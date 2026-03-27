/**
 * Route guard for authenticated pages (Dashboard where Practitioner can see stats and edit their stuff).
 *
 * Renders nothing while the auth check is in flight (isLoading),
 * then either renders children or redirects to /login.
 * The "replace" prop keeps the login redirect out of browser history
 * so the back button doesn't loop.
 */

import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// so you can put <ProtectedRoute>...</ProtectedRoute> around stuff later
export default function ProtectedRoute({
  children,  // destructure children from the props object
}: {
  children: React.ReactNode;  /// the children will have this shape (this is the type annotation)
}) {
  const { user, isLoading } = useAuth();  // read the bulletin board. now you know who is logged in or not

  if (isLoading) return null;  // wait
  if (!user) return <Navigate to="/login" replace />; // no session / user -> redirect login
  return <>{children}</>;  // you passed 2 checks - render the actual thing (you don't need to be admin, just logged in to see this page)
}
