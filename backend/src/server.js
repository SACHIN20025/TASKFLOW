const path = require('path');
const express = require('express');
const cors = require('cors');
const { createDb } = require('./db');
const buildQueries = require('./queries');

const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, '..', 'data', 'taskflow.db');

const db = createDb(DB_PATH);
const queries = buildQueries(db);

const app = express();
app.use(cors());
app.use(express.json());

// Small helper so route handlers can stay flat; better-sqlite3 is synchronous
// so there's no async/await needed, just try/catch -> next(err).
function route(handler) {
  return (req, res, next) => {
    try {
      handler(req, res);
    } catch (err) {
      next(err);
    }
  };
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Full board: columns + tasks nested.
app.get(
  '/api/boards/:id',
  route((req, res) => {
    const board = queries.getBoardWithColumnsAndTasks(Number(req.params.id));
    res.json(board);
  })
);

// Flat list of a board's tasks, optionally filtered by priority.
// Backed by getTasksByPriority (WHERE + ORDER BY) or getAllTasksForBoard.
app.get(
  '/api/boards/:id/tasks',
  route((req, res) => {
    const boardId = Number(req.params.id);
    const { priority } = req.query;
    const tasks = priority
      ? queries.getTasksByPriority(boardId, priority)
      : queries.getAllTasksForBoard(boardId);
    res.json(tasks);
  })
);

// Task count per column (GROUP BY query) - powers the column header counts.
app.get(
  '/api/boards/:id/counts',
  route((req, res) => {
    const counts = queries.getTaskCountsPerColumn(Number(req.params.id));
    res.json(counts);
  })
);

app.post(
  '/api/tasks',
  route((req, res) => {
    const { columnId, title, description, priority } = req.body;
    const task = queries.createTask({ columnId, title, description, priority });
    res.status(201).json(task);
  })
);

app.put(
  '/api/tasks/:id',
  route((req, res) => {
    const { title, description, priority } = req.body;
    const task = queries.updateTask(Number(req.params.id), { title, description, priority });
    res.json(task);
  })
);

app.patch(
  '/api/tasks/:id/move',
  route((req, res) => {
    const { columnId } = req.body;
    const task = queries.moveTask(Number(req.params.id), columnId);
    res.json(task);
  })
);

app.delete(
  '/api/tasks/:id',
  route((req, res) => {
    const result = queries.deleteTask(Number(req.params.id));
    res.json(result);
  })
);

// 404 for unknown routes.
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Centralized error handler - anything thrown with `err.status` becomes that
// status code with a readable message; anything else is a 500.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) {
    console.error(err);
  }
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`TaskFlow backend listening on http://localhost:${PORT}`);
});
