import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const r = await axios.post(process.env.BACKEND_URL + '/session', req.body)
    res.status(200).json(r.data)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
