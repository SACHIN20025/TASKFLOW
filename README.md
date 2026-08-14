# TaskFlow

A small full-stack task board (Trello-style): a Board with Columns, each holding Tasks with a
title, optional description, priority, and status (which column they're in). Supports filtering by
priority and searching by title, both backed by real database queries.

- **Frontend:** React (Vite, JavaScript)
- **Backend:** Node.js + Express
- **Database:** SQLite (via `better-sqlite3`), hand-written SQL — no ORM query builder

## Project layout

```
taskflow/
  backend/
    schema.sql           # CREATE TABLE statements (source of truth for the schema)
    src/
      db.js               # opens/creates the SQLite db, applies schema.sql
      queries.js           # all data-access functions + hand-written SQL
      server.js             # Express app / routes
      seed.js                # resets and populates demo data
    tests/
      queries.test.js         # backend tests against small ad-hoc fixtures
      seed-data.test.js        # backend tests against the real seed dataset
    data/                      # taskflow.db lives here once created (gitignored)
  frontend/
    .env.example                 # VITE_API_URL — only needed for deployment
    src/
      api.js               # fetch wrapper for the backend API
      App.jsx               # top-level state (board, filter, search, error banner)
      components/
        Column.jsx, TaskCard.jsx, TaskForm.jsx, FilterBar.jsx
      styles.css
```

## Getting started (from a fresh clone)

You need Node.js 18+ installed. Two terminal windows/tabs (one for backend, one for frontend).

### 1. Backend

```bash
cd backend
npm install
npm run seed     # creates backend/data/taskflow.db and fills it with demo data
npm start        # starts the API on http://localhost:4000
```

`npm run seed` is safe to re-run any time — it wipes and re-inserts the demo board, columns, and
tasks, so you always get a known-good starting point.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev       # starts the app on http://localhost:5173
```

Open http://localhost:5173. The frontend talks to the backend at `http://localhost:4000/api`
(hardcoded in `frontend/src/api.js` — no env config needed for local dev).

### 3. Run the backend tests

```bash
cd backend
npm test
```

Uses Node's built-in test runner (`node --test`) against an **in-memory** SQLite database, so it
never touches `data/taskflow.db`. This runs both test files:
- `queries.test.js` — small, purpose-built fixtures for each behavior (e.g. an empty-title task).
- `seed-data.test.js` — calls the *actual* `seedDatabase()` function from `src/seed.js` (the same
  code `npm run seed` runs) and asserts the DB-layer queries return the right rows for that real
  seed data, e.g. "3 tasks in To Do, 2 in In Progress, 2 in Done" and "2 High priority tasks,
  newest first."

## Database schema

From `backend/schema.sql`:

```sql
CREATE TABLE boards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE columns (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id   INTEGER NOT NULL,
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  column_id   INTEGER NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  priority    TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
);
```

Plus indexes on `tasks.column_id` and `columns.board_id`, since both are the columns most queries
filter/join on.

### The two non-trivial queries (in `backend/src/queries.js`)

**1. Task count per column on a board** (`getTaskCountsPerColumn`) — a `GROUP BY` with a `LEFT
JOIN` so empty columns still show `0` rather than disappearing:

```sql
SELECT columns.id AS column_id, columns.name AS column_name, COUNT(tasks.id) AS task_count
FROM columns
LEFT JOIN tasks ON tasks.column_id = columns.id
WHERE columns.board_id = ?
GROUP BY columns.id
ORDER BY columns.position ASC, columns.id ASC
```

**2. Tasks with a given priority, newest first** (`getTasksByPriority`) — joins through `columns`
because priority filtering is scoped to a board, then orders by recency:

```sql
SELECT tasks.*
FROM tasks
JOIN columns ON columns.id = tasks.column_id
WHERE columns.board_id = ? AND tasks.priority = ?
ORDER BY tasks.created_at DESC, tasks.id DESC
```

Both are exercised by real HTTP endpoints (`GET /api/boards/:id/counts` and
`GET /api/boards/:id/tasks?priority=High`), not just filtered client-side after fetching everything.

**Also implemented (nice-to-have): text search by title** (`searchTasksByTitle`) — a parameterized
`LIKE` search, combinable with the priority filter, scoped to a board the same way as query 2:

```sql
SELECT tasks.*
FROM tasks
JOIN columns ON columns.id = tasks.column_id
WHERE columns.board_id = ? AND tasks.title LIKE ? ESCAPE '\'
  [AND tasks.priority = ?]   -- only when a priority filter is also active
ORDER BY tasks.created_at DESC, tasks.id DESC
```

`%` and `_` in the user's search term are escaped before being embedded in the `LIKE` pattern, so a
literal `%` typed by the user is searched for literally rather than acting as a wildcard.

## API summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/boards/:id` | Board with nested columns + tasks |
| GET | `/api/boards/:id/tasks?priority=High&search=schema` | Flat task list, optionally filtered by priority and/or title search (combinable) |
| GET | `/api/boards/:id/counts` | Task count per column |
| POST | `/api/tasks` | Create a task (`columnId`, `title`, `description?`, `priority?`) |
| PUT | `/api/tasks/:id` | Edit a task |
| PATCH | `/api/tasks/:id/move` | Move a task to another column (`columnId`) |
| DELETE | `/api/tasks/:id` | Delete a task |

Every write route validates on the server (empty/whitespace titles are rejected with a 400, not
just blocked in the UI) and errors come back as `{ "error": "message" }` with an appropriate status
code, which the frontend surfaces as a dismissible banner instead of a blank screen.

## Decisions & assumptions

- **Single board.** The spec only asks to "view a board," so I didn't build board
  creation/switching — the app always loads board `#1`, created by the seed script. Multi-board
  support would mostly mean adding a board picker in the UI; the schema already supports it.
- **Move control instead of drag-and-drop.** Per the brief ("a working dropdown beats a broken
  drag-and-drop"), each task card has a `<select>` to move it between columns. Drag-and-drop is a
  natural next step if there's time.
- **Stretch goal picked: task count per column**, shown in each column header. It's driven by the
  `GROUP BY` query above rather than `column.tasks.length` on the frontend, so it stays correct
  even when the priority filter is hiding some tasks (the count still shows the true total).
- **Priority filter and title search both hit the backend**, not just `.filter()` on already-fetched
  data — partly to exercise the required queries for real, partly because it's the more honest
  version of "filtering" for a real app with more tasks than fit in memory. They're combinable
  (search "auth" within High priority tasks, for example), and the search box is debounced 300ms
  so it's not firing a request on every keystroke.
- **`created_at` is stored as SQLite's `datetime('now')` (UTC, second precision).** The frontend
  appends `Z` before parsing so dates display in the browser's local time zone rather than being
  misread as local time.
- Deleting a task asks for confirmation via a plain `window.confirm` — simplest thing that clearly
  works, given the UI isn't being judged on polish.

## What I'd improve with more time

- Drag-and-drop for moving tasks (kept as the one stretch goal I didn't do — text search ended up
  implemented too, alongside the column-count stretch goal, since both were small once the query
  layer existed).
- Optimistic UI updates instead of refetching the whole board after every mutation — currently
  simple and correct, but a bit chattier than necessary.
- Board/column management (rename a column, add a new one, reorder columns).
- A few more edge-case tests (e.g. deleting a task that doesn't exist, updating with only a
  partial payload).

## Deploying

The backend is a plain Express app and the frontend is a static Vite build, so they deploy to
separate hosts. Below is a free-tier path using Render (backend) + Vercel (frontend) — any similar
hosts (Railway, Fly.io, Netlify, etc.) work the same way.

### Backend → Render

1. Push this repo to GitHub, then in Render: **New → Web Service**, point it at the repo, set
   **Root Directory** to `backend`.
2. Build command: `npm install`. Start command: `npm start`.
3. SQLite writes to a file, and Render's default filesystem is **ephemeral** (wiped on every
   deploy/restart) — so add a **persistent disk**: Render dashboard → your service → *Disks* → add
   a disk mounted at `/data`.
4. Set an environment variable `DB_PATH=/data/taskflow.db` (the server and seed script both read
   this — see `server.js` / `seed.js`) so the database lives on that persistent disk instead of the
   ephemeral one.
5. After the first deploy, open the Render **Shell** for the service and run `npm run seed` once to
   populate the demo board.
6. Render assigns a public URL like `https://taskflow-api-xxxx.onrender.com` — that's your API base
   (the app already listens on `process.env.PORT`, which Render sets automatically).

### Frontend → Vercel

1. In Vercel: **New Project**, point it at the repo, set **Root Directory** to `frontend`.
2. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist` (Vercel usually
   detects these automatically).
3. Add an environment variable `VITE_API_URL` set to your Render URL **plus `/api`**, e.g.
   `https://taskflow-api-xxxx.onrender.com/api` (see `frontend/.env.example`).
4. Deploy. Vercel gives you a public URL for the UI.

### Notes

- CORS is wide open (`cors()` with no options) in `server.js`, which is fine for this assignment
  but is the first thing to lock down (to the deployed frontend's origin) in a real product.
- Render's free tier spins down after inactivity, so the first request after idling can take
  10–20 seconds to wake back up — that's expected, not a bug.

## Time spent

Roughly 3–4 hours end to end: schema and backend first, then the API, then the React UI, then
tests and this write-up.

## Something I looked into while building this

I hadn't used `better-sqlite3` before (only `sqlite3`'s callback-based API in the past). It's fully
synchronous, which felt wrong at first for a server, but for SQLite specifically it's actually a
good fit — the driver is doing the I/O in native code, there's no event-loop-blocking network
round trip like there would be with Postgres, and skipping async/await everywhere made the query
layer noticeably easier to read and test (no need to spin up a running server just to assert on a
query's SQL).
