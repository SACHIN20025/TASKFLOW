import { useState } from 'react';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';

export default function Column({ column, allColumns, tasks, onCreate, onUpdate, onDelete, onMove }) {
  const [adding, setAdding] = useState(false);
  const list = tasks || [];

  return (
    <div className="column">
      <div className="column-header">
        <h2>{column.name}</h2>
        <span className="task-count">{list.length}</span>
      </div>

      <div className="task-list">
        {list.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            allColumns={allColumns}
            onUpdate={(updates) => onUpdate(task.id, updates)}
            onDelete={() => onDelete(task.id)}
            onMove={(columnId) => onMove(task.id, columnId)}
          />
        ))}
        {list.length === 0 && <p className="empty-hint">No tasks</p>}
      </div>

      {adding ? (
        <TaskForm
          submitLabel="Add task"
          onCancel={() => setAdding(false)}
          onSubmit={(task) => {
            onCreate({ ...task, columnId: column.id });
            setAdding(false);
          }}
        />
      ) : (
        <button type="button" className="add-task-btn" onClick={() => setAdding(true)}>
          + Add task
        </button>
      )}
    </div>
  );
}
