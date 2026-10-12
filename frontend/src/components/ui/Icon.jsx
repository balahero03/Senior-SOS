import React from 'react';

const paths = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></>,
  discover: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4M11 8v6m-3-3h6" /></>,
  network: <><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="18" r="2.5" /><circle cx="19" cy="18" r="2.5" /><path d="m10.8 7.2-4.5 8.6m6.9-8.6 4.5 8.6M7.5 18h9" /></>,
  mentorship: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1zm12-12a3 3 0 0 1 0 6m2 2a5 5 0 0 1 4 5" /></>,
  community: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8m-8 3h5" /></>,
  messages: <><path d="M4 5h16v12H9l-5 3z" /><path d="M8 9h8m-8 4h5" /></>,
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
};

export default function Icon({ name, className = 'h-4 w-4', ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.arrow}
    </svg>
  );
}
