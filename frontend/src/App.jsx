import { useState } from 'react'
import { ToastProvider, Sidebar } from './components'
import ProcessesPage from './pages/ProcessesPage'
import PositionsPage from './pages/PositionsPage'
import CandidatesPage from './pages/CandidatesPage'
import RankingPage from './pages/RankingPage'

export default function App() {
  const [page, setPage] = useState(
    () => localStorage.getItem('ats_nav') || 'processes'
  )
  const [processes, setProcesses] = useState([])

  function navigate(p) {
    setPage(p)
    localStorage.setItem('ats_nav', p)
  }

  return (
    <ToastProvider>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar page={page} setPage={navigate} />
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {page === 'processes' && (
            <ProcessesPage processes={processes} setProcesses={setProcesses} />
          )}
          {page === 'positions' && (
            <PositionsPage processes={processes} />
          )}
          {page === 'candidates' && (
            <CandidatesPage />
          )}
          {page === 'ranking' && (
            <RankingPage processes={processes} />
          )}
        </main>
      </div>
    </ToastProvider>
  )
}
