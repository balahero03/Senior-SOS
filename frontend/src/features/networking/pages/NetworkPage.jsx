// frontend/src/features/networking/pages/NetworkPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../../components/layout/Navbar';
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
      setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
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
    <div className="min-h-screen bg-[#f4f2ee] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#0a66c2] uppercase tracking-wider">
              Manage Your Network
            </span>
            <h1 className="text-2xl font-black text-slate-900 mt-1">Campus Connections</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Grow your relationships with alumni mentors and campus peers.
            </p>
          </div>
          <Link to="/discover" className="btn-linkedin-secondary text-xs self-start sm:self-auto">
            🔍 Find More Alumni
          </Link>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mb-6 gap-2 sm:gap-6 overflow-x-auto bg-white px-4 pt-2 rounded-t-xl border-x">
          <button
            onClick={() => setActiveTab('connections')}
            className={`pb-3 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'connections'
                ? 'text-[#0a66c2] border-b-2 border-[#0a66c2]'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>My Connections</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700">
              {connections.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('incoming')}
            className={`pb-3 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'incoming'
                ? 'text-[#0a66c2] border-b-2 border-[#0a66c2]'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Invitations</span>
            {incomingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-[#0a66c2] text-white font-extrabold animate-pulse">
                {incomingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('outgoing')}
            className={`pb-3 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'outgoing'
                ? 'text-[#0a66c2] border-b-2 border-[#0a66c2]'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Sent Requests</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700">
              {outgoingRequests.length}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 border-3 border-[#0a66c2] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Loading network...</p>
          </div>
        ) : (
          <>
            {/* 1. MY CONNECTIONS TAB */}
            {activeTab === 'connections' && (
              <div>
                {connections.length === 0 ? (
                  <div className="p-12 text-center feed-card space-y-3">
                    <span className="text-4xl block">🤝</span>
                    <h3 className="text-sm font-bold text-slate-800">No connections yet</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Explore the directory to connect with verified alumni and students from your department.
                    </p>
                    <Link to="/discover" className="btn-linkedin-primary text-xs mt-2">
                      Discover Members →
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {connections.map((c) => {
                      const member = c.user;
                      const isAlumni = member?.role === 'ALUMNI';
                      const initials = member?.name ? member.name.charAt(0).toUpperCase() : 'U';

                      return (
                        <div
                          key={c.connectionId}
                          className="feed-card p-5 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="w-12 h-12 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold text-base shadow-xs">
                                {initials}
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isAlumni
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {member?.role}
                              </span>
                            </div>

                            <Link
                              to={`/profile/${member?.id}`}
                              className="block font-bold text-slate-900 text-sm hover:text-[#0a66c2] transition-colors leading-snug"
                            >
                              {member?.name}
                            </Link>

                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              {isAlumni
                                ? member?.designation && member?.company
                                  ? `${member.designation} at ${member.company}`
                                  : member?.company || 'Alumnus'
                                : member?.departmentName || member?.department || 'Student'}
                            </p>

                            {member?.graduationYear && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Class of {member.graduationYear}
                              </p>
                            )}
                          </div>

                          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                            <Link
                              to="/messages"
                              className="btn-linkedin-primary text-xs flex-1 text-center py-1.5"
                            >
                              Message
                            </Link>
                            <button
                              onClick={() => handleRemove(member?.id)}
                              disabled={actionLoadingId === member?.id}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                  <div className="p-12 text-center feed-card space-y-3">
                    <span className="text-4xl block">📬</span>
                    <h3 className="text-sm font-bold text-slate-800">No invitations right now</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      When other students or alumni send you connection requests, they will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {incomingRequests.map((req) => {
                      const sender = req.sender;
                      const isAlumni = sender?.role === 'ALUMNI';
                      const initials = sender?.name ? sender.name.charAt(0).toUpperCase() : 'U';
                      const isLoadingThis = actionLoadingId === req.id;

                      return (
                        <div
                          key={req.id}
                          className="feed-card p-5 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="w-12 h-12 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold text-base shadow-xs">
                                {initials}
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isAlumni
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {sender?.role}
                              </span>
                            </div>

                            <Link
                              to={`/profile/${sender?.id}`}
                              className="block font-bold text-slate-900 text-sm hover:text-[#0a66c2] transition-colors leading-snug"
                            >
                              {sender?.name}
                            </Link>

                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              {isAlumni
                                ? sender?.designation && sender?.company
                                  ? `${sender.designation} at ${sender.company}`
                                  : sender?.company || 'Alumnus'
                                : sender?.departmentName || sender?.department || 'Student'}
                            </p>
                          </div>

                          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-2">
                            <button
                              onClick={() => handleRespond(req.id, 'ACCEPT')}
                              disabled={isLoadingThis}
                              className="btn-linkedin-primary text-xs flex-1 py-1.5"
                            >
                              {isLoadingThis ? '...' : 'Accept'}
                            </button>
                            <button
                              onClick={() => handleRespond(req.id, 'REJECT')}
                              disabled={isLoadingThis}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-full transition-colors"
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
                  <div className="p-12 text-center feed-card space-y-3">
                    <span className="text-4xl block">📤</span>
                    <h3 className="text-sm font-bold text-slate-800">No pending sent requests</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      All connection requests you sent have been responded to.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {outgoingRequests.map((req) => {
                      const receiver = req.receiver;
                      const isAlumni = receiver?.role === 'ALUMNI';
                      const initials = receiver?.name ? receiver.name.charAt(0).toUpperCase() : 'U';
                      const isLoadingThis = actionLoadingId === req.id;

                      return (
                        <div
                          key={req.id}
                          className="feed-card p-5 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="w-12 h-12 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold text-base shadow-xs">
                                {initials}
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Pending
                              </span>
                            </div>

                            <Link
                              to={`/profile/${receiver?.id}`}
                              className="block font-bold text-slate-900 text-sm hover:text-[#0a66c2] transition-colors leading-snug"
                            >
                              {receiver?.name}
                            </Link>

                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              {isAlumni
                                ? receiver?.company || 'Alumnus'
                                : receiver?.departmentName || receiver?.department || 'Student'}
                            </p>
                          </div>

                          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end">
                            <button
                              onClick={() => handleCancel(req.id)}
                              disabled={isLoadingThis}
                              className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
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
