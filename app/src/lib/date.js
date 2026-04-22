// All date operations go through here so we consistently use the user's
// selected timezone (from user_settings), not the browser's.
// Dates in the DB are stored as YYYY-MM-DD strings and must be interpreted
// as calendar dates in the user's timezone.

// Returns YYYY-MM-DD in the given IANA timezone for the given Date (default: now).
export function localDateStr(timezone = 'UTC', d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d)
  const get = (t) => parts.find((p) => p.type === t)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

// Shifts a YYYY-MM-DD string by a number of days (calendar days, timezone-agnostic).
export function addDaysStr(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

// YYYY-MM-DD of the Monday of the week containing `dateStr`.
export function mondayStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() // 0..6, Sun=0
  const diff = dow === 0 ? -6 : 1 - dow
  dt.setUTCDate(dt.getUTCDate() + diff)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

// Parses a YYYY-MM-DD string into a Date object at UTC midnight.
// Safe for display/formatting, not for date math (use addDaysStr instead).
export function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

// Day-of-week index where Monday=0, Sunday=6, from a YYYY-MM-DD string.
export function dowMon0(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay()
  return dow === 0 ? 6 : dow - 1
}
