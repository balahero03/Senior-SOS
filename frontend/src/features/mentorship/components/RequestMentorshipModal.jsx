// frontend/src/features/mentorship/components/RequestMentorshipModal.jsx
import React, { useState, useEffect } from 'react';
import { requestMentorship, getAlumniList } from '../api';

const FREQUENCIES = [
  { value: 'ONE_TIME', label: 'One-Time Session' },
  { value: 'WEEKLY', label: 'Weekly Check-ins' },
  { value: 'MONTHLY', label: 'Monthly Catch-ups' },
];

export default function RequestMentorshipModal({ isOpen, onClose, initialMentorId, onMentorshipCreated }) {
  const [alumniList, setAlumniList] = useState([]);
  const [mentorId, setMentorId] = useState(initialMentorId || '');
  const [focusArea, setFocusArea] = useState('');
  const [helpDescription, setHelpDescription] = useState('');
  const [goals, setGoals] = useState('');
  const [frequency, setFrequency] = useState('ONE_TIME');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMentors, setIsLoadingMentors] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setAlumniList([]);
    if (initialMentorId) {
      setMentorId(initialMentorId);
    }

    setIsLoadingMentors(true);
    getAlumniList()
      .then((users) => setAlumniList(users || []))
      .catch((err) => {
        console.error('Failed to load verified alumni mentors', err);
        setError('Could not load mentors. Please close this window and try again.');
      })
      .finally(() => setIsLoadingMentors(false));
  }, [isOpen, initialMentorId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mentorId) {
      setError('Please select an alumni mentor');
      return;
    }
    if (!focusArea.trim()) {
      setError('Please enter a focus area');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await requestMentorship({
        mentorId,
        focusArea: focusArea.trim(),
        helpDescription: helpDescription.trim() || undefined,
        goals: goals.trim() || undefined,
        frequency,
      });

      if (onMentorshipCreated) onMentorshipCreated();
      onClose();
    } catch (err) {
      console.error('Request mentorship failed:', err);
      setError(err.response?.data?.error?.message || 'Failed to submit mentorship request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Request Mentorship</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect with an alumnus for guidance and career mentorship
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-200">
              {error}
            </div>
          )}

          {/* Select Mentor */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Alumni Mentor
            </label>
            <select
              value={mentorId}
              onChange={(e) => setMentorId(e.target.value)}
              required
              disabled={isLoadingMentors}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
            >
              <option value="">{isLoadingMentors ? 'Loading verified alumni...' : 'Choose an alumnus...'}</option>
              {alumniList.map((alumnus) => (
                <option key={alumnus.id} value={alumnus.id}>
                  {alumnus.name}
                  {alumnus.designation || alumnus.company
                    ? ` — ${[alumnus.designation, alumnus.company].filter(Boolean).join(' at ')}`
                    : ' — Verified alumnus'}
                </option>
              ))}
            </select>
            {!isLoadingMentors && alumniList.length === 0 && (
              <p className="mt-2 text-xs text-slate-500">
                No verified alumni are available for mentorship yet.
              </p>
            )}
          </div>

          {/* Focus Area */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Focus Area</label>
            <input
              type="text"
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              required
              maxLength={150}
              placeholder="e.g. Software Engineering Career Prep, System Design"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Help Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              What kind of help are you seeking?
            </label>
            <textarea
              value={helpDescription}
              onChange={(e) => setHelpDescription(e.target.value)}
              rows={2}
              placeholder="e.g. Seeking advice on transitioning into backend development and resume critique..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
            />
          </div>

          {/* Goals */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Goals / Expectations
            </label>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={2}
              placeholder="e.g. Preparing for summer 2026 internships and mock interviews..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
            />
          </div>

          {/* Meeting Frequency */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Preferred Meeting Cadence
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Footer buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Sending Request...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
