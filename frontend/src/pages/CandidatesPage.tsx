import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { CandidateRecord } from '../api'
import {
  useToast, Spinner, ProcessedBadge, EmptyState, SkillRow,
  SparkleIcon, ChevronIcon, PlusIcon, UploadIcon, FileIcon,
} from '../components'

export default function CandidatesPage() {
  const toast = useToast()
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [creating, setCreating]     = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId]   = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({})
  const [form, setForm] = useState({ name: '', email: '' })

  useEffect(() => { load() }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeForm() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  async function load() {
    setLoading(true)
    try { setCandidates(await api.getCandidates()) }
    catch (err: unknown) { toast(err instanceof Error ? err.message : String(err), 'error') }
    finally { setLoading(false) }
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', email: '' })
  }

  function openCreate() {
    setEditingId(null)
    setForm({ name: '', email: '' })
    setShowForm(s => !s)
  }

  function startEdit(c: CandidateRecord) {
    setEditingId(c.id || c._id)
    setForm({ name: c.name || '', email: c.email || '' })
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreating(true)
    try {
      if (editingId) {
        const updated = await api.updateCandidate(editingId, form)
        setCandidates(cs => cs.map(c => (c.id || c._id) === editingId ? updated : c))
        toast('Candidate updated')
      } else {
        const created = await api.createCandidate(form)
        setCandidates(cs => [created, ...cs])
        toast('Candidate added')
      }
      closeForm()
    } catch (err: unknown) { toast(err instanceof Error ? err.message : String(err), 'error') }
    finally { setCreating(false) }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await api.deleteCandidate(id)
      setCandidates(cs => cs.filter(c => (c.id || c._id) !== id))
      setConfirmingId(null)
      toast('Candidate deleted')
    } catch (err: unknown) { toast(err instanceof Error ? err.message : String(err), 'error') }
    finally { setDeletingId(null) }
  }

  async function handleUpload(cId: string) {
    const file = pendingFiles[cId]
    if (!file) return
    setUploadingId(cId)
    try {
      await api.uploadResume(cId, file)
      setPendingFiles(pf => { const n = { ...pf }; delete n[cId]; return n })
      toast('Resume uploaded')
      const fresh = await api.getCandidate(cId)
      setCandidates(cs => cs.map(c => (c.id || c._id) === cId ? fresh : c))
    } catch (err: unknown) { toast(err instanceof Error ? err.message : String(err), 'error') }
    finally { setUploadingId(null) }
  }

  async function handleProcess(cId: string) {
    setProcessingId(cId)
    try {
      await api.processCandidate(cId)
      const fresh = await api.getCandidate(cId)
      setCandidates(cs => cs.map(c => (c.id || c._id) === cId ? fresh : c))
      setExpanded(cId)
      toast('Candidate processed')
    } catch (err: unknown) { toast(err instanceof Error ? err.message : String(err), 'error') }
    finally { setProcessingId(null) }
  }

  function isProcessed(c: CandidateRecord) {
    return c.processed ||
      (c.hardSkills && c.hardSkills.length > 0) ||
      (c.softSkills  && c.softSkills.length  > 0)
  }

  function initials(name?: string) {
    if (!name) return '?'
    return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
  }

  function avatarHue(name?: string) {
    if (!name) return 210
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
    return h % 360
  }

  function resumeFileName(c: CandidateRecord) {
    if (c.resumeFileName) return c.resumeFileName
    if (!c.resumePdfUrl) return null
    return c.resumePdfUrl.split('/').pop() || c.resumePdfUrl
  }

  function truncateName(name: string, max = 20) {
    return name.length > max ? name.slice(0, max - 3) + '…' : name
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Candidates</h1>
          <p className="page-sub">
            {loading ? 'Loading…' : `${candidates.length} candidate${candidates.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <PlusIcon /> New Candidate
        </button>
      </div>

      {showForm && (
        <div className="inline-form">
          <div className="inline-form-title">{editingId ? 'Edit Candidate' : 'New Candidate'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Doe"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  className="form-input"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane.doe@university.edu"
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                {creating
                  ? <><Spinner /> {editingId ? 'Saving…' : 'Adding…'}</>
                  : (editingId ? 'Save Changes' : 'Add Candidate')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="card-loading"><Spinner dark /></div>
        ) : candidates.length === 0 ? (
          <EmptyState
            title="No candidates yet"
            description="Add candidates, upload their PDF resumes, then process to extract skills."
          />
        ) : (
          candidates.map((c, i) => {
            const cId        = c.id || c._id
            const processed  = isProcessed(c)
            const isExpanded = expanded === cId
            const isUploading  = uploadingId  === cId
            const isProcessing = processingId === cId
            const pendingFile  = pendingFiles[cId]
            const currentFile  = resumeFileName(c)
            const hue = avatarHue(c.name)

            return (
              <div key={cId}>
                {i > 0 && <div className="row-divider" />}

                <div className="list-row candidate-list-row">
                  <div
                    className="candidate-identity"
                    onClick={() => setExpanded(isExpanded ? null : cId)}
                  >
                    <div
                      className="candidate-avatar"
                      style={{
                        background: `oklch(0.9 0.06 ${hue})`,
                        color: `oklch(0.4 0.1 ${hue})`,
                      }}
                    >
                      {initials(c.name)}
                    </div>
                    <div className="candidate-meta">
                      <div className="candidate-name-row">
                        <span className="cell-bold">{c.name}</span>
                        {processed && <ProcessedBadge />}
                      </div>
                      <div className="cell-mono cell-muted candidate-email">{c.email}</div>
                    </div>
                  </div>

                  <div className="candidate-actions" onClick={e => e.stopPropagation()}>
                    {confirmingId === cId ? (
                      <span className="confirm-delete">
                        <span className="confirm-delete-label">Delete?</span>
                        <button className="btn btn-danger btn-sm" disabled={deletingId === cId}
                          onClick={() => handleDelete(cId)}>
                          {deletingId === cId ? <><Spinner /> Deleting…</> : 'Yes'}
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
                                : <span>{currentFile ? 'Replace Resume' : 'Resume PDF'}</span>
                              }
                              <input
                                type="file"
                                accept=".pdf"
                                style={{ display: 'none' }}
                                onChange={e => {
                                  const f = e.target.files?.[0]
                                  if (f) setPendingFiles(pf => ({ ...pf, [cId]: f }))
                                  e.target.value = ''
                                }}
                              />
                            </label>

                            {pendingFile && (
                              <button
                                className="btn btn-secondary btn-sm"
                                disabled={isUploading}
                                onClick={() => handleUpload(cId)}
                              >
                                {isUploading ? <><Spinner dark /> Uploading…</> : 'Upload'}
                              </button>
                            )}

                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={isProcessing}
                              onClick={() => handleProcess(cId)}
                            >
                              {isProcessing
                                ? <><Spinner dark /> Processing…</>
                                : <><SparkleIcon /> Process</>
                              }
                            </button>
                          </>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmingId(cId)}>Delete</button>
                      </>
                    )}
                  </div>

                  <div
                    style={{ cursor: 'pointer', paddingLeft: 4 }}
                    onClick={() => setExpanded(isExpanded ? null : cId)}
                  >
                    <ChevronIcon expanded={isExpanded} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="row-expanded row-expanded-indented">
                    {processed && c.skillsStale && (
                      <div className="outdated-banner">
                        <span className="outdated-banner-text">
                          Skills are outdated — this candidate changed since processing.
                        </span>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={isProcessing}
                          onClick={() => handleProcess(cId)}
                        >
                          {isProcessing
                            ? <><Spinner dark /> Re-processing…</>
                            : <><SparkleIcon /> Re-process</>
                          }
                        </button>
                      </div>
                    )}
                    {processed ? (
                      <>
                        <SkillRow label="Hard" skills={c.hardSkills} variant="blue" />
                        <SkillRow label="Soft" skills={c.softSkills}  variant="slate" />
                        {(!c.hardSkills || c.hardSkills.length === 0) &&
                         (!c.softSkills  || c.softSkills.length  === 0) && (
                          <div className="expanded-hint">Processed — no skills returned by API.</div>
                        )}
                      </>
                    ) : (
                      <div className="expanded-hint">
                        {currentFile
                          ? <>Resume uploaded: <strong>{currentFile}</strong>. No skills extracted yet — click <strong>Process</strong> to extract skills.</>
                          : <>Upload a resume PDF, then click <strong>Process</strong> to extract skills.</>
                        }
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
