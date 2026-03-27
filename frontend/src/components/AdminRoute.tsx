/**
 * Route guard for admin-only pages.
 *
 * Two-level check: not authenticated → /login, authenticated but
 * not admin → / (home). Mirrors the backend's distinction:
 *   - 401 = not authenticated
 *   - 403 = authenticated but wrong role
 *
 * Nicole is the only admin (ADR-009). This guard keeps the frontend
 * consistent with the backend's require_admin dependency.
 */

import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// so you can put <AdminRoute>...</AdminRoute> around stuff later
export default function AdminRoute({
  children,  // destructure children from the props object
}: {
  children: React.ReactNode;  // and this is the shape of the props object
}) {
  const { user, isLoading } = useAuth();  //  read the bulletin board. Now you know who's logged in (or not)

  if (isLoading) return null;  // the /me call hasn't finished yet
  if (!user) return <Navigate to="/login" replace />;  // there's no session (user not logged in) - redirect to /login
  if (user.role !== "ADMIN") return <Navigate to="/" replace />;  // logged in, but not an admin - redirect to /home
  return <>{children}</>;  // you've passed all 3 checks - you can return the actual page now
}

/**
 * props (properties) object: the single object of all the attributes passed to a component:
 * eg:
 * <AdminRoute>
 *  <DashboardPage />
 * </AdminRoute>
 * 
 * eg (with attributes):
 * <UserCard name="Nicole" role="ADMIN" />
 */
