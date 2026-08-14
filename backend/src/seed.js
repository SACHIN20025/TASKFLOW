const path = require('path');
const { createDb } = require('./db');

const DB_PATH = path.join(__dirname, '..', 'data', 'taskflow.db');
const db = createDb(DB_PATH);

// Wipe existing data so this script can be re-run safely on a non-empty db.
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

const seedTasks = [
  [todoId, 'Set up project repo', 'Initialize git, add a README', 'Medium'],
  [todoId, 'Design database schema', 'Boards, columns, tasks with FKs', 'High'],
  [todoId, 'Write onboarding doc', 'Nice to have for new hires', 'Low'],
  [inProgressId, 'Build task board UI', 'Columns + move control', 'High'],
  [inProgressId, 'Wire up backend API', 'CRUD + move endpoint', 'Medium'],
  [doneId, 'Project kickoff meeting', 'Discussed scope and timeline', 'Low'],
  [doneId, 'Choose tech stack', 'React + Node/Express + SQLite', 'Medium'],
];

for (const [columnId, title, description, priority] of seedTasks) {
  insertTask.run(columnId, title, description, priority);
}

console.log(`Seeded board #${boardId} ("TaskFlow Demo Board") with 3 columns and ${seedTasks.length} tasks.`);

db.close();
