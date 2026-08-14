import { useState } from 'react';
import TaskForm from './TaskForm';

export default function TaskCard({ task, allColumns, onUpdate, onDelete, onMove }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="task-card task-card-editing">
        <TaskForm
          initial={task}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={(updates) => {
            onUpdate(updates);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="task-card">
      <div className="task-card-top">
        <h3>{task.title}</h3>
        <span className={`priority-badge priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
      </div>

      {task.description && <p className="task-desc">{task.description}</p>}

      <p className="task-date">{new Date(task.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()}</p>

      <div className="task-actions">
        <select
          className="move-select"
          value={task.column_id}
          onChange={(e) => onMove(Number(e.target.value))}
          aria-label="Move task to column"
        >
          {allColumns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={() => {
            if (window.confirm('Delete this task?')) onDelete();
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
