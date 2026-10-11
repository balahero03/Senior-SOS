// frontend/src/features/networking/pages/NetworkPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../../components/layout/Navbar';
import PageHeading from '../../../components/ui/PageHeading';
import {
  getConnections,
  getIncomingRequests,
  getOutgoingRequests,
  respondToRequest,
  cancelRequest,
  removeConnection,
} from '../api';

export default function NetworkPage() {
  const [activeTab, setActiveTab] = useState('connections'); // 'connections' | 'incoming' | 'outgoing'
  const [connections, setConnections] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Fetch all network data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [connList, incList, outList] = await Promise.all([
        getConnections().catch(() => []),
        getIncomingRequests().catch(() => []),
        getOutgoingRequests().catch(() => []),
      ]);
      setConnections(connList || []);
      setIncomingRequests(incList || []);
      setOutgoingRequests(outList || []);
    } catch (err) {
      console.error('Failed to load network data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Respond (ACCEPT / REJECT)
  const handleRespond = async (requestId, action) => {
    setActionLoadingId(requestId);
    try {
      await respondToRequest(requestId, action);
      // Optimistic update: remove from incoming
      setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
      // If ACCEPT, refresh connections
      if (action === 'ACCEPT') {
        const updatedConnections = await getConnections().catch(() => []);
        setConnections(updatedConnections || []);
      }
    } catch (err) {
      console.error(`Failed to ${action} request:`, err);
      alert(err.response?.data?.error?.message || `Failed to ${action} request`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Cancel Outgoing Request
  const handleCancel = async (requestId) => {
    setActionLoadingId(requestId);
    try {
      await cancelRequest(requestId);
      setOutgoingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error('Failed to cancel request:', err);
      alert(err.response?.data?.error?.message || 'Failed to cancel request');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Remove Connection
  const handleRemove = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this connection?')) return;
    setActionLoadingId(userId);
    try {
      await removeConnection(userId);
      setConnections((prev) => prev.filter((c) => c.user?.id !== userId));
    } catch (err) {
      console.error('Failed to remove connection:', err);
      alert(err.response?.data?.error?.message || 'Failed to remove connection');
    } finally {
      setActionLoadingId(null);
    }
  };

  const incomingCount = incomingRequests.length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeading
          eyebrow="Network & connections"
          title="Campus Connections Hub"
          description="Manage your network, review incoming connection invitations, and stay in touch."
        />

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mb-8 gap-2 sm:gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('connections')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'connections'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>My Connections</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
              {connections.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('incoming')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'incoming'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Incoming Invitations</span>
            {incomingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-blue-600 text-white font-bold animate-pulse">
                {incomingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('outgoing')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'outgoing'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Sent Requests</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
              {outgoingRequests.length}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Loading network...</p>
          </div>
        ) : (
          <>
            {/* 1. MY CONNECTIONS TAB */}
            {activeTab === 'connections' && (
              <div>
                {connections.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                    <span className="text-4xl block">🤝</span>
                    <h3 className="text-base font-bold text-slate-800">No connections yet</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Explore the directory to connect with alumni mentors and fellow students.
                    </p>
                    <Link
                      to="/discover"
                      className="inline-block mt-2 px-5 py-2.5 bg-blue-600 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors"
                    >
                      Discover Members →
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {connections.map((c) => {
                      const user = c.user;
                      const isAlumni = user?.role === 'ALUMNI';
                      const initials = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

                      return (
                        <div
                          key={c.connectionId}
                          className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-blue-500/20">
                                {initials}
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
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
                                {user?.role}
                              </span>
                            </div>

                            <Link
                              to={`/profile/${user?.id}`}
                              className="block font-bold text-slate-900 text-lg hover:text-blue-600 transition-colors leading-snug"
                            >
                              {user?.name}
                            </Link>

                            <p className="text-xs font-medium text-slate-500 mt-1">
                              {isAlumni
                                ? user?.designation && user?.company
                                  ? `${user.designation} at ${user.company}`
                                  : user?.company || 'Alumnus'
                                : user?.departmentName || user?.department || 'Student'}
                            </p>

                            {user?.graduationYear && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Class of {user.graduationYear}
                              </p>
                            )}

                            {user?.bio && (
                              <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                                {user.bio}
                              </p>
                            )}
                          </div>

                          <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between gap-2">
                            <Link
                              to="/messages"
                              className="flex-1 text-center py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl transition-colors"
                            >
                              💬 Message
                            </Link>
                            <button
                              onClick={() => handleRemove(user?.id)}
                              disabled={actionLoadingId === user?.id}
                              className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                              title="Remove connection"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 2. INCOMING REQUESTS TAB */}
            {activeTab === 'incoming' && (
              <div>
                {incomingRequests.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                    <span className="text-4xl block">📬</span>
                    <h3 className="text-base font-bold text-slate-800">No incoming invitations</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      When other students or alumni send you connection requests, they will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {incomingRequests.map((req) => {
                      const sender = req.sender;
                      const isAlumni = sender?.role === 'ALUMNI';
                      const initials = sender?.name ? sender.name.charAt(0).toUpperCase() : 'U';
                      const isLoadingThis = actionLoadingId === req.id;

                      return (
                        <div
                          key={req.id}
                          className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-blue-500/20">
                                {initials}
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
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
                                {sender?.role}
                              </span>
                            </div>

                            <Link
                              to={`/profile/${sender?.id}`}
                              className="block font-bold text-slate-900 text-lg hover:text-blue-600 transition-colors leading-snug"
                            >
                              {sender?.name}
                            </Link>

                            <p className="text-xs font-medium text-slate-500 mt-1">
                              {isAlumni
                                ? sender?.designation && sender?.company
                                  ? `${sender.designation} at ${sender.company}`
                                  : sender?.company || 'Alumnus'
                                : sender?.departmentName || sender?.department || 'Student'}
                            </p>

                            {sender?.bio && (
                              <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                                {sender.bio}
                              </p>
                            )}
                          </div>

                          <div className="pt-5 mt-5 border-t border-slate-100 flex items-center gap-2">
                            <button
                              onClick={() => handleRespond(req.id, 'ACCEPT')}
                              disabled={isLoadingThis}
                              className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
                            >
                              {isLoadingThis ? '...' : 'Accept'}
                            </button>
                            <button
                              onClick={() => handleRespond(req.id, 'REJECT')}
                              disabled={isLoadingThis}
                              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors disabled:opacity-50"
                            >
                              Ignore
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. SENT REQUESTS TAB */}
            {activeTab === 'outgoing' && (
              <div>
                {outgoingRequests.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                    <span className="text-4xl block">📤</span>
                    <h3 className="text-base font-bold text-slate-800">No sent requests pending</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      All connection requests you have sent have been answered.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {outgoingRequests.map((req) => {
                      const receiver = req.receiver;
                      const isAlumni = receiver?.role === 'ALUMNI';
                      const initials = receiver?.name ? receiver.name.charAt(0).toUpperCase() : 'U';
                      const isLoadingThis = actionLoadingId === req.id;

                      return (
                        <div
                          key={req.id}
                          className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-blue-500/20">
                                {initials}
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                Pending
                              </span>
                            </div>

                            <Link
                              to={`/profile/${receiver?.id}`}
                              className="block font-bold text-slate-900 text-lg hover:text-blue-600 transition-colors leading-snug"
                            >
                              {receiver?.name}
                            </Link>

                            <p className="text-xs font-medium text-slate-500 mt-1">
                              {isAlumni
                                ? receiver?.company || 'Alumnus'
                                : receiver?.departmentName || receiver?.department || 'Student'}
                            </p>
                          </div>

                          <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-end">
                            <button
                              onClick={() => handleCancel(req.id)}
                              disabled={isLoadingThis}
                              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                            >
                              {isLoadingThis ? 'Cancelling...' : 'Cancel Request'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
