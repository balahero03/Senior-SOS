// frontend/src/features/settings/pages/SettingsPage.jsx
import React, { useState, useEffect } from 'react';
import Navbar from '../../../components/layout/Navbar';
import useAuthStore from '../../../stores/authStore';
import {
  getSettings,
  updatePrivacy,
  updateNotificationPreferences,
  changePassword,
} from '../api';

export default function SettingsPage() {
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState('privacy'); // 'privacy' | 'notifications' | 'security'
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Privacy State
  const [profileVisibility, setProfileVisibility] = useState('COLLEGE'); // 'COLLEGE' | 'CONNECTIONS_ONLY'

  // Notification Preferences State
  const [notificationPreferences, setNotificationPreferences] = useState({
    connection_requests: true,
    mentorship_requests: true,
    referral_updates: true,
    messages: true,
    community_activity: false,
  });

  // Security Form State
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [securityErrors, setSecurityErrors] = useState({});

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        const data = await getSettings();
        if (data) {
          if (data.profileVisibility) {
            setProfileVisibility(data.profileVisibility);
          }
          if (data.notificationPreferences) {
            setNotificationPreferences((prev) => ({
              ...prev,
              ...data.notificationPreferences,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Save Privacy
  const handleSavePrivacy = async () => {
    setIsSaving(true);
    try {
      await updatePrivacy(profileVisibility);
      showFeedback('Profile visibility preferences saved.');
    } catch (err) {
      console.error('Privacy update failed:', err);
      showFeedback(err.response?.data?.error?.message || 'Failed to update privacy settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Notification Preference
  const handleTogglePref = (key) => {
    setNotificationPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Save Notification Preferences
  const handleSaveNotifications = async () => {
    setIsSaving(true);
    try {
      await updateNotificationPreferences(notificationPreferences);
      showFeedback('Notification preferences updated successfully.');
    } catch (err) {
      console.error('Notification settings update failed:', err);
      showFeedback(err.response?.data?.error?.message || 'Failed to update notification settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Save Password
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!securityForm.currentPassword) {
      errors.currentPassword = 'Enter your current password';
    }
    if (!securityForm.newPassword) {
      errors.newPassword = 'Enter a new password';
    } else if (securityForm.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters long';
    }
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setSecurityErrors(errors);
      return;
    }

    setSecurityErrors({});
    setIsSaving(true);
    try {
      await changePassword({
        currentPassword: securityForm.currentPassword,
        newPassword: securityForm.newPassword,
      });
      showFeedback('Password changed successfully.');
      setSecurityForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      console.error('Password change failed:', err);
      showFeedback(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update password', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner Feedback */}
        {feedback && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-center justify-between border ${
              feedback.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold underline ml-4 hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Account & Privacy Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your network visibility, notification delivery, and security credentials.
          </p>
        </div>

        {/* Main Card with Sidebar Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col md:flex-row">
          {/* Tabs Sidebar */}
          <div className="w-full md:w-64 bg-slate-50/70 border-b md:border-b-0 md:border-r border-slate-200 p-4 space-y-1">
            <button
              onClick={() => setActiveTab('privacy')}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-3 ${
                activeTab === 'privacy'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Privacy
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-3 ${
                activeTab === 'notifications'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Notification Preferences
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-3 ${
                activeTab === 'security'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Security
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 p-6 sm:p-8">
            {isLoading ? (
              <div className="py-12 text-center text-slate-400">Loading settings...</div>
            ) : (
              <>
                {/* ─── TAB 1: PRIVACY ────────────────────────────────────────── */}
                {activeTab === 'privacy' && (
                  <div>
                    <div className="border-b border-slate-100 pb-4 mb-6">
                      <h2 className="text-lg font-bold text-slate-900">Profile Visibility</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Control who in the SeniorSOS campus network can view your full bio, skills, and academic/career history.
                      </p>
                    </div>

                    <div className="space-y-4 mb-8">
                      {/* Option 1: COLLEGE */}
                      <label
                        className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          profileVisibility === 'COLLEGE'
                            ? 'border-blue-600 bg-blue-50/40 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="profileVisibility"
                          value="COLLEGE"
                          checked={profileVisibility === 'COLLEGE'}
                          onChange={() => setProfileVisibility('COLLEGE')}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-sm">College Community</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                              Recommended
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Visible to all verified students, alumni, and faculty members in your college directory. Helps peers connect with you easily.
                          </p>
                        </div>
                      </label>

                      {/* Option 2: CONNECTIONS_ONLY */}
                      <label
                        className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          profileVisibility === 'CONNECTIONS_ONLY'
                            ? 'border-blue-600 bg-blue-50/40 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="profileVisibility"
                          value="CONNECTIONS_ONLY"
                          checked={profileVisibility === 'CONNECTIONS_ONLY'}
                          onChange={() => setProfileVisibility('CONNECTIONS_ONLY')}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-semibold text-slate-900 text-sm">Connections Only</span>
                          <p className="text-xs text-slate-500 mt-1">
                            Restricts your detailed academic profile and contact reach. Only approved 1-to-1 connections can view your full profile.
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="flex justify-end">
                      <button
                        disabled={isSaving}
                        onClick={handleSavePrivacy}
                        className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        {isSaving ? 'Saving...' : 'Save Privacy Settings'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── TAB 2: NOTIFICATIONS ──────────────────────────────────── */}
                {activeTab === 'notifications' && (
                  <div>
                    <div className="border-b border-slate-100 pb-4 mb-6">
                      <h2 className="text-lg font-bold text-slate-900">Notification Alerts</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Select which real-time campus activities trigger notification bell badges and in-app updates.
                      </p>
                    </div>

                    <div className="space-y-4 mb-8">
                      {/* Connection Requests */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/60 border border-slate-200/80">
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">Connection Requests</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Notify when peers or alumni send or accept connection invitations.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTogglePref('connection_requests')}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            notificationPreferences.connection_requests ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              notificationPreferences.connection_requests ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Mentorship Updates */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/60 border border-slate-200/80">
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">Mentorship Updates</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Notify when mentorship inquiries are requested, accepted, or scheduled.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTogglePref('mentorship_requests')}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            notificationPreferences.mentorship_requests ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              notificationPreferences.mentorship_requests ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Referral Status Alerts */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/60 border border-slate-200/80">
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">Job Referral Alerts</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Notify when your referral request advances (accepted, referred, interview).
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTogglePref('referral_updates')}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            notificationPreferences.referral_updates ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              notificationPreferences.referral_updates ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Messages */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/60 border border-slate-200/80">
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">Direct Messages</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Notify when you receive private 1-on-1 direct messages.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTogglePref('messages')}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            notificationPreferences.messages ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              notificationPreferences.messages ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Community Activity */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/60 border border-slate-200/80">
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">Community Discussions</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Notify when members comment or react to posts you participated in.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTogglePref('community_activity')}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            notificationPreferences.community_activity ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              notificationPreferences.community_activity ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        disabled={isSaving}
                        onClick={handleSaveNotifications}
                        className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        {isSaving ? 'Saving...' : 'Save Notification Preferences'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── TAB 3: SECURITY ───────────────────────────────────────── */}
                {activeTab === 'security' && (
                  <div>
                    <div className="border-b border-slate-100 pb-4 mb-6">
                      <h2 className="text-lg font-bold text-slate-900">Security Credentials</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Change your account password to ensure your account remains secure.
                      </p>
                    </div>

                    <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md mb-8">
                      {/* Current Password */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={securityForm.currentPassword}
                          onChange={(e) =>
                            setSecurityForm({ ...securityForm, currentPassword: e.target.value })
                          }
                          placeholder="Enter your current password"
                          className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                            securityErrors.currentPassword
                              ? 'border-rose-500 focus:border-rose-500'
                              : 'border-slate-200 focus:border-blue-500'
                          }`}
                        />
                        {securityErrors.currentPassword && (
                          <p className="text-xs text-rose-600 mt-1 font-medium">
                            {securityErrors.currentPassword}
                          </p>
                        )}
                      </div>

                      {/* New Password */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={securityForm.newPassword}
                          onChange={(e) =>
                            setSecurityForm({ ...securityForm, newPassword: e.target.value })
                          }
                          placeholder="At least 8 characters"
                          className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                            securityErrors.newPassword
                              ? 'border-rose-500 focus:border-rose-500'
                              : 'border-slate-200 focus:border-blue-500'
                          }`}
                        />
                        {securityErrors.newPassword && (
                          <p className="text-xs text-rose-600 mt-1 font-medium">
                            {securityErrors.newPassword}
                          </p>
                        )}
                      </div>

                      {/* Confirm New Password */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={securityForm.confirmPassword}
                          onChange={(e) =>
                            setSecurityForm({ ...securityForm, confirmPassword: e.target.value })
                          }
                          placeholder="Re-enter your new password"
                          className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                            securityErrors.confirmPassword
                              ? 'border-rose-500 focus:border-rose-500'
                              : 'border-slate-200 focus:border-blue-500'
                          }`}
                        />
                        {securityErrors.confirmPassword && (
                          <p className="text-xs text-rose-600 mt-1 font-medium">
                            {securityErrors.confirmPassword}
                          </p>
                        )}
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="w-full px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                        >
                          {isSaving ? 'Updating Password...' : 'Update Password'}
                        </button>
                      </div>
                    </form>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      <p className="font-semibold text-slate-700 mb-1">Session Security Note</p>
                      <p>
                        Logged in as <span className="font-medium text-slate-800">{user?.email}</span>. Changing your password updates your account authentication key across all campus devices.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
