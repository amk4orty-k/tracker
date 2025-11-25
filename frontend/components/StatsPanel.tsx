import React, { useState } from 'react'
import axios from 'axios'

export default function StatsPanel() {
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
    <div className="glass-card">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-indigo-500/10 rounded-lg">
          <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-white">Stats & PRs</h3>
          <div className="text-xs text-slate-400">Quick PRs and plateau detection.</div>
        </div>
      </div>

      <div className="mt-4">
        <button
          className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-colors border border-white/5"
          onClick={load}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Load PRs'}
        </button>
      </div>

      {error && <div className="mt-3 text-xs text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">{error}</div>}

      {data && (
        <div className="mt-4 space-y-3">
          {data.prs ? (
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Personal Records</div>
              <ul className="space-y-2">
                {Object.entries(data.prs).map(([ex, val]) => (
                  <li key={ex} className="flex justify-between items-center text-sm border-b border-white/5 pb-1 last:border-0">
                    <span className="text-slate-300">{ex}</span>
                    <strong className="text-indigo-400">{(val as any).weight} kg</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : <div className="text-xs text-slate-500 italic text-center">No PRs found</div>}
        </div>
      )}
    </div>
  )
}
