<p align="center">
  <img src="app/public/navilife-icon.png" alt="Navilife" width="80" />
</p>

<h1 align="center">Navilife</h1>

<p align="center">
  Navigate your lifestyle — take control of your <strong>Time</strong>, <strong>Money</strong>, and <strong>Knowledge</strong>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel&logoColor=white" alt="Vercel" />
</p>

<p align="center">
  <a href="https://productivity-manager-gules.vercel.app/login"><strong>Live Demo</strong></a>
</p>

---

## About

Navilife helps people navigate three pillars of life: **Time**, **Money**, and **Knowledge**. Starting with time management — plan your week, track what actually happens, and see if you're improving.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7 |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Charts | Recharts 3 |
| Build | Vite 7 |
| Deploy | Vercel |

## Features

- **Drag-and-drop weekly planner** — 7-day grid with 15-min slots, resize task duration by dragging edges
- **Daily checklist** — today's tasks + overdue carry-forward, tri-state status cycling (To Do → In Progress → Done)
- **6 analytics charts** — completion rate, weekly trend, time distribution, streak calendar, energy map, task timeline
- **Status audit log** — every status change is timestamped, enabling planned-vs-actual time analysis
- **Inline task notes** — click any task to open a note editor panel
- **Google OAuth + Row-Level Security** — each user only sees their own data

## Project Structure

```
navilife/
├── app/src/
│   ├── pages/          # Login, Dashboard, Week, Daily
│   ├── components/     # Nav, Drawer, WeekGrid
│   ├── lib/            # Supabase client, status helpers
│   └── theme.js        # Centralized design tokens
├── supabase/migrations/ # PostgreSQL schema + RLS policies
├── docs/                # Tech decisions, migration guide
└── vercel.json
```

## Getting Started

```bash
git clone <repo-url>
cd navilife/app
npm install
```

Create `app/.env`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_anon_key
```

Set up the database and run:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
npm run dev
```

## Roadmap

- [x] Weekly planner with drag-and-drop
- [x] Dashboard with 6 analytics charts
- [x] Daily task view with status tracking
- [x] Status checkpoint logging
- [ ] Money tracking module
- [ ] Knowledge tracking module

## License

MIT
