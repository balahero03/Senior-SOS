// frontend/src/features/profile/pages/ProfilePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../../../stores/authStore';
import Navbar from '../../../components/layout/Navbar';
import { getProfile, sendConnectionRequest } from '../api';
import EditProfileModal from '../components/EditProfileModal';

export default function ProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const isSelf = !userId || userId === currentUser?.id;
  const targetId = isSelf ? currentUser?.id : userId;

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectMessage, setConnectMessage] = useState('');

  const fetchProfileData = useCallback(async () => {
    const idToFetch = targetId || currentUser?.id;
    if (!idToFetch) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProfile(idToFetch);
      setProfile(data.profile);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError(err.response?.data?.error?.message || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [targetId, currentUser?.id]);

  useEffect(() => {
    if (targetId || currentUser?.id) {
      fetchProfileData();
    }
  }, [targetId, currentUser?.id, fetchProfileData]);

  const handleConnect = async () => {
    if (!profile || isConnecting) return;
    setIsConnecting(true);
    setConnectMessage('');
    try {
      await sendConnectionRequest(profile.id);
      setProfile((prev) => ({
        ...prev,
        connectionStatus: 'PENDING_SENT',
      }));
      setConnectMessage('Connection request sent!');
    } catch (err) {
      console.error('Failed to send connection request:', err);
      setConnectMessage(err.response?.data?.error?.message || 'Failed to send request');
    } finally {
      setIsConnecting(false);
    }
  };

  const displayName = profile?.name || currentUser?.name || 'Member Profile';
  const initials = displayName.trim().charAt(0).toUpperCase() || 'U';
  const isAlumni = (profile?.role || currentUser?.role) === 'ALUMNI';

  // Professional / Academic Headline
  const headline = isAlumni
    ? profile?.alumniProfile?.designation && profile?.alumniProfile?.companyName
      ? `${profile.alumniProfile.designation} at ${profile.alumniProfile.companyName}`
      : profile?.alumniProfile?.companyName
      ? `Works at ${profile.alumniProfile.companyName}`
      : 'SSN Alumnus • Industry Professional'
    : profile?.academicProfile?.departmentName
    ? `${profile.academicProfile.departmentName} Student • Class of ${profile.academicProfile.graduationYear || '2026'}`
    : 'Student at SSN College of Engineering';


  return (
    <div className="min-h-screen bg-[#f4f2ee] flex flex-col font-sans text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-28 space-y-4">
            <div className="w-9 h-9 border-3 border-[#0a66c2] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-500">Loading profile…</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center feed-card space-y-3">
            <p className="text-red-600 font-bold text-sm">{error}</p>
            <button
              onClick={() => navigate('/discover')}
              className="btn-linkedin-primary text-xs"
            >
              Back to Discover
            </button>
          </div>
        ) : profile ? (
          <div className="space-y-4">
            {/* ══════════ LinkedIn Profile Banner & Identity Card ══════════ */}
            <div className="feed-card overflow-hidden">
              {/* Cover Banner */}
              <div className="h-40 sm:h-48 bg-gradient-to-r from-[#0a66c2] via-[#004182] to-[#1e293b] relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
              </div>

              {/* Avatar Overlap + Top Right Actions */}
              <div className="relative px-6 bg-white">
                {/* Large Avatar sitting cleanly 50% on banner, 50% on white */}
                <div className="absolute -top-16 sm:-top-20 left-6 z-20">
                  <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full border-4 border-white bg-gradient-to-tr from-[#0a66c2] to-[#004182] text-white flex items-center justify-center font-black text-4xl sm:text-5xl shadow-md ring-1 ring-slate-200">
                    {initials}
                  </div>
                </div>

                {/* Top Action Buttons (Edit Profile / Connect) */}
                <div className="flex items-center justify-end min-h-[56px] pt-3.5 pb-2">
                  {isSelf ? (
                    <button
                      onClick={() => setIsEditOpen(true)}
                      className="btn-linkedin-primary text-xs py-2 px-5 flex items-center gap-1.5 shadow-xs"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span>Edit Profile</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {profile.connectionStatus === 'CONNECTED' && (
                        <button
                          onClick={() => navigate('/messages')}
                          className="btn-linkedin-primary text-xs py-2 px-5 flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span>Message</span>
                        </button>
                      )}

                      {profile.connectionStatus === 'PENDING_SENT' && (
                        <span className="px-4 py-2 bg-slate-100 text-slate-600 font-bold text-xs rounded-full border border-slate-200">
                          Pending Request
                        </span>
                      )}

                      {profile.connectionStatus === 'PENDING_RECEIVED' && (
                        <button
                          onClick={() => navigate('/network')}
                          className="btn-linkedin-primary text-xs py-2 px-5"
                        >
                          Respond to Request
                        </button>
                      )}

                      {profile.connectionStatus === 'NONE' && (
                        <button
                          onClick={handleConnect}
                          disabled={isConnecting}
                          className="btn-linkedin-primary text-xs py-2 px-5 disabled:opacity-50"
                        >
                          {isConnecting ? 'Connecting…' : '+ Connect'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Profile Identity Text */}
                <div className="pt-5 pb-6">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                      {displayName}
                    </h1>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold ${
                        isAlumni
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isAlumni ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      {profile.role}
                    </span>

                    {isAlumni && profile.alumniProfile?.verificationStatus && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          profile.alumniProfile.verificationStatus === 'APPROVED'
                            ? 'bg-blue-50 text-[#0a66c2] border border-blue-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {profile.alumniProfile.verificationStatus === 'APPROVED' ? '✓ Verified Alumni' : 'Pending Verification'}
                      </span>
                    )}
                  </div>

                  {/* Headline */}
                  <p className="text-sm font-semibold text-slate-700 mt-1.5 leading-snug">
                    {headline}
                  </p>

                  {/* College & Location */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-2 font-medium">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      SSN College of Engineering
                    </span>
                    <span>•</span>
                    <span>Chennai, Tamil Nadu, India</span>
                    <span>•</span>
                    <Link to="/network" className="text-[#0a66c2] font-bold hover:underline">
                      Contact info
                    </Link>
                  </div>

                  {connectMessage && (
                    <div className="mt-3 p-2.5 rounded-xl bg-blue-50 text-[#0a66c2] text-xs font-semibold border border-blue-200 animate-slide-up">
                      {connectMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ══════════ Content Grid (2 Columns) ══════════ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              
              {/* Left Column (About, Skills, Career Interests) */}
              <div className="md:col-span-2 space-y-4">
                
                {/* About Card */}
                <div className="feed-card p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">About</h2>
                    {isSelf && (
                      <button
                        onClick={() => setIsEditOpen(true)}
                        className="text-xs text-[#0a66c2] font-bold hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {profile.academicProfile?.bio ||
                      profile.bio ||
                      'Passionate about engineering, technology, and building high-impact software.'}
                  </p>
                </div>

                {/* Skills & Endorsements Card */}
                <div className="feed-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">Skills & Endorsements</h2>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 font-bold">
                        {profile.skills?.length || 0} skills
                      </span>
                      {isSelf && (
                        <button
                          onClick={() => setIsEditOpen(true)}
                          className="text-xs text-[#0a66c2] font-bold hover:underline"
                        >
                          + Add / Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {profile.skills && profile.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {profile.skills.map((skill, idx) => (
                        <div
                          key={idx}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs shadow-2xs hover:border-[#0a66c2]/40 transition-colors"
                        >
                          <span className="font-bold text-slate-800">{skill.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-[#0a66c2] uppercase">
                            {skill.proficiency || 'SKILL'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-500">No skills added yet.</p>
                      {isSelf && (
                        <button
                          onClick={() => setIsEditOpen(true)}
                          className="mt-2 text-xs font-bold text-[#0a66c2] hover:underline"
                        >
                          Click here to add your skills
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Career Interests Card */}
                {profile.academicProfile?.careerInterests && (
                  <div className="feed-card p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold text-slate-900">Career Interests</h2>
                      {isSelf && (
                        <button
                          onClick={() => setIsEditOpen(true)}
                          className="text-xs text-[#0a66c2] font-bold hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {profile.academicProfile.careerInterests}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Academic & Background Card */}
              <div className="space-y-4">
                <div className="feed-card p-5 space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                      {isAlumni ? 'Career & Background' : 'Academic Profile'}
                    </h3>
                    {isSelf && (
                      <button
                        onClick={() => setIsEditOpen(true)}
                        className="text-xs text-[#0a66c2] font-bold hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  <div className="space-y-3.5 divide-y divide-slate-100">
                    {/* Department */}
                    <div className="pt-2 first:pt-0">
                      <span className="text-slate-400 block font-bold text-[11px] uppercase tracking-wide">
                        Department
                      </span>
                      <span className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5 block">
                        {profile.academicProfile?.departmentName || profile.academicProfile?.departmentCode || 'Not specified'}
                      </span>
                    </div>

                    {/* Graduation Year */}
                    <div className="pt-3">
                      <span className="text-slate-400 block font-bold text-[11px] uppercase tracking-wide">
                        Graduation Batch
                      </span>
                      <span className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5 block">
                        Class of {profile.academicProfile?.graduationYear || '2026'}
                      </span>
                    </div>

                    {/* Alumni Specific Fields */}
                    {isAlumni && (
                      <>
                        {profile.alumniProfile?.companyName && (
                          <div className="pt-3">
                            <span className="text-slate-400 block font-bold text-[11px] uppercase tracking-wide">
                              Current Company
                            </span>
                            <span className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5 block">
                              {profile.alumniProfile.companyName}
                            </span>
                          </div>
                        )}

                        {profile.alumniProfile?.designation && (
                          <div className="pt-3">
                            <span className="text-slate-400 block font-bold text-[11px] uppercase tracking-wide">
                              Job Title / Role
                            </span>
                            <span className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5 block">
                              {profile.alumniProfile.designation}
                            </span>
                          </div>
                        )}

                        {profile.alumniProfile?.experienceYears !== null &&
                          profile.alumniProfile?.experienceYears !== undefined && (
                            <div className="pt-3">
                              <span className="text-slate-400 block font-bold text-[11px] uppercase tracking-wide">
                                Industry Experience
                              </span>
                              <span className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5 block">
                                {profile.alumniProfile.experienceYears} Years
                              </span>
                            </div>
                          )}

                        {profile.alumniProfile?.verificationStatus && (
                          <div className="pt-3">
                            <span className="text-slate-400 block font-bold text-[11px] uppercase tracking-wide">
                              Alumni Status
                            </span>
                            <span
                              className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1 ${
                                profile.alumniProfile.verificationStatus === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {profile.alumniProfile.verificationStatus}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : null}
      </main>

      {/* Edit Profile Modal */}
      {isSelf && (
        <EditProfileModal
          profile={profile}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onProfileUpdated={fetchProfileData}
        />
      )}
    </div>
  );
}
