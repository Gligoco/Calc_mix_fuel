import React, { useEffect, useMemo, useState } from 'react'

const LITERS_PER_GALLON = 3.78541

const BR_GAS_TYPES = [
  { id: 'E27', name: 'Gasolina Comum/Aditivada (≈E27)', ethanolFraction: 0.27 },
  { id: 'E25', name: 'Gasolina Premium/Podium (≈E25)', ethanolFraction: 0.25 },
]

function round(value, decimals = 2) {
  if (!isFinite(value)) return 0
  const p = Math.pow(10, decimals)
  return Math.round(value * p) / p
}

function toBaseLiters(value, unit) {
  if (!value || isNaN(value)) return 0
  return unit === 'gal' ? value * LITERS_PER_GALLON : value
}

function fromBaseLiters(liters, unit) {
  return unit === 'gal' ? liters / LITERS_PER_GALLON : liters
}

function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initialValue
    } catch {
      return initialValue
    }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)) } catch {} }, [key, state])
  return [state, setState]
}

function computeMixWithAddedFuel(currentVolume, currentEPercent, targetEPercent, addedFuelEthanolFraction) {
  const A = Math.max(0, currentVolume)
  const Ec = Math.max(0, Math.min(1, currentEPercent / 100))
  const Et = Math.max(0, Math.min(1, targetEPercent / 100))
  const Ea = Math.max(0, Math.min(1, addedFuelEthanolFraction))

  if (A <= 0) return { addAmount: 0, finalVolume: 0, finalEPercent: targetEPercent, valid: false, reason: 'Sem combustível no tanque.' }

  const denom = Et - Ea
  if (Math.abs(denom) < 1e-9) {
    if (Math.abs(Ec - Et) < 1e-9) {
      return { addAmount: 0, finalVolume: A, finalEPercent: Et * 100, valid: true, reason: '' }
    }
    return { addAmount: Infinity, finalVolume: Infinity, finalEPercent: Et * 100, valid: false, reason: 'Alvo igual ao etanol do combustível a ser adicionado; volume infinito seria necessário.' }
  }

  const x = (A * (Ec - Et)) / denom
  if (!isFinite(x) || x < 0) {
    return { addAmount: 0, finalVolume: A, finalEPercent: Ec * 100, valid: false, reason: 'Alvo inalcançável adicionando apenas esse combustível.' }
  }

  const finalVolume = A + x
  const finalEPercent = finalVolume > 0 ? ((A * Ec + x * Ea) / finalVolume) * 100 : 0
  // Sanity: final should be between Ec and Ea
  const min = Math.min(Ec, Ea) - 1e-6
  const max = Math.max(Ec, Ea) + 1e-6
  const EtFrac = finalEPercent / 100
  const inRange = EtFrac >= min && EtFrac <= max

  return { addAmount: x, finalVolume, finalEPercent, valid: inRange, reason: inRange ? '' : 'Fora da faixa atingível pela mistura.' }
}

export default function App() {
  const [unit, setUnit] = useLocalStorage('unit', 'L')
  const [currentVolumeInput, setCurrentVolumeInput] = useLocalStorage('currentVolume', 30)
  const [currentE, setCurrentE] = useLocalStorage('currentE', 10)
  const [targetE, setTargetE] = useLocalStorage('targetE', 50)
  const [brGasTypeId, setBrGasTypeId] = useLocalStorage('br_gas_type', 'E27')
  const [presets, setPresets] = useLocalStorage('presets', [
    { id: 'E30', name: 'E30', targetE: 30 },
    { id: 'E50', name: 'E50', targetE: 50 },
    { id: 'E85', name: 'E85', targetE: 85 },
  ])

  const selectedGas = BR_GAS_TYPES.find(g => g.id === brGasTypeId) || BR_GAS_TYPES[0]

  const currentVolumeLiters = useMemo(
    () => toBaseLiters(Number(currentVolumeInput) || 0, unit === 'gal' ? 'gal' : 'L'),
    [currentVolumeInput, unit]
  )

  const ethanolCandidate = useMemo(() => computeMixWithAddedFuel(currentVolumeLiters, Number(currentE) || 0, Number(targetE) || 0, 1.0), [currentVolumeLiters, currentE, targetE])
  const gasolineCandidate = useMemo(() => computeMixWithAddedFuel(currentVolumeLiters, Number(currentE) || 0, Number(targetE) || 0, selectedGas.ethanolFraction), [currentVolumeLiters, currentE, targetE, selectedGas.ethanolFraction])

  const decision = useMemo(() => {
    const options = []
    if (ethanolCandidate.valid && isFinite(ethanolCandidate.addAmount)) options.push({ mode: 'ethanol', result: ethanolCandidate })
    if (gasolineCandidate.valid && isFinite(gasolineCandidate.addAmount)) options.push({ mode: 'gasoline', result: gasolineCandidate })

    if (options.length === 0) {
      // Fallback suggestion based on direction
      const Ec = (Number(currentE) || 0) / 100
      const Et = (Number(targetE) || 0) / 100
      const needs = Et > Ec ? 'ethanol' : 'gasoline'
      const reason = needs === 'gasoline' && Et < selectedGas.ethanolFraction
        ? `Impossível atingir E${round(Et*100,1)} adicionando ${selectedGas.name.replace(/ \(.*\)/,'')} (mínimo ≈ ${round(selectedGas.ethanolFraction*100,0)}%). Drene combustível ou use gasolina E0.`
        : 'Alvo inalcançável apenas adicionando combustível.'
      return { mode: needs, result: { addAmount: 0, finalVolume: currentVolumeLiters, finalEPercent: currentE, valid: false, reason } }
    }

    // Choose smallest positive addition
    options.sort((a, b) => a.result.addAmount - b.result.addAmount)
    return options[0]
  }, [ethanolCandidate, gasolineCandidate, currentE, targetE, currentVolumeLiters, selectedGas])

  const chosenMode = decision.mode
  const result = decision.result

  const ethanolToAddL = chosenMode === 'ethanol' ? result.addAmount : 0
  const gasolineToAddL = chosenMode === 'gasoline' ? result.addAmount : 0

  const ethanolAddInUnit = fromBaseLiters(ethanolToAddL, unit === 'gal' ? 'gal' : 'L')
  const gasolineAddInUnit = fromBaseLiters(gasolineToAddL, unit === 'gal' ? 'gal' : 'L')
  const finalVolumeInUnit = fromBaseLiters(result.finalVolume, unit === 'gal' ? 'gal' : 'L')

  const ratioEthanol = useMemo(() => {
    const finalV = Math.max(0.0001, result.finalVolume)
    const Ec = (Number(currentE) || 0) / 100
    const finalEthanolVolume = currentVolumeLiters * Ec + (chosenMode === 'ethanol' ? ethanolToAddL * 1.0 : gasolineToAddL * selectedGas.ethanolFraction)
    return Math.max(0, Math.min(1, finalEthanolVolume / finalV))
  }, [result.finalVolume, currentVolumeLiters, currentE, ethanolToAddL, gasolineToAddL, chosenMode, selectedGas.ethanolFraction])

  function handleSavePreset() {
    const name = `E${targetE}`
    const id = `${name}-${Date.now()}`
    setPresets([{ id, name, targetE: Number(targetE) }, ...presets].slice(0, 12))
  }

  const unitLabel = unit === 'gal' ? 'gal' : 'L'
  const ethanolWidth = `${round(ratioEthanol * 100, 1)}%`
  const pretty = (v) => (v === Infinity ? '∞' : round(v, unit === 'gal' ? 2 : 2))

  return (
    <div className="container">
      <div className="header-min">
        <div className="brand-logo" />
        <div className="brand-title">Calculadora de Mistura</div>
      </div>

      <section className="panel">
        <div className="panel-body">
          <div className="row">
            <div className="control">
              <label>Combustível no tanque ({unitLabel})</label>
              <input className="input" type="number" min="0" step="0.1" value={currentVolumeInput} onChange={(e)=> setCurrentVolumeInput(e.target.value)} />
            </div>

            <div className="control">
              <label>E% atual</label>
              <input className="input" type="number" min="0" max="100" step="1" value={currentE} onChange={(e)=> setCurrentE(e.target.value)} />
              <input className="range" type="range" min="0" max="100" step="1" value={currentE} onChange={(e)=> setCurrentE(e.target.value)} />
            </div>

            <div className="control">
              <label>E% desejado (alvo)</label>
              <input className="input" type="number" min="0" max="100" step="1" value={targetE} onChange={(e)=> setTargetE(e.target.value)} />
              <input className="range" type="range" min="0" max="100" step="1" value={targetE} onChange={(e)=> setTargetE(e.target.value)} />
            </div>

            <div className="control">
              <label>Tipo de gasolina (BR)</label>
              <select className="select" value={brGasTypeId} onChange={(e)=> setBrGasTypeId(e.target.value)}>
                {BR_GAS_TYPES.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
              </select>
              <div className="help">A comum/aditivada ≈ 27% etanol; a Podium/Premium ≈ 25%.</div>
            </div>

            <div className="inline">
              <label>Unidades</label>
              <div className="unit-toggle">
                <button className={unit !== 'gal' ? 'active' : ''} onClick={()=> setUnit('L')}>L</button>
                <button className={unit === 'gal' ? 'active' : ''} onClick={()=> setUnit('gal')}>gal</button>
              </div>
            </div>

            <div className="actions">
              <button className="button" onClick={handleSavePreset}>Salvar preset E{targetE}</button>
            </div>

            {presets.length > 0 && (
              <div className="presets">
                {presets.map(p => (<button key={p.id} className="chip" onClick={()=> setTargetE(p.targetE)}>{p.name}</button>))}
              </div>
            )}

            <div className="mixbar" title={`Etanol ${ethanolWidth}`}>
              <div className="ethanol" style={{ width: ethanolWidth }} />
            </div>

            <div className="results">
              <div className="result">
                <div className="label">Adicionar</div>
                <div className="value">{chosenMode === 'ethanol' ? 'Etanol (E100)' : `${selectedGas.name}`}</div>
              </div>
              <div className="result">
                <div className="label">Quantidade</div>
                <div className="value">{chosenMode === 'ethanol' ? pretty(ethanolAddInUnit) : pretty(gasolineAddInUnit)} {unitLabel}</div>
              </div>
              <div className="result">
                <div className="label">Volume final</div>
                <div className="value">{pretty(finalVolumeInUnit)} {unitLabel}</div>
              </div>
              <div className="result">
                <div className="label">E% final</div>
                <div className="value">{round(result.finalEPercent, 1)}%</div>
              </div>
            </div>

            {!result.valid && (
              <div className="help">{result.reason}</div>
            )}

            <div className="footer-note">Leva em conta o etanol presente na gasolina brasileira selecionada.</div>
          </div>
        </div>
      </section>
    </div>
  )
}
