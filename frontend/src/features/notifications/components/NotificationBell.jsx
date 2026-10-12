// frontend/src/features/notifications/components/NotificationBell.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getNotifications, markAsRead, markAllAsRead } from '../api';

export default function NotificationBell() {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchUnread = useCallback(async () => {
    try {
      const data = await getNotifications({ limit: 5 });
      setUnreadCount(data.unreadCount || 0);
      setRecentNotifications(data.notifications || []);
    } catch {
      // Silently ignore if not authenticated
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setUnreadCount(0);
      setRecentNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.readAt) {
      try {
        await markAsRead(notif.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setRecentNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, readAt: new Date().toISOString() } : n))
        );
      } catch {
        // Continue navigation
      }
    }

    setIsOpen(false);

    // Target context routing
    switch (notif.type) {
      case 'CONNECTION_REQUEST_RECEIVED':
      case 'CONNECTION_REQUEST_ACCEPTED':
        navigate('/network');
        break;
      case 'MENTORSHIP_REQUEST_RECEIVED':
      case 'MENTORSHIP_STATUS_UPDATED':
        navigate('/mentorship');
        break;
      case 'POST_COMMENT_RECEIVED':
        navigate('/feed');
        break;
      default:
        navigate('/notifications');
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
      case 'POST_COMMENT_RECEIVED':
        return `${actorName} commented on your post`;
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
      case 'POST_COMMENT_RECEIVED':
        return '💬';
      default:
        return '🔔';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchUnread();
        }}
        className="relative p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-colors"
        title="Notifications"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-blue-600 rounded-full shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden z-50 animate-slide-up">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-100 text-blue-700 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {recentNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No notifications right now
              </div>
            ) : (
              recentNotifications.map((n) => {
                const isUnread = !n.readAt;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                      isUnread ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">
                      {getNotificationIcon(n.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-relaxed ${isUnread ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                        {getNotificationText(n)}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        {new Date(n.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
