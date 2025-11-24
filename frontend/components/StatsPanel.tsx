import React, { useState } from 'react'
import axios from 'axios'

export default function StatsPanel(){
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await axios.get('/api/analytics')
      setData(res.data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="glass" style={{ padding:12 }}>
      <div style={{ fontWeight:700 }}>Stats & PRs</div>
      <div style={{ marginTop:8, color:'var(--muted)', fontSize:13 }}>Quick PRs and plateau detection.</div>
      <div style={{ marginTop:10 }}>
        <button className="btn" onClick={load} disabled={loading}>{loading? 'Loading…':'Load PRs'}</button>
      </div>
      {error ? <div style={{ marginTop:8, color:'#ffb3c7' }}>{error}</div> : null}
      {data ? (
        <div style={{ marginTop:10 }}>
          {data.prs ? (
            <div>
              <div style={{ fontWeight:700 }}>PRs</div>
              <ul>
                {Object.entries(data.prs).map(([ex, val]) => (
                  <li key={ex} style={{ marginTop:6 }}>{ex}: <strong>{(val as any).weight} kg</strong></li>
                ))}
              </ul>
            </div>
          ) : <div style={{ color:'var(--muted)', marginTop:8 }}>No PRs found</div>}
        </div>
      ) : null}
    </div>
  )
}
