import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authHeader = req.headers.authorization || ''
    
    if (req.method === 'GET') {
      const r = await axios.get(process.env.BACKEND_URL + '/user/profile', {
        headers: { Authorization: authHeader }
      })
      res.status(200).json(r.data)
    } else if (req.method === 'PUT') {
      const r = await axios.put(process.env.BACKEND_URL + '/user/profile', req.body, {
        headers: { Authorization: authHeader }
      })
      res.status(200).json(r.data)
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
