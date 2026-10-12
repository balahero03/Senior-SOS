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
    if (!targetId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProfile(targetId);
      setProfile(data.profile);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError(err.response?.data?.error?.message || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

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

  const displayName = profile?.name || 'Member Profile';
  const initials = displayName.charAt(0).toUpperCase();
  const isAlumni = profile?.role === 'ALUMNI';

  return (
    <div className="min-h-screen bg-[#f4f2ee] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-8 h-8 border-3 border-[#0a66c2] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Loading profile...</p>
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
            {/* LinkedIn Profile Hero Card */}
            <div className="feed-card overflow-hidden">
              {/* Header Cover Banner */}
              <div className="h-36 sm:h-44 bg-gradient-to-r from-[#0a66c2] via-[#004182] to-[#0f172a] relative">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
              </div>

              {/* Avatar & Key Profile Info */}
              <div className="px-6 pb-6 pt-0">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-16 sm:-mt-20">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white bg-slate-900 text-white flex items-center justify-center font-black text-4xl shadow-md shrink-0">
                    {initials}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {isSelf ? (
                      <button
                        onClick={() => setIsEditOpen(true)}
                        className="btn-linkedin-primary text-xs py-2 px-5"
                      >
                        ✏️ Edit Profile
                      </button>
                    ) : (
                      <>
                        {profile.connectionStatus === 'CONNECTED' && (
                          <button
                            onClick={() => navigate('/messages')}
                            className="btn-linkedin-primary text-xs py-2 px-5"
                          >
                            💬 Send Message
                          </button>
                        )}

                        {profile.connectionStatus === 'PENDING_SENT' && (
                          <span className="px-4 py-2 bg-slate-100 text-slate-500 font-semibold text-xs rounded-full border border-slate-200">
                            ⏳ Request Pending
                          </span>
                        )}

                        {profile.connectionStatus === 'PENDING_RECEIVED' && (
                          <button
                            onClick={() => navigate('/network')}
                            className="btn-linkedin-primary text-xs py-2 px-5"
                          >
                            ✓ Respond to Request
                          </button>
                        )}

                        {profile.connectionStatus === 'NONE' && (
                          <button
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className="btn-linkedin-primary text-xs py-2 px-5 disabled:opacity-50"
                          >
                            {isConnecting ? 'Connecting...' : '+ Connect'}
                          </button>
                        )}

                        {isAlumni && (
                          <Link
                            to="/mentorship"
                            className="btn-linkedin-secondary text-xs py-2 px-4"
                          >
                            🎓 Request Mentorship
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Identity & Headline */}
                <div className="mt-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-black text-slate-900 leading-tight">
                      {displayName}
                    </h1>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isAlumni
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isAlumni ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      {profile.role}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-700 mt-1">
                    {isAlumni
                      ? profile.alumniProfile?.designation && profile.alumniProfile?.companyName
                        ? `${profile.alumniProfile.designation} at ${profile.alumniProfile.companyName}`
                        : profile.alumniProfile?.companyName || 'Alumni Mentor'
                      : profile.academicProfile?.departmentName
                      ? `${profile.academicProfile.departmentName} Student`
                      : 'Student at SSN College of Engineering'}
                  </p>

                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span>Chennai, Tamil Nadu, India</span>
                    <span>•</span>
                    <Link to="/network" className="text-[#0a66c2] font-bold hover:underline">
                      Contact info
                    </Link>
                  </p>
                </div>

                {connectMessage && (
                  <div className="mt-3 p-2.5 rounded-lg bg-blue-50 text-[#0a66c2] text-xs font-semibold border border-blue-200">
                    {connectMessage}
                  </div>
                )}
              </div>
            </div>

            {/* Profile Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Left Column (About, Experience, Skills) */}
              <div className="md:col-span-2 space-y-4">
                
                {/* About Card */}
                <div className="feed-card p-5 space-y-2">
                  <h2 className="text-base font-bold text-slate-900">About</h2>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {profile.academicProfile?.bio ||
                      profile.bio ||
                      'Passionate about engineering, technology, and building high-impact software.'}
                  </p>
                </div>

                {/* Skills Card */}
                <div className="feed-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">Skills & Endorsements</h2>
                    <span className="text-xs text-slate-400 font-semibold">
                      {profile.skills?.length || 0} skills
                    </span>
                  </div>

                  {profile.skills && profile.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs"
                        >
                          <span className="font-bold text-slate-800">{skill.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-[#0a66c2] uppercase">
                            {skill.proficiency}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No skills added yet.</p>
                  )}
                </div>

                {/* Career Interests Card */}
                {profile.academicProfile?.careerInterests && (
                  <div className="feed-card p-5 space-y-2">
                    <h2 className="text-base font-bold text-slate-900">Career Interests</h2>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {profile.academicProfile.careerInterests}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column (Academic / Professional background) */}
              <div className="space-y-4">
                <div className="feed-card p-5 space-y-4 text-xs">
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                    Academic & Background
                  </h3>

                  <div className="space-y-3">
                    {profile.academicProfile?.departmentName && (
                      <div>
                        <span className="text-slate-400 block font-semibold text-[11px]">Department</span>
                        <span className="font-bold text-slate-800 text-xs">
                          {profile.academicProfile.departmentName}
                        </span>
                      </div>
                    )}

                    {profile.academicProfile?.graduationYear && (
                      <div>
                        <span className="text-slate-400 block font-semibold text-[11px]">
                          Graduation Year
                        </span>
                        <span className="font-bold text-slate-800 text-xs">
                          Class of {profile.academicProfile.graduationYear}
                        </span>
                      </div>
                    )}

                    {isAlumni && profile.alumniProfile?.companyName && (
                      <div>
                        <span className="text-slate-400 block font-semibold text-[11px]">Current Company</span>
                        <span className="font-bold text-slate-800 text-xs">
                          {profile.alumniProfile.companyName}
                        </span>
                      </div>
                    )}

                    {isAlumni && profile.alumniProfile?.experienceYears && (
                      <div>
                        <span className="text-slate-400 block font-semibold text-[11px]">Experience</span>
                        <span className="font-bold text-slate-800 text-xs">
                          {profile.alumniProfile.experienceYears} Years
                        </span>
                      </div>
                    )}

                    {isAlumni && profile.alumniProfile?.verificationStatus && (
                      <div>
                        <span className="text-slate-400 block font-semibold text-[11px]">Alumni Status</span>
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                            profile.alumniProfile.verificationStatus === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {profile.alumniProfile.verificationStatus}
                        </span>
                      </div>
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
