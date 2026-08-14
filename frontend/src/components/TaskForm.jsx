import { useState } from 'react';

export default function TaskForm({ initial, submitLabel = 'Save', onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [priority, setPriority] = useState(initial?.priority || 'Medium');
  const [titleError, setTitleError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('Title is required');
      return;
    }
    onSubmit({ title: title.trim(), description: description.trim() || null, priority });
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <input
        autoFocus
        type="text"
        placeholder="Task title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (titleError) setTitleError('');
        }}
      />
      {titleError && <p className="field-error">{titleError}</p>}

      <textarea
        placeholder="Description (optional)"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <select value={priority} onChange={(e) => setPriority(e.target.value)}>
        <option value="Low">Low priority</option>
        <option value="Medium">Medium priority</option>
        <option value="High">High priority</option>
      </select>

      <div className="form-actions">
        <button type="submit">{submitLabel}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
