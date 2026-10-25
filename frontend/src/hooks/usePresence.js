// frontend/src/hooks/usePresence.js
// Online status and last-seen for a set of users. The API only reports people
// the viewer is connected to, so anyone else is simply absent from the result.
// Updates arrive live over the socket; a slow poll covers a dropped socket.

import { useEffect, useState } from 'react';
import api from '../services/api';
import { connectSocket } from '../services/socket';

const POLL_MS = 60_000;
const MAX_IDS = 100;

const fetchPresence = (ids) =>
  api.get('/presence', { params: { ids: ids.join(',') } }).then((r) => r.data.data.presence);

/**
 * @param {string[]} userIds
 * @returns {Record<string, { online: boolean, lastSeen: number | null }>}
 */
export default function usePresence(userIds) {
  const [presence, setPresence] = useState({});

  const ids = [...new Set((userIds || []).filter(Boolean))].sort().slice(0, MAX_IDS);
  const key = ids.join(',');

  useEffect(() => {
    if (!key) return undefined;
    const wanted = new Set(key.split(','));
    let cancelled = false;

    const load = () => {
      fetchPresence([...wanted])
        .then((result) => { if (!cancelled) setPresence((prev) => ({ ...prev, ...result })); })
        .catch(() => {});
    };

    load();
    const timer = setInterval(load, POLL_MS);

    const socket = connectSocket();
    const onUpdate = ({ userId, online, lastSeen }) => {
      if (wanted.has(userId)) setPresence((prev) => ({ ...prev, [userId]: { online, lastSeen } }));
    };
    socket.on('presence:update', onUpdate);

    return () => {
      cancelled = true;
      clearInterval(timer);
      socket.off('presence:update', onUpdate);
    };
  }, [key]);

  return presence;
}

/** "Active now", "Last seen 5m ago", or '' when nothing is known. */
export function describePresence(entry) {
  if (!entry) return '';
  if (entry.online) return 'Active now';
  if (!entry.lastSeen) return '';
  const minutes = Math.floor((Date.now() - entry.lastSeen) / 60_000);
  if (minutes < 1) return 'Last seen just now';
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  return `Last seen ${Math.floor(hours / 24)}d ago`;
}
