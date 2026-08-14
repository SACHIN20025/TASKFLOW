import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import Column from './components/Column';
import FilterBar from './components/FilterBar';

// The assignment only asks for a single board, so we keep this simple and
// point at board #1 (created by the seed script) rather than building
// board switching, which is out of scope.
const BOARD_ID = 1;

export default function App() {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [filteredByColumn, setFilteredByColumn] = useState(null);

  const loadBoard = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getBoard(BOARD_ID);
      setBoard(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // When the priority filter changes (or the board reloads), fetch the
  // filtered task list from the backend (a real WHERE + ORDER BY query,
  // not just client-side filtering of everything).
  useEffect(() => {
    if (!board) return;
    if (priorityFilter === 'All') {
      setFilteredByColumn(null);
      return;
    }
    let cancelled = false;
    api
      .getTasks(BOARD_ID, priorityFilter)
      .then((tasks) => {
        if (cancelled) return;
        const grouped = {};
        board.columns.forEach((c) => {
          grouped[c.id] = [];
        });
        tasks.forEach((t) => {
          if (grouped[t.column_id]) grouped[t.column_id].push(t);
        });
        setFilteredByColumn(grouped);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [priorityFilter, board]);

  async function runMutation(action) {
    try {
      await action();
      await loadBoard();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <div className="app-status">Loading board…</div>;
  }

  if (!board) {
    return (
      <div className="app-status app-status-error">
        {error || 'No board found.'}
        <p className="hint">
          Did you run <code>npm run seed</code> in the backend?
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>{board.name}</h1>
        <FilterBar value={priorityFilter} onChange={setPriorityFilter} />
      </header>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      <div className="board">
        {board.columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            allColumns={board.columns}
            tasks={filteredByColumn ? filteredByColumn[column.id] : column.tasks}
            onCreate={(task) => runMutation(() => api.createTask(task))}
            onUpdate={(id, updates) => runMutation(() => api.updateTask(id, updates))}
            onDelete={(id) => runMutation(() => api.deleteTask(id))}
            onMove={(id, columnId) => runMutation(() => api.moveTask(id, columnId))}
          />
        ))}
      </div>
    </div>
  );
}
