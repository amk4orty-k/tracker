import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { exercise } = req.query
  try {
    const r = await axios.get(process.env.BACKEND_URL + '/analytics', { params: { exercise } })
    res.status(200).json(r.data)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
