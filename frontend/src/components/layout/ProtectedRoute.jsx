// frontend/src/components/layout/ProtectedRoute.jsx
// Route guard: redirects to /login if the user is not authenticated.
// Shows a full-screen loader while auth state is initialising.
// Per FOLDER_STRUCTURE.md §frontend/src/routes/:
//   "Route definitions and route guards: public/authenticated/admin route trees."

import { Navigate, useLocation, Link } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-blue-700 animate-pulse-slow flex items-center justify-center">
          <span className="text-xl font-bold text-white">S</span>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Shown instead of redirecting when a route sets `explainDenial`.
 * Used where a silent bounce would look like a broken link.
 */
function NotAuthorised() {
  return (
    <div className="min-h-screen bg-[#f4f2ee] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm max-w-md">
        <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mb-4">
          🔒
        </div>
        <h2 className="text-lg font-bold text-slate-800">Administrator access only</h2>
        <p className="text-sm text-slate-500 mt-2">
          This section is restricted to campus administrators. If you believe you
          should have access, contact your administrator.
        </p>
        <Link
          to="/dashboard"
          className="inline-block mt-6 px-4 py-2 rounded-xl bg-[#0a66c2] text-white text-xs font-bold hover:bg-[#004182] transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

/**
 * Wraps a route that requires authentication.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.requiredRole]   role the user must hold
 * @param {boolean} [props.allowAdmin]    let admins through a non-admin route
 * @param {boolean} [props.explainDenial] show a message instead of redirecting
 *                                        when the role check fails
 */
export default function ProtectedRoute({
  children, requiredRole, allowAdmin = false, explainDenial = false,
}) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Strict Admin route separation: Admins are directed to the Admin Console
  if (user?.role === 'ADMIN' && requiredRole !== 'ADMIN' && !allowAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    // A silent redirect from a link the user just clicked reads as a bug,
    // so some routes say why instead.
    return explainDenial ? <NotAuthorised /> : <Navigate to="/dashboard" replace />;
  }

  return children;
}
