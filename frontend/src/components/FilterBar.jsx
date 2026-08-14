const PRIORITIES = ['All', 'Low', 'Medium', 'High'];

export default function FilterBar({ value, onChange }) {
  return (
    <div className="filter-bar">
      <span className="filter-label">Filter by priority:</span>
      {PRIORITIES.map((p) => (
        <button
          key={p}
          type="button"
          className={p === value ? 'filter-btn filter-btn-active' : 'filter-btn'}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
