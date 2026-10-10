// frontend/src/features/profile/components/EditProfileModal.jsx
import React, { useState, useEffect } from 'react';
import { updateProfile, getDepartments, getCompanies, getSkills } from '../api';

const PROFICIENCY_OPTIONS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

export default function EditProfileModal({ profile, isOpen, onClose, onProfileUpdated }) {
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

  // Metadata dropdown options
  const [departments, setDepartments] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !profile) return;

    setName(profile.name || '');
    setBio(profile.academicProfile?.bio || '');
    setDepartmentId(profile.academicProfile?.departmentId || '');
    setGraduationYear(profile.academicProfile?.graduationYear || '');
    setCareerInterests(profile.academicProfile?.careerInterests || '');

    if (isAlumni && profile.alumniProfile) {
      setCompanyName(profile.alumniProfile.companyName || '');
      setDesignation(profile.alumniProfile.designation || '');
      setExperienceYears(profile.alumniProfile.experienceYears || '');
    }

    setSkills(
      profile.skills?.map((s) => ({
        skillId: s.skillId,
        skillName: s.name,
        proficiency: s.proficiency || 'INTERMEDIATE',
      })) || []
    );

    setError(null);

    // Fetch departments
    getDepartments()
      .then((depts) => setDepartments(depts || []))
      .catch((err) => console.error('Failed to load departments', err));

    // Fetch existing skills list for suggestion
    getSkills()
      .then((sList) => setAvailableSkills(sList || []))
      .catch((err) => console.error('Failed to load skills', err));
  }, [isOpen, profile, isAlumni]);

  if (!isOpen) return null;

  const handleAddSkill = () => {
    if (!newSkillName.trim()) return;
    const trimmed = newSkillName.trim();

    // Check duplicate
    if (skills.some((s) => s.skillName.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    const match = availableSkills.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());

    setSkills([
      ...skills,
      {
        skillId: match ? match.id : null,
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
          skillName: s.skillName,
          proficiency: s.proficiency,
        })),
      };

      if (isAlumni) {
        payload.companyName = companyName.trim();
        payload.designation = designation.trim();
        payload.experienceYears = experienceYears ? parseFloat(experienceYears) : undefined;
      }

      await updateProfile(payload);
      onProfileUpdated();
      onClose();
    } catch (err) {
      console.error('Update profile error:', err);
      setError(err.response?.data?.error?.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Edit Profile</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">General Information</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bio / About</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Share your background, passions, and current journey..."
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
              />
            </div>
          </div>

          {/* Academic Info */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Academic Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Graduation Year</label>
                <input
                  type="number"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  placeholder="e.g. 2025"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Career Interests</label>
              <input
                type="text"
                value={careerInterests}
                onChange={(e) => setCareerInterests(e.target.value)}
                placeholder="e.g. Cloud Architecture, Machine Learning, Full-Stack"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          </div>

          {/* Alumni Professional Info */}
          {isAlumni && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Professional Experience</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Google, Microsoft, SSN Solutions"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Years of Experience</label>
                <input
                  type="number"
                  step="0.5"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="e.g. 4.5"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
            </div>
          )}

          {/* Skills Management */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Skills & Proficiencies</h3>
            
            {/* Added Skills Pill List */}
            <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
              {skills.length === 0 ? (
                <span className="text-xs text-slate-400">No skills added yet. Add your key skills below.</span>
              ) : (
                skills.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 shadow-sm"
                  >
                    <span>{s.skillName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold uppercase">
                      {s.proficiency}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(idx)}
                      className="ml-1 text-slate-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Add Skill Row */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                placeholder="Enter skill (e.g. React, PostgreSQL)"
                className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
              <select
                value={newSkillProficiency}
                onChange={(e) => setNewSkillProficiency(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
              >
                {PROFICIENCY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddSkill}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-xl transition-colors shadow-sm"
              >
                + Add Skill
              </button>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
