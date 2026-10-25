// frontend/src/features/messages/pages/MessagesPage.jsx
// Real-time chat page — conversation list (sidebar) + message thread (main panel).
// Socket.IO delivers incoming messages instantly; HTTP is used for history + sending.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from '../../../components/layout/Navbar';
import useAuthStore from '../../../stores/authStore';
import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  getUsers,
} from '../api';
import { connectSocket, getSocket } from '../../../services/socket';
import usePresence, { describePresence } from '../../../hooks/usePresence';
import PresenceDot from '../../../components/common/PresenceDot';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function roleColor(role) {
  return role === 'ALUMNI' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200';
}

function Avatar({ name, size = 'md' }) {
  const initials = (name || 'U').charAt(0).toUpperCase();
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-11 h-11 text-base' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold flex-shrink-0 shadow-xs`}>
      {initials}
    </div>
  );
}

// ─── Conversation List Item ───────────────────────────────────────────────────

function ConversationItem({ conv, isActive, currentUserId, onClick, online }) {
  const other = conv.otherUser || { name: 'Unknown', role: 'STUDENT' };
  return (
    <button
      onClick={() => onClick(conv)}
      className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-all rounded-lg ${
        isActive
          ? 'bg-[#eef5fc] border-l-4 border-l-[#0a66c2] shadow-2xs'
          : 'hover:bg-slate-100 border-l-4 border-l-transparent'
      }`}
    >
      <div className="relative flex-shrink-0">
        <Avatar name={other.name} />
        <PresenceDot online={online} className="absolute bottom-0 right-0" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className={`text-xs font-bold truncate ${isActive ? 'text-[#0a66c2]' : 'text-slate-900'}`}>{other.name}</p>
          {conv.lastMessageAt && (
            <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">{formatTime(conv.lastMessageAt)}</span>
          )}
        </div>
        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-extrabold mt-0.5 inline-block ${roleColor(other.role)}`}>
          {other.role}
        </span>
      </div>
    </button>
  );
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ msg, isOwn }) {
  return (
    <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`max-w-xs sm:max-w-sm lg:max-w-md px-4 py-2 rounded-2xl text-xs leading-relaxed shadow-xs ${
          isOwn
            ? 'bg-[#0a66c2] text-white rounded-br-xs'
            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        <p className={`text-[10px] mt-1 text-right ${isOwn ? 'text-blue-100' : 'text-slate-400'}`}>
          {formatTime(msg.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ─── User Showcase & New Conversation Modal ───────────────────────────────────

function NewConversationModal({ onStart, onClose }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState(null);
  const [error, setError] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getUsers({ search, role: roleFilter });
      setUsers(data || []);
    } catch (err) {
      setError('Failed to load users list');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleSelectUser = async (targetUserId) => {
    setStartingId(targetUserId);
    setError('');
    try {
      const conv = await getOrCreateConversation(targetUserId);
      onStart(conv);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not start conversation.');
      setStartingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border border-slate-100">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Start a Conversation</h2>
            <p className="text-xs text-slate-500 mt-0.5">Select anyone in the SeniorSOS network to message</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-lg font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
          <div className="relative">
            <svg className="w-5 h-5 absolute left-3.5 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full text-sm text-slate-900 placeholder:text-slate-400 pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>

          <div className="flex gap-2">
            {[
              { id: 'ALL', label: 'All Users' },
              { id: 'STUDENT', label: 'Students 🎓' },
              { id: 'ALUMNI', label: 'Alumni 💼' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  roleFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Users Showcase List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-medium">Finding members...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <div className="text-3xl">👥</div>
              <p className="text-sm font-semibold text-slate-700">No users found</p>
              <p className="text-xs text-slate-500">Try searching with another name or filter.</p>
            </div>
          ) : (
            users.map((u) => {
              const isStarting = startingId === u.id;
              const isAlumni = u.role === 'ALUMNI';
              const isStudent = u.role === 'STUDENT';

              const subText = isAlumni
                ? u.alumniProfile?.designation && u.alumniProfile?.company?.name
                  ? `${u.alumniProfile.designation} at ${u.alumniProfile.company.name}`
                  : u.alumniProfile?.designation || u.email
                : isStudent
                ? u.academicProfile?.department?.name
                  ? `${u.academicProfile.department.name} ${u.academicProfile.graduationYear ? `('${String(u.academicProfile.graduationYear).slice(-2)})` : ''}`
                  : u.email
                : u.email;

              return (
                <div
                  key={u.id}
                  onClick={() => !isStarting && handleSelectUser(u.id)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all cursor-pointer group shadow-sm hover:shadow"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={u.name} size="lg" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {u.name}
                        </p>
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${roleColor(u.role)}`}>
                          {u.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{subText}</p>
                    </div>
                  </div>

                  <button
                    disabled={isStarting}
                    className="ml-3 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-all flex items-center gap-1 flex-shrink-0"
                  >
                    {isStarting ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Opening…
                      </span>
                    ) : (
                      'Chat'
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main MessagesPage ────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const presence = usePresence(conversations.map((c) => c.otherUser?.id));
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const messagesEndRef = useRef(null);

  // ── Scroll to bottom ────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ── Socket.IO connection ─────────────────────────────────────────────────────
  useEffect(() => {
    const socket = connectSocket();

    const handleNewMessage = ({ conversationId, message }) => {
      // Append to active thread if the message belongs to it
      if (activeConv?._id === conversationId) {
        setMessages(prev => [...prev, message]);
      }
      // Refresh conversation list to update lastMessageAt
      fetchConversations();
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [activeConv]);

  // ── Load conversations ───────────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data.conversations || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    setLoadingConvs(true);
    fetchConversations().finally(() => setLoadingConvs(false));
  }, [fetchConversations]);

  // ── Select a conversation & load messages ────────────────────────────────────
  const handleSelectConversation = async (conv) => {
    setActiveConv(conv);
    setMessages([]);
    setLoadingMsgs(true);
    try {
      const data = await getMessages(conv._id);
      setMessages((data.messages || []).reverse()); // API returns newest first
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  };

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = async (e) => {
    e.preventDefault();
    if (!msgInput.trim() || !activeConv || sending) return;
    const content = msgInput.trim();
    setMsgInput('');
    setSending(true);

    // Optimistic update
    const optimistic = {
      _id: `opt-${Date.now()}`,
      conversationId: activeConv._id,
      senderId: user?.id,
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const data = await sendMessage(activeConv._id, content);
      // Replace optimistic with real message
      setMessages(prev => prev.map(m => m._id === optimistic._id ? data.message : m));
      fetchConversations();
    } catch {
      // Remove optimistic on failure
      setMessages(prev => prev.filter(m => m._id !== optimistic._id));
    } finally {
      setSending(false);
    }
  };

  // ── New conversation created ──────────────────────────────────────────────────
  const handleConversationStarted = async (conv) => {
    setShowNewModal(false);
    // Refresh list and select new conversation
    await fetchConversations();
    handleSelectConversation(conv);
  };

  const otherUser = activeConv?.otherUser;

  return (
    <div className="min-h-screen bg-[#f4f2ee] flex flex-col font-sans">
      <Navbar />

      {showNewModal && (
        <NewConversationModal
          onStart={handleConversationStarted}
          onClose={() => setShowNewModal(false)}
        />
      )}

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col">
        <main className="feed-card flex-1 flex overflow-hidden h-[calc(100vh-100px)]">
          {/* ── Conversation Sidebar ─────────────────────────────────────────── */}
          <aside className="w-80 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-sm">Messaging</h2>
              <button
                onClick={() => setShowNewModal(true)}
                className="w-8 h-8 rounded-full bg-[#0a66c2] text-white flex items-center justify-center hover:bg-[#004182] transition-colors shadow-xs"
                title="New conversation"
              >
                <span className="text-base leading-none font-bold">+</span>
              </button>
            </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingConvs ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-slate-200 rounded w-3/4" />
                      <div className="h-2 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-sm font-semibold text-slate-600">No conversations yet</p>
                <p className="text-xs text-slate-400 mt-1">Start a new conversation with a student or alumni.</p>
                <button
                  onClick={() => setShowNewModal(true)}
                  className="mt-4 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Start messaging
                </button>
              </div>
            ) : (
              conversations.map(conv => (
                <ConversationItem
                  key={conv._id}
                  conv={conv}
                  isActive={activeConv?._id === conv._id}
                  currentUserId={user?.id}
                  onClick={handleSelectConversation}
                  online={presence[conv.otherUser?.id]?.online}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── Message Thread ──────────────────────────────────────────────── */}
        <section className="flex-1 flex flex-col bg-slate-50">
          {activeConv ? (
            <>
              {/* Header */}
              <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center gap-3 flex-shrink-0">
                <div className="relative flex-shrink-0">
                  <Avatar name={otherUser?.name} />
                  <PresenceDot online={presence[otherUser?.id]?.online} className="absolute bottom-0 right-0" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{otherUser?.name || 'Unknown'}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleColor(otherUser?.role)}`}>
                    {otherUser?.role}
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  {presence[otherUser?.id]?.online && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                  <span className="text-xs text-slate-500">
                    {describePresence(presence[otherUser?.id])}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-slate-400">Loading messages…</p>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="text-4xl mb-3">👋</div>
                    <p className="text-sm font-semibold text-slate-600">Say hello to {otherUser?.name}!</p>
                    <p className="text-xs text-slate-400 mt-1">Your messages are end-to-end stored securely.</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <MessageBubble
                      key={msg._id}
                      msg={msg}
                      isOwn={msg.senderId === user?.id}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form
                onSubmit={handleSend}
                className="bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0"
              >
                <input
                  type="text"
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  placeholder={`Message ${otherUser?.name || ''}…`}
                  className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 px-4 py-2.5 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!msgInput.trim() || sending}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-all shadow-md shadow-blue-500/20 flex-shrink-0"
                  title="Send"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                  </svg>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4 shadow-inner">
                <span className="text-4xl">💬</span>
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Your messages</h2>
              <p className="text-sm text-slate-500 max-w-xs">
                Select a conversation from the sidebar, or start a new one by clicking the <strong>+</strong> button.
              </p>
            </div>
          )}
        </section>
      </main>
      </div>
    </div>
  );
}
