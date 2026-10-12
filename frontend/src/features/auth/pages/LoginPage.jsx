// frontend/src/features/auth/pages/LoginPage.jsx
// Route: /login
// Public page — redirects to /dashboard if already authenticated.

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../../stores/authStore';
import { loginUser } from '../api';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useAuthStore((s) => s.setUser);

  const from = location.state?.from?.pathname || '/dashboard';

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  }

  function validate() {
    const errs = {};
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Enter a valid email address';
    if (!form.password) errs.password = 'Password is required';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    setApiError('');

    try {
      const data = await loginUser({ email: form.email, password: form.password });
      const loggedInUser = data.data.user;
      setUser(loggedInUser);
      const targetPath = from !== '/dashboard' ? from : (loggedInUser.role === 'ADMIN' ? '/admin' : '/dashboard');
      navigate(targetPath, { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        'Login failed. Please check your credentials and try again.';
      setApiError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f2ee] flex flex-col justify-between font-sans">
      {/* Top Header */}
      <header className="px-6 sm:px-12 py-5 max-w-7xl w-full mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1.5" aria-label="SeniorSOS home">
          <span className="font-black text-2xl tracking-tight text-slate-900 leading-none">
            Senior<span className="text-[#0a66c2]">SOS</span>
          </span>
          <span className="hidden sm:inline-block text-[10px] font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.5 rounded tracking-wide uppercase">
            Campus Network
          </span>
        </Link>
        <Link
          to="/register"
          className="text-xs sm:text-sm font-bold text-[#0a66c2] hover:underline"
        >
          Join now
        </Link>
      </header>

      {/* Main Login Card Section */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[400px]">
          {/* Card Container */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-7 sm:p-9 space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Sign in
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Stay connected with your campus community & alumni
              </p>
            </div>

            {/* Quick Demo Fill Buttons */}
            <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-2.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                One-Click Demo Fill
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setForm({ email: 'student.demo@ssn.edu.in', password: 'Password@123' });
                    setErrors({});
                    setApiError('');
                  }}
                  className="px-2 py-1.5 text-[11px] font-semibold bg-white hover:bg-blue-50 hover:text-[#0a66c2] hover:border-blue-200 border border-slate-200 rounded-lg text-slate-700 transition-all shadow-2xs text-center"
                >
                  🎓 Student
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ email: 'alumni.demo@ssn.edu.in', password: 'Password@123' });
                    setErrors({});
                    setApiError('');
                  }}
                  className="px-2 py-1.5 text-[11px] font-semibold bg-white hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 border border-slate-200 rounded-lg text-slate-700 transition-all shadow-2xs text-center"
                >
                  💼 Alumni
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ email: 'admin@seniorsos.edu.in', password: 'Password@123' });
                    setErrors({});
                    setApiError('');
                  }}
                  className="px-2 py-1.5 text-[11px] font-semibold bg-white hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 border border-slate-200 rounded-lg text-slate-700 transition-all shadow-2xs text-center"
                >
                  👑 Admin
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {apiError && (
              <div
                className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-slide-up"
                role="alert"
              >
                <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{apiError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-slate-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Your college email (e.g. name@ssn.edu.in)"
                  className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white rounded-lg border text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                    errors.email
                      ? 'border-red-500 ring-1 ring-red-500'
                      : 'border-slate-300 focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2]'
                  }`}
                />
                {errors.email && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-xs font-bold text-slate-700">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-bold text-[#0a66c2] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter password"
                    className={`w-full px-3.5 py-2.5 pr-14 text-xs sm:text-sm bg-white rounded-lg border text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                      errors.password
                        ? 'border-red-500 ring-1 ring-red-500'
                        : 'border-slate-300 focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#0a66c2] hover:text-[#004182]"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.password}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-6 bg-[#0a66c2] hover:bg-[#004182] active:scale-[0.99] text-white font-bold text-sm rounded-full transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-slate-400 font-medium">or</span>
              </div>
            </div>

            {/* Create Account Link */}
            <Link
              to="/register"
              className="block w-full text-center py-2.5 px-6 rounded-full font-bold text-xs sm:text-sm border border-slate-400 hover:border-slate-800 text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all"
            >
              Join SeniorSOS
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 text-center text-xs text-slate-500 space-y-2">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-slate-500 font-medium">
          <Link to="/" className="hover:text-[#0a66c2] hover:underline">About</Link>
          <Link to="/" className="hover:text-[#0a66c2] hover:underline">Accessibility</Link>
          <Link to="/" className="hover:text-[#0a66c2] hover:underline">User Agreement</Link>
          <Link to="/" className="hover:text-[#0a66c2] hover:underline">Privacy Policy</Link>
          <Link to="/" className="hover:text-[#0a66c2] hover:underline">Community Guidelines</Link>
        </div>
        <p className="text-slate-400">SeniorSOS Corporation © 2026. Campus Network.</p>
      </footer>
    </div>
  );
}
