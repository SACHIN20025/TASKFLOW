const test = require('node:test');
const assert = require('node:assert/strict');
const { createDb } = require('../src/db');
const buildQueries = require('../src/queries');

/** Fresh in-memory db + a small fixture board/columns for each test. */
function setupTestDb() {
  const db = createDb(':memory:');

  const boardId = db.prepare('INSERT INTO boards (name) VALUES (?)').run('Test Board')
    .lastInsertRowid;
  const todoId = db
    .prepare('INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)')
    .run(boardId, 'To Do', 0).lastInsertRowid;
  const doneId = db
    .prepare('INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)')
    .run(boardId, 'Done', 1).lastInsertRowid;

  return { db, queries: buildQueries(db), boardId, todoId, doneId };
}

test('creating a task with no title fails', () => {
  const { queries, todoId } = setupTestDb();

  assert.throws(
    () => queries.createTask({ columnId: todoId, title: '   ', description: '', priority: 'Low' }),
    /Title is required/
  );
  assert.throws(
    () => queries.createTask({ columnId: todoId, title: undefined }),
    /Title is required/
  );
});

test('creating a task with a valid title succeeds and defaults priority', () => {
  const { queries, todoId } = setupTestDb();

  const task = queries.createTask({ columnId: todoId, title: 'Write tests' });
  assert.equal(task.title, 'Write tests');
  assert.equal(task.priority, 'Medium');
  assert.equal(task.column_id, todoId);
});

test('moving a task updates its column in the database', () => {
  const { db, queries, todoId, doneId } = setupTestDb();

  const task = queries.createTask({ columnId: todoId, title: 'Ship feature' });
  const moved = queries.moveTask(task.id, doneId);
  assert.equal(moved.column_id, doneId);

  const fromDb = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  assert.equal(fromDb.column_id, doneId);
});

test('moving a task to a nonexistent column is rejected', () => {
  const { queries, todoId } = setupTestDb();
  const task = queries.createTask({ columnId: todoId, title: 'Ship feature' });

  assert.throws(() => queries.moveTask(task.id, 9999), /does not exist/);
});

test('getTasksByPriority queries the database directly and returns newest first', () => {
  const { queries, boardId, todoId } = setupTestDb();

  queries.createTask({ columnId: todoId, title: 'Low prio task', priority: 'Low' });
  const highA = queries.createTask({ columnId: todoId, title: 'High prio A', priority: 'High' });
  const highB = queries.createTask({ columnId: todoId, title: 'High prio B', priority: 'High' });

  const results = queries.getTasksByPriority(boardId, 'High');

  assert.equal(results.length, 2);
  assert.ok(results.every((t) => t.priority === 'High'));
  // Newest first: highB was inserted after highA.
  assert.equal(results[0].id, highB.id);
  assert.equal(results[1].id, highA.id);
});

test('getTaskCountsPerColumn returns the right counts per column (GROUP BY query)', () => {
  const { queries, boardId, todoId, doneId } = setupTestDb();

  queries.createTask({ columnId: todoId, title: 'A' });
  queries.createTask({ columnId: todoId, title: 'B' });
  queries.createTask({ columnId: doneId, title: 'C' });

  const counts = queries.getTaskCountsPerColumn(boardId);
  const todoCount = counts.find((c) => c.column_id === todoId).task_count;
  const doneCount = counts.find((c) => c.column_id === doneId).task_count;

  assert.equal(todoCount, 2);
  assert.equal(doneCount, 1);
});
