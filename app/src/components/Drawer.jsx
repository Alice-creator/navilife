import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import { T, PRESET_COLORS } from '../theme'
const PANEL_WIDTH = 280
const BAR_WIDTH = 44

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const clamped = Math.min(total, 23 * 60 + 45)
  return `${Math.floor(clamped / 60).toString().padStart(2, '0')}:${(clamped % 60).toString().padStart(2, '0')}`
}

function stripSeconds(t) {
  if (!t) return t
  return t.split(':').slice(0, 2).join(':')
}

export default function Drawer({ slot, editTask, categories, onCategoriesChange, stories, onStoriesChange, onTaskChanged }) {
  const [activeTab, setActiveTab] = useState(null)

  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState(PRESET_COLORS[0])

  const [storyTitle, setStoryTitle] = useState('')
  const [storyDesc, setStoryDesc] = useState('')
  const [storyColor, setStoryColor] = useState(PRESET_COLORS[0])

  const [editingId, setEditingId] = useState(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('09:30')
  const [selectedCats, setSelectedCats] = useState([])
  const [selectedStoryId, setSelectedStoryId] = useState(null)
  const [status, setStatus] = useState('todo')
  const [priority, setPriority] = useState(null)
  const [points, setPoints] = useState('')
  const [note, setNote] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [existingReminders, setExistingReminders] = useState([])

  useEffect(() => {
    if (slot) {
      setActiveTab('task')
      setEditingId(null)
      setStatus('todo')
      setPriority(null)
      setPoints('')
      setNote('')
      setReminderDate('')
      setReminderTime('')
      setExistingReminders([])
      setDate(slot.date)
      setStartTime(slot.time)
      setEndTime(addMinutes(slot.time, 30))
      setTitle('')
      setSelectedCats([])
      setSelectedStoryId(null)
    }
  }, [slot])

  useEffect(() => {
    if (editTask) {
      setActiveTab('task')
      setEditingId(editTask.id)
      setTitle(editTask.title)
      setDate(editTask.date)
      setStartTime(stripSeconds(editTask.start_time) || '09:00')
      setEndTime(stripSeconds(editTask.end_time) || '09:30')
      setSelectedCats(editTask.category_ids || [])
      setSelectedStoryId(editTask.story_id || null)
      setStatus(editTask.status || 'todo')
      setPriority(editTask.priority || null)
      setPoints(editTask.points != null ? String(editTask.points) : '')
      setNote(editTask.note || '')
      setReminderDate('')
      setReminderTime('')
      // Load existing reminders for this task
      supabase.from('reminders').select('*').eq('task_id', editTask.id).eq('sent', false).order('remind_at').then(({ data }) => {
        setExistingReminders(data || [])
      })
    }
  }, [editTask])

  function handleIconClick(tab) {
    if (activeTab === tab) {
      setActiveTab(null)
    } else {
      setActiveTab(tab)
      if (tab === 'task') {
        setEditingId(null)
        setTitle('')
        setNote('')
        setPriority(null)
        setPoints('')
        setReminderDate('')
        setReminderTime('')
        setExistingReminders([])
        setDate(new Date().toISOString().split('T')[0])
        setStartTime('09:00')
        setEndTime('09:30')
        setSelectedCats([])
        setSelectedStoryId(null)
      }
    }
  }

  async function handleAddStory(e) {
    e.preventDefault()
    if (!storyTitle.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('stories').insert({ title: storyTitle.trim(), description: storyDesc.trim(), color: storyColor, user_id: user.id }).select().single()
    if (data) {
      onStoriesChange([...stories, data])
      setStoryTitle('')
      setStoryDesc('')
      setStoryColor(PRESET_COLORS[0])
    }
  }

  async function handleDeleteStory(id) {
    await supabase.from('stories').delete().eq('id', id)
    onStoriesChange(stories.filter(s => s.id !== id))
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!catName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('categories').insert({ name: catName.trim(), color: catColor, user_id: user.id }).select().single()
    if (data) {
      onCategoriesChange([...categories, data])
      setCatName('')
      setCatColor(PRESET_COLORS[0])
    }
  }

  async function handleDeleteCategory(id) {
    await supabase.from('categories').delete().eq('id', id)
    onCategoriesChange(categories.filter(c => c.id !== id))
  }

  function toggleCat(id) {
    setSelectedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  async function handleSaveTask(e) {
    e.preventDefault()
    if (!title.trim()) return

    if (editingId) {
      const { data: task } = await supabase
        .from('tasks')
        .update({ title: title.trim(), date, start_time: startTime, end_time: endTime, note, story_id: selectedStoryId, priority: priority || null, points: points ? parseInt(points) : null })
        .eq('id', editingId)
        .select()
        .single()

      if (task) {
        await supabase.from('task_categories').delete().eq('task_id', editingId)
        if (selectedCats.length > 0) {
          await supabase.from('task_categories').insert(selectedCats.map(cid => ({ task_id: editingId, category_id: cid })))
        }
        onTaskChanged()
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: task } = await supabase
        .from('tasks')
        .insert({ title: title.trim(), date, start_time: startTime, end_time: endTime, status: 'todo', note, story_id: selectedStoryId, priority: priority || null, points: points ? parseInt(points) : null, user_id: user.id })
        .select()
        .single()

      if (task && selectedCats.length > 0) {
        await supabase.from('task_categories').insert(selectedCats.map(cid => ({ task_id: task.id, category_id: cid })))
      }

      if (task) {
        onTaskChanged()
        setTitle('')
        setNote('')
        setPriority(null)
        setPoints('')
        setSelectedCats([])
        setSelectedStoryId(null)
      }
    }
  }

  async function handleDeleteTask() {
    if (!editingId) return
    await supabase.from('tasks').delete().eq('id', editingId)
    onTaskChanged()
    setEditingId(null)
    setTitle('')
    setSelectedCats([])
  }

  async function handleSetStatus(newStatus) {
    if (!editingId) return
    await Promise.all([
      supabase.from('tasks').update({ status: newStatus }).eq('id', editingId),
      supabase.from('status_logs').insert({ task_id: editingId, status: newStatus }),
    ])
    setStatus(newStatus)
    onTaskChanged()
  }

  async function handleAddReminder() {
    if (!reminderDate || !reminderTime) return
    const taskId = editingId
    const remindAt = new Date(`${reminderDate}T${reminderTime}`).toISOString()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('reminders').insert({ task_id: taskId, remind_at: remindAt, user_id: user.id }).select().single()
    if (data) {
      setExistingReminders(prev => [...prev, data])
      setReminderDate('')
      setReminderTime('')
    }
  }

  async function handleDeleteReminder(id) {
    await supabase.from('reminders').delete().eq('id', id)
    setExistingReminders(prev => prev.filter(r => r.id !== id))
  }

  const expanded = activeTab !== null
  const isEditing = activeTab === 'task' && editingId !== null

  return (
    <div style={{ display: 'flex', flexShrink: 0, height: '100%' }}>
      {/* Icon bar */}
      <div style={{ width: BAR_WIDTH, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 4, flexShrink: 0, borderRight: `1px solid ${T.border}` }}>
        <IconBtn active={activeTab === 'categories'} onClick={() => handleIconClick('categories')} title="Categories">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
          </svg>
        </IconBtn>
        <IconBtn active={activeTab === 'stories'} onClick={() => handleIconClick('stories')} title="Stories">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </IconBtn>
        <IconBtn active={activeTab === 'task'} onClick={() => handleIconClick('task')} title="New Task">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </IconBtn>
      </div>

      {/* Panel */}
      <div style={{ width: expanded ? PANEL_WIDTH : 0, minWidth: expanded ? PANEL_WIDTH : 0, transition: 'width 0.2s ease, min-width 0.2s ease', overflow: 'hidden', borderRight: expanded ? `1px solid ${T.border}` : 'none', background: T.bg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
        {/* Header */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {activeTab === 'categories' ? 'Categories' : activeTab === 'stories' ? 'Stories' : isEditing ? 'Edit Task' : 'New Task'}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>
          {activeTab === 'categories' && (
            <CategoriesTab
              categories={categories}
              catName={catName}
              setCatName={setCatName}
              catColor={catColor}
              setCatColor={setCatColor}
              onAdd={handleAddCategory}
              onDelete={handleDeleteCategory}
            />
          )}
          {activeTab === 'stories' && (
            <StoriesTab
              stories={stories}
              storyTitle={storyTitle}
              setStoryTitle={setStoryTitle}
              storyDesc={storyDesc}
              setStoryDesc={setStoryDesc}
              storyColor={storyColor}
              setStoryColor={setStoryColor}
              onAdd={handleAddStory}
              onDelete={handleDeleteStory}
            />
          )}
          {activeTab === 'task' && (
            <TaskTab
              isEditing={isEditing}
              status={status}
              title={title}
              setTitle={setTitle}
              note={note}
              setNote={setNote}
              date={date}
              setDate={setDate}
              startTime={startTime}
              setStartTime={setStartTime}
              endTime={endTime}
              setEndTime={setEndTime}
              categories={categories}
              selectedCats={selectedCats}
              toggleCat={toggleCat}
              stories={stories}
              selectedStoryId={selectedStoryId}
              setSelectedStoryId={setSelectedStoryId}
              priority={priority}
              setPriority={setPriority}
              points={points}
              setPoints={setPoints}
              reminderDate={reminderDate}
              setReminderDate={setReminderDate}
              reminderTime={reminderTime}
              setReminderTime={setReminderTime}
              existingReminders={existingReminders}
              onAddReminder={handleAddReminder}
              onDeleteReminder={handleDeleteReminder}
              onSave={handleSaveTask}
              onDelete={handleDeleteTask}
              onSetStatus={handleSetStatus}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function IconBtn({ active, onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 6, cursor: 'pointer', background: active ? T.elevated : 'transparent', color: active ? T.text : T.textFaint }}
    >
      {children}
    </button>
  )
}

function StoriesTab({ stories, storyTitle, setStoryTitle, storyDesc, setStoryDesc, storyColor, setStoryColor, onAdd, onDelete }) {
  return (
    <div>
      {stories.length === 0 && (
        <p style={{ fontSize: 12, color: T.textDim, textAlign: 'center', margin: '12px 0' }}>No stories yet</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 18 }}>
        {stories.map(story => (
          <div key={story.id} style={{ padding: '8px 10px', background: T.elevated, borderRadius: 5, border: `1px solid ${T.borderStrong}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: story.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, color: T.text, fontWeight: 600 }}>{story.title}</span>
              <button onClick={() => onDelete(story.id)} style={{ background: 'none', border: 'none', fontSize: 16, color: T.textFaint, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }} title="Delete">×</button>
            </div>
            {story.description && (
              <div style={{ fontSize: 11, color: T.textSub, marginTop: 4, paddingLeft: 18 }}>{story.description}</div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={onAdd}>
        <div style={{ fontSize: 10, fontWeight: 600, color: T.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Add new</div>
        <input value={storyTitle} onChange={e => setStoryTitle(e.target.value)} placeholder="Story title" style={{ ...inputStyle, marginBottom: 8 }} />
        <textarea value={storyDesc} onChange={e => setStoryDesc(e.target.value)} placeholder="Description (optional)" rows={2} style={{ ...inputStyle, marginBottom: 8, resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          {PRESET_COLORS.map(c => (
            <div key={c} onClick={() => setStoryColor(c)} style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: storyColor === c ? `2px solid ${T.text}` : '2px solid transparent', boxShadow: storyColor === c ? `0 0 0 1px ${T.borderStrong}` : 'none' }} />
          ))}
        </div>
        <button type="submit" style={primaryBtnStyle}>Add Story</button>
      </form>
    </div>
  )
}

function CategoriesTab({ categories, catName, setCatName, catColor, setCatColor, onAdd, onDelete }) {
  return (
    <div>
      {categories.length === 0 && (
        <p style={{ fontSize: 12, color: T.textDim, textAlign: 'center', margin: '12px 0' }}>No categories yet</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 18 }}>
        {categories.map(cat => (
          <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: T.elevated, borderRadius: 5, border: `1px solid ${T.borderStrong}` }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: T.text }}>{cat.name}</span>
            <button onClick={() => onDelete(cat.id)} style={{ background: 'none', border: 'none', fontSize: 16, color: T.textFaint, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }} title="Delete">×</button>
          </div>
        ))}
      </div>

      <form onSubmit={onAdd}>
        <div style={{ fontSize: 10, fontWeight: 600, color: T.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Add new</div>
        <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Category name" style={{ ...inputStyle, marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          {PRESET_COLORS.map(c => (
            <div key={c} onClick={() => setCatColor(c)} style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: catColor === c ? `2px solid ${T.text}` : '2px solid transparent', boxShadow: catColor === c ? `0 0 0 1px ${T.borderStrong}` : 'none' }} />
          ))}
        </div>
        <button type="submit" style={primaryBtnStyle}>Add</button>
      </form>
    </div>
  )
}

function TaskTab({ isEditing, status, title, setTitle, note, setNote, date, setDate, startTime, setStartTime, endTime, setEndTime, categories, selectedCats, toggleCat, stories, selectedStoryId, setSelectedStoryId, priority, setPriority, points, setPoints, reminderDate, setReminderDate, reminderTime, setReminderTime, existingReminders, onAddReminder, onDeleteReminder, onSave, onDelete, onSetStatus }) {
  return (
    <form onSubmit={onSave}>
      {isEditing && (
        <div style={{ marginBottom: 12 }}>
          <Label>Status</Label>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { value: 'todo',        label: 'To Do',       color: T.textSub, bg: T.elevated,    border: T.borderStrong },
              { value: 'in_progress', label: 'In Progress', color: T.warning, bg: T.warningSoft,  border: T.warningBorder },
              { value: 'done',        label: 'Done',        color: T.success, bg: T.successSoft,  border: T.successBorder },
            ].map(opt => {
              const active = status === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSetStatus(opt.value)}
                  style={{
                    flex: 1, padding: '7px 6px',
                    border: `1px solid ${active ? opt.border : T.borderStrong}`,
                    borderRadius: 5,
                    background: active ? opt.bg : T.elevated,
                    cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    color: active ? opt.color : T.textDim,
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <Label>Title</Label>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="What are you working on?" style={inputStyle} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <Label>Note</Label>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note..." rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <Label>Priority</Label>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { value: 'low', label: 'Low', color: T.accent },
              { value: 'medium', label: 'Med', color: T.warning },
              { value: 'high', label: 'High', color: T.danger },
            ].map(opt => {
              const active = priority === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(active ? null : opt.value)}
                  style={{
                    flex: 1, padding: '6px 4px',
                    border: `1px solid ${active ? opt.color : T.borderStrong}`,
                    borderRadius: 5,
                    background: active ? `${opt.color}18` : T.elevated,
                    cursor: 'pointer', fontSize: 10, fontWeight: 600,
                    color: active ? opt.color : T.textDim,
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ width: 70 }}>
          <Label>Points</Label>
          <input
            type="number"
            min="0"
            value={points}
            onChange={e => setPoints(e.target.value)}
            placeholder="—"
            style={{ ...inputStyle, textAlign: 'center' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <Label>Date</Label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <Label>Start</Label>
          <input type="time" step="900" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <Label>End</Label>
          <input type="time" step="900" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {stories.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Label>Story</Label>
          <select
            value={selectedStoryId || ''}
            onChange={e => setSelectedStoryId(e.target.value ? Number(e.target.value) : null)}
            style={inputStyle}
          >
            <option value="">No story</option>
            {stories.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
      )}

      {categories.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Label>Categories</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {categories.map(cat => (
              <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: T.text }}>
                <input type="checkbox" checked={selectedCats.includes(cat.id)} onChange={() => toggleCat(cat.id)} style={{ accentColor: cat.color }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                {cat.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Reminder section */}
      {isEditing && (
        <div style={{ marginBottom: 14 }}>
          <Label>Reminders</Label>

          {/* Existing reminders */}
          {existingReminders.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {existingReminders.map(r => {
                const d = new Date(r.remind_at)
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: T.elevated, borderRadius: 4, border: `1px solid ${T.borderStrong}` }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.warning} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    <span style={{ flex: 1, fontSize: 11, color: T.text }}>
                      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button onClick={() => onDeleteReminder(r.id)} type="button" style={{ background: 'none', border: 'none', fontSize: 14, color: T.textFaint, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>×</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add new reminder */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
            <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
            <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
            <button
              type="button"
              onClick={onAddReminder}
              disabled={!reminderDate || !reminderTime}
              style={{
                padding: '7px 10px', border: 'none', borderRadius: 5,
                background: reminderDate && reminderTime ? T.accent : T.elevated,
                color: reminderDate && reminderTime ? T.buttonText : T.textDim,
                fontSize: 11, fontWeight: 600, cursor: reminderDate && reminderTime ? 'pointer' : 'default',
                flexShrink: 0,
              }}
            >
              +
            </button>
          </div>
        </div>
      )}

      <button type="submit" style={primaryBtnStyle}>{isEditing ? 'Update Task' : 'Save Task'}</button>

      {isEditing && (
        <button type="button" onClick={onDelete} style={{ ...primaryBtnStyle, background: 'transparent', border: `1px solid ${T.dangerBorder}`, color: T.danger, marginTop: 8 }}>
          Delete Task
        </button>
      )}
    </form>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 600, color: T.textDim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</div>
}

const inputStyle = {
  width: '100%', padding: '7px 9px',
  border: `1px solid ${T.borderStrong}`,
  borderRadius: 5, fontSize: 13, boxSizing: 'border-box', outline: 'none',
  background: T.elevated, color: T.text,
}

const primaryBtnStyle = {
  width: '100%', padding: '8px 14px', border: 'none', borderRadius: 5,
  background: T.accent, color: T.buttonText, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
