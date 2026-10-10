// frontend/src/features/profile/pages/ProfilePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Loading profile...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-red-100 shadow-sm">
            <p className="text-red-600 font-semibold mb-2">{error}</p>
            <button
              onClick={() => navigate('/discover')}
              className="px-4 py-2 text-sm bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
            >
              Back to Discover
            </button>
          </div>
        ) : profile ? (
          <div className="space-y-6">
            {/* Profile Header Banner Card */}
            <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 shadow-sm p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-3xl shadow-lg shadow-blue-500/20">
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                          isAlumni
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isAlumni ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        />
                        {profile.role}
                      </span>
                    </div>

                    <p className="text-sm text-slate-500 mt-1">
                      {isAlumni
                        ? profile.alumniProfile?.designation && profile.alumniProfile?.companyName
                          ? `${profile.alumniProfile.designation} at ${profile.alumniProfile.companyName}`
                          : profile.alumniProfile?.companyName || 'Alumnus'
                        : profile.academicProfile?.departmentName || 'Student'}
                    </p>
                  </div>
                </div>

                {/* Profile Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  {isSelf ? (
                    <button
                      onClick={() => setIsEditOpen(true)}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                    >
                      ✏️ Edit Profile
                    </button>
                  ) : (
                    <>
                      {profile.connectionStatus === 'CONNECTED' && (
                        <button
                          onClick={() => navigate('/messages')}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-all"
                        >
                          💬 Send Message
                        </button>
                      )}

                      {profile.connectionStatus === 'PENDING_SENT' && (
                        <span className="px-5 py-2.5 bg-slate-100 text-slate-500 font-semibold text-sm rounded-xl border border-slate-200 text-center">
                          ⏳ Request Sent
                        </span>
                      )}

                      {profile.connectionStatus === 'PENDING_RECEIVED' && (
                        <button
                          onClick={() => navigate('/dashboard')}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-all"
                        >
                          ✓ Respond to Request
                        </button>
                      )}

                      {profile.connectionStatus === 'NONE' && (
                        <button
                          onClick={handleConnect}
                          disabled={isConnecting}
                          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
                        >
                          {isConnecting ? 'Connecting...' : '+ Connect'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {connectMessage && (
                <div className="mt-4 p-2.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                  {connectMessage}
                </div>
              )}
            </div>

            {/* Profile Info Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: About & Academic */}
              <div className="md:col-span-2 space-y-6">
                {/* About section */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                  <h2 className="text-base font-bold text-slate-900">About</h2>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                    {profile.academicProfile?.bio || 'No bio added yet.'}
                  </p>
                </div>

                {/* Skills section */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">Skills & Expertise</h2>
                    <span className="text-xs text-slate-400 font-medium">
                      {profile.skills?.length || 0} skills
                    </span>
                  </div>

                  {profile.skills && profile.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2.5">
                      {profile.skills.map((skill, idx) => (
                        <div
                          key={idx}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2 shadow-2xs hover:bg-slate-100 transition-colors"
                        >
                          <span className="text-xs font-semibold text-slate-800">
                            {skill.name}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 uppercase">
                            {skill.proficiency}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No skills listed yet.</p>
                  )}
                </div>

                {/* Career Interests */}
                {profile.academicProfile?.careerInterests && (
                  <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
                    <h2 className="text-base font-bold text-slate-900">Career Interests</h2>
                    <p className="text-sm text-slate-600">
                      {profile.academicProfile.careerInterests}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Key Details Sidebar */}
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                    Background Details
                  </h3>

                  <div className="space-y-3.5 text-sm">
                    {profile.academicProfile?.departmentName && (
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">Department</span>
                        <span className="font-semibold text-slate-800">
                          {profile.academicProfile.departmentName}
                        </span>
                      </div>
                    )}

                    {profile.academicProfile?.graduationYear && (
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">
                          Graduation Year
                        </span>
                        <span className="font-semibold text-slate-800">
                          Class of {profile.academicProfile.graduationYear}
                        </span>
                      </div>
                    )}

                    {isAlumni && profile.alumniProfile?.companyName && (
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">Company</span>
                        <span className="font-semibold text-slate-800">
                          {profile.alumniProfile.companyName}
                        </span>
                      </div>
                    )}

                    {isAlumni && profile.alumniProfile?.experienceYears && (
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">
                          Experience
                        </span>
                        <span className="font-semibold text-slate-800">
                          {profile.alumniProfile.experienceYears} Years
                        </span>
                      </div>
                    )}

                    {isAlumni && profile.alumniProfile?.verificationStatus && (
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">
                          Verification Status
                        </span>
                        <span
                          className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 ${
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
