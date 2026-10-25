// frontend/src/components/common/PresenceDot.jsx
// Small green dot shown when a connection is online. Renders nothing otherwise,
// so people who are offline or whose status is not shared show no indicator.

import React from 'react';

export default function PresenceDot({ online, className = '' }) {
  if (!online) return null;
  return (
    <span
      title="Active now"
      aria-label="Online"
      className={`block w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white ${className}`}
    />
  );
}
