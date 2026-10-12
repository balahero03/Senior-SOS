// frontend/src/features/auth/pages/ForgotPasswordPage.jsx
// Route: /forgot-password
// Forgot password verification via registered email and academic department.

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDepartments, resetPassword } from '../api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState('');
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    email: '',
    departmentId: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    getDepartments()
      .then(setDepartments)
      .catch(() => {});
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  }

  function validate() {
    const errs = {};
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Enter a valid registered email address';
    }
    if (!form.departmentId) {
      errs.departmentId = 'Please select your department';
    }
    if (!form.newPassword || form.newPassword.length < 8) {
      errs.newPassword = 'Password must be at least 8 characters';
    }
    if (form.newPassword !== form.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setApiError('');

    try {
      await resetPassword({
        email: form.email.trim(),
        departmentId: form.departmentId,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });
      setSuccess(true);
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.errors?.[0]?.message ||
        'Password reset failed. Please ensure your email and department are correct.';
      setApiError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f2ee] flex flex-col justify-between font-sans text-slate-900">
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
        <div className="text-xs sm:text-sm">
          <span className="text-slate-500 mr-2">Remember your password?</span>
          <Link to="/login" className="font-bold text-[#0a66c2] hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      {/* Main Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px]">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-7 sm:p-9 space-y-6">
            {!success ? (
              <>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Reset Password
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Enter your college email and registered department to create a new password.
                  </p>
                </div>

                {/* Error Banner */}
                {apiError && (
                  <div
                    className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-slide-up"
                    role="alert"
                  >
                    <svg
                      className="w-4 h-4 shrink-0 mt-0.5 text-red-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{apiError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  {/* College Email */}
                  <div>
                    <label htmlFor="reset-email" className="block text-xs font-bold text-slate-700 mb-1">
                      College Email
                    </label>
                    <input
                      id="reset-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="e.g. yourname@ssn.edu.in"
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

                  {/* Department */}
                  <div>
                    <label htmlFor="reset-dept" className="block text-xs font-bold text-slate-700 mb-1">
                      Academic Department
                    </label>
                    <select
                      id="reset-dept"
                      name="departmentId"
                      value={form.departmentId}
                      onChange={handleChange}
                      className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white rounded-lg border text-slate-900 focus:outline-none transition-all ${
                        errors.departmentId
                          ? 'border-red-500 ring-1 ring-red-500'
                          : 'border-slate-300 focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2]'
                      }`}
                    >
                      <option value="">Select your department…</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.code ? `(${d.code})` : ''}
                        </option>
                      ))}
                    </select>
                    {errors.departmentId && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.departmentId}</p>
                    )}
                  </div>

                  {/* New Password */}
                  <div>
                    <label htmlFor="reset-password" className="block text-xs font-bold text-slate-700 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="reset-password"
                        name="newPassword"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={form.newPassword}
                        onChange={handleChange}
                        placeholder="At least 8 characters"
                        className={`w-full px-3.5 py-2.5 pr-14 text-xs sm:text-sm bg-white rounded-lg border text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                          errors.newPassword
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
                    {errors.newPassword && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.newPassword}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="reset-confirm" className="block text-xs font-bold text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        id="reset-confirm"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        placeholder="Re-type new password"
                        className={`w-full px-3.5 py-2.5 pr-14 text-xs sm:text-sm bg-white rounded-lg border text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                          errors.confirmPassword
                            ? 'border-red-500 ring-1 ring-red-500'
                            : 'border-slate-300 focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#0a66c2] hover:text-[#004182]"
                      >
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.confirmPassword}</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    id="reset-submit"
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
                        Verifying & Resetting…
                      </>
                    ) : (
                      'Reset Password'
                    )}
                  </button>
                </form>

                <div className="pt-2 text-center">
                  <Link to="/login" className="text-xs font-bold text-[#0a66c2] hover:underline">
                    Back to Sign in
                  </Link>
                </div>
              </>
            ) : (
              /* Success View */
              <div className="text-center py-4 space-y-4">
                <div className="w-16 h-16 bg-green-50 border border-green-200 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <div className="space-y-1">
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    Password Reset!
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                    Your password has been successfully updated. All previous sessions have been signed out.
                  </p>
                </div>

                <div className="pt-3">
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full py-3 px-6 bg-[#0a66c2] hover:bg-[#004182] active:scale-[0.99] text-white font-bold text-sm rounded-full transition-all shadow-xs"
                  >
                    Sign in to SeniorSOS
                  </button>
                </div>
              </div>
            )}
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

