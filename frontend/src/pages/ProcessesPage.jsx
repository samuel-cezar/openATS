import { useState, useEffect } from 'react'
import { api } from '../api'
import {
  useToast, Spinner, Badge, EmptyState, PlusIcon,
} from '../components'

export default function ProcessesPage({ processes, setProcesses }) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '' })

  useEffect(() => {
    api.getProcesses()
      .then(data => { setProcesses(data); setLoading(false) })
      .catch(e => { toast(e.message, 'error'); setLoading(false) })
  }, [])

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') setShowForm(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    try {
      const payload = { name: form.name, description: form.description }
      if (form.startDate) payload.startDate = form.startDate
      if (form.endDate) payload.endDate = form.endDate
      const created = await api.createProcess(payload)
      setProcesses(ps => [created, ...ps])
      setForm({ name: '', description: '', startDate: '', endDate: '' })
      setShowForm(false)
      toast('Selection process created')
    } catch (e) { toast(e.message, 'error') }
    finally { setCreating(false) }
  }

  function fmtDate(d) {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    catch { return d }
  }

  function statusOf(p) {
    const now = new Date()
    const start = p.startDate ? new Date(p.startDate) : null
    const end   = p.endDate   ? new Date(p.endDate)   : null
    if (start && start > now) return <Badge type="pending">Upcoming</Badge>
    if (!end || end >= now)   return <Badge type="success">Active</Badge>
    return <Badge type="muted">Closed</Badge>
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Selection Processes</h1>
          <p className="page-sub">
            {loading ? 'Loading…' : `${processes.length} process${processes.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          <PlusIcon /> New Process
        </button>
      </div>

      {showForm && (
        <div className="inline-form">
          <div className="inline-form-title">New Selection Process</div>
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Name *</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Engineering Faculty Recruitment 2025"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input form-textarea"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Scope and goals of this process…"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                {creating ? <><Spinner /> Creating…</> : 'Create Process'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="card-loading"><Spinner dark /></div>
        ) : processes.length === 0 ? (
          <EmptyState
            title="No selection processes"
            description="Create a process to start organising positions and candidates."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {processes.map(p => (
                <tr key={p.id || p._id}>
                  <td className="cell-bold">{p.name}</td>
                  <td>
                    <div className="cell-truncate cell-secondary">{p.description || '—'}</div>
                  </td>
                  <td className="cell-mono cell-secondary">{fmtDate(p.startDate)}</td>
                  <td className="cell-mono cell-secondary">{fmtDate(p.endDate)}</td>
                  <td>{statusOf(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
