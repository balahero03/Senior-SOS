import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import NotificationBell from '../../features/notifications/components/NotificationBell';

const navItems = [
  {
    to: '/dashboard',
    label: 'Home',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    ),
  },
  {
    to: '/network',
    label: 'My Network',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    ),
  },
  {
    to: '/messages',
    label: 'Messaging',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
      </svg>
    ),
  },
];

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/discover?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/discover');
    }
  };

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  const displayName = user?.name || 'User';
  const initials = displayName.trim().charAt(0).toUpperCase();
  const isAdmin = user?.role === 'ADMIN';
  const isAlumni = user?.role === 'ALUMNI';
  if (isAdmin) {
    return (
      <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-3 sm:gap-6">
            {/* Left: Brand + Admin Pill */}
            <div className="flex items-center gap-3">
              <Link to="/admin" className="flex items-center gap-2 group" aria-label="SeniorSOS Admin Console">
                <span className="font-black text-xl tracking-tight text-white group-hover:text-slate-200 transition-colors">
                  Senior<span className="text-[#38bdf8]">SOS</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest text-purple-300 bg-purple-950/80 border border-purple-500/40 px-2.5 py-0.5 rounded-full uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  Admin Console
                </span>
              </Link>
            </div>

            {/* Center: Portal Label */}
            <div className="hidden sm:flex items-center space-x-1 text-xs font-semibold">
              <span className="text-slate-300 px-3 py-1 bg-slate-800/80 rounded-lg border border-slate-700/60 flex items-center gap-1.5">
                <span className="text-emerald-400">●</span> Campus Administration & Governance
              </span>
            </div>

            {/* Right: Admin Account & Logout */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-800/70 px-2.5 py-1 rounded-full border border-slate-700">
                <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {initials}
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-xs font-bold text-slate-100 leading-tight">{displayName}</p>
                  <p className="text-[10px] text-purple-300 font-semibold leading-none">Platform Admin</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-bold text-red-300 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 rounded-lg transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200/90 shadow-[0_1px_2px_0_rgba(0,0,0,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-3 sm:gap-6">
          
          {/* Left: Clean Brand Logo (No SOS box) & Search Bar */}
          <div className="flex items-center gap-4 shrink-0 flex-1 sm:flex-initial">
            <Link to="/dashboard" className="flex items-center gap-1.5 group shrink-0" aria-label="SeniorSOS home">
              <span className="font-black text-xl tracking-tight text-slate-900 group-hover:text-slate-800 transition-colors">
                Senior<span className="text-[#0a66c2]">SOS</span>
              </span>
              <span className="hidden xl:inline-block text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded tracking-wide uppercase">
                Campus
              </span>
            </Link>

            {user && (
              <form onSubmit={handleSearchSubmit} className="relative w-full max-w-xs sm:max-w-sm hidden sm:block">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search alumni, skills, campus discussions..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#edf3f8] hover:bg-[#e4ebf2] focus:bg-white text-slate-900 placeholder:text-slate-500 rounded-md border border-transparent focus:border-slate-300 focus:outline-none transition-all"
                />
              </form>
            )}
          </div>

          {/* Right: LinkedIn-style Nav Icons & Profile */}
          {user ? (
            <div className="flex items-center gap-0.5 sm:gap-1">
              <nav className="hidden md:flex items-center space-x-0.5 lg:space-x-1.5" aria-label="Main navigation">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `relative flex flex-col items-center justify-center min-w-[60px] sm:min-w-[64px] h-14 px-1 text-slate-500 hover:text-slate-900 transition-colors group ${
                        isActive ? 'text-[#0a66c2] font-semibold' : ''
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="relative">
                          {item.icon}
                        </div>
                        <span className="text-[11px] mt-0.5 tracking-tight whitespace-nowrap leading-tight">
                          {item.label}
                        </span>
                        {isActive && (
                          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0a66c2] rounded-t-full" />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}

                {/* Notifications Bell */}
                <NotificationBell />
              </nav>

              <div className="h-8 w-px bg-slate-200 hidden md:block mx-1.5" />

              {/* Profile / "Me" Dropdown */}
              <div className="relative" ref={userDropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex flex-col items-center justify-center min-w-[54px] sm:min-w-[60px] h-14 text-slate-600 hover:text-slate-900 focus:outline-none group px-1"
                >
                  <div className="w-6 h-6 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold text-xs shadow-xs group-hover:ring-2 group-hover:ring-blue-200 transition-all">
                    {initials}
                  </div>
                  <div className="hidden md:flex items-center gap-0.5 text-[11px] mt-0.5 leading-tight">
                    <span>Me</span>
                    <svg className={`w-3 h-3 text-slate-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-dropdown border border-slate-200/90 py-2 z-50 animate-slide-up">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 text-sm truncate">{displayName}</p>
                        <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                          isAlumni
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isAlumni ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          {user.role}
                        </span>
                      </div>
                    </div>

                    <div className="p-2 border-b border-slate-100">
                      <Link
                        to="/profile"
                        className="block w-full text-center py-1.5 px-3 text-xs font-bold text-[#0a66c2] border border-[#0a66c2] hover:bg-blue-50 rounded-full transition-colors"
                      >
                        View Profile
                      </Link>
                    </div>

                    <div className="py-1 text-xs">
                      <p className="px-4 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Account</p>
                      <Link to="/settings" className="block px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-[#0a66c2] transition-colors">
                        Settings & Privacy
                      </Link>
                      <Link to="/network" className="block px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-[#0a66c2] transition-colors">
                        Manage Connections
                      </Link>
                      {isAdmin && (
                        <Link to="/admin" className="block px-4 py-2 font-semibold text-purple-700 hover:bg-purple-50 transition-colors">
                          ⚡ Admin Portal
                        </Link>
                      )}
                    </div>

                    <div className="pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                type="button"
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                aria-label="Toggle navigation menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileNavOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-xs sm:text-sm font-semibold text-slate-700 hover:text-[#0a66c2] transition-colors px-3 py-1.5">
                Sign In
              </Link>
              <Link to="/register" className="btn-linkedin-primary text-xs sm:text-sm py-1.5 px-4">
                Join Network
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Navigation Drawer */}
        {user && mobileNavOpen && (
          <div className="md:hidden border-t border-slate-200 py-2 space-y-1 animate-slide-up bg-white">
            <form onSubmit={handleSearchSubmit} className="px-2 pb-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search alumni, skills..."
                className="w-full px-3 py-2 text-xs bg-[#edf3f8] text-slate-900 rounded-md border border-slate-200 focus:outline-none focus:bg-white"
              />
            </form>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isActive ? 'bg-blue-50 text-[#0a66c2] font-bold' : 'text-slate-700 hover:bg-slate-50'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
            <Link
              to="/notifications"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
              </svg>
              <span>Notifications</span>
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-purple-700 hover:bg-purple-50"
              >
                <span>⚡ Admin Portal</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
