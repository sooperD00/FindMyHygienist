/**
 * Provider dashboard — minimal Sprint 3 version.
 *
 * Shows the logged-in provider's email and their provider status.
 * The real dashboard (profile preview, edit, admin messages) is
 * Sprint 5. This is just enough to prove the auth flow works
 * end-to-end.
 *
 * Route guard: wrapped in <ProtectedRoute> in App.tsx — if you're
 * not logged in, you never see this component.
 */

import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="page-narrow">
      <h1>My Dashboard</h1>
      <p>Welcome, {user?.email}</p>
      {user?.role === "PROVIDER" && (
        <p>
          <small>
            Your profile is pending review. You'll be able to edit it
            once the full profile editor ships. {/* Sprint 5 */}
          </small>
        </p>
      )}
      {/* Sprint 5: profile preview, edit button, status indicator,
          admin messages if changes were requested */}
    </div>
  );
}
