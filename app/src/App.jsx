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

async function ensureUserSettings(userId) {
  const { data } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
  if (!data) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const { data: created } = await supabase.from('user_settings').insert({ user_id: userId, timezone: tz }).select().single()
    return created
  }
  return data
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [categories, setCategories] = useState([])
  const [stories, setStories] = useState([])
  const [timezone, setTimezone] = useState('UTC')

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
      })
    }
  }, [session])

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
                    <Route path="/settings" element={<Settings userId={session.user.id} onTimezoneChange={setTimezone} />} />
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
