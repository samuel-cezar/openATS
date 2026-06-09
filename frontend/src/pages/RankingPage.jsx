import { useState, useEffect } from 'react'
import { api } from '../api'
import {
  useToast, Spinner, ScoreDisplay, EmptyState,
  SparkleIcon, RefreshIcon,
} from '../components'

export default function RankingPage({ processes }) {
  const toast = useToast()
  const [positions, setPositions]   = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [ranking, setRanking]       = useState(null)
  const [computing, setComputing]   = useState(false)
  const [loadingRanking, setLoadingRanking] = useState(false)

  useEffect(() => {
    api.getPositions()
      .then(setPositions)
      .catch(e => toast(e.message, 'error'))
  }, [])

  useEffect(() => {
    if (selectedId) { setRanking(null); fetchRanking() }
  }, [selectedId])

  async function fetchRanking() {
    setLoadingRanking(true)
    try {
      const data = await api.getPositionRanking(selectedId)
      const list = Array.isArray(data) ? data
        : (data.ranking || data.data || data.results || [])
      setRanking(list)
    } catch (e) {
      if (!e.message.includes('404') && !e.message.includes('Not Found')) {
        toast(e.message, 'error')
      }
      setRanking([])
    } finally { setLoadingRanking(false) }
  }

  async function handleCompute() {
    if (!selectedId) return
    setComputing(true)
    try {
      await api.computeMatches(selectedId)
      toast('Rankings computed successfully')
      await fetchRanking()
    } catch (e) { toast(e.message, 'error') }
    finally { setComputing(false) }
  }

  function rankStyle(rank) {
    if (rank === 1) return 'rank-gold'
    if (rank === 2) return 'rank-silver'
    if (rank === 3) return 'rank-bronze'
    return 'rank-n'
  }

  const selectedPosition = positions.find(p => (p.id || p._id) === selectedId)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ranking</h1>
          <p className="page-sub">
            {selectedPosition
              ? `Candidates ranked for: ${selectedPosition.title}`
              : 'Select a position to view AI-computed match scores'}
          </p>
        </div>
      </div>

      <div className="rank-controls">
        <select
          className="form-select rank-select"
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          <option value="">Select a position…</option>
          {positions.map(p => (
            <option key={p.id || p._id} value={p.id || p._id}>{p.title}</option>
          ))}
        </select>

        <div className="rank-control-actions">
          <button
            className="btn btn-ghost btn-sm"
            disabled={!selectedId || loadingRanking}
            onClick={fetchRanking}
          >
            {loadingRanking
              ? <><Spinner dark /> Loading…</>
              : <><RefreshIcon /> Refresh</>
            }
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={!selectedId || computing}
            onClick={handleCompute}
          >
            {computing
              ? <><Spinner /> Computing…</>
              : <><SparkleIcon color="white" /> Compute Rankings</>
            }
          </button>
        </div>
      </div>

      <div className="card">
        {!selectedId ? (
          <EmptyState
            title="No position selected"
            description="Choose a position above to view or compute candidate rankings."
          />
        ) : loadingRanking ? (
          <div className="card-loading"><Spinner dark /></div>
        ) : !ranking || ranking.length === 0 ? (
          <EmptyState
            title="No rankings yet"
            description='Click "Compute Rankings" to score all processed candidates against this position.'
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Rank</th>
                <th>Candidate</th>
                <th style={{ textAlign: 'right', paddingRight: 20 }}>Total</th>
                <th style={{ textAlign: 'right', paddingRight: 20 }}>Hard Skills</th>
                <th style={{ textAlign: 'right', paddingRight: 24 }}>Soft Skills</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((entry, i) => {
                const rank = entry.rank != null ? Number(entry.rank) : i + 1
                const totalScore = entry.totalScore ?? entry.score ?? entry.total
                const hardScore  = entry.hardScore  ?? entry.hardSkillScore  ?? entry.hard
                const softScore  = entry.softScore  ?? entry.softSkillScore  ?? entry.soft
                const name = entry.candidateName || entry.name || entry.candidate?.name || '—'
                const email = entry.email || entry.candidate?.email

                return (
                  <tr key={entry.candidateId || entry.id || i}>
                    <td>
                      <div className={`rank-badge ${rankStyle(rank)}`}>{rank}</div>
                    </td>
                    <td>
                      <div className="cell-bold">{name}</div>
                      {email && (
                        <div className="cell-mono cell-muted" style={{ fontSize: '11.5px', marginTop: 1 }}>
                          {email}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 20 }}>
                      <ScoreDisplay value={totalScore} />
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 20 }}>
                      <ScoreDisplay value={hardScore} />
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 24 }}>
                      <ScoreDisplay value={softScore} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {ranking && ranking.length > 0 && (
        <div className="score-legend">
          <span className="score score-high">≥ 75%</span> excellent match
          <span className="legend-sep" />
          <span className="score score-mid">50–74%</span> partial match
          <span className="legend-sep" />
          <span className="score score-low">&lt; 50%</span> weak match
        </div>
      )}
    </div>
  )
}
