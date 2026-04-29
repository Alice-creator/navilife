import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import supabase from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Week from './pages/Week'
import Daily from './pages/Daily'
import Kanban from './pages/Kanban'
import Settings from './pages/Settings'
import Nav from './components/Nav'
import { filenameToLabel } from './theme'

async function ensureUserSettings(userId) {
  const { data } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
  if (!data) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const { data: created } = await supabase.from('user_settings').insert({ user_id: userId, timezone: tz }).select().single()
    return created
  }
  return data
}

function applyAppearance({ theme, background }) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme || 'dark')
  if (background) {
    root.setAttribute('data-bg', 'custom')
    root.style.setProperty('--bg-image', `url('${background}')`)
  } else {
    root.setAttribute('data-bg', 'none')
    root.style.removeProperty('--bg-image')
  }
}

async function fetchBackgrounds() {
  const { data, error } = await supabase.storage.from('backgrounds').list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } })
  if (error || !data) return []
  return data
    .filter(f => f.name && /\.(jpe?g|png|webp)$/i.test(f.name))
    .map(f => ({
      name: f.name,
      label: filenameToLabel(f.name),
      url: supabase.storage.from('backgrounds').getPublicUrl(f.name).data.publicUrl,
    }))
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [categories, setCategories] = useState([])
  const [stories, setStories] = useState([])
  const [timezone, setTimezone] = useState('UTC')
  const [appearance, setAppearance] = useState({ theme: 'dark', background: '' })
  const [backgrounds, setBackgrounds] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      supabase.from('categories').select('*').order('created_at').then(({ data }) => {
        if (data) setCategories(data)
      })
      supabase.from('stories').select('*').order('created_at').then(({ data }) => {
        if (data) setStories(data)
      })
      // Ensure user_settings row exists (auto-seed with browser timezone on first login)
      ensureUserSettings(session.user.id).then((settings) => {
        if (settings?.timezone) setTimezone(settings.timezone)
        if (settings) {
          setAppearance({
            theme: settings.theme || 'dark',
            background: settings.background || '',
          })
        }
      })
      fetchBackgrounds().then(setBackgrounds)
    }
  }, [session])

  useEffect(() => {
    applyAppearance(appearance)
  }, [appearance])

  if (session === undefined) return null

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/daily" />} />
        <Route
          path="/*"
          element={
            session ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
                <Nav user={session.user} />
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <Routes>
                    <Route path="/" element={<Dashboard timezone={timezone} />} />
                    <Route path="/schedule" element={
                      <Week
                        categories={categories}
                        onCategoriesChange={setCategories}
                        stories={stories}
                        onStoriesChange={setStories}
                        timezone={timezone}
                      />
                    } />
                    <Route path="/daily" element={<Daily categories={categories} stories={stories} timezone={timezone} />} />
                    <Route path="/kanban" element={<Kanban categories={categories} stories={stories} timezone={timezone} />} />
                    <Route path="/settings" element={<Settings userId={session.user.id} backgrounds={backgrounds} onTimezoneChange={setTimezone} onAppearanceChange={setAppearance} />} />
                  </Routes>
                </div>
              </div>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
