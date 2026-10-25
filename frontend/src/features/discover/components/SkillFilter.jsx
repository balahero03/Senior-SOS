// frontend/src/features/discover/components/SkillFilter.jsx
// Compact type-ahead for filtering by one skill from the curated list.
import React, { useEffect, useRef, useState } from 'react';
import { getSkills } from '../api';

export default function SkillFilter({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      getSkills(query.trim())
        .then((skills) => { if (!cancelled) setResults(Array.isArray(skills) ? skills : []); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, open]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (value) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-[#0a66c2] rounded-xl pl-2.5 pr-1.5 py-1.5 text-xs font-semibold">
        Skill: {value.name}
        <button
          type="button"
          onClick={() => onChange(null)}
          className="w-4 h-4 rounded-full hover:bg-blue-100 leading-none"
          title="Remove skill filter"
        >
          ✕
        </button>
      </span>
    );
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter') {
            e.preventDefault();
            if (results[0]) { onChange(results[0]); setQuery(''); setOpen(false); }
          }
        }}
        placeholder="Any skill — search…"
        autoComplete="off"
        className="w-44 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
      {open && (
        <ul className="absolute z-20 top-full mt-1 w-56 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(s); setQuery(''); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-50"
              >
                {s.name}
              </button>
            </li>
          ))}
          {loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-400">Searching…</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-400">No matching skill.</li>
          )}
        </ul>
      )}
    </div>
  );
}
