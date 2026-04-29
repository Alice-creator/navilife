import { useEffect, useRef, useState } from 'react'
import supabase from '../lib/supabase'
import { T } from '../theme'

// Common timezones to show in the dropdown. If the user's current timezone
// isn't in the list, it will still be injected as the selected option.
const COMMON_TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
]

export default function Settings({ userId, backgrounds = [], onTimezoneChange, onAppearanceChange }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  const [timezone, setTimezone] = useState('UTC')
  const [digestEnabled, setDigestEnabled] = useState(false)
  const [digestTime, setDigestTime] = useState('08:00')
  const [theme, setThemeValue] = useState('dark')
  const [background, setBackgroundValue] = useState('')
  // Last saved appearance — used to detect dirty state and revert on unmount.
  const savedAppearanceRef = useRef({ theme: 'dark', background: '' })
  const currentAppearanceRef = useRef({ theme: 'dark', background: '' })

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
      if (data) {
        setTimezone(data.timezone || 'UTC')
        setDigestEnabled(!!data.daily_digest_enabled)
        setDigestTime((data.daily_digest_time || '08:00').slice(0, 5))
        const t = data.theme || 'dark'
        const b = data.background || ''
        setThemeValue(t)
        setBackgroundValue(b)
        savedAppearanceRef.current = { theme: t, background: b }
        currentAppearanceRef.current = { theme: t, background: b }
      }
      setLoading(false)
    }
    load()
  }, [userId])

  // Track current preview values so the unmount cleanup can revert without stale closures.
  useEffect(() => {
    currentAppearanceRef.current = { theme, background }
  }, [theme, background])

  // On unmount (navigation away), if the user previewed but didn't save, revert.
  useEffect(() => {
    return () => {
      const saved = savedAppearanceRef.current
      const current = currentAppearanceRef.current
      if (saved.theme !== current.theme || saved.background !== current.background) {
        if (onAppearanceChange) onAppearanceChange(saved)
      }
    }
  }, [onAppearanceChange])

  // Live preview while picking — apply immediately, persist on Save.
  function pickTheme(v) {
    setThemeValue(v)
    if (onAppearanceChange) onAppearanceChange(prev => ({ ...prev, theme: v }))
  }
  function pickBackground(v) {
    setBackgroundValue(v)
    if (onAppearanceChange) onAppearanceChange(prev => ({ ...prev, background: v }))
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('user_settings').upsert({
      user_id: userId,
      timezone,
      daily_digest_enabled: digestEnabled,
      daily_digest_time: digestTime,
      theme,
      background,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setSaving(false)
    if (error) {
      console.error('Settings save failed:', error)
      alert(`Could not save: ${error.message}`)
      return
    }
    savedAppearanceRef.current = { theme, background }
    setSavedAt(Date.now())
    setTimeout(() => setSavedAt(null), 2000)
    if (onTimezoneChange) onTimezoneChange(timezone)
  }

  const timezoneOptions = COMMON_TIMEZONES.includes(timezone)
    ? COMMON_TIMEZONES
    : [timezone, ...COMMON_TIMEZONES]

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, color: T.textDim, fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', background: T.bg, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border}` }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>Settings</h1>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px' }}>
        {/* Timezone */}
        <Section title="Timezone" description="Used to decide when daily digests are sent and which day your tasks belong to.">
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            style={inputStyle}
          >
            {timezoneOptions.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </Section>

        {/* Theme */}
        <Section title="Theme" description="Switch the whole app between dark and light.">
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { value: 'dark',  label: 'Dark' },
              { value: 'light', label: 'Light' },
            ].map(opt => {
              const active = theme === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => pickTheme(opt.value)}
                  style={{
                    flex: 1, padding: '10px 12px',
                    border: `1px solid ${active ? T.accent : T.borderStrong}`,
                    borderRadius: 6,
                    background: active ? T.accentSoft : T.elevated,
                    color: active ? T.accent : T.text,
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </Section>

        {/* Background */}
        <Section title="Background" description="Optional ambient image behind the app.">
          {backgrounds.length === 0 ? (
            <p style={{ fontSize: 12, color: T.textDim, margin: 0 }}>
              No background images uploaded yet. Add JPG/PNG/WebP files to the <code>backgrounds</code> bucket in Supabase Storage and they'll appear here.
            </p>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {/* None tile */}
            <BackgroundTile
              label="None"
              imageUrl={null}
              active={background === ''}
              onClick={() => pickBackground('')}
            />
            {backgrounds.map(bg => (
              <BackgroundTile
                key={bg.url}
                label={bg.label}
                imageUrl={bg.url}
                active={background === bg.url}
                onClick={() => pickBackground(bg.url)}
              />
            ))}
          </div>
        </Section>

        {/* Daily digest */}
        <Section title="Daily morning digest" description="Get an email every morning with today's tasks.">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={digestEnabled}
              onChange={e => setDigestEnabled(e.target.checked)}
              style={{ accentColor: T.accent, width: 16, height: 16 }}
            />
            <span style={{ fontSize: 14, color: T.text }}>
              Send me a daily digest email
            </span>
          </label>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Time</div>
            <input
              type="time"
              value={digestTime}
              onChange={e => setDigestTime(e.target.value)}
              disabled={!digestEnabled}
              style={{ ...inputStyle, opacity: digestEnabled ? 1 : 0.5, width: 140 }}
            />
            <div style={{ fontSize: 12, color: T.textSub, marginTop: 6 }}>
              In your local timezone ({timezone})
            </div>
          </div>
        </Section>

        {/* Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 28 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 22px', border: 'none', borderRadius: 6,
              background: T.accent, color: T.buttonText,
              fontSize: 13, fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {savedAt && (
            <span style={{ fontSize: 12, color: T.success }}>Saved ✓</span>
          )}
        </div>
      </div>
    </div>
  )
}

function BackgroundTile({ label, imageUrl, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      style={{
        padding: 0,
        border: `2px solid ${active ? T.accent : T.borderStrong}`,
        borderRadius: 8,
        background: T.elevated,
        cursor: 'pointer',
        overflow: 'hidden',
        aspectRatio: '4 / 3',
        position: 'relative',
      }}
    >
      {imageUrl && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url('${imageUrl}')`,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
      )}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '6px 8px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))',
        color: '#fff',
        fontSize: 11, fontWeight: 600,
        textAlign: 'left',
      }}>
        {label}
      </div>
    </button>
  )
}

function Section({ title, description, children }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.borderStrong}`, borderRadius: 10, padding: '20px 22px', marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>{title}</div>
      {description && (
        <div style={{ fontSize: 12, color: T.textSub, marginBottom: 16 }}>{description}</div>
      )}
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '8px 10px',
  border: `1px solid ${T.borderStrong}`,
  borderRadius: 5, fontSize: 13, boxSizing: 'border-box', outline: 'none',
  background: T.elevated, color: T.text,
}
