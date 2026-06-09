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
  const [editingId, setEditingId] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '' })

  useEffect(() => {
    api.getProcesses()
      .then(data => { setProcesses(data); setLoading(false) })
      .catch(e => { toast(e.message, 'error'); setLoading(false) })
  }, [])

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') closeForm() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function toDateInput(d) {
    return d ? String(d).slice(0, 10) : ''
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', description: '', startDate: '', endDate: '' })
  }

  function openCreate() {
    setEditingId(null)
    setForm({ name: '', description: '', startDate: '', endDate: '' })
    setShowForm(s => !s)
  }

  function startEdit(p) {
    setEditingId(p.id || p._id)
    setForm({
      name: p.name || '',
      description: p.description || '',
      startDate: toDateInput(p.startDate),
      endDate: toDateInput(p.endDate),
    })
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setCreating(true)
    try {
      const payload = { name: form.name, description: form.description }
      payload.startDate = form.startDate || null
      payload.endDate = form.endDate || null
      if (editingId) {
        const updated = await api.updateProcess(editingId, payload)
        setProcesses(ps => ps.map(p => (p.id || p._id) === editingId ? updated : p))
        toast('Selection process updated')
      } else {
        const created = await api.createProcess(payload)
        setProcesses(ps => [created, ...ps])
        toast('Selection process created')
      }
      closeForm()
    } catch (e) { toast(e.message, 'error') }
    finally { setCreating(false) }
  }

  async function handleDelete(id) {
    setDeletingId(id)
    try {
      await api.deleteProcess(id)
      setProcesses(ps => ps.filter(p => (p.id || p._id) !== id))
      setConfirmingId(null)
      toast('Selection process deleted')
    } catch (e) { toast(e.message, 'error') }
    finally { setDeletingId(null) }
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
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <PlusIcon /> New Process
        </button>
      </div>

      {showForm && (
        <div className="inline-form">
          <div className="inline-form-title">{editingId ? 'Edit Selection Process' : 'New Selection Process'}</div>
          <form onSubmit={handleSubmit}>
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
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                {creating
                  ? <><Spinner /> {editingId ? 'Saving…' : 'Creating…'}</>
                  : (editingId ? 'Save Changes' : 'Create Process')}
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
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {processes.map(p => {
                const id = p.id || p._id
                return (
                <tr key={id}>
                  <td className="cell-bold">{p.name}</td>
                  <td>
                    <div className="cell-truncate cell-secondary">{p.description || '—'}</div>
                  </td>
                  <td className="cell-mono cell-secondary">{fmtDate(p.startDate)}</td>
                  <td className="cell-mono cell-secondary">{fmtDate(p.endDate)}</td>
                  <td>{statusOf(p)}</td>
                  <td>
                    <div className="list-row-actions" style={{ justifyContent: 'flex-end' }}>
                      {confirmingId === id ? (
                        <span className="confirm-delete">
                          <span className="confirm-delete-label">Delete?</span>
                          <button className="btn btn-danger btn-sm" disabled={deletingId === id}
                            onClick={() => handleDelete(id)}>
                            {deletingId === id ? <><Spinner /> Deleting…</> : 'Yes'}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmingId(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirmingId(id)}>Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
