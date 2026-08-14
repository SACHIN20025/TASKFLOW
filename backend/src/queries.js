const VALID_PRIORITIES = ['Low', 'Medium', 'High'];

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Builds the data-access layer for a given better-sqlite3 database instance.
 * Passing the db in (rather than importing a singleton) keeps this testable
 * against an in-memory database.
 */
module.exports = function buildQueries(db) {
  // ---- prepared statements -------------------------------------------------
  const stmtGetBoard = db.prepare('SELECT * FROM boards WHERE id = ?');
  const stmtGetColumnsForBoard = db.prepare(
    'SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC, id ASC'
  );
  const stmtGetColumn = db.prepare('SELECT * FROM columns WHERE id = ?');
  const stmtGetTasksForColumn = db.prepare(
    'SELECT * FROM tasks WHERE column_id = ? ORDER BY created_at ASC, id ASC'
  );
  const stmtGetTask = db.prepare('SELECT * FROM tasks WHERE id = ?');
  const stmtInsertTask = db.prepare(
    'INSERT INTO tasks (column_id, title, description, priority) VALUES (?, ?, ?, ?)'
  );
  const stmtUpdateTask = db.prepare(
    'UPDATE tasks SET title = ?, description = ?, priority = ? WHERE id = ?'
  );
  const stmtMoveTask = db.prepare('UPDATE tasks SET column_id = ? WHERE id = ?');
  const stmtDeleteTask = db.prepare('DELETE FROM tasks WHERE id = ?');

  // Query 1 (non-trivial): count of tasks per column on a board.
  const stmtCountsPerColumn = db.prepare(`
    SELECT columns.id AS column_id, columns.name AS column_name, COUNT(tasks.id) AS task_count
    FROM columns
    LEFT JOIN tasks ON tasks.column_id = columns.id
    WHERE columns.board_id = ?
    GROUP BY columns.id
    ORDER BY columns.position ASC, columns.id ASC
  `);

  // Query 2 (non-trivial): tasks with a given priority on a board, newest first.
  const stmtTasksByPriority = db.prepare(`
    SELECT tasks.*
    FROM tasks
    JOIN columns ON columns.id = tasks.column_id
    WHERE columns.board_id = ? AND tasks.priority = ?
    ORDER BY tasks.created_at DESC, tasks.id DESC
  `);

  const stmtAllTasksForBoard = db.prepare(`
    SELECT tasks.*
    FROM tasks
    JOIN columns ON columns.id = tasks.column_id
    WHERE columns.board_id = ?
    ORDER BY tasks.created_at DESC, tasks.id DESC
  `);

  // ---- helpers --------------------------------------------------------------
  function normalizePriority(priority) {
    if (priority == null || priority === '') return 'Medium';
    if (!VALID_PRIORITIES.includes(priority)) {
      throw httpError(400, `Priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }
    return priority;
  }

  function requireTitle(title) {
    if (typeof title !== 'string' || !title.trim()) {
      throw httpError(400, 'Title is required');
    }
    return title.trim();
  }

  function getColumnOrThrow(columnId) {
    const column = stmtGetColumn.get(columnId);
    if (!column) throw httpError(400, `Column ${columnId} does not exist`);
    return column;
  }

  // ---- public API -------------------------------------------------------------
  function getBoardWithColumnsAndTasks(boardId) {
    const board = stmtGetBoard.get(boardId);
    if (!board) throw httpError(404, `Board ${boardId} not found`);

    const columns = stmtGetColumnsForBoard.all(boardId).map((column) => ({
      ...column,
      tasks: stmtGetTasksForColumn.all(column.id),
    }));

    return { ...board, columns };
  }

  function getTaskById(id) {
    const task = stmtGetTask.get(id);
    if (!task) throw httpError(404, `Task ${id} not found`);
    return task;
  }

  function createTask({ columnId, title, description, priority }) {
    getColumnOrThrow(columnId);
    const cleanTitle = requireTitle(title);
    const cleanPriority = normalizePriority(priority);
    const cleanDescription = description && description.trim() ? description.trim() : null;

    const info = stmtInsertTask.run(columnId, cleanTitle, cleanDescription, cleanPriority);
    return getTaskById(info.lastInsertRowid);
  }

  function updateTask(id, { title, description, priority }) {
    const existing = getTaskById(id);
    const cleanTitle = requireTitle(title ?? existing.title);
    const cleanPriority = normalizePriority(priority ?? existing.priority);
    const cleanDescription =
      description === undefined
        ? existing.description
        : description && description.trim()
        ? description.trim()
        : null;

    stmtUpdateTask.run(cleanTitle, cleanDescription, cleanPriority, id);
    return getTaskById(id);
  }

  function moveTask(id, columnId) {
    getTaskById(id); // 404 if missing
    getColumnOrThrow(columnId); // 400 if target column invalid
    stmtMoveTask.run(columnId, id);
    return getTaskById(id);
  }

  function deleteTask(id) {
    getTaskById(id); // 404 if missing
    stmtDeleteTask.run(id);
    return { deleted: true, id };
  }

  function getTaskCountsPerColumn(boardId) {
    if (!stmtGetBoard.get(boardId)) throw httpError(404, `Board ${boardId} not found`);
    return stmtCountsPerColumn.all(boardId);
  }

  function getTasksByPriority(boardId, priority) {
    if (!VALID_PRIORITIES.includes(priority)) {
      throw httpError(400, `Priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }
    return stmtTasksByPriority.all(boardId, priority);
  }

  function getAllTasksForBoard(boardId) {
    return stmtAllTasksForBoard.all(boardId);
  }

  return {
    getBoardWithColumnsAndTasks,
    getTaskById,
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    getTaskCountsPerColumn,
    getTasksByPriority,
    getAllTasksForBoard,
  };
};
