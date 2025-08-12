import React, { useEffect, useMemo, useState } from 'react'
import rpLogo from '/assets/IMG_6442.jpeg'

const ETH_OPTIONS = [
  { id: 'hidratado', name: 'Hidratado (≈95,5%)', Eeth: 0.955 },
  { id: 'anidro', name: 'Anidro (≈99,6%)', Eeth: 0.996 },
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

// ---------- Simple Mode ----------
// Ethanol_liters = Vtotal * (Etarget - Eg) / (Eethanol - Eg)
// Gasoline_liters = Vtotal - Ethanol_liters
function computeSimple(Vtotal_liters, Etarget_pct, Eg, Eeth) {
  const V = Number(Vtotal_liters) || 0
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

// ---------- Advanced Mode ----------
// Adding ethanol: X = Y*(Etarget - Eg)/(Eeth - Etarget) where Y = liters of gasoline in tank = A*(1 - Ec)
// Adding gasoline: X = A*(Ec - Etarget)/(Etarget - Eg)
function computeAdvanced(A_liters, Ec_pct, Etarget_pct, Eg, Eeth) {
  const A = Number(A_liters) || 0
  const Ec = Math.max(0, Math.min(1, (Number(Ec_pct) || 0) / 100))
  const Et = Math.max(0, Math.min(1, (Number(Etarget_pct) || 0) / 100))
  if (A <= 0) return { ok: false, msg: 'Informe o volume atual (A) > 0.', fuel: '', X: 0 }

  // Decide direction: subir ou descer E%
  if (Et > Ec) {
    // Add ethanol
    if (Et < Math.min(Eg, Eeth) || Et > Math.max(Eg, Eeth)) return { ok: false, msg: 'E% alvo fora do intervalo entre E_g e E_etanol.', fuel: '', X: 0 }
    const Y = A * (1 - Ec) // gasolina no tanque
    const denom = (Eeth - Et)
    if (Math.abs(denom) < 1e-9) return { ok: false, msg: 'Divisão por zero. Ajuste E_alvo.', fuel: '', X: 0 }
    const X = Y * (Et - Eg) / denom
    if (X <= 0) return { ok: false, msg: 'Impossível atingir E% alvo adicionando etanol.', fuel: '', X: 0 }
    return { ok: true, msg: '', fuel: 'Etanol a adicionar', X }
  } else if (Et < Ec) {
    // Add gasoline
    if (Et < Math.min(Eg, Ec) || Et > Math.max(Eg, Ec)) return { ok: false, msg: 'E% alvo fora do intervalo entre E_g e E_c.', fuel: '', X: 0 }
    const denom = (Et - Eg)
    if (Math.abs(denom) < 1e-9) return { ok: false, msg: 'Divisão por zero. Ajuste E_alvo.', fuel: '', X: 0 }
    const X = A * (Ec - Et) / denom
    if (X <= 0) return { ok: false, msg: 'Impossível atingir E% alvo adicionando gasolina.', fuel: '', X: 0 }
    return { ok: true, msg: '', fuel: 'Gasolina a adicionar', X }
  }

  // Et == Ec
  return { ok: false, msg: 'E% alvo igual ao E% atual.', fuel: '', X: 0 }
}

export default function App() {
  const [mode, setMode] = useLocalStorage('mode', 'simple') // 'simple' | 'advanced'

  // Common selectors
  const [gasClass, setGasClass] = useLocalStorage('gasClass', 'comum') // 'comum' | 'podium'
  const [comumReg, setComumReg] = useLocalStorage('comumReg', 'E27') // 'E27' | 'E30'
  const [EgPodiumPct, setEgPodiumPct] = useLocalStorage('EgPodiumPct', 25) // adjustable in settings
  const [ethId, setEthId] = useLocalStorage('ethId', 'hidratado')
  const eth = ETH_OPTIONS.find(e => e.id === ethId) || ETH_OPTIONS[0]

  const Eg = useMemo(() => {
    if (gasClass === 'comum') return comumReg === 'E30' ? 0.30 : 0.27
    return Math.max(0, Math.min(1, Number(EgPodiumPct) / 100))
  }, [gasClass, comumReg, EgPodiumPct])

  // Simple inputs
  const [Vtotal, setVtotal] = useLocalStorage('Vtotal', 40)
  const [EtargetSimple, setEtargetSimple] = useLocalStorage('EtargetSimple', 60)

  // Advanced inputs
  const [A, setA] = useLocalStorage('A', 20)
  const [Ec, setEc] = useLocalStorage('Ec', 40)
  const [EtargetAdv, setEtargetAdv] = useLocalStorage('EtargetAdv', 60)

  const [hasCalculated, setHasCalculated] = useState(false)
  function handleCalc() { setHasCalculated(true) }
  function handleReset() { window.location.reload() }

  const simpleRes = useMemo(() => {
    if (mode !== 'simple') return { ok: false, xe: 0, yg: 0, msg: '' }
    return computeSimple(Vtotal, EtargetSimple, Eg, eth.Eeth)
  }, [mode, Vtotal, EtargetSimple, Eg, eth.Eeth])

  const advRes = useMemo(() => {
    if (mode !== 'advanced') return { ok: false, fuel: '', X: 0, msg: '' }
    return computeAdvanced(A, Ec, EtargetAdv, Eg, eth.Eeth)
  }, [mode, A, Ec, EtargetAdv, Eg, eth.Eeth])

  const barPercent = mode === 'simple' ? Number(EtargetSimple) : Number(EtargetAdv)
  const barWidth = `${round(Math.max(0, Math.min(100, barPercent || 0)), 1)}%`

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
              <div className="rp-group-title">Modo</div>
              <div className="rp-chips">
                <button className="rp-chip" aria-pressed={mode==='simple'} onClick={()=> setMode('simple')}>Simple Mode</button>
                <button className="rp-chip" aria-pressed={mode==='advanced'} onClick={()=> setMode('advanced')}>Advanced Mode</button>
              </div>
            </div>

            <div className="rp-group">
              <div className="rp-group-title">Parâmetros do combustível</div>
              <div className="rp-row">
                <div className="rp-label">Gasolina</div>
                <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                  <select className="rp-select" value={gasClass} onChange={(e)=> setGasClass(e.target.value)}>
                    <option value="comum">Comum (E27/E30)</option>
                    <option value="podium">Pódium (ajustável)</option>
                  </select>
                </div>
              </div>
              {gasClass === 'comum' ? (
                <div className="rp-row">
                  <div className="rp-label">Regulamentação Comum</div>
                  <div className="input-wrap" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <button className="rp-chip" aria-pressed={comumReg==='E27'} onClick={()=> setComumReg('E27')}>E27</button>
                    <button className="rp-chip" aria-pressed={comumReg==='E30'} onClick={()=> setComumReg('E30')}>E30</button>
                  </div>
                </div>
              ) : (
                <div className="rp-row">
                  <div className="rp-label">E_g Pódium (%)</div>
                  <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                    <input className="rp-input" type="number" min="0" max="100" step="0.1" value={EgPodiumPct} onChange={(e)=> setEgPodiumPct(e.target.value)} />
                  </div>
                </div>
              )}
              <div className="rp-row">
                <div className="rp-label">Tipo de etanol</div>
                <select className="rp-select" value={ethId} onChange={(e)=> setEthId(e.target.value)}>
                  {ETH_OPTIONS.map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
                </select>
              </div>
            </div>

            {mode === 'simple' ? (
              <div className="rp-group">
                <div className="rp-group-title">Simple Mode</div>
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
                    <input className="rp-input" type="number" min="0" max="100" step="0.1" value={EtargetSimple} onChange={(e)=> setEtargetSimple(e.target.value)} />
                    <input className="rp-slider" type="range" min="0" max="100" step="0.1" value={Number(EtargetSimple)} onChange={(e)=> setEtargetSimple(e.target.value)} />
                  </div>
                </div>

                <div className="rp-tank" title={`Etanol ${barWidth}`}>
                  <div className="eth" style={{ width: barWidth }} />
                  <div className="label">E{round(Number(EtargetSimple)||0,0)}</div>
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
                    {simpleRes.ok ? (
                      <div className="results-kpis">
                        <div className="item"><div className="label">Etanol</div><div className="value">{round(simpleRes.xe, 2)} L</div></div>
                        <div className="item"><div className="label">Gasolina</div><div className="value">{round(simpleRes.yg, 2)} L</div></div>
                        <div className="item"><div className="label">E% alvo</div><div className="value">{round(Number(EtargetSimple)||0, 2)}%</div></div>
                      </div>
                    ) : (
                      <div className="rp-footer-note" style={{ color: '#ffb3b3' }}>{simpleRes.msg}</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rp-group">
                <div className="rp-group-title">Advanced Mode</div>
                <div className="rp-row">
                  <div className="rp-label">A — Volume atual (L)</div>
                  <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                    <input className="rp-input" type="number" min="0" step="0.1" value={A} onChange={(e)=> setA(e.target.value)} />
                    <input className="rp-slider" type="range" min="0" max="200" step="0.1" value={Number(A)} onChange={(e)=> setA(e.target.value)} />
                  </div>
                </div>
                <div className="rp-row">
                  <div className="rp-label">E% atual (E_c)</div>
                  <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                    <input className="rp-input" type="number" min="0" max="100" step="0.1" value={Ec} onChange={(e)=> setEc(e.target.value)} />
                    <input className="rp-slider" type="range" min="0" max="100" step="0.1" value={Number(Ec)} onChange={(e)=> setEc(e.target.value)} />
                  </div>
                </div>
                <div className="rp-row">
                  <div className="rp-label">E% alvo</div>
                  <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                    <input className="rp-input" type="number" min="0" max="100" step="0.1" value={EtargetAdv} onChange={(e)=> setEtargetAdv(e.target.value)} />
                    <input className="rp-slider" type="range" min="0" max="100" step="0.1" value={Number(EtargetAdv)} onChange={(e)=> setEtargetAdv(e.target.value)} />
                  </div>
                </div>

                <div className="rp-tank" title={`Etanol ${barWidth}`}>
                  <div className="eth" style={{ width: barWidth }} />
                  <div className="label">E{round(Number(EtargetAdv)||0,0)}</div>
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
                    {advRes.ok ? (
                      <div className="results-kpis">
                        <div className="item"><div className="label">{advRes.fuel}</div><div className="value">{round(advRes.X, 2)} L</div></div>
                        <div className="item"><div className="label">E_g</div><div className="value">{round(Eg*100, 2)}%</div></div>
                        <div className="item"><div className="label">E_etanol</div><div className="value">{round(eth.Eeth*100, 2)}%</div></div>
                      </div>
                    ) : (
                      <div className="rp-footer-note" style={{ color: '#ffb3b3' }}>{advRes.msg}</div>
                    )}
                  </div>
                )}
              </div>
            )}
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
