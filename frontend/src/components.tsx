import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import type { ReactNode } from 'react'

// ─── Toast System ──────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error'
export type AddToast = (message: string, type?: ToastType) => void

const ToastCtx = createContext<AddToast | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: ToastType }[]>([])

  const addToast = useCallback<AddToast>((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800)
  }, [])

  return (
    <ToastCtx.Provider value={addToast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success'
              ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="rgba(16,185,129,0.25)"/><path d="M4.5 7l1.5 1.5L9.5 5" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="rgba(239,68,68,0.25)"/><path d="M5 5l4 4M9 5l-4 4" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/></svg>
            }
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast(): AddToast { return useContext(ToastCtx)! }

// ─── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ dark = false }: { dark?: boolean }) {
  return <span className={`spinner${dark ? ' spinner-dark' : ''}`} />
}

// ─── Skill Chips ────────────────────────────────────────────────────────────
export function SkillChip({ label, variant = 'blue' }: { label: string; variant?: string }) {
  return <span className={`chip chip-${variant}`}>{label}</span>
}

// ─── Badges ─────────────────────────────────────────────────────────────────
export function Badge({ type, children }: { type: string; children: ReactNode }) {
  return <span className={`badge badge-${type}`}>{children}</span>
}

export function ProcessedBadge() {
  return (
    <Badge type="success">
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
        <path d="M1.5 4.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Processed
    </Badge>
  )
}

// ─── Score Display ───────────────────────────────────────────────────────────
export function ScoreDisplay({ value }: { value?: number | string | null }) {
  if (value == null || isNaN(Number(value))) return <span className="score score-na">—</span>
  const n = Number(value)
  const pct = (n * 100).toFixed(1)
  const cls = n >= 0.75 ? 'score-high' : n >= 0.5 ? 'score-mid' : 'score-low'
  return <span className={`score ${cls}`}>{pct}%</span>
}

// ─── Empty State ─────────────────────────────────────────────────────────────
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect x="5" y="10" width="26" height="20" rx="2.5" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="3.5 2.5"/>
          <path d="M11 18h14M11 23h9" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M11 7h8" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
    </div>
  )
}

// ─── Skill Row ───────────────────────────────────────────────────────────────
export function SkillRow({ label, skills, variant }: { label: string; skills?: string[]; variant?: string }) {
  if (!skills || skills.length === 0) return null
  return (
    <div className="skill-row">
      <span className="skill-section-label">{label}</span>
      <div className="chip-list">
        {skills.map((s, i) => <SkillChip key={i} label={s} variant={variant} />)}
      </div>
    </div>
  )
}

// ─── Icon Primitives ─────────────────────────────────────────────────────────
export function SparkleIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1L7.5 4.5H11L8 6.5 9.2 10 6 8 2.8 10 4 6.5 1 4.5h3.5z"
            stroke={color} strokeWidth="1.1" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

export function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
         style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease', flexShrink: 0 }}>
      <path d="M2.5 4.5l4 4 4-4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M10.5 6A4.5 4.5 0 111.5 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M10.5 2.5V6H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M5.5.5v10M.5 5.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function UploadIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M5.5.5v6M2.5 3.5l3-3 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M.5 8v1.5a1 1 0 001 1h8a1 1 0 001-1V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    id: 'processes',
    label: 'Processes',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M1.5 5A1.5 1.5 0 013 3.5h3.086a1.5 1.5 0 011.06.44l.415.413A1.5 1.5 0 008.622 4.5H12A1.5 1.5 0 0113.5 6v5A1.5 1.5 0 0112 12.5H3A1.5 1.5 0 011.5 11V5z" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    id: 'positions',
    label: 'Positions',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1.5" y="4.5" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 4.5V3.5a1 1 0 011-1h3a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M1.5 8.5h12" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    id: 'candidates',
    label: 'Candidates',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M2 13c0-3.038 2.462-5.5 5.5-5.5S13 9.962 13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'ranking',
    label: 'Ranking',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M1.5 10L5 7l3 2.5 3.5-5L15 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M1.5 13h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export function Sidebar({ page, setPage }: { page: string; setPage: (page: string) => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">Σ</div>
        <div className="logo-name">open<em>ATS</em></div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item${page === item.id ? ' active' : ''}`}
            onClick={() => setPage(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-row">
          <span className="footer-key">tenant</span>
          <span className="footer-val">demo</span>
        </div>
        <div className="sidebar-footer-row">
          <span className="footer-key">api</span>
          <span className="footer-val">localhost:3000</span>
        </div>
      </div>
    </aside>
  )
}

export { useEffect, useRef }
