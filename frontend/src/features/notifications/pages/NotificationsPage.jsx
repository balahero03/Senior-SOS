// frontend/src/features/notifications/pages/NotificationsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../../components/layout/Navbar';
import PageHeading from '../../../components/ui/PageHeading';
import { getNotifications, markAsRead, markAllAsRead } from '../api';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchNotifs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getNotifications({
        limit: 50,
        ...(activeTab === 'unread' && { unreadOnly: 'true' }),
      });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  const handleMarkOne = async (id, e) => {
    e.stopPropagation();
    setActionLoadingId(id);
    try {
      await markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleCardClick = (notif) => {
    if (!notif.readAt) {
      markAsRead(notif.id).catch(() => {});
    }

    switch (notif.type) {
      case 'CONNECTION_REQUEST_RECEIVED':
      case 'CONNECTION_REQUEST_ACCEPTED':
        navigate('/network');
        break;
      case 'MENTORSHIP_REQUEST_RECEIVED':
      case 'MENTORSHIP_STATUS_UPDATED':
        navigate('/mentorship');
        break;
      case 'REFERRAL_REQUEST_RECEIVED':
      case 'REFERRAL_STATUS_UPDATED':
        navigate('/referrals');
        break;
      case 'POST_COMMENT_RECEIVED':
        navigate('/feed');
        break;
      default:
        break;
    }
  };

  const getNotificationText = (notif) => {
    const actorName = notif.actor?.name || 'Someone';
    switch (notif.type) {
      case 'CONNECTION_REQUEST_RECEIVED':
        return `${actorName} sent you a connection request`;
      case 'CONNECTION_REQUEST_ACCEPTED':
        return `${actorName} accepted your connection request`;
      case 'MENTORSHIP_REQUEST_RECEIVED':
        return `${actorName} requested mentorship: "${notif.payload?.focusArea || ''}"`;
      case 'MENTORSHIP_STATUS_UPDATED':
        return `Mentorship status updated to ${notif.payload?.newStatus || ''}`;
      case 'REFERRAL_REQUEST_RECEIVED':
        return `${actorName} requested a referral for ${notif.payload?.jobTitle || 'a job'}`;
      case 'REFERRAL_STATUS_UPDATED':
        return `Referral status updated to ${notif.payload?.newStatus || ''}`;
      case 'POST_COMMENT_RECEIVED':
        return `${actorName} commented on your post: "${notif.payload?.contentSnippet || ''}"`;
      default:
        return 'You have a new update';
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'CONNECTION_REQUEST_RECEIVED':
      case 'CONNECTION_REQUEST_ACCEPTED':
        return '🤝';
      case 'MENTORSHIP_REQUEST_RECEIVED':
      case 'MENTORSHIP_STATUS_UPDATED':
        return '🎓';
      case 'REFERRAL_REQUEST_RECEIVED':
      case 'REFERRAL_STATUS_UPDATED':
        return '💼';
      case 'POST_COMMENT_RECEIVED':
        return '💬';
      default:
        return '🔔';
    }
  };

  // Group by Today vs Earlier
  const isToday = (dateString) => {
    const d = new Date(dateString);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  };

  const todayList = notifications.filter((n) => isToday(n.createdAt));
  const earlierList = notifications.filter((n) => !isToday(n.createdAt));

  const renderSection = (title, items) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-3 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2">
          {title}
        </h3>
        <div className="space-y-2.5">
          {items.map((n) => {
            const isUnread = !n.readAt;
            return (
              <div
                key={n.id}
                onClick={() => handleCardClick(n)}
                className={`bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4 cursor-pointer hover:shadow-md transition-all ${
                  isUnread ? 'border-l-4 border-l-blue-600 bg-blue-50/20' : ''
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm ${isUnread ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                      {getNotificationText(n)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(n.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {isUnread && (
                    <button
                      onClick={(e) => handleMarkOne(n.id, e)}
                      disabled={actionLoadingId === n.id}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                      {actionLoadingId === n.id ? '...' : 'Mark read'}
                    </button>
                  )}
                  <span className="text-slate-300 text-sm">→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeading
          eyebrow="Activity & alerts"
          title="Notifications Center"
          description="Track requests, mentorship updates, and connection activities."
          actions={unreadCount > 0 && (
            <button onClick={handleMarkAll} className="page-action page-action-secondary">
              Mark all as read
            </button>
          )}
        />

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 mb-6 gap-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
              activeTab === 'all'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>All Updates</span>
          </button>

          <button
            onClick={() => setActiveTab('unread')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
              activeTab === 'unread'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-blue-600 text-white font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <span className="text-4xl block">✨</span>
            <h3 className="text-base font-bold text-slate-800">
              {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You are all caught up! New requests, referrals, and connection notices will appear here.
            </p>
          </div>
        ) : (
          <div>
            {renderSection('Today', todayList)}
            {renderSection('Earlier', earlierList)}
          </div>
        )}
      </main>
    </div>
  );
}
