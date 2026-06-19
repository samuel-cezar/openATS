import { useState, useEffect } from 'react'
import { api } from '../api'
import { useToast, Spinner } from '../components'

// Round to 2 decimals so persisted weights stay clean and sum exactly to 1
// (avoids float drift like 0.7 + 0.3 = 0.999… that the API rejects).
const round2 = (n: number) => Math.round(n * 100) / 100

export default function SettingsPage() {
  const toast = useToast()
  const [alpha, setAlpha]     = useState(0.6)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    api.getTenant()
      .then(t => setAlpha(t.alpha))
      .catch(e => toast(e instanceof Error ? e.message : String(e), 'error'))
      .finally(() => setLoading(false))
  }, [])

  const beta = round2(1 - alpha)
  const hardPct = Math.round(alpha * 100)
  const softPct = 100 - hardPct

  async function handleSave() {
    setSaving(true)
    try {
      await api.updateTenantWeights({ alpha: round2(alpha), beta })
      toast('Weights saved')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally { setSaving(false) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Tune how match scores weigh hard vs. soft skills.</p>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="card-loading"><Spinner dark /></div>
        ) : (
          <div className="inline-form" style={{ margin: 0 }}>
            <div className="inline-form-title">Skill Weights</div>
            <p className="page-sub" style={{ marginTop: 0 }}>
              Total match score = <strong>{hardPct}%</strong> hard-skill similarity
              + <strong>{softPct}%</strong> soft-skill similarity.
            </p>

            <div className="weight-slider-labels">
              <span>Hard skills <strong>{hardPct}%</strong></span>
              <span><strong>{softPct}%</strong> Soft skills</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={alpha}
              onChange={e => setAlpha(Number(e.target.value))}
            />

            <div className="form-actions" style={{ marginTop: 16 }}>
              <button
                className="btn btn-primary btn-sm"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? <><Spinner /> Saving…</> : 'Save Weights'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
