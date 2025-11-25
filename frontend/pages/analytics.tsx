import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const exercises = [
  'Incline Dumbbell Press',
  'Smith Machine Press',
  'Overhead Press',
  'Lateral Raises',
  'Pec Deck / Machine Fly',
  'Cable Fly (Low-to-High)',
  'Leg Extension',
  'Smith Machine Squat',
  'Romanian Deadlift',
]

export default function Analytics() {
  const [exercise, setExercise] = useState<string>(exercises[0])
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    fetchData(exercise)
  }, [exercise])

  async function fetchData(ex: string) {
    try {
      const r = await axios.get('/api/analytics_proxy', { params: { exercise: ex } })
      const payload = r.data?.data || []
      setData(payload)
    } catch (e) {
      console.error(e)
      setData([])
    }
  }

  const hasCalories = data.some((d) => d.calories !== undefined && d.calories !== null)

  return (
    <div style={{ padding: 24 }}>
      <h1>Analytics</h1>
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="exercise">Exercise:&nbsp;</label>
        <select id="exercise" value={exercise} onChange={(e) => setExercise(e.target.value)}>
          {exercises.map((ex) => (
            <option key={ex} value={ex}>{ex}</option>
          ))}
        </select>
      </div>

      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="weight" stroke="#8884d8" name="Weight" />
            <Line type="monotone" dataKey="pr" stroke="#82ca9d" name="PR" />
            <Line type="monotone" dataKey="intensity" stroke="#ff7300" name="Intensity" />
            {hasCalories && <Line type="monotone" dataKey="calories" stroke="#888888" name="Calories" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
