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
  { name: 'Crimson', hue: 348, color: '#ff2f54' },
  { name: 'Electric Blue', hue: 200, color: '#00bfff' },
  { name: 'Purple', hue: 280, color: '#ba55d3' },
  { name: 'Emerald', hue: 140, color: '#50c878' },
  { name: 'Orange', hue: 30, color: '#ff8c42' },
  { name: 'Pink', hue: 320, color: '#ff69b4' },
  { name: 'Cyan', hue: 180, color: '#00e5ff' },
  { name: 'Lime', hue: 75, color: '#32cd32' },
]

export default function SettingsPanel({ onClose, onProfileUpdate }: SettingsPanelProps) {
  const { signOut, user } = useAuth()
  const [profile, setProfile] = useState<UserProfile>({
    current_weight_kg: 70,
    height_cm: 175,
    ideal_weight_kg: 85,
    age: 25,
    sex: 'male',
    theme_color: '#ff2f54'
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
    const hue = colorToHue(color)
    document.documentElement.style.setProperty('--theme-hue', hue.toString())
  }

  const colorToHue = (hex: string): number => {
    const theme = THEME_COLORS.find(t => t.color === hex)
    return theme?.hue || 348
  }

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out? Your data will be saved.')) {
      await signOut()
    }
  }

  const fieldStyle = {
    background: 'rgba(8, 14, 26, 0.55)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '10px',
    padding: '8px 10px',
    color: '#ecf6ff',
    fontSize: '13px',
    width: '100%'
  }

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div className="glass-strong" style={{ padding: '2rem', minWidth: '300px' }}>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }} onClick={onClose}>
      <div className="glass-strong" style={{
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Settings</h2>
          <button onClick={onClose} style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0',
            lineHeight: '1'
          }}>×</button>
        </div>

        <div style={{ display: 'grid', gap: '20px' }}>
          {/* User Info */}
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Account</h3>
            <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', marginBottom: '10px' }}>
              {user?.email}
            </div>
            <button className="btn btn-ghost" onClick={handleLogout} style={{ width: '100%' }}>
              Log Out
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />

          {/* Current Profile */}
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Current Profile</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'rgba(255,255,255,0.7)' }}>
                  Current Weight (kg)
                </label>
                <input
                  type="number"
                  value={profile.current_weight_kg}
                  onChange={(e) => setProfile({ ...profile, current_weight_kg: Number(e.target.value) })}
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'rgba(255,255,255,0.7)' }}>
                  Height (cm)
                </label>
                <input
                  type="number"
                  value={profile.height_cm}
                  onChange={(e) => setProfile({ ...profile, height_cm: Number(e.target.value) })}
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'rgba(255,255,255,0.7)' }}>
                  Age
                </label>
                <input
                  type="number"
                  value={profile.age}
                  onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })}
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'rgba(255,255,255,0.7)' }}>
                  Sex
                </label>
                <select
                  value={profile.sex}
                  onChange={(e) => setProfile({ ...profile, sex: e.target.value as 'male' | 'female' })}
                  style={fieldStyle}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />

          {/* Ideal Profile */}
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Goal Weight</h3>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'rgba(255,255,255,0.7)' }}>
                Ideal Weight (kg)
              </label>
              <input
                type="number"
                value={profile.ideal_weight_kg}
                onChange={(e) => setProfile({ ...profile, ideal_weight_kg: Number(e.target.value) })}
                style={fieldStyle}
              />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />

          {/* Theme Color */}
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Theme Color</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {THEME_COLORS.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => setProfile({ ...profile, theme_color: theme.color })}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: profile.theme_color === theme.color ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                    background: theme.color,
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    fontSize: '10px',
                    color: '#fff',
                    fontWeight: 'bold',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {theme.name}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn"
            onClick={saveProfile}
            disabled={saving}
            style={{ width: '100%', marginTop: '10px' }}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
