import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

// Simple proxy so the frontend can call backend without dealing with CORS
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { exercise } = req.query
  try {
    const authHeader = req.headers.authorization || ''
    const r = await axios.get(process.env.BACKEND_URL + '/recommendation_dynamic', {
      params: { exercise },
      headers: { Authorization: authHeader }
    })
    res.status(200).json(r.data)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
