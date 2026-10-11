// frontend/src/features/auth/pages/RegisterPage.jsx
// Route: /register
// Multi-step registration form — Step 1: account basics, Step 2: academic + alumni details.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../../stores/authStore';
import { registerUser, getDepartments } from '../api';
import { useEffect } from 'react';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR + 4 - i);

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              i < current
                ? 'bg-brand-500 w-8'
                : i === current
                ? 'bg-brand-400 w-8 ring-2 ring-brand-400/30'
                : 'bg-surface-border w-6'
            }`}
          />
        </div>
      ))}
      <span className="text-xs text-slate-500 ml-2">
        Step {current + 1} of {total}
      </span>
    </div>
  );
}

// ─── Field error ──────────────────────────────────────────────────────────────
function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="field-error">
      <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd" />
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
    // Step 0
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'STUDENT',
    // Step 1 — academic
    departmentId: '',
    graduationYear: '',
    bio: '',
    careerInterests: '',
    // Alumni only
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

  // ─── Step 0 validation ─────────────────────────────────────────────────────
  function validateStep0() {
    const errs = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      errs.name = 'Full name is required (min 2 characters)';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'A valid email address is required';
    if (!form.password || form.password.length < 8)
      errs.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = 'Passwords do not match';
    return errs;
  }

  // ─── Step 1 validation ─────────────────────────────────────────────────────
  function validateStep1() {
    const errs = {};
    if (!form.departmentId) errs.departmentId = 'Please select your department';
    if (!form.graduationYear) errs.graduationYear = 'Graduation year is required';
    if (form.role === 'ALUMNI' && !form.company.trim())
      errs.company = 'Company name is required for alumni';
    return errs;
  }

  function handleNext() {
    const errs = validateStep0();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
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
        email: form.email.trim().toLowerCase(),
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
    <div className="min-h-screen bg-surface bg-auth-mesh flex items-center justify-center px-4 py-12">
      {/* Background glows */}
      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-brand mb-4 shadow-lg shadow-brand-900/50">
            <span className="text-2xl font-bold text-white">S</span>
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {step === 0 ? 'Create account' : 'Academic details'}
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {step === 0
              ? 'Join your college professional network'
              : 'Tell us about your academic background'}
          </p>
        </div>

        {/* Card */}
        <div className="card-glass p-8 shadow-2xl shadow-black/40">
          <StepIndicator current={step} total={2} />

          {/* API error */}
          {apiError && (
            <div className="alert-error mb-6" role="alert">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>{apiError}</span>
            </div>
          )}

          {/* ─── Step 0: Account basics ──────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-5">
              {/* Role selector */}
              <div>
                <label className="input-label">I am a</label>
                <div className="grid grid-cols-2 gap-3">
                  {['STUDENT', 'ALUMNI'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, role: r }))}
                      className={`py-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                        form.role === r
                          ? 'bg-brand-600/20 border-brand-500 text-brand-300'
                          : 'border-surface-border text-slate-400 hover:border-brand-700/60 hover:text-slate-300'
                      }`}
                    >
                      {r === 'STUDENT' ? '🎓 Student' : '💼 Alumni'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label htmlFor="reg-name" className="input-label">Full name</label>
                <input id="reg-name" name="name" type="text" autoComplete="name"
                  value={form.name} onChange={handleChange} placeholder="Your name"
                  className={`input-field ${errors.name ? 'error' : ''}`} />
                <FieldError message={errors.name} />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="reg-email" className="input-label">Email address</label>
                <input id="reg-email" name="email" type="email" autoComplete="email"
                  value={form.email} onChange={handleChange} placeholder="Your college email"
                  className={`input-field ${errors.email ? 'error' : ''}`} />
                <FieldError message={errors.email} />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="reg-password" className="input-label">Password</label>
                <input id="reg-password" name="password" type="password" autoComplete="new-password"
                  value={form.password} onChange={handleChange} placeholder="Min. 8 characters"
                  className={`input-field ${errors.password ? 'error' : ''}`} />
                <FieldError message={errors.password} />
              </div>

              {/* Confirm password */}
              <div>
                <label htmlFor="reg-confirm" className="input-label">Confirm password</label>
                <input id="reg-confirm" name="confirmPassword" type="password" autoComplete="new-password"
                  value={form.confirmPassword} onChange={handleChange} placeholder="••••••••"
                  className={`input-field ${errors.confirmPassword ? 'error' : ''}`} />
                <FieldError message={errors.confirmPassword} />
              </div>

              <button id="register-next" type="button" onClick={handleNext} className="btn-primary mt-2">
                Continue
              </button>
            </div>
          )}

          {/* ─── Step 1: Academic + alumni details ───────────────────── */}
          {step === 1 && (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Department */}
              <div>
                <label htmlFor="reg-dept" className="input-label">Department</label>
                <select id="reg-dept" name="departmentId" value={form.departmentId}
                  onChange={handleChange}
                  className={`input-field ${errors.departmentId ? 'error' : ''}`}>
                  <option value="">Select department…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <FieldError message={errors.departmentId} />
              </div>

              {/* Graduation year */}
              <div>
                <label htmlFor="reg-year" className="input-label">Graduation year</label>
                <select id="reg-year" name="graduationYear" value={form.graduationYear}
                  onChange={handleChange}
                  className={`input-field ${errors.graduationYear ? 'error' : ''}`}>
                  <option value="">Select year…</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <FieldError message={errors.graduationYear} />
              </div>

              {/* Bio */}
              <div>
                <label htmlFor="reg-bio" className="input-label">
                  Bio <span className="text-slate-600">(optional)</span>
                </label>
                <textarea id="reg-bio" name="bio" rows={3} value={form.bio}
                  onChange={handleChange}
                  placeholder="Tell the community about yourself…"
                  className="input-field resize-none" />
              </div>

              {/* Alumni-only fields */}
              {form.role === 'ALUMNI' && (
                <div className="space-y-5 pt-2 border-t border-surface-border">
                  <p className="text-xs text-brand-400 font-medium uppercase tracking-wider mt-4">
                    Professional Details
                  </p>

                  {/* Company */}
                  <div>
                    <label htmlFor="reg-company" className="input-label">Current company</label>
                    <input id="reg-company" name="company" type="text"
                      value={form.company} onChange={handleChange}
                      placeholder="e.g. Amazon, Google, TCS"
                      className={`input-field ${errors.company ? 'error' : ''}`} />
                    <FieldError message={errors.company} />
                  </div>

                  {/* Designation */}
                  <div>
                    <label htmlFor="reg-designation" className="input-label">
                      Designation <span className="text-slate-600">(optional)</span>
                    </label>
                    <input id="reg-designation" name="designation" type="text"
                      value={form.designation} onChange={handleChange}
                      placeholder="e.g. Software Engineer"
                      className="input-field" />
                  </div>

                  {/* Experience */}
                  <div>
                    <label htmlFor="reg-exp" className="input-label">
                      Years of experience <span className="text-slate-600">(optional)</span>
                    </label>
                    <input id="reg-exp" name="experienceYears" type="number"
                      min="0" max="60" step="0.5"
                      value={form.experienceYears} onChange={handleChange}
                      placeholder="e.g. 2.5"
                      className="input-field" />
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setStep(0)}
                  className="flex-1 py-3 px-4 rounded-xl border border-surface-border
                             text-slate-400 hover:text-slate-300 hover:border-brand-700/60
                             font-semibold transition-all duration-200">
                  Back
                </button>
                <button id="register-submit" type="submit" disabled={loading}
                  className="btn-primary flex-1">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating…
                    </span>
                  ) : (
                    'Create account'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Link to login */}
          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          SeniorSOS — Your College Network. Your Career Advantage.
        </p>
      </div>
    </div>
  );
}
