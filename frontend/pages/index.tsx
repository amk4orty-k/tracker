import React, { CSSProperties, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import StatsPanel from '../components/StatsPanel'
import SettingsPanel from '../components/SettingsPanel'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'

type RuleRecommendation = {
  recommended_weight: number
  recommended_reps: number
  note?: string
}

type AiRecommendation = {
  ai_weight?: number
  ai_reps?: number
  ai_note?: string
  fatigue_adjusted?: boolean
  fatigue_score?: number
  calories_correlation?: number | null
}

type Recommendation = {
  rule?: RuleRecommendation
  ai?: AiRecommendation
  recommended_sets?: number
  substitutions?: string[]
}

type SetEntry = {
  set_number: number
  weight?: number | string
  reps?: number | string
  intensity?: number
  manual?: boolean
  done?: boolean
  feedback?: 'too_easy' | 'too_hard' | 'on_target'
}

type ExerciseRow = {
  exercise: string
  setsCount: number
  sets: SetEntry[]
}

// Define explicit 7-day split the user requested:
// Chest, Legs, Rest, Back, Shoulders & Arms, Rest, Rest
const dayTypes = ['Chest', 'Legs', 'Rest', 'Back', 'Shoulders & Arms', 'Rest', 'Rest']

const exerciseGroups: Record<string, string[]> = {
  Chest: [
    'Incline Dumbbell Press',
    'Smith Machine Press',
    'Pec Deck / Machine Fly',
    'Cable Fly (Low-to-High)',
    // add two shoulder-focused assistance movements so shoulders are trained twice weekly
    'Lateral Raises',
    'Shoulder Press',
  ],
  Back: [
    'Romanian Deadlift',
    'Bent-over Row',
    'Lat Pulldown',
    'Seated Cable Row',
  ],
  Legs: [
    'Leg Extension',
    'Smith Machine Squat',
    'Romanian Deadlift',
    'Smith Machine Lunges',
    'Seated Leg Curl',
    'Standing Calf Raise',
  ],
  'Shoulders & Arms': [
    // merge shoulders + arms into one training day
    'Overhead Press',
    'Lateral Raises',
    'Front Raises',
    'Rear Delt Fly',
    'Barbell Curl',
    'Dumbbell Hammer Curl',
    'Triceps Pushdown',
    'Overhead Triceps Extension',
  ],
}

const exercises = exerciseGroups['Chest']

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number }

type UserProfile = {
  sex: 'male' | 'female'
  age: number
  weightKg: number
  heightCm: number
  maintenanceCalories: number
  idealWeightKg?: number
  current_weight_kg?: number
  height_cm?: number
  ideal_weight_kg?: number
  theme_color?: string
}

const IconCalendarSpark = ({ size = 18, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x={3.5} y={4.5} width={17} height={15} rx={2.2} ry={2.2} />
    <path d="M8 3v3" />
    <path d="M16 3v3" />
    <path d="M3.5 9.5h17" />
    <path d="m12 12 1.1 2.3 2.5.2-2 1.6.6 2.5-2.2-1.2-2.2 1.2.6-2.5-2-1.6 2.5-.2Z" />
  </svg>
)

const IconBarbell = ({ size = 18, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 12h18" />
    <path d="M6 9v6" />
    <path d="M18 9v6" />
    <path d="M9 8v8" />
    <path d="M15 8v8" />
  </svg>
)

const IconWave = ({ size = 18, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 15c1.5-2.2 2.5-3.2 4-3.2s2.5 2 4 2 2.5-3.2 4-3.2 2.4 2.2 6 5.4" />
    <path d="M3 19c1.7-2.1 2.6-3 4-3s2.5 1.6 4 1.6 2.6-2.6 4-2.6 2.7 2.3 6 5" />
  </svg>
)

const IconGauge = ({ size = 18, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M5 16a7 7 0 0 1 14 0" />
    <path d="M12 10v4l2 2" />
    <path d="M9 21h6" />
  </svg>
)

const IconStreak = ({ size = 18, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M13 2 5 14h6l-1 8 9-12h-6Z" />
  </svg>
)

const IconTrophy = ({ size = 18, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M8 4h8v3a3 3 0 0 0 3 3h1" />
    <path d="M16 4V2" />
    <path d="M8 4V2" />
    <path d="M4 10h1a3 3 0 0 0 3-3V4H4Z" />
    <path d="M12 14c3 0 4-2.4 4-4.5V4H8v5.5C8 11.6 9 14 12 14Z" />
    <path d="M10 14v2.2a2 2 0 0 1-.9 1.66L7 19.5h10l-2.1-1.64a2 2 0 0 1-.9-1.66V14" />
  </svg>
)

const IconTarget = ({ size = 18, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx={12} cy={12} r={7} />
    <circle cx={12} cy={12} r={3} />
    <path d="M12 3V2" />
    <path d="M21 12h1" />
    <path d="M12 22v-1" />
    <path d="M2 12h1" />
  </svg>
)

function defaultSetsForExercise(ex: string) {
  // Simple heuristic: compound lifts -> 4, isolation -> 3
  const compound = ['Incline Dumbbell Press', 'Smith Machine Press', 'Romanian Deadlift', 'Bent-over Row', 'Lat Pulldown', 'Seated Cable Row', 'Smith Machine Squat', 'Smith Machine Lunges', 'Overhead Press']
  const isolation = ['Pec Deck / Machine Fly', 'Cable Fly (Low-to-High)', 'Lateral Raises', 'Front Raises', 'Rear Delt Fly', 'Barbell Curl', 'Dumbbell Hammer Curl', 'Triceps Pushdown', 'Overhead Triceps Extension', 'Leg Extension', 'Seated Leg Curl', 'Standing Calf Raise', 'Ab Crunches', 'Weighted Leg Raises']
  if (compound.includes(ex)) return 4
  if (isolation.includes(ex)) return 3
  return 3
}

export default function Home() {
  const router = useRouter()
  const { session, user, loading, signOut } = useAuth()

  const [rows, setRows] = useState<ExerciseRow[]>([])
  const [recs, setRecs] = useState<Record<string, Recommendation>>({})
  const [submitting, setSubmitting] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string>('Chest')
  const [sessionFinished, setSessionFinished] = useState<boolean>(false)
  const [sessionActive, setSessionActive] = useState<boolean>(false)
  const [bodyWeight, setBodyWeight] = useState<number | ''>('')
  const [weeklyWeights, setWeeklyWeights] = useState<{ weekStart: string; weight: number }[]>([])
  const [poTargets, setPoTargets] = useState<Record<string, number>>({})
  const [acceptedSubs, setAcceptedSubs] = useState<Record<string, string>>({})
  const [caloriesToday, setCaloriesToday] = useState<number | ''>('')
  const [dailyCalories, setDailyCalories] = useState<Record<string, number>>({})
  const [calorieSurplus, setCalorieSurplus] = useState<number>(0)
  const [finishedSessions, setFinishedSessions] = useState<Record<string, boolean>>({})
  const [streakCurrent, setStreakCurrent] = useState<number>(0)
  const [streakBest, setStreakBest] = useState<number>(0)
  const [skippedSessions, setSkippedSessions] = useState<Record<string, boolean>>({})
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null)
  const [confirmSkipFor, setConfirmSkipFor] = useState<string | null>(null)
  const [celebrateMilestone, setCelebrateMilestone] = useState<number | null>(null)
  const [idealWeightGoal, setIdealWeightGoal] = useState<number | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !session) {
      router.push('/login')
    }
  }, [loading, session, router])

  // Load user profile on mount
  useEffect(() => {
    if (!loading && session) {
      loadUserProfile()
    }
  }, [loading, session])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const rawWeights = localStorage.getItem('weeklyWeights')
      if (rawWeights) {
        const parsed = JSON.parse(rawWeights)
        if (Array.isArray(parsed)) {
          setWeeklyWeights(parsed)
          if (parsed.length && typeof parsed[0]?.weight === 'number') {
            setBodyWeight(parsed[0].weight)
          }
        }
      }

      const rawPo = localStorage.getItem('poTargets')
      if (rawPo) {
        const parsed = JSON.parse(rawPo)
        if (parsed && typeof parsed === 'object') setPoTargets(parsed)
      }

      const rawCalories = localStorage.getItem('dailyCalories')
      if (rawCalories) {
        const parsed = JSON.parse(rawCalories)
        if (parsed && typeof parsed === 'object') {
          setDailyCalories(parsed)
          const todayStr = new Date().toISOString().slice(0, 10)
          if (parsed[todayStr]) setCaloriesToday(parsed[todayStr])
        }
      }

      const rawFinished = localStorage.getItem('finishedSessions')
      if (rawFinished) {
        const parsed = JSON.parse(rawFinished)
        if (parsed && typeof parsed === 'object') setFinishedSessions(parsed)
      }

      const rawSkipped = localStorage.getItem('skippedSessions')
      if (rawSkipped) {
        const parsed = JSON.parse(rawSkipped)
        if (parsed && typeof parsed === 'object') setSkippedSessions(parsed)
      }

      const rawBest = localStorage.getItem('bestStreak')
      if (rawBest) setStreakBest(Number(rawBest))

      const rawIdeal = localStorage.getItem('idealWeightGoal')
      if (rawIdeal) setIdealWeightGoal(Number(rawIdeal))

      const rawSurplus = localStorage.getItem('calorieSurplus')
      if (rawSurplus) setCalorieSurplus(Number(rawSurplus))
    } catch (e) {
      console.warn('initial load failed', e)
    }
  }, [])

  // Compute streak when finishedSessions changes
  useEffect(() => {
    // Count consecutive training days up to today that are finished
    let count = 0
    const today = new Date()
    for (let d = 0; d < 365; d++) {
      const dd = new Date()
      dd.setDate(today.getDate() - d)
      const dateStr = dd.toISOString().slice(0,10)
      const dayIndex = (dd.getDay() + 6) % 7
      const dayType = dayTypes[dayIndex]
      if (dayType === 'Rest') continue
      if (finishedSessions[dateStr]) {
        count += 1
      } else {
        break
      }
    }
    setStreakCurrent(count)
    try {
      const rawBest = localStorage.getItem('bestStreak')
      const prevBest = rawBest ? Number(rawBest) : 0
      if (count > prevBest) {
        localStorage.setItem('bestStreak', String(count))
        setStreakBest(count)
      } else {
        setStreakBest(prevBest)
      }
    } catch (e) { console.warn('streak persist failed', e) }
  }, [finishedSessions])

  // Celebrate milestones (3,7,14,30) once
  useEffect(() => {
    const milestones = [3,7,14,30]
    try {
      const lastRaw = localStorage.getItem('lastCelebrated') || '0'
      const last = Number(lastRaw)
      if (milestones.includes(streakCurrent) && streakCurrent > last) {
        setCelebrateMilestone(streakCurrent)
        localStorage.setItem('lastCelebrated', String(streakCurrent))
        window.setTimeout(() => setCelebrateMilestone(null), 4200)
      }
    } catch (e) { console.warn('celebrate check failed', e) }
  }, [streakCurrent])

  // Initialize selectedDateStr to today if not set
  useEffect(() => {
    if (!selectedDateStr) {
      const today = new Date().toISOString().slice(0, 10)
      setSelectedDateStr(today)
    }
  }, [selectedDateStr])

  // Build rows when selectedDay changes
  useEffect(() => {
    const profile = getUserProfile()
    const initial = buildRowsForDay(selectedDay, profile)

    if (!initial.length) {
      setRows([])
      setRecs({})
      return
    }

    setRows(initial)
    if (Object.keys(poTargets).length === 0) {
      persistPoTargets(baselinePoTargets(profile))
    }

    fetchRecommendations(initial)
  }, [selectedDay])

  async function loadUserProfile() {
    try {
      const headers = await getAuthHeaders()
      const res = await axios.get('/api/profile_proxy', { headers })
      setUserProfile(res.data)
      // Apply theme color
      const hue = colorToHue(res.data.theme_color)
      document.documentElement.style.setProperty('--theme-hue', hue.toString())
    } catch (e) {
      console.error('Failed to load profile', e)
      // Set defaults
      setUserProfile({
        sex: 'male',
        age: 25,
        weightKg: 70,
        heightCm: 175,
        maintenanceCalories: 3000,
        idealWeightKg: 85
      })
    }
  }

  function colorToHue(hex: string): number {
    // Map common colors to hue values
    const colorMap: Record<string, number> = {
      '#ff2f54': 348, // Crimson (default)
      '#00bfff': 200, // Electric Blue
      '#ba55d3': 280, // Purple
      '#50c878': 140, // Emerald
      '#ff8c42': 30,  // Orange
      '#ff69b4': 320, // Pink
      '#00e5ff': 180, // Cyan
      '#32cd32': 75,  // Lime
    }
    return colorMap[hex] || 348
  }

  const baseFieldStyle: CSSProperties = {
    background: 'rgba(8, 14, 26, 0.55)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 10,
    padding: '8px 10px',
    color: '#ecf6ff',
    fontSize: 13,
  }

  // Helper to get auth headers for API calls
  const getAuthHeaders = async () => {
    if (!session) return {}
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    return currentSession?.access_token ? { Authorization: `Bearer ${currentSession.access_token}` } : {}
  }

  // Show loading state while checking auth
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 100%)',
        color: '#dc143c',
        fontSize: '1.5rem',
      }}>
        Loading...
      </div>
    )
  }

  // Don't render anything if not authenticated (router will redirect)
  if (!session) {
    return null
  }

  // Simple user profile - now loaded from backend
  function getUserProfile(): UserProfile {
    if (userProfile) {
      return {
        sex: userProfile.sex || 'male',
        age: userProfile.age || 25,
        weightKg: userProfile.current_weight_kg || 70,
        heightCm: userProfile.height_cm || 175,
        maintenanceCalories: calculateMaintenanceCalories(userProfile)
      }
    }
    return { sex: 'male', age: 25, weightKg: 70, heightCm: 175, maintenanceCalories: 3000 }
  }

  function getIdealProfile(): UserProfile {
    if (userProfile) {
      return {
        sex: userProfile.sex || 'male',
        age: userProfile.age || 25,
        weightKg: userProfile.ideal_weight_kg || 85,
        heightCm: userProfile.height_cm || 175,
        maintenanceCalories: calculateMaintenanceCalories({
          ...userProfile,
          current_weight_kg: userProfile.ideal_weight_kg
        })
      }
    }
    return { sex: 'male', age: 25, weightKg: 85, heightCm: 175, maintenanceCalories: 3400 }
  }

  function calculateMaintenanceCalories(profile: any): number {
    const weight = profile.current_weight_kg || profile.weightKg || 70
    const height = profile.height_cm || profile.heightCm || 175
    const age = profile.age || 25
    const sex = profile.sex || 'male'
    
    // Mifflin-St Jeor Equation
    let bmr: number
    if (sex === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161
    }
    
    // Activity factor for moderate activity (gym 4-5x/week)
    return Math.round(bmr * 1.55)
  }

  function computeInitialWeightForExercise(exercise: string, profile: UserProfile) {
    // Base multipliers by exercise type (conservative initial estimates)
    const bw = profile.weightKg || 70
    const map: Record<string, number> = {
      // chest/presses
      'Incline Dumbbell Press': 0.35, // per DB per hand; we'll return total per hand equivalent
      'Smith Machine Press': 0.6,
      'Pec Deck / Machine Fly': 0.25,
      'Cable Fly (Low-to-High)': 0.2,
      // back
      'Romanian Deadlift': 1.1,
      'Bent-over Row': 0.7,
      'Lat Pulldown': 0.6,
      'Seated Cable Row': 0.6,
      // legs
      'Leg Extension': 0.45,
      'Smith Machine Squat': 1.2,
      'Smith Machine Lunges': 0.6,
      'Seated Leg Curl': 0.4,
      'Standing Calf Raise': 0.25,
      // shoulders/arms
      'Overhead Press': 0.45,
      'Lateral Raises': 0.08,
      'Front Raises': 0.08,
      'Rear Delt Fly': 0.12,
      'Barbell Curl': 0.18,
      'Dumbbell Hammer Curl': 0.12,
      'Triceps Pushdown': 0.12,
      'Overhead Triceps Extension': 0.12,
      // fallbacks
    }
    const factor = map[exercise] ?? 0.25
    // nudge estimate slightly upward to stimulate adaptation (push comfort zone)
    const raw = Math.max(2.5, bw * factor * 1.08)
    const estimated = Math.round(raw * 2) / 2
    return estimated
  }

  function seedPoForExercise(exercise: string, profile: UserProfile) {
    // Conservative kg/week targets by exercise complexity
    const compounds = ['Incline Dumbbell Press','Smith Machine Press','Romanian Deadlift','Bent-over Row','Smith Machine Squat','Overhead Press']
    if (compounds.includes(exercise)) return 0.5
    return 0.25
  }

  function markFinishedFor(dateStr: string) {
    const next = { ...finishedSessions, [dateStr]: true }
    setFinishedSessions(next)
    try { localStorage.setItem('finishedSessions', JSON.stringify(next)) } catch(e){ console.warn(e) }
  }

  function markSkippedFor(dateStr: string) {
    const next = { ...skippedSessions, [dateStr]: true }
    setSkippedSessions(next)
    try { localStorage.setItem('skippedSessions', JSON.stringify(next)) } catch(e){ console.warn(e) }
  }

  function saveDailyCaloriesFor(dateStr: string, kcal: number) {
    const next = { ...dailyCalories, [dateStr]: kcal }
    setDailyCalories(next)
    try { localStorage.setItem('dailyCalories', JSON.stringify(next)) } catch(e){ console.warn(e) }
  }

  function baselinePoTargets(profile: UserProfile) {
    const map: Record<string, number> = {}
    Object.values(exerciseGroups).forEach(group => {
      group.forEach((exercise) => {
        map[exercise] = seedPoForExercise(exercise, profile)
      })
    })
    return map
  }

  function avgRecentCalories() {
    const ordered = Object.entries(dailyCalories)
      .filter(([, val]) => typeof val === 'number' && !Number.isNaN(val))
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 7)
      .map(([, val]) => Number(val))
    if (!ordered.length) return null
    const total = ordered.reduce((acc, val) => acc + val, 0)
    return total / ordered.length
  }

  function calorieSuggestion() {
    const profile = getUserProfile()
    const maintenance = profile.maintenanceCalories ?? ((profile.weightKg || 70) * 30)
    return Math.round(maintenance + calorieSurplus)
  }

  function resetPlannerState() {
    const profile = getUserProfile()
    const ideal = getIdealProfile()
    const todayIso = new Date().toISOString().slice(0, 10)

    const hasWindow = typeof window !== 'undefined'

    if (hasWindow) {
      const keys = ['poTargets', 'finishedSessions', 'skippedSessions', 'dailyCalories', 'weeklyWeights', 'calorieSurplus', 'idealWeightGoal', 'bestStreak', 'lastCelebrated']
      keys.forEach((key) => {
        try { localStorage.removeItem(key) } catch (e) { console.warn('reset failed removing', key, e) }
      })
    }

    const poSeed = baselinePoTargets(profile)
    persistPoTargets(poSeed)

    const currentWeek = getWeekStart()
    const baselineWeights = [{ weekStart: currentWeek, weight: profile.weightKg }]
    setWeeklyWeights(baselineWeights)
    if (hasWindow) {
      try { localStorage.setItem('weeklyWeights', JSON.stringify(baselineWeights)) } catch (e) { console.warn('reset weeklyWeights persist failed', e) }
    }

    setBodyWeight(profile.weightKg)
    setDailyCalories({})
    setCaloriesToday('')
    setFinishedSessions({})
    setSkippedSessions({})
    setConfirmSkipFor(null)
    setSessionActive(false)
    setSessionFinished(false)
    setAcceptedSubs({})
    setRecs({})
    setStreakCurrent(0)
    setStreakBest(0)
    setCelebrateMilestone(null)
    setCalorieSurplus(0)
    if (hasWindow) {
      try { localStorage.setItem('calorieSurplus', '0') } catch (e) { console.warn('reset calorieSurplus persist failed', e) }
    }
    setIdealWeightGoal(ideal.weightKg)
    if (hasWindow) {
      try { localStorage.setItem('idealWeightGoal', String(ideal.weightKg)) } catch (e) { console.warn('reset idealWeightGoal persist failed', e) }
    }
    setSelectedDateStr(todayIso)

    const rebuilt = buildRowsForDay(selectedDay, profile)
    setRows(rebuilt)
    if (rebuilt.length) {
      fetchRecommendations(rebuilt)
    }
  }

  function getLastMissedDate() {
    const today = new Date()
    for (let d = 1; d < 30; d++) {
      const dd = new Date()
      dd.setDate(today.getDate() - d)
      const dateStr = dd.toISOString().slice(0,10)
      const dayIndex = (dd.getDay() + 6) % 7
      const dayType = dayTypes[dayIndex]
      if (dayType === 'Rest') continue
      if (!finishedSessions[dateStr] && !skippedSessions[dateStr]) return dateStr
    }
    return null
  }

  function getTopPRs(limit = 3) {
    try {
      const items = Object.keys(recs).map((ex) => ({ exercise: ex, weight: (recs[ex]?.ai?.ai_weight as number) || (recs[ex]?.rule?.recommended_weight as number) || 0 }))
      const filtered = items.filter(i => i.weight && i.weight > 0)
      filtered.sort((a,b) => (b.weight as number) - (a.weight as number))
      return filtered.slice(0, limit)
    } catch (e) { return [] }
  }

  /* --- Instrumentation helpers: queue events locally and try to POST to backend '/api/instrument' --- */
  function getInstrumentQueue(): any[] {
    try {
      const raw = localStorage.getItem('instrumentQueue')
      return raw ? JSON.parse(raw) : []
    } catch (e) { return [] }
  }

  function saveInstrumentQueue(q: any[]) {
    try { localStorage.setItem('instrumentQueue', JSON.stringify(q)) } catch (e) { console.warn('saveInstrumentQueue failed', e) }
  }

  async function sendInstrumentEvent(event: any) {
    try {
      await axios.post('/api/instrument', event, { timeout: 5000 })
      return true
    } catch (e) {
      console.debug('instrument POST failed, queueing', e)
      return false
    }
  }

  async function enqueueInstrumentEvent(event: any) {
    const ok = await sendInstrumentEvent(event)
    if (!ok) {
      const q = getInstrumentQueue()
      q.push({ event, ts: Date.now() })
      saveInstrumentQueue(q)
    }
  }

  // Attempt to flush queued events
  async function flushInstrumentQueue() {
    const q = getInstrumentQueue()
    if (!q || !q.length) return
    const remaining: any[] = []
    for (const item of q) {
      const ok = await sendInstrumentEvent(item.event)
      if (!ok) remaining.push(item)
    }
    saveInstrumentQueue(remaining)
  }

  async function fetchRecommendations(currentRows: ExerciseRow[]) {
    try {
      const headers = await getAuthHeaders()
      const calls = currentRows.map((r) => axios.get('/api/recommendation_proxy', { params: { exercise: r.exercise }, headers }))
      const results = await Promise.allSettled(calls)
      const next: Record<string, Recommendation> = {}
      results.forEach((res, idx) => {
        const ex = currentRows[idx].exercise
        if (res.status === 'fulfilled') {
          const data = res.value.data
          next[ex] = {
            rule: {
              recommended_weight: data.recommended_weight,
              recommended_reps: data.recommended_reps,
              note: data.note,
            },
            ai: data.ai_recommendation || undefined,
            recommended_sets: data.recommended_sets,
            substitutions: data.substitutions,
          }
        }
      })
      if (Object.keys(next).length) setRecs((prev) => ({ ...prev, ...next }))
    } catch (e) {
      console.error('fetchRecommendations error', e)
    }
  }

  function aiConfidenceLabel(ai: AiRecommendation) {
    const score = typeof ai?.fatigue_score === 'number' ? ai.fatigue_score : 0
    if (score >= 0.66) return 'High'
    if (score >= 0.33) return 'Moderate'
    return 'Low'
  }

  function openDay(day: string, explicitDate?: string){
    setSelectedDay(day)
    // derive the dateStr for the clicked day by finding the matching day in this week when explicit not supplied
    const resolved = explicitDate ?? (() => {
      const match = getWeekDates().find((d) => dayTypes[(d.getDay() + 6) % 7] === day)
      return match ? match.toISOString().slice(0, 10) : null
    })()
    setSelectedDateStr(resolved)
    setSessionActive(false)
    setSessionFinished(false)
  }

  function formatDateLabel(dateStr: string | null) {
    if (!dateStr) return 'This week'
    const [y, m, d] = dateStr.split('-').map(Number)
    if (!y || !m || !d) return dateStr
    const date = new Date()
    date.setFullYear(y, (m || 1) - 1, d || 1)
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  }

  function startSession() {
    if (selectedDay === 'Rest') return
    setSessionActive(true)
    setSessionFinished(false)
  }

  function handleSkipSession() {
    const dateStr = selectedDateStr || new Date().toISOString().slice(0, 10)
    markSkippedFor(dateStr)
    setSessionActive(false)
    setSessionFinished(false)
    setConfirmSkipFor(null)
  }

  function getWeekStart(date = new Date()) {
    // return YYYY-MM-DD for Monday-start week
    const d = new Date(date)
    const day = (d.getDay() + 6) % 7 // Mon=0
    d.setDate(d.getDate() - day)
    return d.toISOString().slice(0,10)
  }

  function getWeekDates() {
    const start = new Date()
    const day = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - day)
    const days: Date[] = []
    for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d) }
    return days
  }

  function getWeekIndex() {
    // calculate current week index relative to the earliest saved weekly weight (or this week)
    const start = weeklyWeights && weeklyWeights.length ? weeklyWeights[weeklyWeights.length - 1].weekStart : getWeekStart()
    const s = new Date(start)
    const cur = new Date(getWeekStart())
    const diff = Math.round((+cur - +s) / (1000 * 60 * 60 * 24 * 7))
    return diff + 1
  }

  async function saveWeeklyWeight(weight: number) {
    const weekStart = getWeekStart()
    const next = [...weeklyWeights]
    const idx = next.findIndex(w => w.weekStart === weekStart)
    if (idx >= 0) next[idx] = { weekStart, weight }
    else next.unshift({ weekStart, weight })
    setWeeklyWeights(next)
    try { localStorage.setItem('weeklyWeights', JSON.stringify(next)) } catch(e){console.warn(e)}

    // Try to POST to backend proxy; ignore errors
    try {
      await axios.post('/api/weight_proxy', { weekStart, weight })
    } catch (e) {
      // backend may not have weights table; that's okay
      console.debug('weight proxy failed', e)
    }
  }

  function applyRecommendedSets(exercise: string, setsCount?: number) {
    const target = setsCount || recs[exercise]?.recommended_sets
    if (!target) return
    setRows(prev => prev.map(r => r.exercise === exercise ? ({ ...r, setsCount: target, sets: Array.from({ length: target }, (_,i) => ({ set_number: i+1, weight: '', reps: '', intensity: 7 })) }) : r))
  }

  function acceptSubstitution(exercise: string, sub: string) {
    setAcceptedSubs(prev => ({ ...prev, [exercise]: sub }))
  }

  function setPoTarget(exercise: string, kgPerWeek: number) {
    const next = { ...poTargets, [exercise]: kgPerWeek }
    persistPoTargets(next)
  }

  function getLatestWeight() {
    if (weeklyWeights && weeklyWeights.length) return weeklyWeights[0].weight
    if (bodyWeight) return Number(bodyWeight)
    return null
  }

  function roundToHundreds(n: number) { return Math.round(n/100)*100 }

  function updateSet(exIndex: number, setIndex: number, patch: Partial<SetEntry>) {
    setRows((prev) => prev.map((r, i) => {
      if (i !== exIndex) return r
      const sets = r.sets.map((s, si) => si === setIndex ? { ...s, ...patch, manualIntensity: (patch.intensity !== undefined ? true : (s as any).manualIntensity) } : s)
      return { ...r, sets }
    }))
  }

  function roundToHalf(n: number) {
    return Math.round(n * 2) / 2
  }

  function computePoSuggestion(exercise: string, setNumber: number, setsCount: number, overridePoTarget?: number) {
    // base recommendation from AI or rule
    const rec = recs[exercise]
    // prefer ai/rule base, otherwise fall back to seeded initial weight for current profile
    const baseFromRec = (rec?.ai?.ai_weight as number) || (rec?.rule?.recommended_weight as number)
    const profileForPo = getUserProfile()
    const base = (baseFromRec && baseFromRec > 0) ? baseFromRec : computeInitialWeightForExercise(exercise, profileForPo)
    const po = (overridePoTarget ?? poTargets[exercise]) ?? 0
    // distribute PO target across sets with heavier first set
    // e.g., allocate portion = po / setsCount, and bias towards first set
    const perSet = po / Math.max(1, setsCount)
    const bias = Math.max(0, 1 - (setNumber - 1) * 0.15) // slight decay per set
    const suggested = base + perSet * bias
    return roundToHalf(suggested || 0)
  }

  function persistPoTargets(next: Record<string, number>) {
    setPoTargets(next)
    try { localStorage.setItem('poTargets', JSON.stringify(next)) } catch (e) { console.warn('poTarget persist failed', e) }
  }

  function adjustPoTarget(exercise: string, delta: number) {
    const current = poTargets[exercise] ?? seedPoForExercise(exercise, getUserProfile())
    const nextVal = Math.max(0, Math.round((current + delta) * 100) / 100)
    if (delta !== 0) {
      const next = { ...poTargets, [exercise]: nextVal }
      persistPoTargets(next)
    }
    return delta !== 0 ? nextVal : current
  }

  function feedbackToIntensity(feedback?: 'too_easy' | 'too_hard' | 'on_target') {
    if (feedback === 'too_easy') return 6
    if (feedback === 'too_hard') return 9
    return 7
  }

  function handleSetFeedback(exIndex: number, setIndex: number, feedback: 'too_easy' | 'too_hard' | 'on_target') {
    const exercise = rows[exIndex]?.exercise
    if (!exercise) return
    let overrideTarget = poTargets[exercise]
    if (feedback === 'too_easy') overrideTarget = adjustPoTarget(exercise, 0.25)
    else if (feedback === 'too_hard') overrideTarget = adjustPoTarget(exercise, -0.25)
    else overrideTarget = adjustPoTarget(exercise, 0)

    const nextTarget = overrideTarget ?? poTargets[exercise]

    setRows((prev) => prev.map((r, i) => {
      if (i !== exIndex) return r
      const sets = r.sets.map((s, si) => {
        if (si !== setIndex) return s
        const nextWeight = computePoSuggestion(r.exercise, s.set_number, r.setsCount, nextTarget)
        return { ...s, feedback, intensity: feedbackToIntensity(feedback), weight: nextWeight }
      })
      return { ...r, sets }
    }))
  }

  function computeIdealWeightForExercise(exercise: string, idealWeight: number) {
    // reuse the same multipliers but scaled to the ideal weight
    const mapFactor = (() => {
      const bw = 1
      const map: Record<string, number> = {
        'Incline Dumbbell Press': 0.35,
        'Smith Machine Press': 0.6,
        'Pec Deck / Machine Fly': 0.25,
        'Cable Fly (Low-to-High)': 0.2,
        'Romanian Deadlift': 1.1,
        'Bent-over Row': 0.7,
        'Lat Pulldown': 0.6,
        'Seated Cable Row': 0.6,
        'Leg Extension': 0.45,
        'Smith Machine Squat': 1.2,
        'Smith Machine Lunges': 0.6,
        'Seated Leg Curl': 0.4,
        'Standing Calf Raise': 0.25,
        'Overhead Press': 0.45,
        'Lateral Raises': 0.08,
        'Front Raises': 0.08,
        'Rear Delt Fly': 0.12,
        'Barbell Curl': 0.18,
        'Dumbbell Hammer Curl': 0.12,
        'Triceps Pushdown': 0.12,
        'Overhead Triceps Extension': 0.12,
      }
      return map[exercise] ?? 0.25
    })()
    // nudge slightly above conservative baseline to make the ideal target challenging
    const raw = Math.max(2.5, idealWeight * mapFactor * 1.08)
    return Math.round(raw * 2) / 2
  }

  function computeIdealPoSuggestion(exercise: string, setNumber: number, setsCount: number) {
    const profileForIdeal = getIdealProfile()
    const idealW = idealWeightGoal || profileForIdeal.weightKg
    const base = computeIdealWeightForExercise(exercise, idealW)
    const po = poTargets[exercise] ?? seedPoForExercise(exercise, profileForIdeal)
    const perSet = po / Math.max(1, setsCount)
    const bias = Math.max(0, 1 - (setNumber - 1) * 0.15)
    const suggested = base + perSet * bias
    return roundToHalf(suggested || 0)
  }

  function computePoReps(exercise: string) {
    const rec = recs[exercise]
    // Prefer 6 reps as starter target (6-8 rep range), easier to increase later
    return (rec?.ai?.ai_reps as number) || (rec?.rule?.recommended_reps as number) || 6
  }

  function buildRowsForDay(day: string, profile: UserProfile): ExerciseRow[] {
    const group = exerciseGroups[day]
    if (!day || day === 'Rest' || !group || !group.length) return []
    return group.map((ex) => {
      const count = defaultSetsForExercise(ex)
      const base = computeInitialWeightForExercise(ex, profile)
      const sets: SetEntry[] = Array.from({ length: count }, (_, i) => {
        const weight = Math.max(2.5, Math.round((base * (1 - i * 0.08)) * 2) / 2)
        return { set_number: i + 1, weight, reps: computePoReps(ex), intensity: 7, feedback: 'on_target' as const }
      })
      return { exercise: ex, setsCount: count, sets }
    })
  }

  function updateSetsCount(exIndex: number, newCount: number) {
    setRows((prev) => prev.map((r, i) => {
      if (i !== exIndex) return r
      const count = Math.max(1, Math.min(8, newCount))
      const sets = Array.from({ length: count }, (_, idx) => {
        const existing = r.sets[idx]
        return existing ? { ...existing, set_number: idx + 1 } : { set_number: idx + 1, weight: '', reps: '', intensity: 7, feedback: 'on_target' as const }
      })
      return { ...r, setsCount: count, sets }
    }))
  }

  async function finishSession() {
    setSubmitting(true)
    try {
      const enrichedSets = rows.flatMap((r) => r.sets.map((s) => {
        const recWeight = computePoSuggestion(r.exercise, s.set_number, r.setsCount)
        const recReps = computePoReps(r.exercise)
        const feedback = (s.feedback ?? 'on_target') as 'too_easy' | 'too_hard' | 'on_target'
        return {
          exercise: r.exercise,
          set_number: s.set_number,
          weight: s.weight,
          reps: s.reps,
          intensity: feedbackToIntensity(feedback),
          rec_weight: recWeight,
          rec_reps: recReps,
          feedback,
        }
      })).filter((s) => s.weight !== '' && s.reps !== '')

      if (!enrichedSets.length) {
        alert('Please enter at least one set (weight & reps) before finishing')
        return
      }

      const body = { date: new Date().toISOString(), calories: 0, day_type: selectedDay, finished: true, sets: enrichedSets, rec_meta: recs }
      const headers = await getAuthHeaders()
      const res = await axios.post('/api/session_proxy', body, { headers })
      const data = res.data
      if (data && data.recommendations) setRecs(data.recommendations as Record<string, Recommendation>)
      setSessionFinished(true)
      const dateStr = new Date().toISOString().slice(0,10)
      markFinishedFor(dateStr)
      setRows((prev) => prev.map((r) => ({
        ...r,
        sets: r.sets.map((s) => ({ ...s, weight: '', reps: '', feedback: 'on_target' as const, intensity: 7 })),
      })))
      setSessionActive(false)

      // instrument event: session finished (outcome) so server can analyze success vs recs
      enqueueInstrumentEvent({ type: 'session_finished', payload: body })

      alert('Session finished')
    } catch (e: any) {
      console.error(e)
      alert('Failed to finish session: ' + (e?.response?.data?.detail || e.message || e))
    } finally {
      setSubmitting(false)
    }
  }

  const weekDates = getWeekDates()
  const selectedDateLabel = formatDateLabel(selectedDateStr)
  const latestWeight = getLatestWeight()
  const todayIso = new Date().toISOString().slice(0, 10)
  const averageCalories = avgRecentCalories()
  const calorieTarget = calorieSuggestion()
  const topPRs = getTopPRs(4)

  return (
    <div className="app-root" style={{ minHeight: '100vh', paddingBottom: 40 }}>
      <div className="app-container">
        <header className="glass-strong" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="card-heading" style={{ gap: 14 }}>
            <IconBarbell className="ui-icon" size={20} />
            <div>
              <h1 style={{ margin: 0, fontSize: 28 }}>Gym Tracker</h1>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Weekly split, progressive overload, and fast session logging.</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div className="badge">Week #{getWeekIndex()}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 12, color: 'var(--muted)' }}>Body weight (kg)</label>
              <input
                type="number"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ ...baseFieldStyle, width: 90 }}
              />
              <button
                className="btn"
                onClick={() => {
                  if (bodyWeight === '') return
                  saveWeeklyWeight(Number(bodyWeight))
                }}
              >Save</button>
            </div>
            <button className="btn btn-ghost" onClick={flushInstrumentQueue}>Sync data</button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const ok = window.confirm('Reset planner data for the current week? This clears unfinished progress and reseeds targets.')
                  if (!ok) return
                }
                resetPlannerState()
              }}
            >Reset planner</button>
            <button
              className="btn btn-ghost"
              onClick={() => setShowSettings(true)}
              style={{ fontWeight: 'bold' }}
            >⚙️ Settings</button>
          </div>
        </header>

        {showSettings && (
          <SettingsPanel
            onClose={() => setShowSettings(false)}
            onProfileUpdate={(profile) => {
              setUserProfile({
                sex: profile.sex,
                age: profile.age,
                weightKg: profile.current_weight_kg,
                heightCm: profile.height_cm,
                maintenanceCalories: calculateMaintenanceCalories(profile),
                idealWeightKg: profile.ideal_weight_kg,
                current_weight_kg: profile.current_weight_kg,
                height_cm: profile.height_cm,
                ideal_weight_kg: profile.ideal_weight_kg,
                theme_color: profile.theme_color
              } as any)
            }}
          />
        )}

        {celebrateMilestone ? (
          <div className="glass" style={{ padding: 16, border: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>🔥 Streak milestone unlocked!</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>You just hit a {celebrateMilestone}-day streak. Keep the momentum.</div>
          </div>
        ) : null}

        <section className="glass" style={{ padding: 20, display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div className="card-heading">
              <IconCalendarSpark className="ui-icon" />
              <div>
                <div className="title">Weekly planner</div>
                <div className="subtitle">Tap a day to jump into the session builder.</div>
              </div>
            </div>
          </div>

          <div className="week-grid">
            {weekDates.map((date) => {
              const dateStr = date.toISOString().slice(0, 10)
              const dayIndex = (date.getDay() + 6) % 7
              const dayType = dayTypes[dayIndex]
              const finished = !!finishedSessions[dateStr]
              const skipped = !!skippedSessions[dateStr]
              const isSelected = selectedDateStr === dateStr && selectedDay === dayType
              const isToday = dateStr === todayIso
              return (
                <button
                  key={`${dateStr}-${dayType}`}
                  onClick={() => openDay(dayType, dateStr)}
                  className={`week-card ${isSelected ? 'active' : ''}`}
                  style={{
                    textAlign: 'left',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{date.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>{date.getDate()}</div>
                    </div>
                    <div style={{ fontSize: 12, textAlign: 'right', color: 'var(--muted)' }}>{dayType}</div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, color: finished ? '#7fffab' : skipped ? '#ff9aa9' : 'var(--muted)' }}>
                    {finished ? 'Finished ✅' : skipped ? 'Skipped' : (dayType === 'Rest' ? 'Recovery' : 'Pending')}
                  </div>
                  {isToday ? <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 11, color: 'var(--accent)' }}>Today</div> : null}
                </button>
              )
            })}
          </div>
        </section>

        <div className="two-column">
          <section className="glass" style={{ padding: 22, display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div className="card-heading" style={{ marginBottom: 0 }}>
                <IconBarbell className="ui-icon" />
                <div>
                  <div className="title">{selectedDay}</div>
                  <div className="subtitle">{selectedDateLabel}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {selectedDay !== 'Rest' ? (
                  <button className="btn btn-ghost" style={{ padding: '6px 12px' }} onClick={() => fetchRecommendations(rows)}>Refresh recs</button>
                ) : null}
                {selectedDay !== 'Rest' ? (
                  confirmSkipFor === selectedDay ? (
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Skip session?</span>
                      <button className="btn" style={{ padding: '6px 12px', background: '#ff9aa9', color: '#032031' }} onClick={handleSkipSession}>Yes</button>
                      <button className="btn btn-ghost" style={{ padding: '6px 12px' }} onClick={() => setConfirmSkipFor(null)}>No</button>
                    </span>
                  ) : (
                    <button className="btn btn-ghost" style={{ padding: '6px 12px' }} onClick={() => setConfirmSkipFor(selectedDay)}>Skip</button>
                  )
                ) : null}
              </div>
            </div>

            {selectedDay === 'Rest' ? (
              <div className="empty-state">
                Use today for mobility, hydration, and sleep. You can still log a mobility session if you like.
              </div>
            ) : (
              <>
                {!sessionActive ? (
                  <div className="subtle-grid">
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Plan your sets, tune targets, and log everything when you wrap the session.</div>
                    <div className="session-actions">
                      <button className="btn" onClick={startSession} disabled={selectedDay === 'Rest'}>Start session</button>
                      {sessionFinished ? <div className="badge" style={{ background: 'rgba(127,255,171,0.18)', color: '#7fffab' }}>Session completed</div> : null}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gap: 14 }}>
                      {rows.map((row, exIndex) => {
                        const rec = recs[row.exercise]
                        const ai = rec?.ai
                        const rule = rec?.rule
                        const displayExercise = acceptedSubs[row.exercise] || row.exercise
                        const poTarget = poTargets[row.exercise] ?? ''
                        return (
                          <div key={row.exercise} className="glass" style={{ padding: 18, border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 15 }}>{displayExercise}</div>
                                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Target {computePoReps(row.exercise)} reps</div>
                                <div style={{ marginTop: 6, display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <span className="badge" style={{ background: 'rgba(255,70,120,0.18)', color: '#ffb8c8' }}>PO goal {poTarget || 0} kg/week</span>
                                  <button
                                    className="btn btn-ghost"
                                    style={{ padding: '4px 10px', fontSize: 11 }}
                                    onClick={() => {
                                      if (typeof window === 'undefined') return
                                      const next = window.prompt('Update PO target (kg/week)', String(poTarget || 0))
                                      if (next === null) return
                                      const parsed = Number(next)
                                      if (!Number.isNaN(parsed)) setPoTarget(row.exercise, parsed)
                                    }}
                                  >Edit</button>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>
                                {ai ? `AI confidence: ${aiConfidenceLabel(ai)}` : 'Awaiting data'}
                              </div>
                            </div>

                            {rec?.substitutions && rec.substitutions.length ? (
                              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {rec.substitutions.map((sub) => (
                                  <button
                                    key={sub}
                                    className={acceptedSubs[row.exercise] === sub ? 'btn' : 'btn btn-ghost'}
                                    style={{ padding: '4px 10px', fontSize: 12 }}
                                    onClick={() => acceptSubstitution(row.exercise, sub)}
                                  >{sub}</button>
                                ))}
                              </div>
                            ) : null}

                            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                              {row.sets.map((set, setIndex) => {
                                const suggested = computePoSuggestion(row.exercise, set.set_number, row.setsCount)
                                const idealSuggested = computeIdealPoSuggestion(row.exercise, set.set_number, row.setsCount)
                                return (
                                  <div key={`${row.exercise}-set-${set.set_number}`} style={{ display: 'grid', gridTemplateColumns: '80px repeat(2, minmax(0, 1fr))', gap: 12 }}>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 4 }}>Set {set.set_number}</div>
                                    <div style={{ display: 'grid', gap: 6 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
                                        <span>Weight (kg)</span>
                                        <button
                                          className="btn btn-ghost"
                                          style={{ padding: '4px 10px', fontSize: 11 }}
                                          onClick={() => updateSet(exIndex, setIndex, { weight: suggested })}
                                        >Use suggestion</button>
                                      </div>
                                      <input
                                        type="number"
                                        placeholder={String(suggested)}
                                        value={set.weight === '' ? '' : set.weight}
                                        onChange={(e) => {
                                          const val = e.target.value
                                          updateSet(exIndex, setIndex, { weight: val === '' ? '' : Number(val) })
                                        }}
                                        style={baseFieldStyle}
                                      />
                                    </div>
                                    <div style={{ display: 'grid', gap: 6 }}>
                                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Reps</div>
                                      <input
                                        type="number"
                                        placeholder={String(computePoReps(row.exercise))}
                                        value={set.reps === '' ? '' : set.reps}
                                        onChange={(e) => {
                                          const val = e.target.value
                                          updateSet(exIndex, setIndex, { reps: val === '' ? '' : Number(val) })
                                        }}
                                        style={baseFieldStyle}
                                      />
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', gridColumn: '1 / -1' }}>
                                      <button
                                        className={`btn btn-ghost${set.feedback === 'too_hard' ? ' active' : ''}`}
                                        style={{ padding: '6px 10px', borderColor: set.feedback === 'too_hard' ? 'rgba(255,51,87,0.6)' : undefined, background: set.feedback === 'too_hard' ? 'rgba(255,51,87,0.18)' : undefined, color: set.feedback === 'too_hard' ? '#ffadb9' : undefined }}
                                        onClick={() => handleSetFeedback(exIndex, setIndex, 'too_hard')}
                                      >Too hard</button>
                                      <button
                                        className={`btn btn-ghost${set.feedback === 'on_target' ? ' active' : ''}`}
                                        style={{ padding: '6px 10px', borderColor: set.feedback === 'on_target' ? 'rgba(255,255,255,0.24)' : undefined, background: set.feedback === 'on_target' ? 'rgba(255,255,255,0.08)' : undefined }}
                                        onClick={() => handleSetFeedback(exIndex, setIndex, 'on_target')}
                                      >On target</button>
                                      <button
                                        className={`btn btn-ghost${set.feedback === 'too_easy' ? ' active' : ''}`}
                                        style={{ padding: '6px 10px', borderColor: set.feedback === 'too_easy' ? 'rgba(110,255,180,0.6)' : undefined, background: set.feedback === 'too_easy' ? 'rgba(110,255,180,0.18)' : undefined, color: set.feedback === 'too_easy' ? '#b4ffdd' : undefined }}
                                        onClick={() => handleSetFeedback(exIndex, setIndex, 'too_easy')}
                                      >Too easy</button>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--muted)' }}>
                                      Suggested: {suggested} kg • Stretch goal: {idealSuggested} kg
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sets</span>
                                <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => updateSetsCount(exIndex, row.setsCount - 1)}>-</button>
                                <span style={{ fontSize: 12 }}>{row.setsCount}</span>
                                <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => updateSetsCount(exIndex, row.setsCount + 1)}>+</button>
                                {rec?.recommended_sets ? (
                                  <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={() => applyRecommendedSets(row.exercise, rec.recommended_sets)}>Apply {rec.recommended_sets}</button>
                                ) : null}
                              </div>
                              {rule?.note ? <div style={{ fontSize: 11, color: 'var(--muted)' }}>{rule.note}</div> : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="session-actions" style={{ marginTop: 12 }}>
                      <button className="btn" style={{ background: '#7fffab', color: '#032031' }} onClick={finishSession} disabled={submitting}>Log session</button>
                      <button className="btn btn-ghost" onClick={() => setSessionActive(false)}>Close</button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>

          <aside className="aside-grid">
            <div className="glass" style={{ padding: 18, display: 'grid', gap: 12 }}>
              <div className="card-heading">
                <IconWave className="ui-icon" />
                <div>
                  <div className="title">Weight trend</div>
                  <div className="subtitle">Latest weigh-in: {latestWeight ?? '—'} kg</div>
                </div>
              </div>
              <div style={{ height: 84 }}>
                <svg width="100%" height="84" viewBox="0 0 320 84">
                  <defs>
                    <linearGradient id="weight-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(126,202,255,0.8)" />
                      <stop offset="100%" stopColor="rgba(126,202,255,0)" />
                    </linearGradient>
                  </defs>
                  <rect x={0} y={0} width={320} height={84} rx={10} fill="rgba(255,255,255,0.03)" />
                  {(() => {
                    const raw = weeklyWeights.slice(0, 16).map((w) => Number(w.weight)).filter((w) => !Number.isNaN(w))
                    const safe = raw.length ? raw : (latestWeight ? [latestWeight] : [])
                    if (!safe.length) return null
                    const n = safe.length
                    const min = Math.min(...safe)
                    const max = Math.max(...safe)
                    const toX = (i: number) => (n === 1 ? 160 : Math.round((i / (n - 1)) * 300) + 10)
                    const toY = (v: number) => {
                      if (max === min) return 42
                      const pct = (v - min) / (max - min)
                      return Math.round((1 - pct) * 64) + 10
                    }
                    const path = safe.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p)}`).join(' ')
                    return <path d={path} fill="none" stroke="url(#weight-gradient)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  })()}
                </svg>
              </div>
            </div>

            <div className="glass" style={{ padding: 18, display: 'grid', gap: 12 }}>
              <div className="card-heading">
                <IconGauge className="ui-icon" />
                <div>
                  <div className="title">Calories</div>
                  <div className="subtitle">Target ~{calorieTarget} kcal</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  value={caloriesToday}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '') {
                      setCaloriesToday('')
                      return
                    }
                    const numberVal = Number(val)
                    if (!Number.isNaN(numberVal)) {
                      setCaloriesToday(numberVal)
                      const dateStr = selectedDateStr || todayIso
                      saveDailyCaloriesFor(dateStr, numberVal)
                    }
                  }}
                  placeholder="Today"
                  style={{ ...baseFieldStyle, width: 120 }}
                />
                <button
                  className="btn"
                  onClick={() => {
                    if (typeof caloriesToday === 'number') {
                      const dateStr = selectedDateStr || todayIso
                      saveDailyCaloriesFor(dateStr, caloriesToday)
                    }
                  }}
                >Save</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Avg last 7d: {averageCalories ? Math.round(averageCalories) : '—'} kcal</div>
            </div>

            <div className="glass" style={{ padding: 18, display: 'grid', gap: 8 }}>
              <div className="card-heading">
                <IconStreak className="ui-icon" />
                <div>
                  <div className="title">Streak</div>
                  <div className="subtitle">Consistency unlocks progress</div>
                </div>
              </div>
              <div style={{ fontSize: 12 }}>Current <strong>{streakCurrent}</strong> • Best <strong>{streakBest}</strong></div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Last missed: {getLastMissedDate() || 'None in 30 days'}</div>
            </div>

            <div className="glass" style={{ padding: 18, display: 'grid', gap: 10 }}>
              <div className="card-heading">
                <IconTrophy className="ui-icon" />
                <div>
                  <div className="title">PR highlights</div>
                  <div className="subtitle">Auto-updates from session logs</div>
                </div>
              </div>
              {topPRs.length ? (
                <ul className="list-reset">
                  {topPRs.map((pr) => (
                    <li key={pr.exercise} style={{ marginBottom: 4 }}>
                      <strong style={{ color: 'var(--accent-2)' }}>{pr.exercise}</strong> {pr.weight} kg
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state" style={{ padding: 14 }}>Log more sessions to see PRs here.</div>
              )}
            </div>

            <div className="glass" style={{ padding: 18, display: 'grid', gap: 10 }}>
              <div className="card-heading">
                <IconTarget className="ui-icon" />
                <div>
                  <div className="title">Ideal target</div>
                  <div className="subtitle">Long-term bodyweight goal</div>
                </div>
              </div>
              <input
                type="number"
                value={idealWeightGoal ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  const parsed = val === '' ? null : Number(val)
                  setIdealWeightGoal(parsed)
                  try { localStorage.setItem('idealWeightGoal', val) } catch (err) { console.warn('idealWeight persist failed', err) }
                }}
                style={{ ...baseFieldStyle, width: 120 }}
              />
            </div>

            <StatsPanel />
          </aside>
        </div>
      </div>
    </div>
  )
}
