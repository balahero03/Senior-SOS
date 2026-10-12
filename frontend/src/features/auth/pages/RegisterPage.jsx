// frontend/src/features/auth/pages/RegisterPage.jsx
// Route: /register
// Multi-step registration form — Step 1: account basics, Step 2: academic + alumni details.

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../../stores/authStore';
import { registerUser, getDepartments } from '../api';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR + 4 - i);

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-2 flex-1">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${
              i <= current ? 'bg-[#0a66c2]' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <span className="text-xs font-bold text-slate-500 shrink-0">
        Step {current + 1} of {total}
      </span>
    </div>
  );
}

// ─── Field error ──────────────────────────────────────────────────────────────
function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
      <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {message}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'STUDENT',
    departmentId: '',
    graduationYear: '',
    bio: '',
    careerInterests: '',
    company: '',
    designation: '',
    experienceYears: '',
  });

  useEffect(() => {
    getDepartments().then(setDepartments).catch(() => {});
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  }

  function validateStep0() {
    const errs = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      errs.name = 'Full name is required (min 2 characters)';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Enter a valid email address';
    if (!form.password || form.password.length < 8)
      errs.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = 'Passwords do not match';
    return errs;
  }

  function validateStep1() {
    const errs = {};
    if (!form.departmentId) errs.departmentId = 'Select your department';
    if (!form.graduationYear) errs.graduationYear = 'Select your graduation year';
    if (form.role === 'ALUMNI' && !form.company.trim())
      errs.company = 'Company is required for alumni';
    return errs;
  }

  function handleNext() {
    const errs = validateStep0();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setStep(1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validateStep1();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    setApiError('');

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        role: form.role,
        departmentId: form.departmentId,
        graduationYear: parseInt(form.graduationYear, 10),
        bio: form.bio.trim() || undefined,
        careerInterests: form.careerInterests.trim() || undefined,
      };

      if (form.role === 'ALUMNI') {
        payload.company = form.company.trim();
        payload.designation = form.designation.trim() || undefined;
        payload.experienceYears = form.experienceYears
          ? parseFloat(form.experienceYears)
          : undefined;
      }

      const data = await registerUser(payload);
      setUser(data.data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.errors?.[0]?.message ||
        'Registration failed. Please try again.';
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
        <div className="text-xs sm:text-sm">
          <span className="text-slate-500 mr-2">Already on SeniorSOS?</span>
          <Link to="/login" className="font-bold text-[#0a66c2] hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      {/* Main Registration Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px]">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-7 sm:p-9 space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {step === 0 ? 'Make the most of your college life' : 'Your academic background'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {step === 0
                  ? 'Connect with alumni mentors and launch your career.'
                  : 'Tell seniors and peers where you study.'}
              </p>
            </div>

            <StepIndicator current={step} total={2} />

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

            {/* Step 0: Account Basics */}
            {step === 0 && (
              <div className="space-y-4">
                {/* Role Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    I am joining as a
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {['STUDENT', 'ALUMNI'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, role: r }))}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          form.role === r
                            ? 'bg-[#eef5fc] border-[#0a66c2] text-[#0a66c2] shadow-2xs'
                            : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <span>{r === 'STUDENT' ? '🎓' : '💼'}</span>
                        <span>{r === 'STUDENT' ? 'Student' : 'Alumnus'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label htmlFor="reg-name" className="block text-xs font-bold text-slate-700 mb-1">
                    Full name
                  </label>
                  <input
                    id="reg-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Bala Muthukrishnan"
                    className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white rounded-lg border text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                      errors.name ? 'border-red-500' : 'border-slate-300 focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2]'
                    }`}
                  />
                  <FieldError message={errors.name} />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="reg-email" className="block text-xs font-bold text-slate-700 mb-1">
                    College or work email
                  </label>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="name@ssn.edu.in"
                    className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white rounded-lg border text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                      errors.email ? 'border-red-500' : 'border-slate-300 focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2]'
                    }`}
                  />
                  <FieldError message={errors.email} />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="reg-password" className="block text-xs font-bold text-slate-700 mb-1">
                    Password (8+ characters)
                  </label>
                  <input
                    id="reg-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Choose a strong password"
                    className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white rounded-lg border text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                      errors.password ? 'border-red-500' : 'border-slate-300 focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2]'
                    }`}
                  />
                  <FieldError message={errors.password} />
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="reg-confirm" className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm password
                  </label>
                  <input
                    id="reg-confirm"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter password"
                    className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white rounded-lg border text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                      errors.confirmPassword ? 'border-red-500' : 'border-slate-300 focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2]'
                    }`}
                  />
                  <FieldError message={errors.confirmPassword} />
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  By clicking Agree & Join, you agree to the SeniorSOS User Agreement and Privacy Policy.
                </p>

                <button
                  id="register-next"
                  type="button"
                  onClick={handleNext}
                  className="w-full mt-2 py-3 px-6 bg-[#0a66c2] hover:bg-[#004182] active:scale-[0.99] text-white font-bold text-sm rounded-full transition-all shadow-xs"
                >
                  Agree & Join
                </button>
              </div>
            )}

            {/* Step 1: Academic & Professional Details */}
            {step === 1 && (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Department */}
                <div>
                  <label htmlFor="reg-dept" className="block text-xs font-bold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    id="reg-dept"
                    name="departmentId"
                    value={form.departmentId}
                    onChange={handleChange}
                    className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white rounded-lg border text-slate-900 focus:outline-none ${
                      errors.departmentId ? 'border-red-500' : 'border-slate-300 focus:border-[#0a66c2]'
                    }`}
                  >
                    <option value="">Select your department…</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <FieldError message={errors.departmentId} />
                </div>

                {/* Graduation Year */}
                <div>
                  <label htmlFor="reg-year" className="block text-xs font-bold text-slate-700 mb-1">
                    Graduation Year
                  </label>
                  <select
                    id="reg-year"
                    name="graduationYear"
                    value={form.graduationYear}
                    onChange={handleChange}
                    className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white rounded-lg border text-slate-900 focus:outline-none ${
                      errors.graduationYear ? 'border-red-500' : 'border-slate-300 focus:border-[#0a66c2]'
                    }`}
                  >
                    <option value="">Select year…</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <FieldError message={errors.graduationYear} />
                </div>

                {/* Bio */}
                <div>
                  <label htmlFor="reg-bio" className="block text-xs font-bold text-slate-700 mb-1">
                    Headline / Bio <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="reg-bio"
                    name="bio"
                    rows={2}
                    value={form.bio}
                    onChange={handleChange}
                    placeholder="e.g. 3rd year CSE student interested in Full Stack & Cloud"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white rounded-lg border border-slate-300 focus:border-[#0a66c2] focus:outline-none resize-none"
                  />
                </div>

                {/* Alumni only fields */}
                {form.role === 'ALUMNI' && (
                  <div className="space-y-4 pt-3 border-t border-slate-200">
                    <p className="text-xs font-bold text-[#0a66c2] uppercase tracking-wider">
                      Professional Career
                    </p>

                    <div>
                      <label htmlFor="reg-company" className="block text-xs font-bold text-slate-700 mb-1">
                        Current Company
                      </label>
                      <input
                        id="reg-company"
                        name="company"
                        type="text"
                        value={form.company}
                        onChange={handleChange}
                        placeholder="e.g. Google, Amazon, Microsoft"
                        className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white rounded-lg border ${
                          errors.company ? 'border-red-500' : 'border-slate-300 focus:border-[#0a66c2]'
                        }`}
                      />
                      <FieldError message={errors.company} />
                    </div>

                    <div>
                      <label htmlFor="reg-designation" className="block text-xs font-bold text-slate-700 mb-1">
                        Designation / Title
                      </label>
                      <input
                        id="reg-designation"
                        name="designation"
                        type="text"
                        value={form.designation}
                        onChange={handleChange}
                        placeholder="e.g. Senior Software Engineer"
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white rounded-lg border border-slate-300 focus:border-[#0a66c2]"
                      />
                    </div>

                    <div>
                      <label htmlFor="reg-exp" className="block text-xs font-bold text-slate-700 mb-1">
                        Years of Experience
                      </label>
                      <input
                        id="reg-exp"
                        name="experienceYears"
                        type="number"
                        min="0"
                        max="60"
                        step="0.5"
                        value={form.experienceYears}
                        onChange={handleChange}
                        placeholder="e.g. 3"
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white rounded-lg border border-slate-300 focus:border-[#0a66c2]"
                      />
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="flex-1 py-2.5 px-4 rounded-full border border-slate-400 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    id="register-submit"
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 px-4 rounded-full bg-[#0a66c2] hover:bg-[#004182] text-white font-bold text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? 'Creating…' : 'Complete Setup'}
                  </button>
                </div>
              </form>
            )}

            <div className="pt-2 text-center">
              <Link to="/login" className="text-xs font-bold text-[#0a66c2] hover:underline">
                Already have an account? Sign in
              </Link>
            </div>
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
