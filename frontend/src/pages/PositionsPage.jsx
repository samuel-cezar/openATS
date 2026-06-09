import { useState, useEffect } from 'react'
import { api } from '../api'
import {
  useToast, Spinner, ProcessedBadge, EmptyState, SkillRow,
  SparkleIcon, ChevronIcon, PlusIcon,
} from '../components'

export default function PositionsPage({ processes }) {
  const toast = useToast()
  const [positions, setPositions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [creating, setCreating]   = useState(false)
  const [processingId, setProcessingId] = useState(null)
  const [expanded, setExpanded]   = useState(null)
  const [form, setForm] = useState({ selectionProcessId: '', title: '', jobDescription: '' })

  useEffect(() => { load() }, [])
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') setShowForm(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  async function load() {
    setLoading(true)
    try { setPositions(await api.getPositions()) }
    catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    try {
      const created = await api.createPosition(form)
      setPositions(ps => [created, ...ps])
      setForm({ selectionProcessId: '', title: '', jobDescription: '' })
      setShowForm(false)
      toast('Position created')
    } catch (e) { toast(e.message, 'error') }
    finally { setCreating(false) }
  }

  async function handleExtract(posId) {
    setProcessingId(posId)
    try {
      await api.processPosition(posId)
      const fresh = await api.getPosition(posId)
      setPositions(ps => ps.map(p => (p.id || p._id) === posId ? fresh : p))
      setExpanded(posId)
      toast('Skills extracted successfully')
    } catch (e) { toast(e.message, 'error') }
    finally { setProcessingId(null) }
  }

  function processName(id) {
    const p = processes.find(p => (p.id || p._id) === id)
    return p ? p.name : (id ? String(id).slice(0, 8) + '…' : '—')
  }

  function isProcessed(pos) {
    return pos.processed ||
      (pos.hardSkillsRequired && pos.hardSkillsRequired.length > 0) ||
      (pos.softSkillsRequired  && pos.softSkillsRequired.length  > 0)
  }

  function skillCount(pos) {
    const h = (pos.hardSkillsRequired || []).length
    const s = (pos.softSkillsRequired  || []).length
    if (!h && !s) return null
    return `${h + s} skill${h + s !== 1 ? 's' : ''}`
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Positions</h1>
          <p className="page-sub">
            {loading ? 'Loading…' : `${positions.length} position${positions.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          <PlusIcon /> New Position
        </button>
      </div>

      {showForm && (
        <div className="inline-form">
          <div className="inline-form-title">New Position</div>
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Process *</label>
                <select
                  className="form-select"
                  value={form.selectionProcessId}
                  onChange={e => setForm(f => ({ ...f, selectionProcessId: e.target.value }))}
                  required
                >
                  <option value="">Select a process…</option>
                  {processes.map(p => (
                    <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Title *</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Associate Professor in Machine Learning"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Job Description *</label>
                <textarea
                  className="form-input form-textarea"
                  style={{ minHeight: 110 }}
                  value={form.jobDescription}
                  onChange={e => setForm(f => ({ ...f, jobDescription: e.target.value }))}
                  placeholder="Paste the full job description here — the AI will extract required skills from this text."
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                {creating ? <><Spinner /> Creating…</> : 'Create Position'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="card-loading"><Spinner dark /></div>
        ) : positions.length === 0 ? (
          <EmptyState
            title="No positions yet"
            description="Create a position and extract its required skills using AI."
          />
        ) : (
          positions.map((pos, i) => {
            const id           = pos.id || pos._id
            const processed    = isProcessed(pos)
            const isExpanded   = expanded === id
            const isExtracting = processingId === id
            const count        = skillCount(pos)

            return (
              <div key={id}>
                {i > 0 && <div className="row-divider" />}

                <div className="list-row" onClick={() => setExpanded(isExpanded ? null : id)}>
                  <div className="list-row-main">
                    <div className="list-row-title">
                      <span className="cell-bold">{pos.title}</span>
                      {processed && <ProcessedBadge />}
                      {processed && count && (
                        <span className="count-pill">{count}</span>
                      )}
                    </div>
                    <div className="list-row-meta">{processName(pos.selectionProcessId)}</div>
                  </div>

                  <div className="list-row-actions" onClick={e => e.stopPropagation()}>
                    {!processed && (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={isExtracting}
                        onClick={() => handleExtract(id)}
                      >
                        {isExtracting
                          ? <><Spinner dark /> Extracting…</>
                          : <><SparkleIcon /> Extract Skills</>
                        }
                      </button>
                    )}
                  </div>

                  <ChevronIcon expanded={isExpanded} />
                </div>

                {isExpanded && (
                  <div className="row-expanded">
                    {processed ? (
                      <>
                        <SkillRow label="Hard" skills={pos.hardSkillsRequired} variant="blue" />
                        <SkillRow label="Soft" skills={pos.softSkillsRequired}  variant="slate" />
                      </>
                    ) : (
                      <div className="expanded-hint">
                        No skills extracted yet. Use <strong>Extract Skills</strong> to run the AI pipeline.
                      </div>
                    )}
                    {pos.jobDescription && (
                      <div className="jd-preview">
                        <span className="skill-section-label">JD</span>
                        <p className="jd-text">{pos.jobDescription}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
