import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { PositionRecord, ProcessRecord } from '../api'
import {
  useToast, Spinner, ProcessedBadge, EmptyState, SkillRow,
  SparkleIcon, ChevronIcon, PlusIcon, UploadIcon, FileIcon,
} from '../components'

export default function PositionsPage({ processes }: { processes: ProcessRecord[] }) {
  const toast = useToast()
  const [positions, setPositions] = useState<PositionRecord[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [creating, setCreating]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({})
  const [form, setForm] = useState({ selectionProcessId: '', title: '', jobDescription: '' })
  // Pending poll timers keyed by position id, so we can cancel them on unmount.
  const pollTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => { load() }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeForm() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  // Clear any in-flight processing polls when the page unmounts.
  useEffect(() => () => {
    Object.values(pollTimers.current).forEach(clearTimeout)
  }, [])

  async function load() {
    setLoading(true)
    try { setPositions(await api.getPositions()) }
    catch (err: unknown) { toast(err instanceof Error ? err.message : String(err), 'error') }
    finally { setLoading(false) }
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ selectionProcessId: '', title: '', jobDescription: '' })
  }

  function openCreate() {
    setEditingId(null)
    setForm({ selectionProcessId: '', title: '', jobDescription: '' })
    setShowForm(s => !s)
  }

  function startEdit(pos: PositionRecord) {
    setEditingId(pos.id || pos._id)
    setForm({
      selectionProcessId: pos.selectionProcessId || '',
      title: pos.title || '',
      jobDescription: pos.jobDescription || '',
    })
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreating(true)
    try {
      if (editingId) {
        const updated = await api.updatePosition(editingId, form)
        setPositions(ps => ps.map(p => (p.id || p._id) === editingId ? updated : p))
        toast('Position updated')
      } else {
        const created = await api.createPosition(form)
        setPositions(ps => [created, ...ps])
        toast('Position created')
      }
      closeForm()
    } catch (err: unknown) { toast(err instanceof Error ? err.message : String(err), 'error') }
    finally { setCreating(false) }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await api.deletePosition(id)
      setPositions(ps => ps.filter(p => (p.id || p._id) !== id))
      setConfirmingId(null)
      toast('Position deleted')
    } catch (err: unknown) { toast(err instanceof Error ? err.message : String(err), 'error') }
    finally { setDeletingId(null) }
  }

  async function handleUpload(posId: string) {
    const file = pendingFiles[posId]
    if (!file) return
    setUploadingId(posId)
    try {
      await api.uploadPositionJobDescription(posId, file)
      setPendingFiles(pf => { const n = { ...pf }; delete n[posId]; return n })
      toast('Job description uploaded')
      const fresh = await api.getPosition(posId)
      setPositions(ps => ps.map(p => (p.id || p._id) === posId ? fresh : p))
    } catch (err: unknown) { toast(err instanceof Error ? err.message : String(err), 'error') }
    finally { setUploadingId(null) }
  }

  async function handleExtract(posId: string) {
    setProcessingId(posId)
    try {
      await api.processPosition(posId)
      setExpanded(posId)
      toast('Processing started — extracting skills…')
      // Processing is async on the server; poll until the position flips to processed.
      pollUntilProcessed(posId)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : String(err), 'error')
      setProcessingId(null)
    }
  }

  // Re-fetch the position every 30s until processing completes, keeping the
  // row's "Processing…" state until then.
  function pollUntilProcessed(posId: string) {
    pollTimers.current[posId] = setTimeout(async () => {
      try {
        const fresh = await api.getPosition(posId)
        setPositions(ps => ps.map(p => (p.id || p._id) === posId ? fresh : p))
        if (isProcessed(fresh) && !fresh.skillsStale) {
          delete pollTimers.current[posId]
          setProcessingId(p => (p === posId ? null : p))
          toast('Skills extracted successfully')
          return
        }
      } catch { /* transient fetch error — keep polling */ }
      pollUntilProcessed(posId)
    }, 30000)
  }

  function processName(id?: string) {
    const p = processes.find(p => (p.id || p._id) === id)
    return p ? p.name : (id ? String(id).slice(0, 8) + '…' : '—')
  }

  function isProcessed(pos: PositionRecord) {
    return pos.processed ||
      (pos.hardSkillsRequired && pos.hardSkillsRequired.length > 0) ||
      (pos.softSkillsRequired  && pos.softSkillsRequired.length  > 0)
  }

  function skillCount(pos: PositionRecord) {
    const h = (pos.hardSkillsRequired || []).length
    const s = (pos.softSkillsRequired  || []).length
    if (!h && !s) return null
    return `${h + s} skill${h + s !== 1 ? 's' : ''}`
  }

  function jdFileName(pos: PositionRecord) {
    if (pos.jobDescriptionFileName) return pos.jobDescriptionFileName
    if (!pos.jobDescriptionFileUrl) return null
    return pos.jobDescriptionFileUrl.split('/').pop() || pos.jobDescriptionFileUrl
  }

  function truncateName(name: string, max = 20) {
    return name.length > max ? name.slice(0, max - 3) + '…' : name
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
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <PlusIcon /> New Position
        </button>
      </div>

      {showForm && (
        <div className="inline-form">
          <div className="inline-form-title">{editingId ? 'Edit Position' : 'New Position'}</div>
          <form onSubmit={handleSubmit}>
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
                <label className="form-label">Description</label>
                <textarea
                  className="form-input form-textarea"
                  style={{ minHeight: 110 }}
                  value={form.jobDescription}
                  onChange={e => setForm(f => ({ ...f, jobDescription: e.target.value }))}
                  placeholder="Optional notes about this position, for your reference."
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
                  : (editingId ? 'Save Changes' : 'Create Position')}
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
            description="Create a position, upload its job description file, then extract required skills using AI."
          />
        ) : (
          positions.map((pos, i) => {
            const id           = pos.id || pos._id
            const processed    = isProcessed(pos)
            const isExpanded   = expanded === id
            const isExtracting = processingId === id
            const isUploading  = uploadingId === id
            const pendingFile  = pendingFiles[id]
            const currentFile  = jdFileName(pos)
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
                        {!processed && (
                          <>
                            {currentFile && !pendingFile && (
                              <span className="file-chip" title={currentFile}>
                                <FileIcon /> {truncateName(currentFile)}
                              </span>
                            )}
                            <label className="file-btn">
                              <UploadIcon />
                              {pendingFile
                                ? <span className="file-name-label">{truncateName(pendingFile.name)}</span>
                                : <span>{currentFile ? 'Replace JD File' : 'JD File'}</span>
                              }
                              <input
                                type="file"
                                accept=".pdf,.docx"
                                style={{ display: 'none' }}
                                onChange={e => {
                                  const f = e.target.files?.[0]
                                  if (f) setPendingFiles(pf => ({ ...pf, [id]: f }))
                                  e.target.value = ''
                                }}
                              />
                            </label>

                            {pendingFile && (
                              <button
                                className="btn btn-secondary btn-sm"
                                disabled={isUploading}
                                onClick={() => handleUpload(id)}
                              >
                                {isUploading ? <><Spinner dark /> Uploading…</> : 'Upload'}
                              </button>
                            )}

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
                          </>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(pos)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmingId(id)}>Delete</button>
                      </>
                    )}
                  </div>

                  <ChevronIcon expanded={isExpanded} />
                </div>

                {isExpanded && (
                  <div className="row-expanded">
                    {processed && pos.skillsStale && (
                      <div className="outdated-banner">
                        <span className="outdated-banner-text">
                          Skills are outdated — the job description file changed since extraction.
                        </span>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={isExtracting}
                          onClick={() => handleExtract(id)}
                        >
                          {isExtracting
                            ? <><Spinner dark /> Re-extracting…</>
                            : <><SparkleIcon /> Re-extract Skills</>
                          }
                        </button>
                      </div>
                    )}
                    {processed ? (
                      <>
                        <SkillRow label="Hard" skills={pos.hardSkillsRequired} variant="blue" />
                        <SkillRow label="Soft" skills={pos.softSkillsRequired}  variant="slate" />
                      </>
                    ) : (
                      <div className="expanded-hint">
                        {currentFile
                          ? <>Job description file uploaded: <strong>{currentFile}</strong>. No skills extracted yet — use <strong>Extract Skills</strong> to run the AI pipeline.</>
                          : <>Upload a job description file (PDF or DOCX), then use <strong>Extract Skills</strong> to run the AI pipeline.</>
                        }
                      </div>
                    )}
                    {pos.jobDescription && (
                      <div className="jd-preview">
                        <span className="skill-section-label">Description</span>
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
