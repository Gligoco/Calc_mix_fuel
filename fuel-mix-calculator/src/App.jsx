import React, { useEffect, useMemo, useState } from 'react'
import FuelPBR from './components/FuelPBR'

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
  const [hasCalculated, setHasCalculated] = useState(false)
  const [playKey, setPlayKey] = useState(0)

  const selectedGas = BR_GAS_TYPES.find(g => g.id === brGasTypeId) || BR_GAS_TYPES[0]

  const totalVolumeLiters = useMemo(
    () => toBaseLiters(Number(totalVolumeInput) || 0, unit === 'gal' ? 'gal' : 'L'),
    [totalVolumeInput, unit]
  )

  const result = useMemo(() => computeFromEmpty(totalVolumeLiters, Number(targetE) || 0, selectedGas.ethanolFraction), [totalVolumeLiters, targetE, selectedGas.ethanolFraction])

  const ethanolInUnit = fromBaseLiters(result.addEthanol, unit === 'gal' ? 'gal' : 'L')
  const gasolineInUnit = fromBaseLiters(result.addGasoline, unit === 'gal' ? 'gal' : 'L')

  const ratioEthanol = useMemo(() => Math.max(0, Math.min(1, (Number(targetE) || 0) / 100)), [targetE])

  const unitLabel = unit === 'gal' ? 'gal' : 'L'
  const ethanolWidth = `${round(ratioEthanol * 100, 1)}%`
  const pretty = (v) => (v === Infinity ? '∞' : round(v, unit === 'gal' ? 1 : 1))

  function handleCalc() { setHasCalculated(true); setPlayKey(k => k + 1) }
  function handleReset() { window.location.reload() }

  // Proportions for animation
  const ethanolPct = Math.max(0, Math.min(1, Number(targetE) / 100))

  return (
    <div className="rp-app">
      <div className="rp-topbar" role="banner">
        <div />
        <div className="rp-header-stack">
          <div className="rp-title">Calculadora de mistura</div>
          <div className="rp-subtitle">
            Race Performance
            <a className="rp-ig-icon" href="https://www.instagram.com/raceperformance_/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" stroke="currentColor" strokeWidth="1"/></svg>
            </a>
          </div>
        </div>
        <div />
      </div>

      <div className="rp-shell">
        <div className="rp-inputs-wrapper">
          <div className="rp-inputs">
            <div className="rp-group">
              <div className="rp-group-title">Tanque</div>
              <div className="rp-row">
                <div className="rp-label">Volume final desejado ({unitLabel === 'gal' ? 'gal' : 'L'})</div>
                <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                  <input className="rp-input" type="number" min="0" step="0.1" value={totalVolumeInput} onChange={(e)=> setTotalVolumeInput(e.target.value)} />
                  <input className="rp-slider" type="range" min="0" max="200" step="0.1" value={Number(unit === 'gal' ? totalVolumeInput : totalVolumeInput)} onChange={(e)=> setTotalVolumeInput(e.target.value)} />
                </div>
              </div>
              <div className="rp-row">
                <div className="rp-label">Unidades</div>
                <div className="input-wrap" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button className="rp-chip" aria-pressed={unit==='L'} onClick={()=> setUnit('L')}>Litros</button>
                  <button className="rp-chip" aria-pressed={unit==='gal'} onClick={()=> setUnit('gal')}>Galões</button>
                </div>
              </div>
            </div>

            <div className="rp-group">
              <div className="rp-group-title">Alvo</div>
              <div className="rp-row">
                <div className="rp-label">% de etanol desejada</div>
                <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                  <input className="rp-input" type="number" min="0" max="100" step="0.1" value={targetE} onChange={(e)=> setTargetE(e.target.value)} />
                  <input className="rp-slider" type="range" min="0" max="100" step="0.1" value={Number(targetE)} onChange={(e)=> setTargetE(e.target.value)} />
                </div>
              </div>
              <div className="rp-tank" title={`Etanol ${ethanolWidth}`}>
                <div className="eth" style={{ width: ethanolWidth }} />
                <div className="label">E{round(Number(targetE)||0,0)}</div>
              </div>

              <div className="rp-row">
                <div className="rp-label">Tipo de gasolina (BR)</div>
                <select className="rp-select" value={brGasTypeId} onChange={(e)=> setBrGasTypeId(e.target.value)}>
                  {BR_GAS_TYPES.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
                </select>
                <div className="rp-label" style={{ fontSize: 11 }}>Comum/Aditivada ≈ 27% • Premium/Podium ≈ 25%</div>
              </div>

              <div className="cta-row">
                {!hasCalculated ? (
                  <button className="rp-cta" onClick={handleCalc}>CALCULAR</button>
                ) : (
                  <button className="rp-cta" onClick={handleReset}>RECOMEÇAR</button>
                )}
              </div>

              {hasCalculated && (
                <div className="results-block">
                  <div className="results-kpis">
                    <div className="item">
                      <div className="label">Etanol (E100)</div>
                      <div className="value">{pretty(ethanolInUnit)} {unitLabel}</div>
                    </div>
                    <div className="item">
                      <div className="label">Gasolina</div>
                      <div className="value">{pretty(gasolineInUnit)} {unitLabel}</div>
                    </div>
                    <div className="item">
                      <div className="label">E% final</div>
                      <div className="value">{round(result.finalEPercent, 1)}%</div>
                    </div>
                  </div>

                  {/* Three.js PBR-based animation */}
                  <FuelPBR ethanolFraction={ethanolPct} playKey={playKey} reducedMotion={window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rp-footer">
        <div className="rp-footer-note">Desenvolvido por Gabriel Cappello Machado.</div>
        <div className="rp-footer-link"><a href="https://www.instagram.com/autostatt_" target="_blank" rel="noopener noreferrer">meu Instagram</a></div>
      </div>
    </div>
  )
}
