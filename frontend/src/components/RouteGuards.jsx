import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// These guards control what the frontend renders, nothing more. The
// backend re-checks role/permission on every request regardless of
// what this component decided to show — see backend/src/middleware
// once Phase 6 builds it.
export function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  // A worker/admin logging in with a temporary password gets routed
  // here instead of the rest of the app until they set a real one —
  // the backend blocks every other endpoint while this flag is true,
  // so letting them land anywhere else just shows broken pages.
  if (user.forcePasswordChange && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}
export function RequireRole({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const allowed = Array.isArray(role) ? role.includes(user.role) : user.role === role;
  if (!allowed) return <Navigate to="/" replace />;
  return children;
}
