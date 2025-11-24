import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const backend = process.env.BACKEND_URL || 'http://localhost:8000'
  try {
    const resp = await fetch(`${backend}/weights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })
    const data = await resp.json().catch(() => ({}))
    return res.status(resp.status).json(data)
  } catch (e: any) {
    return res.status(500).json({ error: String(e) })
  }
}
