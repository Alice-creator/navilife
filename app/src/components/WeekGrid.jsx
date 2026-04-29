import { useRef, useState } from 'react'
import { T } from '../theme'
import { localDateStr } from '../lib/date'

const HOUR_START = 0
const HOUR_END = 24
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
const HOUR_HEIGHT = 64
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function minsToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0')
  const m = (mins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function getTaskTop(startTime) {
  const mins = timeToMinutes(startTime)
  return ((mins - HOUR_START * 60) / 60) * HOUR_HEIGHT
}

function getTaskHeight(startTime, endTime) {
  const duration = timeToMinutes(endTime) - timeToMinutes(startTime)
  return Math.max((duration / 60) * HOUR_HEIGHT, 16)
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function WeekGrid({ days, tasks, categories = [], taskCatMap = {}, stories = [], timezone = 'UTC', selectionRange = null, onSelectionRangeEdit, onSlotClick, onTaskClick, onTaskMove }) {
  const gridRef = useRef(null)
  const dragRef = useRef(null)
  const resizeRef = useRef(null)
  const selResizeRef = useRef(null)
  const selDragRef = useRef(null)
  const wasDragging = useRef(false)
  const rafRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [resize, setResize] = useState(null) // { taskId, startTime, endTime }
  const [selResize, setSelResize] = useState(null) // { startTime, endTime } during selection-edge drag
  const [selMove, setSelMove] = useState(null)     // { date, startTime, endTime } during selection body drag

  const catById = {}
  categories.forEach(c => { catById[c.id] = c })

  const storyById = {}
  stories.forEach(s => { storyById[s.id] = s })

  function getTaskColor(task) {
    const catIds = taskCatMap[task.id]
    if (catIds && catIds.length > 0 && catById[catIds[0]]) {
      const color = catById[catIds[0]].color
      return {
        bg: hexToRgba(color, 0.28),
        border: hexToRgba(color, 0.9),
        text: color,
      }
    }
    return {
      bg: T.taskBg,
      border: T.taskBorder,
      text: T.taskText,
    }
  }

  function getTasksForDay(date) {
    const dateStr = date.toISOString().split('T')[0]
    return tasks.filter(t => t.date === dateStr && t.start_time && t.end_time)
  }

  function handleColumnClick(e, dateStr) {
    if (wasDragging.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const totalMins = HOUR_START * 60 + Math.floor((y / HOUR_HEIGHT) * 60)
    const snapped = Math.round(totalMins / 15) * 15
    onSlotClick(dateStr, minsToTime(snapped))
  }

  // --- Drag and drop ---

  function getDropInfo(clientX, clientY) {
    if (!gridRef.current) return null
    const cols = gridRef.current.querySelectorAll('[data-day-col]')
    for (const col of cols) {
      const rect = col.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) {
        const relY = clientY - rect.top
        const totalMins = HOUR_START * 60 + (relY / HOUR_HEIGHT) * 60
        const snapped = Math.round(totalMins / 15) * 15
        const clamped = Math.max(0, Math.min(snapped, 23 * 60 + 45))
        return { date: col.dataset.date, time: minsToTime(clamped), rect }
      }
    }
    return null
  }

  function handleTaskMouseDown(e, task) {
    if (e.button !== 0) return
    e.preventDefault()

    const el = e.currentTarget
    const elRect = el.getBoundingClientRect()

    dragRef.current = {
      task,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - elRect.left,
      offsetY: e.clientY - elRect.top,
      width: elRect.width,
      height: elRect.height,
      duration: timeToMinutes(task.end_time) - timeToMinutes(task.start_time),
      started: false,
    }

    function onMove(ev) {
      const d = dragRef.current
      if (!d) return

      if (!d.started) {
        if (Math.abs(ev.clientX - d.startX) + Math.abs(ev.clientY - d.startY) < 5) return
        d.started = true
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
      }

      d.lastX = ev.clientX
      d.lastY = ev.clientY
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const dd = dragRef.current
        if (!dd) return

        const drop = getDropInfo(dd.lastX, dd.lastY)

        if (drop) {
          const mins = timeToMinutes(drop.time)
          const snapY = drop.rect.top + ((mins - HOUR_START * 60) / 60) * HOUR_HEIGHT
          setDrag({
            task: dd.task,
            x: drop.rect.left + 2,
            y: snapY,
            w: drop.rect.width - 4,
            h: dd.height,
          })
        } else {
          setDrag({
            task: dd.task,
            x: dd.lastX - dd.offsetX,
            y: dd.lastY - dd.offsetY,
            w: dd.width,
            h: dd.height,
          })
        }
      })
    }

    function onUp(ev) {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      const d = dragRef.current
      dragRef.current = null
      setDrag(null)

      if (!d || !d.started) return

      wasDragging.current = true
      setTimeout(() => { wasDragging.current = false }, 0)

      const drop = getDropInfo(ev.clientX, ev.clientY)
      if (!drop || !onTaskMove) return

      const startMins = timeToMinutes(drop.time)
      const endMins = Math.min(startMins + d.duration, 24 * 60)

      const oldStart = (d.task.start_time || '').slice(0, 5)
      if (drop.date !== d.task.date || drop.time !== oldStart) {
        onTaskMove(d.task.id, drop.date, drop.time, minsToTime(endMins))
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // --- Resize ---

  function handleResizeMouseDown(e, task, edge) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    const col = e.target.closest('[data-day-col]')
    if (!col) return

    resizeRef.current = {
      task,
      edge,
      colEl: col,
      startTime: task.start_time.slice(0, 5),
      endTime: task.end_time.slice(0, 5),
    }

    document.body.style.cursor = edge === 'top' ? 'n-resize' : 's-resize'
    document.body.style.userSelect = 'none'

    function onMove(ev) {
      const r = resizeRef.current
      if (!r) return

      r.lastY = ev.clientY
      if (r.raf) return
      r.raf = requestAnimationFrame(() => {
        r.raf = null
        const rr = resizeRef.current
        if (!rr) return

        const rect = rr.colEl.getBoundingClientRect()
        const relY = rr.lastY - rect.top
        const totalMins = HOUR_START * 60 + (relY / HOUR_HEIGHT) * 60
        const snapped = Math.round(totalMins / 15) * 15
        const clamped = Math.max(0, Math.min(snapped, 24 * 60))

        if (rr.edge === 'bottom') {
          const startMins = timeToMinutes(rr.startTime)
          rr.endTime = minsToTime(Math.max(clamped, startMins + 15))
        } else {
          const endMins = timeToMinutes(rr.endTime)
          rr.startTime = minsToTime(Math.min(clamped, endMins - 15))
        }

        setResize({ taskId: rr.task.id, startTime: rr.startTime, endTime: rr.endTime })
      })
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (resizeRef.current?.raf) cancelAnimationFrame(resizeRef.current.raf)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      const r = resizeRef.current
      resizeRef.current = null
      setResize(null)

      if (!r || !onTaskMove) return

      const oldStart = (r.task.start_time || '').slice(0, 5)
      const oldEnd = (r.task.end_time || '').slice(0, 5)
      if (r.startTime !== oldStart || r.endTime !== oldEnd) {
        onTaskMove(r.task.id, r.task.date, r.startTime, r.endTime)
      }

      wasDragging.current = true
      setTimeout(() => { wasDragging.current = false }, 0)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // --- Selection range body drag (move) ---

  function getSelectionMoveDrop(clientX, clientY, grabPxOffset, durationMins) {
    if (!gridRef.current) return null
    const cols = gridRef.current.querySelectorAll('[data-day-col]')
    for (const c of cols) {
      const rect = c.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) {
        const adjustedY = clientY - grabPxOffset
        const relY = adjustedY - rect.top
        const totalMins = HOUR_START * 60 + (relY / HOUR_HEIGHT) * 60
        const snapped = Math.round(totalMins / 15) * 15
        const maxStart = 24 * 60 - durationMins
        const clamped = Math.max(0, Math.min(snapped, maxStart))
        return {
          date: c.dataset.date,
          startTime: minsToTime(clamped),
          endTime: minsToTime(clamped + durationMins),
        }
      }
    }
    return null
  }

  function handleSelectionMouseDown(e) {
    if (e.button !== 0 || !selectionRange) return
    e.preventDefault()
    e.stopPropagation()

    const col = e.currentTarget.closest('[data-day-col]')
    if (!col) return
    const colRect = col.getBoundingClientRect()
    const bandTopPx = getTaskTop(selectionRange.startTime)
    const grabPxOffset = e.clientY - (colRect.top + bandTopPx)

    const startMins = timeToMinutes(selectionRange.startTime)
    const endMins = timeToMinutes(selectionRange.endTime)

    selDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      grabPxOffset,
      duration: endMins - startMins,
      origDate: selectionRange.date,
      origStart: selectionRange.startTime,
      started: false,
    }

    function onMove(ev) {
      const d = selDragRef.current
      if (!d) return

      if (!d.started) {
        if (Math.abs(ev.clientX - d.startX) + Math.abs(ev.clientY - d.startY) < 5) return
        d.started = true
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
      }

      d.lastX = ev.clientX
      d.lastY = ev.clientY
      if (d.raf) return
      d.raf = requestAnimationFrame(() => {
        d.raf = null
        const dd = selDragRef.current
        if (!dd) return

        const drop = getSelectionMoveDrop(dd.lastX, dd.lastY, dd.grabPxOffset, dd.duration)
        if (!drop) return
        setSelMove(drop)
      })
    }

    function onUp(ev) {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (selDragRef.current?.raf) cancelAnimationFrame(selDragRef.current.raf)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      const d = selDragRef.current
      selDragRef.current = null
      setSelMove(null)

      if (!d || !d.started) return

      wasDragging.current = true
      setTimeout(() => { wasDragging.current = false }, 0)

      if (!onSelectionRangeEdit) return

      const drop = getSelectionMoveDrop(ev.clientX, ev.clientY, d.grabPxOffset, d.duration)
      if (!drop) return
      if (drop.date !== d.origDate || drop.startTime !== d.origStart) {
        onSelectionRangeEdit(drop)
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // --- Selection range resize ---

  function handleSelectionResizeMouseDown(e, edge) {
    if (e.button !== 0 || !selectionRange) return
    e.preventDefault()
    e.stopPropagation()

    const col = e.target.closest('[data-day-col]')
    if (!col) return

    selResizeRef.current = {
      edge,
      colEl: col,
      startTime: selectionRange.startTime,
      endTime: selectionRange.endTime,
    }

    document.body.style.cursor = edge === 'top' ? 'n-resize' : 's-resize'
    document.body.style.userSelect = 'none'

    function onMove(ev) {
      const r = selResizeRef.current
      if (!r) return
      r.lastY = ev.clientY
      if (r.raf) return
      r.raf = requestAnimationFrame(() => {
        r.raf = null
        const rr = selResizeRef.current
        if (!rr) return

        const rect = rr.colEl.getBoundingClientRect()
        const relY = rr.lastY - rect.top
        const totalMins = HOUR_START * 60 + (relY / HOUR_HEIGHT) * 60
        const snapped = Math.round(totalMins / 15) * 15
        const clamped = Math.max(0, Math.min(snapped, 24 * 60))

        if (rr.edge === 'bottom') {
          const startMins = timeToMinutes(rr.startTime)
          rr.endTime = minsToTime(Math.max(clamped, startMins + 15))
        } else {
          const endMins = timeToMinutes(rr.endTime)
          rr.startTime = minsToTime(Math.min(clamped, endMins - 15))
        }

        setSelResize({ startTime: rr.startTime, endTime: rr.endTime })
      })
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (selResizeRef.current?.raf) cancelAnimationFrame(selResizeRef.current.raf)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      const r = selResizeRef.current
      selResizeRef.current = null
      setSelResize(null)

      wasDragging.current = true
      setTimeout(() => { wasDragging.current = false }, 0)

      if (!r || !onSelectionRangeEdit) return
      if (r.startTime !== selectionRange.startTime || r.endTime !== selectionRange.endTime) {
        onSelectionRangeEdit({ date: selectionRange.date, startTime: r.startTime, endTime: r.endTime })
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // --- Render ---

  const ghostColors = drag ? getTaskColor(drag.task) : null

  return (
    <div ref={gridRef} style={{ display: 'flex', width: '100%' }}>
      {/* Time labels */}
      <div style={{ width: 56, flexShrink: 0, paddingTop: 41, background: T.bg }}>
        {HOURS.map(h => (
          <div key={h} style={{ height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, paddingTop: 4, fontSize: 12, color: T.textSub }}>
            {`${h.toString().padStart(2, '0')}:00`}
          </div>
        ))}
      </div>

      {/* Day columns */}
      {days.map((date, i) => {
        const dateStr = date.toISOString().split('T')[0]
        const isToday = dateStr === localDateStr(timezone)
        const dayTasks = getTasksForDay(date)

        return (
          <div key={i} style={{ flex: 1, minWidth: 0, borderLeft: `1px solid ${T.border}` }}>
            {/* Day header */}
            <div style={{ height: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderBottom: `1px solid ${T.border}`, background: isToday ? T.surface : T.bg, position: 'sticky', top: 0, zIndex: 1 }}>
              <span style={{ fontSize: 12, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{DAYS[i]}</span>
              <span style={{ fontSize: 15, fontWeight: isToday ? 700 : 400, color: isToday ? T.text : T.textSub }}>{date.getUTCDate()}</span>
            </div>

            {/* Clickable time slots */}
            <div
              data-day-col={i}
              data-date={dateStr}
              style={{ position: 'relative', height: HOURS.length * HOUR_HEIGHT, cursor: 'crosshair' }}
              onClick={(e) => handleColumnClick(e, dateStr)}
            >
              {/* Hour lines */}
              {HOURS.map(h => (
                <div key={h} style={{ position: 'absolute', top: (h - HOUR_START) * HOUR_HEIGHT, left: 0, right: 0, height: HOUR_HEIGHT, borderTop: `1px solid ${T.border}` }} />
              ))}

              {/* Selection highlight from drawer */}
              {selectionRange && (() => {
                const effDate = selMove ? selMove.date : selectionRange.date
                if (effDate !== dateStr) return null
                const effStart = selResize ? selResize.startTime : (selMove ? selMove.startTime : selectionRange.startTime)
                const effEnd = selResize ? selResize.endTime : (selMove ? selMove.endTime : selectionRange.endTime)
                if (timeToMinutes(effEnd) <= timeToMinutes(effStart)) return null
                const isMoving = !!selMove
                return (
                  <div
                    onMouseDown={handleSelectionMouseDown}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: getTaskTop(effStart),
                      height: getTaskHeight(effStart, effEnd),
                      left: 0,
                      right: 0,
                      background: hexToRgba(T.accent, 0.32),
                      border: `2px dashed ${T.accent}`,
                      borderLeft: `4px solid ${T.accent}`,
                      borderRadius: 4,
                      cursor: isMoving ? 'grabbing' : 'grab',
                      boxSizing: 'border-box',
                      userSelect: 'none',
                    }}
                  >
                    <div
                      onMouseDown={(e) => handleSelectionResizeMouseDown(e, 'top')}
                      style={{ position: 'absolute', top: -3, left: 0, right: 0, height: 8, cursor: 'n-resize' }}
                    />
                    <div
                      onMouseDown={(e) => handleSelectionResizeMouseDown(e, 'bottom')}
                      style={{ position: 'absolute', bottom: -3, left: 0, right: 0, height: 8, cursor: 's-resize' }}
                    />
                  </div>
                )
              })()}

              {/* Tasks */}
              {dayTasks.map(task => {
                const colors = getTaskColor(task)
                const isDragging = drag && drag.task.id === task.id
                const isResizing = resize && resize.taskId === task.id
                const effStart = isResizing ? resize.startTime : task.start_time
                const effEnd = isResizing ? resize.endTime : task.end_time
                return (
                  <div
                    key={task.id}
                    onMouseDown={(e) => handleTaskMouseDown(e, task)}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (wasDragging.current) return
                      onTaskClick(task)
                    }}
                    title={`${task.start_time} – ${task.end_time}\nDrag to move`}
                    style={{
                      position: 'absolute',
                      top: getTaskTop(effStart),
                      height: getTaskHeight(effStart, effEnd),
                      left: 2,
                      right: 2,
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderLeft: `3px solid ${colors.border}`,
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 12,
                      overflow: 'hidden',
                      cursor: isDragging ? 'grabbing' : 'grab',
                      color: colors.text,
                      textDecoration: task.status === 'done' ? 'line-through' : 'none',
                      fontStyle: task.status === 'in_progress' ? 'italic' : 'normal',
                      userSelect: 'none',
                      opacity: isDragging ? 0.3 : 1,
                    }}
                  >
                    {/* Top resize handle */}
                    <div
                      onMouseDown={(e) => handleResizeMouseDown(e, task, 'top')}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, cursor: 'n-resize' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{task.title}</span>
                      {task.priority && (
                        <span style={{
                          fontSize: 8, fontWeight: 700, padding: '0 3px', borderRadius: 2, lineHeight: '14px',
                          color: task.priority === 'high' ? T.danger : task.priority === 'medium' ? T.warning : T.accent,
                          background: task.priority === 'high' ? T.dangerBorder : task.priority === 'medium' ? T.warningSoft : T.accentSoft,
                        }}>
                          {task.priority === 'high' ? 'H' : task.priority === 'medium' ? 'M' : 'L'}
                        </span>
                      )}
                      {task.points != null && (
                        <span style={{ fontSize: 9, fontWeight: 600, color: T.purple, opacity: 0.8 }}>{task.points}pt</span>
                      )}
                    </div>
                    {task.story_id && storyById[task.story_id] && (
                      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {storyById[task.story_id].title}
                      </div>
                    )}
                    {/* Bottom resize handle */}
                    <div
                      onMouseDown={(e) => handleResizeMouseDown(e, task, 'bottom')}
                      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, cursor: 's-resize' }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Drag ghost */}
      {drag && ghostColors && (
        <div style={{
          position: 'fixed',
          left: drag.x,
          top: drag.y,
          width: drag.w,
          height: drag.h,
          background: ghostColors.bg,
          border: `1px solid ${ghostColors.border}`,
          borderLeft: `3px solid ${ghostColors.border}`,
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 12,
          color: ghostColors.text,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 1000,
          boxShadow: T.shadow,
          opacity: 0.9,
        }}>
          {drag.task.title}
        </div>
      )}
    </div>
  )
}
