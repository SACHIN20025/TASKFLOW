const test = require('node:test');
const assert = require('node:assert/strict');
const { createDb } = require('../src/db');
const buildQueries = require('../src/queries');
const { seedDatabase } = require('../src/seed');

/**
 * Unlike queries.test.js (which uses small ad-hoc fixtures), these tests
 * run against the *real* seed dataset from src/seed.js - the same data a
 * fresh `npm run seed` produces - on an in-memory database. This satisfies
 * "a test that hits the database layer directly ... for known seed data"
 * literally, using the actual seed script rather than a re-implementation
 * of it.
 */
function setupSeededDb() {
  const db = createDb(':memory:');
  const ids = seedDatabase(db);
  return { db, queries: buildQueries(db), ...ids };
}

test('seed data: task counts per column match the seed script', () => {
  const { queries, boardId, todoId, inProgressId, doneId } = setupSeededDb();

  const counts = queries.getTaskCountsPerColumn(boardId);
  const byColumn = Object.fromEntries(counts.map((c) => [c.column_id, c.task_count]));

  // From src/seed.js: 3 tasks in To Do, 2 in In Progress, 2 in Done.
  assert.equal(byColumn[todoId], 3);
  assert.equal(byColumn[inProgressId], 2);
  assert.equal(byColumn[doneId], 2);
});

test('seed data: High priority tasks, newest first, match the seed script', () => {
  const { queries, boardId } = setupSeededDb();

  const highPriority = queries.getTasksByPriority(boardId, 'High');

  // Seed has exactly two High priority tasks: "Design database schema"
  // (inserted 2nd) and "Build task board UI" (inserted 4th) - newest
  // (highest id / most recent) first.
  assert.equal(highPriority.length, 2);
  assert.deepEqual(
    highPriority.map((t) => t.title),
    ['Build task board UI', 'Design database schema']
  );
});

test('seed data: title search finds the right seeded task', () => {
  const { queries, boardId } = setupSeededDb();

  const results = queries.searchTasksByTitle(boardId, 'schema');
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Design database schema');

  // Case-insensitive by default in SQLite's LIKE for ASCII text.
  const caseInsensitive = queries.searchTasksByTitle(boardId, 'SCHEMA');
  assert.equal(caseInsensitive.length, 1);

  const noMatch = queries.searchTasksByTitle(boardId, 'nonexistent task title');
  assert.equal(noMatch.length, 0);
});

test('seed data: full board fetch returns all 7 seeded tasks across 3 columns', () => {
  const { queries, boardId } = setupSeededDb();

  const board = queries.getBoardWithColumnsAndTasks(boardId);
  assert.equal(board.columns.length, 3);

  const totalTasks = board.columns.reduce((sum, c) => sum + c.tasks.length, 0);
  assert.equal(totalTasks, 7);
});
