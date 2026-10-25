// frontend/src/features/profile/components/SkillPicker.jsx
// Type-ahead picker over the curated skills list: users can only add skills that exist.
import React, { useEffect, useRef, useState } from 'react';
import { getSkills } from '../api';

export default function SkillPicker({ selectedIds, proficiencyOptions, onAdd }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [proficiency, setProficiency] = useState('INTERMEDIATE');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef(null);

  // Debounced search; ignore stale responses.
  useEffect(() => {
    if (!open || selected) return undefined;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      getSkills(query.trim())
        .then((skills) => {
          if (!cancelled) {
            setResults(Array.isArray(skills) ? skills : []);
            setActiveIndex(0);
          }
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, selected]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const available = results.filter((s) => !selectedIds.includes(s.id));

  const choose = (skill) => {
    setSelected(skill);
    setQuery(skill.name);
    setOpen(false);
  };

  const handleQueryChange = (e) => {
    setQuery(e.target.value);
    setSelected(null);
    setOpen(true);
  };

  const handleAdd = () => {
    if (!selected) return;
    onAdd({ skillId: selected.id, name: selected.name, proficiency });
    setSelected(null);
    setQuery('');
    setResults([]);
    setProficiency('INTERMEDIATE');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, Math.max(available.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selected) handleAdd();
      else if (open && available[activeIndex]) choose(available[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showEmpty = open && !selected && !loading && available.length === 0;

  return (
    <div className="flex flex-col sm:flex-row gap-2 pt-1">
      <div className="relative flex-1" ref={wrapperRef}>
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search skills (e.g. React, Python, System Design)"
          autoComplete="off"
          className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] text-slate-900"
        />
        {open && !selected && (available.length > 0 || showEmpty || loading) && (
          <ul className="absolute z-20 bottom-full mb-1 w-full max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1">
            {available.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(s)}
                  className={`w-full text-left px-3.5 py-1.5 text-xs sm:text-sm text-slate-800 ${
                    i === activeIndex ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  {s.name}
                </button>
              </li>
            ))}
            {loading && available.length === 0 && (
              <li className="px-3.5 py-2 text-xs text-slate-400">Searching…</li>
            )}
            {showEmpty && (
              <li className="px-3.5 py-2 text-xs text-slate-400">
                {query.trim() ? 'No matching skill in the list.' : 'No more skills to add.'}
              </li>
            )}
          </ul>
        )}
      </div>
      <select
        value={proficiency}
        onChange={(e) => setProficiency(e.target.value)}
        className="px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#0a66c2] bg-white font-semibold text-slate-700"
      >
        {proficiencyOptions.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!selected}
        className="btn-linkedin-secondary text-xs py-2 px-4 shrink-0 font-bold disabled:opacity-50"
      >
        + Add Skill
      </button>
    </div>
  );
}
