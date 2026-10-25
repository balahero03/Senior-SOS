// frontend/src/features/profile/components/EditProfileModal.jsx
import React, { useState, useEffect } from 'react';
import useAuthStore from '../../../stores/authStore';
import { updateProfile, getDepartments } from '../api';
import SkillPicker from './SkillPicker';

const PROFICIENCY_OPTIONS = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
  { value: 'EXPERT', label: 'Expert' },
];

export default function EditProfileModal({ profile, isOpen, onClose, onProfileUpdated }) {
  const setUser = useAuthStore((state) => state.setUser);
  const currentUser = useAuthStore((state) => state.user);

  const isAlumni = profile?.role === 'ALUMNI';

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [careerInterests, setCareerInterests] = useState('');

  // Alumni specific
  const [companyName, setCompanyName] = useState('');
  const [designation, setDesignation] = useState('');
  const [experienceYears, setExperienceYears] = useState('');

  // Skills
  const [skills, setSkills] = useState([]);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillProficiency, setNewSkillProficiency] = useState('INTERMEDIATE');

  // Dropdown data
  const [departments, setDepartments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !profile) return;

    setName(profile.name || '');
    setBio(profile.academicProfile?.bio || profile.bio || '');
    setDepartmentId(profile.academicProfile?.departmentId || profile.academicProfile?.departmentCode || '');
    setGraduationYear(profile.academicProfile?.graduationYear ? String(profile.academicProfile.graduationYear) : '');
    setCareerInterests(profile.academicProfile?.careerInterests || '');

    if (isAlumni && profile.alumniProfile) {
      setCompanyName(profile.alumniProfile.companyName || profile.alumniProfile.company?.name || '');
      setDesignation(profile.alumniProfile.designation || '');
      setExperienceYears(
        profile.alumniProfile.experienceYears !== null && profile.alumniProfile.experienceYears !== undefined
          ? String(profile.alumniProfile.experienceYears)
          : ''
      );
    }

    setSkills(
      profile.skills?.map((s) => ({
        skillId: s.skillId,
        name: s.name,
        skillName: s.name,
        proficiency: s.proficiency || 'INTERMEDIATE',
      })) || []
    );

    setError(null);

    // Fetch department options
    getDepartments()
      .then((depts) => {
        if (Array.isArray(depts)) setDepartments(depts);
      })
      .catch((err) => console.error('Failed to load departments', err));
  }, [isOpen, profile, isAlumni]);

  if (!isOpen) return null;

  const handleAddSkill = (e) => {
    if (e) e.preventDefault();
    const trimmed = newSkillName.trim();
    if (!trimmed) return;

    // Check duplicate
    if (skills.some((s) => (s.name || s.skillName).toLowerCase() === trimmed.toLowerCase())) {
      setNewSkillName('');
      return;
    }

    setSkills([
      ...skills,
      {
        skillId: undefined,
        name: trimmed,
        skillName: trimmed,
        proficiency: newSkillProficiency,
      },
    ]);
    setNewSkillName('');
    setNewSkillProficiency('INTERMEDIATE');
  };

  const handleRemoveSkill = (index) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        bio: bio.trim(),
        departmentId: departmentId || undefined,
        graduationYear: graduationYear ? parseInt(graduationYear, 10) : undefined,
        careerInterests: careerInterests.trim(),
        skills: skills.map((s) => ({
          skillId: s.skillId,
          name: (s.name || s.skillName || '').trim(),
          skillName: (s.name || s.skillName || '').trim(),
          proficiency: s.proficiency,
        })),
      };

      if (isAlumni) {
        payload.companyName = companyName.trim();
        payload.designation = designation.trim();
        payload.experienceYears =
          experienceYears !== '' && !isNaN(parseFloat(experienceYears))
            ? parseFloat(experienceYears)
            : undefined;
      }

      const res = await updateProfile(payload);

      // If user store exists, update display name in session
      if (currentUser && res?.data?.profile) {
        setUser({
          ...currentUser,
          name: res.data.profile.name || name.trim(),
        });
      }

      if (onProfileUpdated) {
        await onProfileUpdated();
      }
      onClose();
    } catch (err) {
      console.error('Update profile error:', err);
      setError(err.response?.data?.error?.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-slide-up">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Edit Profile</h2>
            <p className="text-xs text-slate-500">Update your public presence on SeniorSOS.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-200 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Section: General Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0a66c2]">
              General Details
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Bala Muthukrishnan"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Headline & About</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Tell seniors and peers about your journey, interests, or achievements…"
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] resize-none text-slate-900"
              />
            </div>
          </div>

          {/* Section: Academic Details */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0a66c2]">
              Academic Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] bg-white text-slate-900"
                >
                  <option value="">Select Department…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code ? `${d.code} - ` : ''}{d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Graduation Year</label>
                <input
                  type="number"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  placeholder="e.g. 2026"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Career Interests</label>
              <input
                type="text"
                value={careerInterests}
                onChange={(e) => setCareerInterests(e.target.value)}
                placeholder="e.g. Distributed Systems, Machine Learning, Product Management"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] text-slate-900"
              />
            </div>
          </div>

          {/* Section: Alumni Career Info */}
          {isAlumni && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0a66c2]">
                Professional Career (Alumni)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Current Company</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Google, Amazon, Microsoft"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designation / Role</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Years of Experience</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] text-slate-900"
                />
              </div>
            </div>
          )}

          {/* Section: Skills & Proficiencies */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0a66c2]">
                Skills & Endorsements
              </h3>
              <span className="text-[11px] text-slate-400 font-bold">{skills.length} added</span>
            </div>

            {/* Added Skills Pill Container */}
            <div className="flex flex-wrap gap-2 min-h-[44px] p-3 rounded-xl bg-slate-50 border border-slate-200">
              {skills.length === 0 ? (
                <span className="text-xs text-slate-400">
                  No skills added yet. Search for a skill below and click "+ Add Skill".
                </span>
              ) : (
                skills.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 rounded-full text-xs font-bold text-slate-800 shadow-2xs"
                  >
                    <span>{s.name || s.skillName}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-[#0a66c2] uppercase font-bold">
                      {s.proficiency || 'SKILL'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(idx)}
                      className="ml-1 text-slate-400 hover:text-red-600 font-bold text-xs"
                      title="Remove skill"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Add Skill Row — alumni pick from the curated list; students keep free text for now */}
            {isAlumni ? (
              <SkillPicker
                selectedIds={skills.map((s) => s.skillId)}
                proficiencyOptions={PROFICIENCY_OPTIONS}
                onAdd={(skill) => setSkills((prev) => [...prev, { ...skill, skillName: skill.name }])}
              />
            ) : (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                type="text"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                placeholder="Skill name (e.g. React, Python, System Design)"
                className="flex-1 px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] text-slate-900"
              />
              <select
                value={newSkillProficiency}
                onChange={(e) => setNewSkillProficiency(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#0a66c2] bg-white font-semibold text-slate-700"
              >
                {PROFICIENCY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddSkill}
                className="btn-linkedin-secondary text-xs py-2 px-4 shrink-0 font-bold"
              >
                + Add Skill
              </button>
            </div>
            )}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-200/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-linkedin-primary text-xs py-2 px-6 shadow-xs disabled:opacity-50"
          >
            {isSubmitting ? 'Saving Changes…' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  );
}
