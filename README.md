# TaskFlow

A small full-stack task board (Trello-style): a Board with Columns, each holding Tasks with a
title, optional description, priority, and status (which column they're in).

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
      queries.test.js         # backend tests (node's built-in test runner)
    data/                      # taskflow.db lives here once created (gitignored)
  frontend/
    src/
      api.js               # fetch wrapper for the backend API
      App.jsx               # top-level state (board, filter, error banner)
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
never touches `data/taskflow.db`.

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

## API summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/boards/:id` | Board with nested columns + tasks |
| GET | `/api/boards/:id/tasks?priority=High` | Flat task list, optionally filtered |
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
- **Priority filter hits the backend**, not just `.filter()` on already-fetched data — partly to
  exercise the second required query for real, partly because it's the more honest version of
  "filtering" for a real app with more tasks than fit in memory.
- **`created_at` is stored as SQLite's `datetime('now')` (UTC, second precision).** The frontend
  appends `Z` before parsing so dates display in the browser's local time zone rather than being
  misread as local time.
- Deleting a task asks for confirmation via a plain `window.confirm` — simplest thing that clearly
  works, given the UI isn't being judged on polish.

## What I'd improve with more time

- Drag-and-drop for moving tasks (kept as the one stretch goal I didn't do).
- Text search by title (the other listed nice-to-have).
- Optimistic UI updates instead of refetching the whole board after every mutation — currently
  simple and correct, but a bit chattier than necessary.
- Board/column management (rename a column, add a new one, reorder columns).
- A few more edge-case tests (e.g. deleting a task that doesn't exist, updating with only a
  partial payload).

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
