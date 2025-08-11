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

function computeFromEmpty(totalVolume, targetEPercent, gasolineEthanolFraction) {
  const T = Math.max(0, totalVolume)
  const Et = Math.max(0, Math.min(1, (Number(targetEPercent) || 0) / 100))
  const Eg = Math.max(0, Math.min(1, gasolineEthanolFraction))

  if (T <= 0) return { addEthanol: 0, addGasoline: 0, finalEPercent: targetEPercent, valid: false, reason: 'Informe um volume final.' }
  if (Et > 1) return { addEthanol: 0, addGasoline: 0, finalEPercent: 0, valid: false, reason: 'E% desejado acima de 100%.' }

  // Usando duas fontes: E100 (Ea=1) e gasolina BR (Ea=Eg)
  // Sistema: x + y = T; (x + Eg*y)/T = Et
  // => x = T*(Et - Eg)/(1 - Eg), y = T - x = T*(1 - Et)/(1 - Eg)
  const denom = 1 - Eg
  if (Math.abs(denom) < 1e-9) {
    // Gasolina com 100% de etanol não faz sentido, mas evitamos divisão por zero
    return { addEthanol: T * Et, addGasoline: T * (1 - Et), finalEPercent: Et * 100, valid: true, reason: '' }
  }

  // Faixa atingível: Et in [Eg, 1]
  if (Et < Eg - 1e-9) {
    return { addEthanol: 0, addGasoline: 0, finalEPercent: Eg * 100, valid: false, reason: `Com a gasolina selecionada (≈E${round(Eg*100,0)}), o mínimo atingível é E${round(Eg*100,0)}. Para menos, use gasolina E0.` }
  }

  const x = T * (Et - Eg) / denom // E100
  const y = T - x // Gasolina BR

  const xSafe = Math.max(0, Math.min(T, x))
  const ySafe = Math.max(0, Math.min(T, y))

  return { addEthanol: xSafe, addGasoline: ySafe, finalEPercent: Et * 100, valid: true, reason: '' }
}

export default function App() {
  const [unit, setUnit] = useLocalStorage('unit', 'L')
  const [targetE, setTargetE] = useLocalStorage('targetE', 50)
  const [totalVolumeInput, setTotalVolumeInput] = useLocalStorage('totalVolume', 40)
  const [brGasTypeId, setBrGasTypeId] = useLocalStorage('br_gas_type', 'E27')
  const [presets, setPresets] = useLocalStorage('presets', [
    { id: 'E30', name: 'E30', targetE: 30 },
    { id: 'E50', name: 'E50', targetE: 50 },
    { id: 'E85', name: 'E85', targetE: 85 },
  ])

  const selectedGas = BR_GAS_TYPES.find(g => g.id === brGasTypeId) || BR_GAS_TYPES[0]

  const totalVolumeLiters = useMemo(
    () => toBaseLiters(Number(totalVolumeInput) || 0, unit === 'gal' ? 'gal' : 'L'),
    [totalVolumeInput, unit]
  )

  const result = useMemo(() => computeFromEmpty(totalVolumeLiters, Number(targetE) || 0, selectedGas.ethanolFraction), [totalVolumeLiters, targetE, selectedGas.ethanolFraction])

  const ethanolInUnit = fromBaseLiters(result.addEthanol, unit === 'gal' ? 'gal' : 'L')
  const gasolineInUnit = fromBaseLiters(result.addGasoline, unit === 'gal' ? 'gal' : 'L')

  const ratioEthanol = useMemo(() => Math.max(0, Math.min(1, (Number(targetE) || 0) / 100)), [targetE])

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
        <div className="brand-title">Mistura do Zero</div>
      </div>

      <section className="panel">
        <div className="panel-body">
          <div className="row">
            <div className="control">
              <label>Volume final desejado ({unitLabel})</label>
              <input className="input" type="number" min="0" step="0.1" value={totalVolumeInput} onChange={(e)=> setTotalVolumeInput(e.target.value)} />
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
              <div className="help">Comum/Aditivada ≈ 27% etanol; Premium/Podium ≈ 25%.</div>
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
                <div className="label">Etanol (E100) a adicionar</div>
                <div className="value">{pretty(ethanolInUnit)} {unitLabel}</div>
              </div>
              <div className="result">
                <div className="label">Gasolina a adicionar</div>
                <div className="value">{pretty(gasolineInUnit)} {unitLabel}</div>
              </div>
              <div className="result">
                <div className="label">E% final</div>
                <div className="value">{round(result.finalEPercent, 1)}%</div>
              </div>
              <div className="result">
                <div className="label">Volume final</div>
                <div className="value">{pretty(fromBaseLiters(totalVolumeLiters, unit === 'gal' ? 'gal' : 'L'))} {unitLabel}</div>
              </div>
            </div>

            {!result.valid && (
              <div className="help">{result.reason}</div>
            )}

            <div className="footer-note">Mistura a partir do tanque vazio, usando E100 e gasolina BR selecionada.</div>
          </div>
        </div>
      </section>
    </div>
  )
}
