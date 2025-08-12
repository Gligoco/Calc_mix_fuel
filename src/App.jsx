import React, { useEffect, useMemo, useState } from 'react'
import rpLogo from '/assets/IMG_6442.jpeg'

const ETHANOL_TYPES = [
  { id: 'hidratado', name: 'Hidratado (≈95,5%)', fraction: 0.955 },
  { id: 'anidro', name: 'Anidro (≈99,6%)', fraction: 0.996 },
]

function round(value, decimals = 2) {
  if (value === Infinity || value === -Infinity) return Infinity
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

// Forward: X = Y * (E_target - E_g) / (E_ethanol - E_target)
function computeXFromTarget(Y, E_target, E_g, E_ethanol) {
  const denom = (E_ethanol - E_target)
  if (Y <= 0) return { ok: false, message: 'Informe Y > 0 (litros de Gasolina C).', X: 0 }
  if (E_target <= E_g) return { ok: false, message: 'E_alvo deve ser maior que E_g.', X: 0 }
  if (E_target >= E_ethanol) return { ok: false, message: 'E_alvo deve ser menor que E_etanol.', X: 0 }
  if (Math.abs(denom) < 1e-9) return { ok: false, message: 'Divisão por zero. Ajuste E_alvo.', X: 0 }
  const X = Y * (E_target - E_g) / denom
  if (X < 0) return { ok: false, message: 'Resultado negativo. Revise os valores.', X: 0 }
  return { ok: true, message: '', X }
}

// Inverse: E_final = (E_g*Y + E_ethanol*X) / (X + Y)
function computeEFinal(X, Y, E_g, E_ethanol) {
  if (X < 0 || Y <= 0) return { ok: false, message: 'Informe X ≥ 0 e Y > 0.', E_final: 0 }
  const total = X + Y
  if (total <= 0) return { ok: false, message: 'Total inválido.', E_final: 0 }
  const E_final = (E_g * Y + E_ethanol * X) / total
  return { ok: true, message: '', E_final }
}

export default function App() {
  // Mode
  const [mode, setMode] = useLocalStorage('mode', 'forward') // 'forward' | 'inverse'

  // Inputs common / settings
  const [ethTypeId, setEthTypeId] = useLocalStorage('ethType', 'hidratado')
  const eth = ETHANOL_TYPES.find(e => e.id === ethTypeId) || ETHANOL_TYPES[0]
  const [EgPercent, setEgPercent] = useLocalStorage('EgPercent', 27) // % of Gasoline C

  // Forward inputs
  const [Y, setY] = useLocalStorage('Y_liters', 30) // litros Gasolina C
  const [EtargetPercent, setEtargetPercent] = useLocalStorage('EtargetPercent', 40) // % desejado final

  // Inverse inputs
  const [Xinverse, setXinverse] = useLocalStorage('X_liters', 5)
  const [Yinverse, setYinverse] = useLocalStorage('Y_liters_inverse', 30)

  const Eg = Math.max(0, Math.min(1, Number(EgPercent) / 100))
  const Eeth = eth.fraction

  // Results
  const forward = useMemo(() => {
    if (mode !== 'forward') return { ok: false, X: 0, message: '' }
    const res = computeXFromTarget(Number(Y) || 0, (Number(EtargetPercent) || 0) / 100, Eg, Eeth)
    return res
  }, [mode, Y, EtargetPercent, Eg, Eeth])

  const inverse = useMemo(() => {
    if (mode !== 'inverse') return { ok: false, E_final: 0, message: '' }
    const res = computeEFinal(Number(Xinverse) || 0, Number(Yinverse) || 0, Eg, Eeth)
    return res
  }, [mode, Xinverse, Yinverse, Eg, Eeth])

  const [hasCalculated, setHasCalculated] = useState(false)
  function handleCalc() { setHasCalculated(true) }
  function handleReset() { window.location.reload() }

  const tankPercent = mode === 'forward' ? Number(EtargetPercent) : round((inverse.E_final || 0) * 100, 1)
  const ethanolBarWidth = `${Math.max(0, Math.min(100, tankPercent))}%`

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
                <button className="rp-chip" aria-pressed={mode==='forward'} onClick={()=> setMode('forward')}>Calcular X (álcool a adicionar)</button>
                <button className="rp-chip" aria-pressed={mode==='inverse'} onClick={()=> setMode('inverse')}>Calcular E% final (X e Y)</button>
              </div>
            </div>

            <div className="rp-group">
              <div className="rp-group-title">Parâmetros</div>
              <div className="rp-row">
                <div className="rp-label">Tipo de etanol</div>
                <select className="rp-select" value={ethTypeId} onChange={(e)=> setEthTypeId(e.target.value)}>
                  {ETHANOL_TYPES.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
              </div>
              <div className="rp-row">
                <div className="rp-label">E_g — % de etanol na Gasolina C</div>
                <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                  <input className="rp-input" type="number" min="0" max="100" step="0.1" value={EgPercent} onChange={(e)=> setEgPercent(e.target.value)} />
                </div>
              </div>
            </div>

            {mode === 'forward' ? (
              <div className="rp-group">
                <div className="rp-group-title">Calcular X</div>
                <div className="rp-row">
                  <div className="rp-label">Y — Gasolina C (L)</div>
                  <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                    <input className="rp-input" type="number" min="0" step="0.1" value={Y} onChange={(e)=> setY(e.target.value)} />
                    <input className="rp-slider" type="range" min="0" max="200" step="0.1" value={Number(Y)} onChange={(e)=> setY(e.target.value)} />
                  </div>
                </div>
                <div className="rp-row">
                  <div className="rp-label">E_alvo — % de etanol desejada</div>
                  <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                    <input className="rp-input" type="number" min="0" max="100" step="0.1" value={EtargetPercent} onChange={(e)=> setEtargetPercent(e.target.value)} />
                    <input className="rp-slider" type="range" min="0" max="100" step="0.1" value={Number(EtargetPercent)} onChange={(e)=> setEtargetPercent(e.target.value)} />
                  </div>
                </div>
                <div className="rp-tank" title={`Etanol ${ethanolBarWidth}`}>
                  <div className="eth" style={{ width: ethanolBarWidth }} />
                  <div className="label">E{round(Number(EtargetPercent)||0,0)}</div>
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
                    {forward.ok ? (
                      <div className="results-kpis">
                        <div className="item"><div className="label">X — Etanol a adicionar</div><div className="value">{round(forward.X, 2)} L</div></div>
                        <div className="item"><div className="label">Y — Gasolina C</div><div className="value">{round(Number(Y)||0, 2)} L</div></div>
                        <div className="item"><div className="label">E_alvo</div><div className="value">{round(Number(EtargetPercent)||0, 2)}%</div></div>
                      </div>
                    ) : (
                      <div className="rp-footer-note" style={{ color: '#ffb3b3' }}>{forward.message}</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rp-group">
                <div className="rp-group-title">Calcular E% final</div>
                <div className="rp-row">
                  <div className="rp-label">Y — Gasolina C (L)</div>
                  <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                    <input className="rp-input" type="number" min="0" step="0.1" value={Yinverse} onChange={(e)=> setYinverse(e.target.value)} />
                    <input className="rp-slider" type="range" min="0" max="200" step="0.1" value={Number(Yinverse)} onChange={(e)=> setYinverse(e.target.value)} />
                  </div>
                </div>
                <div className="rp-row">
                  <div className="rp-label">X — Etanol (L)</div>
                  <div className="input-wrap" style={{ gridTemplateColumns: '1fr' }}>
                    <input className="rp-input" type="number" min="0" step="0.1" value={Xinverse} onChange={(e)=> setXinverse(e.target.value)} />
                    <input className="rp-slider" type="range" min="0" max="200" step="0.1" value={Number(Xinverse)} onChange={(e)=> setXinverse(e.target.value)} />
                  </div>
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
                    {inverse.ok ? (
                      <div className="results-kpis">
                        <div className="item"><div className="label">E% final</div><div className="value">{round((inverse.E_final||0)*100, 2)}%</div></div>
                        <div className="item"><div className="label">X — Etanol</div><div className="value">{round(Number(Xinverse)||0, 2)} L</div></div>
                        <div className="item"><div className="label">Y — Gasolina C</div><div className="value">{round(Number(Yinverse)||0, 2)} L</div></div>
                      </div>
                    ) : (
                      <div className="rp-footer-note" style={{ color: '#ffb3b3' }}>{inverse.message}</div>
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
