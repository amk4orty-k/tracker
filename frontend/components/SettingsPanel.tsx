import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import axios from 'axios'
import { supabase } from '../lib/supabaseClient'

interface UserProfile {
  current_weight_kg: number
  height_cm: number
  ideal_weight_kg: number
  age: number
  sex: 'male' | 'female'
  theme_color: string
}

interface SettingsPanelProps {
  onClose: () => void
  onProfileUpdate: (profile: UserProfile) => void
}

const THEME_COLORS = [
  { name: 'Crimson', color: '#f43f5e' },
  { name: 'Electric Blue', color: '#0ea5e9' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Emerald', color: '#10b981' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'Cyan', color: '#06b6d4' },
  { name: 'Lime', color: '#84cc16' },
]

export default function SettingsPanel({ onClose, onProfileUpdate }: SettingsPanelProps) {
  const { signOut, user } = useAuth()
  const [profile, setProfile] = useState<UserProfile>({
    current_weight_kg: 70,
    height_cm: 175,
    ideal_weight_kg: 85,
    age: 25,
    sex: 'male',
    theme_color: '#f43f5e'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const headers = { Authorization: `Bearer ${session.access_token}` }
      const res = await axios.get('/api/profile_proxy', { headers })
      setProfile(res.data)
      applyThemeColor(res.data.theme_color)
    } catch (e) {
      console.error('Failed to load profile', e)
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const headers = { Authorization: `Bearer ${session.access_token}` }
      await axios.put('/api/profile_proxy', profile, { headers })
      applyThemeColor(profile.theme_color)
      onProfileUpdate(profile)
      alert('Profile saved successfully!')
    } catch (e: any) {
      alert('Failed to save profile: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const applyThemeColor = (color: string) => {
    document.documentElement.style.setProperty('--primary', color)
    // Also update accent for consistency
    document.documentElement.style.setProperty('--accent', color)
  }

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out? Your data will be saved.')) {
      await signOut()
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="glass-card p-8 min-w-[300px] text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* User Info */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Account</h3>
            <div className="text-sm text-slate-400 mb-3 px-1">
              {user?.email}
            </div>
            <button
              className="w-full py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-bold"
              onClick={handleLogout}
            >
              Log Out
            </button>
          </div>

          <div className="h-px bg-white/10"></div>

          {/* Current Profile */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Current Profile</h3>
            <div className="grid gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Current Weight (kg)</label>
                <input
                  type="number"
                  value={profile.current_weight_kg}
                  onChange={(e) => setProfile({ ...profile, current_weight_kg: Number(e.target.value) })}
                  className="glass-input w-full text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Height (cm)</label>
                <input
                  type="number"
                  value={profile.height_cm}
                  onChange={(e) => setProfile({ ...profile, height_cm: Number(e.target.value) })}
                  className="glass-input w-full text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Age</label>
                <input
                  type="number"
                  value={profile.age}
                  onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })}
                  className="glass-input w-full text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Sex</label>
                <select
                  value={profile.sex}
                  onChange={(e) => setProfile({ ...profile, sex: e.target.value as 'male' | 'female' })}
                  className="glass-input w-full text-white bg-slate-900"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>
          </div>

          <div className="h-px bg-white/10"></div>

          {/* Ideal Profile */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Goal Weight</h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Ideal Weight (kg)</label>
              <input
                type="number"
                value={profile.ideal_weight_kg}
                onChange={(e) => setProfile({ ...profile, ideal_weight_kg: Number(e.target.value) })}
                className="glass-input w-full text-white"
              />
            </div>
          </div>

          <div className="h-px bg-white/10"></div>

          {/* Theme Color */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Theme Color</h3>
            <div className="grid grid-cols-4 gap-3">
              {THEME_COLORS.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => setProfile({ ...profile, theme_color: theme.color })}
                  className={`p-3 rounded-xl text-[10px] font-bold text-white shadow-lg transition-all hover:scale-105 ${profile.theme_color === theme.color ? 'ring-2 ring-white scale-105' : 'ring-1 ring-white/20'
                    }`}
                  style={{ backgroundColor: theme.color }}
                >
                  {theme.name}
                </button>
              ))}
            </div>
          </div>

          <button
            className="glass-button w-full mt-4"
            onClick={saveProfile}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
