import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import { T } from '../theme'
import { nextStatus } from '../lib/taskStatus'

const COLUMNS = [
  { key: 'todo', label: 'To Do', color: T.textSub, border: T.borderStrong },
  { key: 'in_progress', label: 'In Progress', color: T.warning, border: T.warningBorder },
  { key: 'done', label: 'Done', color: T.success, border: T.successBorder },
]

export default function Kanban({ categories, stories }) {
  const [tasks, setTasks] = useState([])
  const [taskCatMap, setTaskCatMap] = useState({})
  const [loading, setLoading] = useState(true)

  const catById = {}
  categories.forEach(c => { catById[c.id] = c })

  const storyById = {}
  ;(stories || []).forEach(s => { storyById[s.id] = s })

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('tasks').select('*').order('date', { ascending: true })
      if (data) {
        setTasks(data)
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
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleChangeStatus(taskId, newStatus) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    await Promise.all([
      supabase.from('tasks').update({ status: newStatus }).eq('id', taskId),
      supabase.from('status_logs').insert({ task_id: taskId, status: newStatus }),
    ])
  }

  // Group tasks by story within each status column
  function getGroupedTasks(status) {
    const columnTasks = tasks.filter(t => t.status === status)
    const grouped = {}
    const noStory = []

    columnTasks.forEach(t => {
      if (t.story_id && storyById[t.story_id]) {
        if (!grouped[t.story_id]) grouped[t.story_id] = []
        grouped[t.story_id].push(t)
      } else {
        noStory.push(t)
      }
    })

    return { grouped, noStory }
  }

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, color: T.textDim, fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border}` }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>Kanban Board</h1>
      </div>

      {/* Board */}
      <div style={{ flex: 1, display: 'flex', gap: 16, padding: 16, overflow: 'auto' }}>
        {COLUMNS.map(col => {
          const { grouped, noStory } = getGroupedTasks(col.key)
          const storyIds = Object.keys(grouped)
          const totalCount = tasks.filter(t => t.status === col.key).length

          return (
            <div key={col.key} style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', background: T.surface, borderRadius: 10, border: `1px solid ${T.borderStrong}`, overflow: 'hidden' }}>
              {/* Column header */}
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col.label}</span>
                <span style={{ fontSize: 12, color: T.textDim, marginLeft: 'auto' }}>{totalCount}</span>
              </div>

              {/* Cards */}
              <div style={{ flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Story groups */}
                {storyIds.map(sid => {
                  const story = storyById[sid]
                  return (
                    <StoryGroup key={sid} story={story} tasks={grouped[sid]} catById={catById} taskCatMap={taskCatMap} onChangeStatus={handleChangeStatus} />
                  )
                })}

                {/* Ungrouped tasks */}
                {noStory.length > 0 && storyIds.length > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 6, marginBottom: 2 }}>
                    No story
                  </div>
                )}
                {noStory.map(task => (
                  <TaskCard key={task.id} task={task} catById={catById} taskCatMap={taskCatMap} onChangeStatus={handleChangeStatus} />
                ))}

                {totalCount === 0 && (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: T.textFaint, fontSize: 12 }}>
                    No tasks
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StoryGroup({ story, tasks, catById, taskCatMap, onChangeStatus }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, marginTop: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: story.color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: story.color, textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {story.title}
        </span>
        <span style={{ fontSize: 10, color: T.textDim }}>{tasks.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} catById={catById} taskCatMap={taskCatMap} onChangeStatus={onChangeStatus} />
        ))}
      </div>
    </div>
  )
}

function TaskCard({ task, catById, taskCatMap, onChangeStatus }) {
  const catIds = taskCatMap[task.id] || []
  const next = nextStatus(task.status)

  return (
    <div style={{
      padding: '10px 12px',
      background: T.elevated,
      border: `1px solid ${T.borderStrong}`,
      borderRadius: 6,
    }}>
      {/* Title */}
      <div style={{
        fontSize: 13, fontWeight: 500, color: T.text,
        textDecoration: task.status === 'done' ? 'line-through' : 'none',
        marginBottom: 6,
      }}>
        {task.title}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {/* Date */}
        {task.date && (
          <span style={{ fontSize: 11, color: T.textSub }}>{task.date}</span>
        )}

        {/* Category dots */}
        {catIds.length > 0 && (
          <div style={{ display: 'flex', gap: 3 }}>
            {catIds.map(cid => {
              const cat = catById[cid]
              return cat ? (
                <div key={cid} title={cat.name} style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color }} />
              ) : null
            })}
          </div>
        )}

        {/* Status button */}
        <button
          onClick={() => onChangeStatus(task.id, next)}
          style={{
            marginLeft: 'auto',
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 600,
            border: `1px solid ${T.borderStrong}`,
            borderRadius: 4,
            background: T.surface,
            color: T.textSub,
            cursor: 'pointer',
          }}
          title={`Move to ${next.replace('_', ' ')}`}
        >
          {next === 'in_progress' ? '→ In Progress' : next === 'done' ? '→ Done' : '→ To Do'}
        </button>
      </div>
    </div>
  )
}
