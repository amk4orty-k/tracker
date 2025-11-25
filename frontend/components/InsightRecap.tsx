import React from 'react'

const recapText = "Project recap (auto-generated):\n\n- Frontend: Next.js + TypeScript app providing a centered weekly gym view with a 7-day split (Chest, Legs, Rest, Back, Shoulders & Arms, Rest, Rest).\n- Session flow: two-layer UX (week summary -> Start Session -> active session with multi-set rows). Start/End session flow persists finished days in localStorage.\n- Recommendations: rule-based + AI-style placeholders via a proxy; per-exercise PO suggestions are seeded from a simple user profile and stored in localStorage under 'poTargets'.\n- Persistence: weekly weight, daily calories, finished sessions are stored in localStorage keys: weeklyWeights, dailyCalories, finishedSessions.\n- UX additions: \"Done\" and \"Missed\" badges on day cards, streak tracking (current & best stored as bestStreak), seeded initial set weights, progressive overload badges, and improved spacing / glass UI.\n- Styling: dark glass theme with gradients; upgraded to use a softer, glowy dark-blue palette with '--user-accent' variable for future per-user color customization.\n- Components: small StatsPanel and the new InsightRecap (this component) to prepare a textual summary for external tools or ChatGPT ingestion.\n\nNotes for ChatGPT: this project stores much state in localStorage for quick UX testing; backend proxies exist but may be stubbed. The best way to align a model with this project is to ingest this recap and then ask for targeted changes (e.g., persist substitutions to backend, implement analytics endpoints, or improve recommendation heuristics)."

export default function InsightRecap() {
  function copyToClipboard() {
    try {
      navigator.clipboard.writeText(recapText)
      alert('Recap copied to clipboard')
    } catch (e) {
      console.error('copy failed', e)
      alert('Copy failed — select and copy manually')
    }
  }

  function downloadRecap() {
    const blob = new Blob([recapText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gym-tracker-recap.txt'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="glass" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 800, color: 'var(--user-accent)' }}>Project Insight Recap</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{recapText}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={copyToClipboard}>Copy to clipboard</button>
        <button className="btn" onClick={downloadRecap}>Download</button>
      </div>
    </div>
  )
}
