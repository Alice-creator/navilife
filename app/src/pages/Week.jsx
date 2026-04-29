import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import WeekGrid from '../components/WeekGrid'
import Drawer from '../components/Drawer'
import { T } from '../theme'
import { localDateStr, mondayStr, addDaysStr, parseDateStr } from '../lib/date'

// Build 7 consecutive dates starting at `startStr` (YYYY-MM-DD).
// Returned as UTC-midnight Date objects so downstream `toISOString()` calls
// yield the correct calendar date regardless of the browser's timezone.
function getWeekDays(startStr) {
  return Array.from({ length: 7 }, (_, i) => parseDateStr(addDaysStr(startStr, i)))
}

function formatRange(days) {
  const start = days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const end = days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return `${start} – ${end}`
}

export default function Week({ categories, onCategoriesChange, stories, onStoriesChange, timezone = 'UTC' }) {
  const [weekStartStr, setWeekStartStr] = useState(() => mondayStr(localDateStr(timezone)))
  const [tasks, setTasks] = useState([])
  const [taskCatMap, setTaskCatMap] = useState({})
  const [taskVersion, setTaskVersion] = useState(0)
  const [drawerSlot, setDrawerSlot] = useState(null)
  const [editTask, setEditTask] = useState(null)
  const [selectionRange, setSelectionRange] = useState(null)
  const [pendingRange, setPendingRange] = useState(null)

  // Re-anchor to the current week when the user's timezone changes
  useEffect(() => {
    setWeekStartStr(mondayStr(localDateStr(timezone)))
  }, [timezone])

  const days = getWeekDays(weekStartStr)

  useEffect(() => {
    fetchTasks()
  }, [weekStartStr, taskVersion])

  function handleSlotClick(date, time) {
    setEditTask(null)
    setDrawerSlot({ date, time, _ts: Date.now() })
  }

  function handleTaskClick(task, categoryIds) {
    setDrawerSlot(null)
    setEditTask({ ...task, category_ids: categoryIds, _ts: Date.now() })
  }

  function handleTaskChanged() {
    setTaskVersion(v => v + 1)
  }

  async function handleTaskMove(taskId, newDate, newStartTime, newEndTime) {
    // Optimistic update — move task instantly in UI
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, date: newDate, start_time: newStartTime, end_time: newEndTime }
        : t
    ))
    // Persist to database in background
    await supabase.from('tasks').update({ date: newDate, start_time: newStartTime, end_time: newEndTime }).eq('id', taskId)
  }

  async function fetchTasks() {
    const from = weekStartStr
    const to = addDaysStr(weekStartStr, 6)
    const { data } = await supabase.from('tasks').select('*').gte('date', from).lte('date', to)
    if (data) {
      setTasks(data)
      // Fetch category mappings for these tasks
      const ids = data.map(t => t.id)
      if (ids.length > 0) {
        const { data: tcData } = await supabase.from('task_categories').select('*').in('task_id', ids)
        if (tcData) {
          const map = {}
          tcData.forEach(tc => {
            if (!map[tc.task_id]) map[tc.task_id] = []
            map[tc.task_id].push(tc.category_id)
          })
          setTaskCatMap(map)
        }
      } else {
        setTaskCatMap({})
      }
    }
  }

  function prevWeek() {
    setWeekStartStr(addDaysStr(weekStartStr, -7))
  }

  function nextWeek() {
    setWeekStartStr(addDaysStr(weekStartStr, 7))
  }

  return (
    <div style={{ height: '100%', display: 'flex', fontFamily: 'system-ui, sans-serif', background: T.bg }}>
      <Drawer
        slot={drawerSlot}
        editTask={editTask}
        pendingRange={pendingRange}
        categories={categories}
        onCategoriesChange={onCategoriesChange}
        stories={stories}
        onStoriesChange={onStoriesChange}
        onTaskChanged={handleTaskChanged}
        onRangeChange={setSelectionRange}
        timezone={timezone}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={prevWeek} style={navBtn}>←</button>
          <button onClick={nextWeek} style={navBtn}>→</button>
          <span style={{ fontWeight: 600, fontSize: 15, color: T.text }}>{formatRange(days)}</span>
          <button onClick={() => setWeekStartStr(mondayStr(localDateStr(timezone)))} style={{ ...navBtn, marginLeft: 4, fontSize: 13 }}>Today</button>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <WeekGrid
            days={days}
            tasks={tasks}
            categories={categories}
            taskCatMap={taskCatMap}
            stories={stories}
            timezone={timezone}
            selectionRange={selectionRange}
            onSelectionRangeEdit={(r) => {
              setSelectionRange(r)
              setPendingRange({ ...r, _ts: Date.now() })
            }}
            onSlotClick={handleSlotClick}
            onTaskClick={(task) => handleTaskClick(task, taskCatMap[task.id] || [])}
            onTaskMove={handleTaskMove}
          />
        </div>
      </div>
    </div>
  )
}

const navBtn = {
  padding: '4px 10px',
  border: `1px solid ${T.borderStrong}`,
  borderRadius: 4,
  background: T.elevated,
  color: T.text,
  cursor: 'pointer',
  fontSize: 14,
}
