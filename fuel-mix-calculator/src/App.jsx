import React, { useEffect, useMemo, useState } from 'react'
import rpLogo from '/assets/IMG_6442.jpeg'

const BR_GAS_TYPES = [
  { id: 'E27', name: 'Gasolina Comum/Aditivada (≈E27)', Eg: 0.27 },
  { id: 'E25', name: 'Gasolina Premium/Podium (≈E25)', Eg: 0.25 },
]

function round(value, decimals = 2) {
  if (!isFinite(value)) return 0
  const p = Math.pow(10, decimals)
  return Math.round(value * p) / p
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

// From empty mixing with Gasoline C (Eg) and Ethanol E100 (Eeth = 1)
// x = T*(Et - Eg)/(1 - Et), y = T - x
function computeFromEmpty(T_liters, Etarget_percent, Eg) {
  const T = Math.max(0, Number(T_liters) || 0)
  const Et = Math.max(0, Math.min(1, (Number(Etarget_percent) || 0) / 100))
  if (T <= 0) return { ok: false, message: 'Informe o volume final.', x: 0, y: 0, Et }
  if (Et <= Eg) return { ok: false, message: 'E% alvo deve ser maior que o E% da Gasolina C.', x: 0, y: T, Et }
  if (Et >= 1) return { ok: false, message: 'E% alvo deve ser menor que 100%.', x: 0, y: T, Et }
  const denom = 1 - Et
  if (Math.abs(denom) < 1e-9) return { ok: false, message: 'Parâmetros inválidos.', x: 0, y: T, Et }
  const x = T * (Et - Eg) / denom
  const y = T - x
  if (x < 0 || y < 0) return { ok: false, message: 'Mistura inválida com os valores atuais.', x: 0, y: 0, Et }
  return { ok: true, message: '', x, y, Et }
}

export default function App() {
  const [totalVolume, setTotalVolume] = useLocalStorage('totalVolume', 40)
  const [targetE, setTargetE] = useLocalStorage('targetE', 40)
  const [gasTypeId, setGasTypeId] = useLocalStorage('gasType', 'E27')
  const [hasCalculated, setHasCalculated] = useState(false)

  const gas = BR_GAS_TYPES.find(g => g.id === gasTypeId) || BR_GAS_TYPES[0]

  const result = useMemo(() => computeFromEmpty(totalVolume, targetE, gas.Eg), [totalVolume, targetE, gas.Eg])

  const barWidth = `${round(Math.max(0, Math.min(100, Number(targetE) || 0)), 1)}%`

  function handleCalc() { setHasCalculated(true) }
  function handleReset() { window.location.reload() }

  return (
    <div className="rp-app">
      <div className="rp-topbar" role="banner">
        <img className="rp-logo-img" src={rpLogo} alt="Race Performance" />
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
                <div className="rp-label">Volume final desejado (L)</div>
                <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                  <input className="rp-input" type="number" min="0" step="0.1" value={totalVolume} onChange={(e)=> setTotalVolume(e.target.value)} />
                  <input className="rp-slider" type="range" min="0" max="200" step="0.1" value={Number(totalVolume)} onChange={(e)=> setTotalVolume(e.target.value)} />
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
              <div className="rp-tank" title={`Etanol ${barWidth}`}>
                <div className="eth" style={{ width: barWidth }} />
                <div className="label">E{round(Number(targetE)||0,0)}</div>
              </div>

              <div className="rp-row">
                <div className="rp-label">Tipo de gasolina (BR)</div>
                <select className="rp-select" value={gasTypeId} onChange={(e)=> setGasTypeId(e.target.value)}>
                  {BR_GAS_TYPES.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
                </select>
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
                  {result.ok ? (
                    <div className="results-kpis">
                      <div className="item"><div className="label">Etanol</div><div className="value">{round(result.x, 2)} L</div></div>
                      <div className="item"><div className="label">Gasolina</div><div className="value">{round(result.y, 2)} L</div></div>
                      <div className="item"><div className="label">E% alvo</div><div className="value">{round(Number(targetE)||0, 2)}%</div></div>
                    </div>
                  ) : (
                    <div className="rp-footer-note" style={{ color: '#ffb3b3' }}>{result.message}</div>
                  )}
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
