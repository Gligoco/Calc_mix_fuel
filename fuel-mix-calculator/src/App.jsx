import React, { useEffect, useMemo, useState } from 'react'
import rpLogo from '/assets/IMG_6442.jpeg'

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

// Simple: Vtotal, Etarget, Eg (by gasolina), Eeth=0.955
// Ethanol = V*(Et - Eg)/(Eeth - Eg), Gasoline = V - Ethanol
function computeSimple(V_liters, Etarget_pct, Eg, Eeth = 0.955) {
  const V = Number(V_liters) || 0
  const Et = Math.max(0, Math.min(1, (Number(Etarget_pct) || 0) / 100))
  if (V <= 0) return { ok: false, msg: 'Informe o volume total (L).', xe: 0, yg: 0 }
  if (Et < Math.min(Eg, Eeth) || Et > Math.max(Eg, Eeth)) return { ok: false, msg: 'E% alvo fora do intervalo entre E_g e E_etanol.', xe: 0, yg: 0 }
  const denom = (Eeth - Eg)
  if (Math.abs(denom) < 1e-9) return { ok: false, msg: 'Parâmetros inválidos.', xe: 0, yg: 0 }
  const xe = V * (Et - Eg) / denom
  const yg = V - xe
  if (xe < 0 || yg < 0) return { ok: false, msg: 'Mistura inviável com os valores atuais.', xe: 0, yg: 0 }
  return { ok: true, msg: '', xe, yg }
}

export default function App() {
  const [gasClass, setGasClass] = useLocalStorage('gasClass', 'comum') // 'comum' | 'podium'
  const Eg = gasClass === 'podium' ? 0.25 : 0.27

  const [Vtotal, setVtotal] = useLocalStorage('Vtotal', 40)
  const [Etarget, setEtarget] = useLocalStorage('Etarget', 60)

  const [hasCalculated, setHasCalculated] = useLocalStorage('hasCalculated', true)
  useEffect(() => { setHasCalculated(true) }, [])
  function handleCalc() { setHasCalculated(true) }
  function handleReset() { window.location.reload() }

  const res = useMemo(() => computeSimple(Vtotal, Etarget, Eg, 0.955), [Vtotal, Etarget, Eg])

  const barWidth = `${round(Math.max(0, Math.min(100, Number(Etarget) || 0)), 1)}%`

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
              <div className="rp-group-title">Parâmetros</div>
              <div className="rp-row">
                <div className="rp-label">Gasolina</div>
                <div className="input-wrap" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <button className="rp-chip" aria-pressed={gasClass==='comum'} onClick={()=> setGasClass('comum')}>Comum</button>
                  <button className="rp-chip" aria-pressed={gasClass==='podium'} onClick={()=> setGasClass('podium')}>Pódium</button>
                </div>
              </div>
              <div className="rp-row">
                <div className="rp-label">Volume total desejado (L)</div>
                <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                  <input className="rp-input" type="number" min="0" step="0.1" value={Vtotal} onChange={(e)=> setVtotal(e.target.value)} />
                  <input className="rp-slider" type="range" min="0" max="200" step="0.1" value={Number(Vtotal)} onChange={(e)=> setVtotal(e.target.value)} />
                </div>
              </div>
              <div className="rp-row">
                <div className="rp-label">E% alvo</div>
                <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                  <input className="rp-input" type="number" min="0" max="100" step="0.1" value={Etarget} onChange={(e)=> setEtarget(e.target.value)} />
                  <input className="rp-slider" type="range" min="0" max="100" step="0.1" value={Number(Etarget)} onChange={(e)=> setEtarget(e.target.value)} />
                </div>
              </div>

              <div className="rp-tank" title={`Etanol ${barWidth}`}>
                <div className="eth" style={{ width: barWidth }} />
                <div className="label">E{round(Number(Etarget)||0,0)}</div>
              </div>

              {hasCalculated && (
                <div className="results-block">
                  {res.ok ? (
                    <div className="results-kpis">
                      <div className="item"><div className="label">Etanol</div><div className="value">{round(res.xe, 2)} L</div></div>
                      <div className="item"><div className="label">Gasolina ({gasClass === 'comum' ? 'Comum' : 'Pódium'})</div><div className="value">{round(res.yg, 2)} L</div></div>
                    </div>
                  ) : (
                    <div className="rp-footer-note" style={{ color: '#ffb3b3' }}>{res.msg}</div>
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
  )}
