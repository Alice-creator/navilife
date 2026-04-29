// Theme tokens, resolved via CSS custom properties.
// Edit the actual color values in src/index.css (`:root` for dark, `[data-theme="light"]` for light).
// Switching themes is done by setting `data-theme` on <html>; no JS state needed for re-render.
export const T = {
  // Backgrounds
  bg:           'var(--page-bg)',  // page background — transparent when a bg image is in use
  surface:      'var(--surface)',  // cards, panels, dropdowns
  elevated:     'var(--elevated)', // inputs, hover states, raised elements
  overlay:      'var(--overlay)',  // modal/login overlay

  // Borders
  border:       'var(--border)',
  borderStrong: 'var(--border-strong)',

  // Text
  text:         'var(--text)',
  textSub:      'var(--text-sub)',
  textDim:      'var(--text-dim)',
  textFaint:    'var(--text-faint)',
  textOnLight:  'var(--text-on-light)',
  buttonText:   'var(--button-text)',

  // Accents
  accent:        'var(--accent)',
  accentSoft:    'var(--accent-soft)',
  success:       'var(--success)',
  successSoft:   'var(--success-soft)',
  successBorder: 'var(--success-border)',
  streak:        'var(--streak)',
  warning:       'var(--warning)',
  warningSoft:   'var(--warning-soft)',
  warningBorder: 'var(--warning-border)',
  purple:        'var(--purple)',
  danger:        'var(--danger)',
  dangerBorder:  'var(--danger-border)',

  // Default task (no category assigned)
  taskBg:     'var(--task-bg)',
  taskBorder: 'var(--task-border)',
  taskText:   'var(--task-text)',

  // Shadows
  shadow:      'var(--shadow)',
  shadowHeavy: 'var(--shadow-heavy)',
}

// Preset color palette for category picker (theme-independent, plain hex).
export const PRESET_COLORS = ['#7C8AFF', '#5BA4F5', '#34D399', '#FBBF4E', '#F87171', '#F472B6', '#A78BFA', '#2DD4BF']

// Convert "moon-night.jpg" → "Moon night", used to label uploaded background files.
export function filenameToLabel(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
