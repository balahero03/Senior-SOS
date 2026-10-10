// frontend/src/features/referrals/components/RequestReferralModal.jsx
import React, { useState, useEffect } from 'react';
import { requestReferral, getVerifiedAlumni } from '../api';

export default function RequestReferralModal({ isOpen, onClose, onReferralCreated }) {
  const [alumniList, setAlumniList] = useState([]);
  const [alumniId, setAlumniId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    getVerifiedAlumni()
      .then((users) => setAlumniList(users || []))
      .catch((err) => console.error('Failed to load verified alumni', err));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectAlumni = (id) => {
    setAlumniId(id);
    const selected = alumniList.find((a) => a.id === id);
    if (selected && selected.company) {
      setCompanyName(selected.company);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!alumniId) {
      setError('Please select an alumni member');
      return;
    }
    if (!jobTitle.trim()) {
      setError('Job title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await requestReferral({
        alumniId,
        jobTitle: jobTitle.trim(),
        companyName: companyName.trim() || undefined,
        jobUrl: jobUrl.trim() || undefined,
        resumeUrl: resumeUrl.trim() || undefined,
        reason: reason.trim() || undefined,
        message: message.trim() || undefined,
      });

      if (onReferralCreated) onReferralCreated();
      onClose();
    } catch (err) {
      console.error('Failed to request referral:', err);
      setError(err.response?.data?.error?.message || 'Failed to request referral');
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
            <h2 className="text-xl font-bold text-slate-900">Request Job Referral</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ask verified alumni to refer you for open opportunities
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-200">
              {error}
            </div>
          )}

          {/* Select Alumnus */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Verified Alumnus
            </label>
            <select
              value={alumniId}
              onChange={(e) => handleSelectAlumni(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
            >
              <option value="">Select an alumnus...</option>
              {alumniList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} - {a.company ? `${a.company}` : 'Alumnus'}{' '}
                  {a.designation ? `(${a.designation})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Job Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              required
              placeholder="e.g. Associate Software Engineer, Frontend Intern"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Target Company */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Company</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Google, SSN Systems"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Job URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Job Opening URL</label>
            <input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://careers.company.com/job/1234"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Resume URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Resume Link (Drive/Portfolio)</label>
            <input
              type="url"
              value={resumeUrl}
              onChange={(e) => setResumeUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Reason / Pitch */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Why are you a great fit?
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Summarize your key qualifications, relevant projects, and GPA..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
            />
          </div>

          {/* Note to Alumnus */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Personal Note to Alumnus
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Hi senior! I would really appreciate your referral for this role..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
            />
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
              {isSubmitting ? 'Submitting...' : 'Request Referral'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
