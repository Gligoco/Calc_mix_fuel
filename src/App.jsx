import React, { useEffect, useMemo, useState } from 'react'
import rpLogo from '/assets/IMG_6442.jpeg'

const GAS_OPTIONS = [
  { id: 'E27', name: 'Gasolina C — E27 (27%)', Eg: 0.27 },
  { id: 'E30', name: 'Gasolina C — E30 (30%)', Eg: 0.30 },
]

const ETH_OPTIONS = [
  { id: 'hidratado', name: 'Etanol hidratado (≈95,5%)', Eeth: 0.955 },
  { id: 'anidro', name: 'Etanol anidro (≈99,6%)', Eeth: 0.996 },
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

// X = Y*(Etarget - Eg)/(Eethanol - Etarget)
function computeAddEthanol(Y_liters, Etarget_pct, Eg, Eeth) {
  const Y = Number(Y_liters) || 0
  const Etarget = Math.max(0, Math.min(1, (Number(Etarget_pct) || 0) / 100))
  if (Y <= 0) return { ok: false, msg: 'Informe Y > 0 (Gasolina C em litros).', X: 0 }
  if (Etarget < Math.min(Eg, Eeth) || Etarget > Math.max(Eg, Eeth)) return { ok: false, msg: 'E% alvo fora do intervalo entre Eg e Eetanol.', X: 0 }
  const denom = (Eeth - Etarget)
  if (Math.abs(denom) < 1e-9) return { ok: false, msg: 'Divisão por zero. Ajuste E_alvo.', X: 0 }
  const X = Y * (Etarget - Eg) / denom
  if (X < 0) return { ok: false, msg: 'Resultado negativo. Verifique os valores.', X: 0 }
  return { ok: true, msg: '', X }
}

// X = A*(Ec - Etarget)/(Etarget - Eg)
function computeAddGasoline(A_liters, Ec_pct, Etarget_pct, Eg) {
  const A = Number(A_liters) || 0
  const Ec = Math.max(0, Math.min(1, (Number(Ec_pct) || 0) / 100))
  const Etarget = Math.max(0, Math.min(1, (Number(Etarget_pct) || 0) / 100))
  if (A <= 0) return { ok: false, msg: 'Informe A > 0 (volume atual em litros).', X: 0 }
  if (Etarget < Math.min(Eg, Ec) || Etarget > Math.max(Eg, Ec)) return { ok: false, msg: 'E% alvo fora do intervalo entre Eg e Ec.', X: 0 }
  const denom = (Etarget - Eg)
  if (Math.abs(denom) < 1e-9) return { ok: false, msg: 'Divisão por zero. Ajuste E_alvo.', X: 0 }
  const X = A * (Ec - Etarget) / denom
  if (X < 0) return { ok: false, msg: 'Resultado negativo. Verifique os valores.', X: 0 }
  return { ok: true, msg: '', X }
}

export default function App() {
  // Mode selection
  const [mode, setMode] = useLocalStorage('mode', 'add_ethanol') // 'add_ethanol' | 'add_gasoline'

  // Common selectors
  const [gasId, setGasId] = useLocalStorage('gasId', 'E27')
  const gas = GAS_OPTIONS.find(g => g.id === gasId) || GAS_OPTIONS[0]
  const [ethId, setEthId] = useLocalStorage('ethId', 'hidratado')
  const eth = ETH_OPTIONS.find(e => e.id === ethId) || ETH_OPTIONS[0]

  // Inputs for adding ethanol
  const [Y, setY] = useLocalStorage('Y', 30) // liters of Gasoline C
  const [Etarget1, setEtarget1] = useLocalStorage('Etarget1', 40)

  // Inputs for adding gasoline
  const [A, setA] = useLocalStorage('A', 20) // liters currently in tank
  const [Ec, setEc] = useLocalStorage('Ec', 60) // current ethanol % in tank
  const [Etarget2, setEtarget2] = useLocalStorage('Etarget2', 40)

  const [hasCalculated, setHasCalculated] = useState(false)
  function handleCalc() { setHasCalculated(true) }
  function handleReset() { window.location.reload() }

  const addEthRes = useMemo(() => {
    if (mode !== 'add_ethanol') return { ok: false, X: 0, msg: '' }
    return computeAddEthanol(Y, Etarget1, gas.Eg, eth.Eeth)
  }, [mode, Y, Etarget1, gas.Eg, eth.Eeth])

  const addGasRes = useMemo(() => {
    if (mode !== 'add_gasoline') return { ok: false, X: 0, msg: '' }
    return computeAddGasoline(A, Ec, Etarget2, gas.Eg)
  }, [mode, A, Ec, Etarget2, gas.Eg])

  const barPercent = mode === 'add_ethanol' ? Number(Etarget1) : Number(Etarget2)
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
                <button className="rp-chip" aria-pressed={mode==='add_ethanol'} onClick={()=> setMode('add_ethanol')}>Adicionar etanol</button>
                <button className="rp-chip" aria-pressed={mode==='add_gasoline'} onClick={()=> setMode('add_gasoline')}>Adicionar gasolina</button>
              </div>
            </div>

            <div className="rp-group">
              <div className="rp-group-title">Parâmetros do combustível</div>
              <div className="rp-row">
                <div className="rp-label">Gasolina C (E_g)</div>
                <select className="rp-select" value={gasId} onChange={(e)=> setGasId(e.target.value)}>
                  {GAS_OPTIONS.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
                </select>
              </div>
              <div className="rp-row">
                <div className="rp-label">Etanol adicionado (E_etanol)</div>
                <select className="rp-select" value={ethId} onChange={(e)=> setEthId(e.target.value)}>
                  {ETH_OPTIONS.map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
                </select>
              </div>
            </div>

            {mode === 'add_ethanol' ? (
              <div className="rp-group">
                <div className="rp-group-title">Adicionar etanol</div>
                <div className="rp-row">
                  <div className="rp-label">Y — Gasolina C (L)</div>
                  <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                    <input className="rp-input" type="number" min="0" step="0.1" value={Y} onChange={(e)=> setY(e.target.value)} />
                    <input className="rp-slider" type="range" min="0" max="200" step="0.1" value={Number(Y)} onChange={(e)=> setY(e.target.value)} />
                  </div>
                </div>
                <div className="rp-row">
                  <div className="rp-label">E% alvo</div>
                  <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                    <input className="rp-input" type="number" min="0" max="100" step="0.1" value={Etarget1} onChange={(e)=> setEtarget1(e.target.value)} />
                    <input className="rp-slider" type="range" min="0" max="100" step="0.1" value={Number(Etarget1)} onChange={(e)=> setEtarget1(e.target.value)} />
                  </div>
                </div>

                <div className="rp-tank" title={`Etanol ${barWidth}`}>
                  <div className="eth" style={{ width: barWidth }} />
                  <div className="label">E{round(Number(Etarget1)||0,0)}</div>
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
                    {addEthRes.ok ? (
                      <div className="results-kpis">
                        <div className="item"><div className="label">Etanol a adicionar</div><div className="value">{round(addEthRes.X, 2)} L</div></div>
                        <div className="item"><div className="label">Gasolina C (Y)</div><div className="value">{round(Number(Y)||0, 2)} L</div></div>
                        <div className="item"><div className="label">E% alvo</div><div className="value">{round(Number(Etarget1)||0, 2)}%</div></div>
                      </div>
                    ) : (
                      <div className="rp-footer-note" style={{ color: '#ffb3b3' }}>{addEthRes.msg}</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rp-group">
                <div className="rp-group-title">Adicionar gasolina</div>
                <div className="rp-row">
                  <div className="rp-label">A — Volume atual no tanque (L)</div>
                  <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                    <input className="rp-input" type="number" min="0" step="0.1" value={A} onChange={(e)=> setA(e.target.value)} />
                    <input className="rp-slider" type="range" min="0" max="200" step="0.1" value={Number(A)} onChange={(e)=> setA(e.target.value)} />
                  </div>
                </div>
                <div className="rp-row">
                  <div className="rp-label">E% atual no tanque (E_c)</div>
                  <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                    <input className="rp-input" type="number" min="0" max="100" step="0.1" value={Ec} onChange={(e)=> setEc(e.target.value)} />
                    <input className="rp-slider" type="range" min="0" max="100" step="0.1" value={Number(Ec)} onChange={(e)=> setEc(e.target.value)} />
                  </div>
                </div>
                <div className="rp-row">
                  <div className="rp-label">E% alvo</div>
                  <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                    <input className="rp-input" type="number" min="0" max="100" step="0.1" value={Etarget2} onChange={(e)=> setEtarget2(e.target.value)} />
                    <input className="rp-slider" type="range" min="0" max="100" step="0.1" value={Number(Etarget2)} onChange={(e)=> setEtarget2(e.target.value)} />
                  </div>
                </div>

                <div className="rp-tank" title={`Etanol ${barWidth}`}>
                  <div className="eth" style={{ width: barWidth }} />
                  <div className="label">E{round(Number(Etarget2)||0,0)}</div>
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
                    {addGasRes.ok ? (
                      <div className="results-kpis">
                        <div className="item"><div className="label">Gasolina a adicionar</div><div className="value">{round(addGasRes.X, 2)} L</div></div>
                        <div className="item"><div className="label">Volume no tanque (A)</div><div className="value">{round(Number(A)||0, 2)} L</div></div>
                        <div className="item"><div className="label">E% atual</div><div className="value">{round(Number(Ec)||0, 2)}%</div></div>
                      </div>
                    ) : (
                      <div className="rp-footer-note" style={{ color: '#ffb3b3' }}>{addGasRes.msg}</div>
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
