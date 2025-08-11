import React, { useEffect, useMemo, useState } from 'react'

const LITERS_PER_GALLON = 3.78541

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
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {}
  }, [key, state])
  return [state, setState]
}

function computeAdditions(currentVolume, currentEPercent, targetEPercent, addMode) {
  const A = Math.max(0, currentVolume)
  const Ec = Math.max(0, Math.min(1, currentEPercent / 100))
  const Et = Math.max(0, Math.min(1, targetEPercent / 100))

  if (A <= 0) return { addEthanol: 0, addGasoline: 0, finalVolume: 0, finalEPercent: targetEPercent, warning: '' }

  if (addMode === 'ethanol') {
    const numerator = A * (Et - Ec)
    const denominator = 1 - Et
    let x_e = numerator / Math.max(denominator, 1e-9)
    if (Et <= Ec) x_e = 0 // cannot lower E% by adding ethanol
    const finalVolume = A + x_e
    const finalEPercent = finalVolume > 0 ? ((A * Ec + x_e) / finalVolume) * 100 : 0
    const warning = Et < Ec ? 'Target is below current E%. Add gasoline or remove fuel.' : ''
    return { addEthanol: Math.max(0, x_e), addGasoline: 0, finalVolume, finalEPercent, warning }
  }

  if (addMode === 'gasoline') {
    if (Et === 0) {
      // x_g -> infinity if Ec > 0. We'll suggest impossible w/o drain.
      if (Ec === 0) {
        return { addEthanol: 0, addGasoline: 0, finalVolume: A, finalEPercent: 0, warning: '' }
      }
      return { addEthanol: 0, addGasoline: Infinity, finalVolume: Infinity, finalEPercent: 0, warning: 'Target E0 is not reachable by only adding gasoline. Reduce ethanol by draining.' }
    }
    const numerator = A * (Ec - Et)
    const denominator = Et
    let x_g = numerator / Math.max(denominator, 1e-9)
    if (Et >= Ec) x_g = 0 // cannot raise E% by adding gasoline
    const finalVolume = A + x_g
    const finalEPercent = finalVolume > 0 ? ((A * Ec) / finalVolume) * 100 : 0
    const warning = Et > Ec ? 'Target is above current E%. Add ethanol or remove fuel.' : ''
    return { addEthanol: 0, addGasoline: Math.max(0, x_g), finalVolume, finalEPercent, warning }
  }

  return { addEthanol: 0, addGasoline: 0, finalVolume: A, finalEPercent: Ec * 100, warning: '' }
}

export default function App() {
  const [unit, setUnit] = useLocalStorage('unit', 'L') // 'L' or 'gal'
  const [addMode, setAddMode] = useLocalStorage('addMode', 'ethanol') // 'ethanol' | 'gasoline'

  const [currentVolumeInput, setCurrentVolumeInput] = useLocalStorage('currentVolume', 30)
  const [currentE, setCurrentE] = useLocalStorage('currentE', 10) // e.g., E10
  const [targetE, setTargetE] = useLocalStorage('targetE', 50)

  const [presets, setPresets] = useLocalStorage('presets', [
    { id: 'E30', name: 'E30', targetE: 30 },
    { id: 'E50', name: 'E50', targetE: 50 },
    { id: 'E85', name: 'E85', targetE: 85 },
  ])

  const currentVolumeLiters = useMemo(
    () => toBaseLiters(Number(currentVolumeInput) || 0, unit === 'gal' ? 'gal' : 'L'),
    [currentVolumeInput, unit]
  )

  const result = useMemo(() => computeAdditions(currentVolumeLiters, Number(currentE) || 0, Number(targetE) || 0, addMode), [currentVolumeLiters, currentE, targetE, addMode])

  const ethanolAddInUnit = fromBaseLiters(result.addEthanol, unit === 'gal' ? 'gal' : 'L')
  const gasolineAddInUnit = fromBaseLiters(result.addGasoline, unit === 'gal' ? 'gal' : 'L')

  const finalVolumeInUnit = fromBaseLiters(result.finalVolume, unit === 'gal' ? 'gal' : 'L')

  const ratioEthanol = useMemo(() => {
    const finalV = Math.max(0.0001, result.finalVolume)
    const finalEthanolVolume = currentVolumeLiters * (Number(currentE) / 100) + (addMode === 'ethanol' ? result.addEthanol : 0)
    return Math.max(0, Math.min(1, finalEthanolVolume / finalV))
  }, [result.finalVolume, currentVolumeLiters, currentE, addMode, result.addEthanol])

  function handleSavePreset() {
    const name = `E${targetE}`
    const id = `${name}-${Date.now()}`
    const newPreset = { id, name, targetE: Number(targetE) }
    setPresets([newPreset, ...presets].slice(0, 12))
  }

  function applyPreset(p) {
    setTargetE(p.targetE)
  }

  function clearPresets() {
    setPresets([])
  }

  const unitLabel = unit === 'gal' ? 'gal' : 'L'

  const gasolineStopPercent = round((1 - ratioEthanol) * 100, 2)

  const pretty = (v) => (v === Infinity ? '∞' : round(v, unit === 'gal' ? 2 : 2))

  return (
    <div className="container">
      <div className="watermark" />

      <header className="header card">
        <div className="brand">
          <div className="brand-logo" />
          <div className="brand-title">Fuel Mix Calculator</div>
        </div>
        <div className="actions">
          <div className="unit-toggle">
            <button
              className={unit !== 'gal' ? 'active' : ''}
              onClick={() => setUnit('L')}
              aria-pressed={unit !== 'gal'}
            >L</button>
            <button
              className={unit === 'gal' ? 'active' : ''}
              onClick={() => setUnit('gal')}
              aria-pressed={unit === 'gal'}
            >gal</button>
          </div>
          <div className="badge">Mode: {addMode === 'ethanol' ? 'Add Ethanol' : 'Add Gasoline'}</div>
        </div>
      </header>

      <div className="grid">
        <section className="card">
          <div className="card-body">
            <div className="controls">
              <div className="control">
                <label>Current Fuel Amount ({unitLabel})</label>
                <div className="input-row">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={currentVolumeInput}
                    onChange={(e) => setCurrentVolumeInput(e.target.value)}
                    placeholder={`e.g., ${unit === 'gal' ? '10.5' : '40'}`}
                  />
                </div>
              </div>

              <div className="control">
                <label>Current Ethanol % (E%)</label>
                <div className="input-row">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={currentE}
                    onChange={(e) => setCurrentE(e.target.value)}
                  />
                </div>
                <input className="range" type="range" min="0" max="100" step="1" value={currentE} onChange={(e)=> setCurrentE(e.target.value)} />
              </div>

              <div className="control">
                <label>Desired Ethanol % (Target)</label>
                <div className="input-row">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={targetE}
                    onChange={(e) => setTargetE(e.target.value)}
                  />
                </div>
                <input className="range" type="range" min="0" max="100" step="1" value={targetE} onChange={(e)=> setTargetE(e.target.value)} />
              </div>

              <div className="control">
                <label>Fuel Type To Add</label>
                <select className="select" value={addMode} onChange={(e) => setAddMode(e.target.value)}>
                  <option value="ethanol">Ethanol (E100)</option>
                  <option value="gasoline">Gasoline (E0)</option>
                </select>
              </div>
            </div>

            <div style={{ height: 16 }} />

            <div className="actions">
              <button className="button" onClick={handleSavePreset}>Save Preset (E{targetE})</button>
              <button className="button secondary" onClick={clearPresets}>Clear Presets</button>
            </div>

            <div style={{ height: 16 }} />

            {presets.length > 0 && (
              <div className="presets">
                {presets.map((p) => (
                  <button key={p.id} className="button secondary" onClick={() => applyPreset(p)}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}

          </div>
        </section>

        <aside className="card">
          <div className="card-body">
            <div className="tank" style={{ ['--gasoline-stop']: `${gasolineStopPercent}%` }}>
              <div className="fill" style={{ ['--gasoline-stop']: `${gasolineStopPercent}%` }} />
              <div className="glass" />
            </div>

            <div className="kpis">
              <div className="kpi">
                <div className="label">Add Ethanol</div>
                <div className="value">{pretty(ethanolAddInUnit)} {unitLabel}</div>
              </div>
              <div className="kpi">
                <div className="label">Add Gasoline</div>
                <div className="value">{pretty(gasolineAddInUnit)} {unitLabel}</div>
              </div>
              <div className="kpi">
                <div className="label">Final Volume</div>
                <div className="value">{pretty(finalVolumeInUnit)} {unitLabel}</div>
              </div>
              <div className="kpi">
                <div className="label">Final Ethanol %</div>
                <div className="value">{round(result.finalEPercent, 1)}%</div>
              </div>
            </div>

            {result.warning && (
              <div style={{ marginTop: 12, color: '#ffadad' }}>{result.warning}</div>
            )}

            <div className="footer-note">Visualization shows final mix. Red = Ethanol, Dark Gray = Gasoline.</div>
          </div>
        </aside>
      </div>
    </div>
  )
}
