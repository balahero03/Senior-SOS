// frontend/src/components/layout/ProtectedRoute.jsx
// Route guard: redirects to /login if the user is not authenticated.
// Shows a full-screen loader while auth state is initialising.
// Per FOLDER_STRUCTURE.md §frontend/src/routes/:
//   "Route definitions and route guards: public/authenticated/admin route trees."

import { Navigate, useLocation } from 'react-router-dom';
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
 * Wraps a route that requires authentication.
 * @param {{ children: React.ReactNode, requiredRole?: string }} props
 */
export default function ProtectedRoute({ children, requiredRole, allowAdmin = false }) {
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
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
