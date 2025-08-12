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

  const denom = 1 - Eg
  if (Math.abs(denom) < 1e-9) {
    return { addEthanol: T * Et, addGasoline: T * (1 - Et), finalEPercent: Et * 100, valid: true, reason: '' }
  }

  if (Et < Eg - 1e-9) {
    return { addEthanol: 0, addGasoline: 0, finalEPercent: Eg * 100, valid: false, reason: `Com a gasolina selecionada (≈E${round(Eg*100,0)}), o mínimo atingível é E${round(Eg*100,0)}. Para menos, use gasolina E0.` }
  }

  const x = T * (Et - Eg) / denom
  const y = T - x

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
  const [showAdvanced, setShowAdvanced] = useState(false)

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
  const segIndex = 1

  return (
    <div className="rp-app">
      <div className="rp-topbar">
        <div className="rp-top-left">
          <div className="rp-logo" />
          <div className="rp-title">Race Performance</div>
        </div>
      </div>

      <div className="rp-shell">
        <div className="rp-seg" style={{ ['--seg-index']: segIndex }}>
          <div className="highlight" />
          <button className="item" aria-selected={false}>Tanque vazio</button>
          <button className="item" aria-selected={true}>Mistura</button>
          <button className="item" aria-selected={false}>Avançado</button>
        </div>

        <div className="rp-chips">
          {presets.slice(0,3).map(p => (
            <button key={p.id} className="rp-chip" aria-pressed={Number(targetE) === p.targetE} onClick={()=> setTargetE(p.targetE)}>{p.name}</button>
          ))}
        </div>

        <div className="rp-inputs-wrapper">
          <div className="rp-inputs">
            <div className="rp-group">
              <div className="rp-group-title">Tank Info</div>
              <div className="rp-row">
                <div className="rp-label">Volume final ({unitLabel})</div>
                <div className="rp-field">
                  <input type="number" min="0" step="0.1" value={totalVolumeInput} onChange={(e)=> setTotalVolumeInput(e.target.value)} />
                  <button className="rp-step" onClick={()=> setTotalVolumeInput(v => String(Math.max(0, (Number(v)||0) - (unit==='gal'?0.5:1))))}>-</button>
                  <button className="rp-step" onClick={()=> setTotalVolumeInput(v => String((Number(v)||0) + (unit==='gal'?0.5:1)))}>+</button>
                </div>
              </div>
              <div className="rp-row">
                <div className="rp-label">Unidades</div>
                <div className="rp-field" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <button className="rp-chip" aria-pressed={unit==='L'} onClick={()=> setUnit('L')}>L</button>
                  <button className="rp-chip" aria-pressed={unit==='gal'} onClick={()=> setUnit('gal')}>gal</button>
                </div>
              </div>
            </div>

            <div className="rp-group">
              <div className="rp-group-title">Target Info</div>
              <div className="rp-row">
                <div className="rp-label">E% desejado</div>
                <div className="rp-field">
                  <input type="number" min="0" max="100" step="1" value={targetE} onChange={(e)=> setTargetE(e.target.value)} />
                  <button className="rp-step" onClick={()=> setTargetE(v => String(Math.max(0, (Number(v)||0) - 1)))}>-</button>
                  <button className="rp-step" onClick={()=> setTargetE(v => String(Math.min(100, (Number(v)||0) + 1)))}>+</button>
                </div>
              </div>
              <div className="rp-row">
                <div className="rp-label">Gasolina (BR)</div>
                <div className="rp-field" style={{ gridTemplateColumns: '1fr' }}>
                  <select value={brGasTypeId} onChange={(e)=> setBrGasTypeId(e.target.value)}>
                    {BR_GAS_TYPES.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
                  </select>
                </div>
                <div className="rp-label" style={{ fontSize: 11 }}>Comum/Aditivada ≈ 27% • Premium/Podium ≈ 25%</div>
              </div>
            </div>

            <div className="rp-group">
              <button className="rp-chip" aria-pressed={false} onClick={()=> setShowAdvanced(v=>!v)}>{showAdvanced ? 'Advanced ▾' : 'Advanced ▸'}</button>
              {showAdvanced && (
                <div className="rp-row" style={{ marginTop: 8 }}>
                  <button className="rp-chip" aria-pressed={false} onClick={handleSavePreset}>Salvar preset E{targetE}</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rp-tank" title={`Etanol ${ethanolWidth}`}>
          <div className="eth" style={{ width: ethanolWidth }} />
          <div className="label">E{round(Number(targetE)||0,0)}</div>
        </div>

        <div style={{ height: 4 }} />
      </div>

      <div className="rp-results">
        <div className="rp-kpis">
          <div className="rp-kpi">
            <div className="k-label">Etanol (E100)</div>
            <div className="k-value">{pretty(ethanolInUnit)} {unitLabel}</div>
          </div>
          <div className="rp-kpi">
            <div className="k-label">Gasolina</div>
            <div className="k-value">{pretty(gasolineInUnit)} {unitLabel}</div>
          </div>
          <div className="rp-kpi">
            <div className="k-label">E% final</div>
            <div className="k-value">{round(result.finalEPercent, 1)}%</div>
          </div>
        </div>
        <button className="rp-cta" onClick={handleSavePreset}>Salvar</button>
      </div>
    </div>
  )
}
