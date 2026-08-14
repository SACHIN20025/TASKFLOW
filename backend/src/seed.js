const path = require('path');
const { createDb } = require('./db');

/**
 * The demo dataset used both for local development (via `npm run seed`)
 * and for backend tests that want to assert against real, known data
 * rather than a bespoke fixture.
 *
 * Wipes any existing boards/columns/tasks in `db` first, so it's safe to
 * call repeatedly (e.g. once per test, against a fresh in-memory db).
 *
 * Returns the ids that were created, so callers can build assertions
 * without hardcoding row numbers.
 */
function seedDatabase(db) {
  db.exec('DELETE FROM tasks; DELETE FROM columns; DELETE FROM boards;');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('tasks', 'columns', 'boards');");

  const insertBoard = db.prepare('INSERT INTO boards (name) VALUES (?)');
  const insertColumn = db.prepare('INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)');
  const insertTask = db.prepare(
    'INSERT INTO tasks (column_id, title, description, priority) VALUES (?, ?, ?, ?)'
  );

  const boardId = insertBoard.run('TaskFlow Demo Board').lastInsertRowid;

  const todoId = insertColumn.run(boardId, 'To Do', 0).lastInsertRowid;
  const inProgressId = insertColumn.run(boardId, 'In Progress', 1).lastInsertRowid;
  const doneId = insertColumn.run(boardId, 'Done', 2).lastInsertRowid;

  // Kept as an ordered list (rather than a bag of inserts) so tests can
  // reason about exact counts and insertion order without recomputing them.
  const seedTasks = [
    { columnId: todoId, title: 'Set up project repo', description: 'Initialize git, add a README', priority: 'Medium' },
    { columnId: todoId, title: 'Design database schema', description: 'Boards, columns, tasks with FKs', priority: 'High' },
    { columnId: todoId, title: 'Write onboarding doc', description: 'Nice to have for new hires', priority: 'Low' },
    { columnId: inProgressId, title: 'Build task board UI', description: 'Columns + move control', priority: 'High' },
    { columnId: inProgressId, title: 'Wire up backend API', description: 'CRUD + move endpoint', priority: 'Medium' },
    { columnId: doneId, title: 'Project kickoff meeting', description: 'Discussed scope and timeline', priority: 'Low' },
    { columnId: doneId, title: 'Choose tech stack', description: 'React + Node/Express + SQLite', priority: 'Medium' },
  ];

  const taskIds = seedTasks.map((t) =>
    Number(insertTask.run(t.columnId, t.title, t.description, t.priority).lastInsertRowid)
  );

  return {
    boardId: Number(boardId),
    todoId: Number(todoId),
    inProgressId: Number(inProgressId),
    doneId: Number(doneId),
    taskIds,
    seedTasks,
  };
}

module.exports = { seedDatabase };

// Run as a standalone script: `node src/seed.js` (or `npm run seed`).
// Guarded so requiring this module (e.g. from tests) doesn't touch the
// real database file.
if (require.main === module) {
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'taskflow.db');
  const db = createDb(DB_PATH);
  const result = seedDatabase(db);
  console.log(
    `Seeded board #${result.boardId} ("TaskFlow Demo Board") with 3 columns and ${result.seedTasks.length} tasks.`
  );
  db.close();
}
