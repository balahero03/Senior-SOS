import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import NotificationBell from '../../features/notifications/components/NotificationBell';

const navigation = [
  { to: '/dashboard', label: 'Home' },
  { to: '/discover', label: 'Discover' },
  { to: '/network', label: 'My network' },
  { to: '/mentorship', label: 'Mentorship' },
  { to: '/referrals', label: 'Referrals' },
  { to: '/feed', label: 'Community' },
  { to: '/messages', label: 'Messages' },
];

function NavigationLinks({ onNavigate }) {
  return navigation.map(({ to, label }) => (
    <NavLink
      key={to}
      to={to}
      onClick={onNavigate}
      className={({ isActive }) => `app-nav-link px-3 py-2 text-sm font-medium${isActive ? ' is-active' : ''}`}
    >
      {label}
    </NavLink>
  ));
}

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const userDropdownRef = useRef(null);

  useEffect(() => {
    setMobileNavOpen(false);
    setUserDropdownOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setUserDropdownOpen(false);
        setMobileNavOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  const displayName = user?.name || 'User';
  const initials = displayName.trim().charAt(0).toUpperCase();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <header className="app-header sticky top-0 z-50">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="group flex shrink-0 items-center gap-3" aria-label="SeniorSOS home">
          <span className="app-brand-mark flex h-10 w-10 items-center justify-center text-xl font-semibold transition-transform group-hover:-rotate-3">
            S
          </span>
          <span className="leading-tight">
            <span className="block text-[1.08rem] font-semibold tracking-tight text-slate-900">
              Senior<span className="text-blue-700">SOS</span>
            </span>
            <span className="hidden text-[0.68rem] tracking-wide text-slate-500 sm:block">Your campus, connected</span>
          </span>
        </Link>

        {user && (
          <>
            <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Main navigation">
              <NavigationLinks />
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
              {isAdmin && (
                <Link
                  to="/admin"
                  className="hidden items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 sm:inline-flex"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-600" aria-hidden="true" />
                  Admin
                </Link>
              )}

              <NotificationBell />

              <div className="relative" ref={userDropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen((open) => !open)}
                  className="flex min-h-10 items-center gap-2 rounded-lg border border-transparent p-1.5 text-left transition-colors hover:border-slate-200 hover:bg-slate-50"
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="menu"
                  aria-label={`Account menu for ${displayName}`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800">
                    {initials}
                  </span>
                  <span className="hidden max-w-32 sm:block">
                    <span className="block truncate text-xs font-semibold text-slate-800">{displayName}</span>
                    <span className="mt-0.5 block text-[10px] capitalize text-slate-500">{user.role?.toLowerCase()}</span>
                  </span>
                  <svg className={`hidden h-4 w-4 text-slate-500 transition-transform sm:block${userDropdownOpen ? ' rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.09 1.03l-4.25 4.5a.75.75 0 01-1.09 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl" role="menu">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                    <Link to="/profile" role="menuitem" className="block px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-800">
                      Your profile
                    </Link>
                    <Link to="/settings" role="menuitem" className="block px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-800">
                      Settings
                    </Link>
                    {isAdmin && (
                      <Link to="/admin" role="menuitem" className="block px-4 py-2.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-50">
                        Admin portal
                      </Link>
                    )}
                    <div className="mt-1 border-t border-slate-100 pt-1">
                      <button type="button" role="menuitem" onClick={handleLogout} className="w-full px-4 py-2.5 text-left text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50">
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50 xl:hidden"
                onClick={() => setMobileNavOpen((open) => !open)}
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-navigation"
                aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              >
                {mobileNavOpen ? (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path d="m5 5 10 10M15 5 5 15" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path d="M3 5h14M3 10h14M3 15h14" />
                  </svg>
                )}
              </button>
            </div>

            {mobileNavOpen && (
              <nav id="mobile-navigation" className="mobile-navigation absolute left-0 right-0 top-full grid grid-cols-2 gap-1 border-b border-slate-200 bg-white px-4 py-3 shadow-lg xl:hidden sm:px-6" aria-label="Mobile navigation">
                <NavigationLinks onNavigate={() => setMobileNavOpen(false)} />
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMobileNavOpen(false)} className="app-nav-link px-3 py-2 text-sm font-medium text-amber-800">
                    Admin portal
                  </Link>
                )}
              </nav>
            )}
          </>
        )}

        {!user && (
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-700 transition-colors hover:text-blue-800">Sign in</Link>
            <Link to="/register" className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800">Join the network</Link>
          </div>
        )}
      </div>
    </header>
  );
}
