/**
 * Admin dashboard — minimal Sprint 3 version.
 *
 * Just confirms the admin route guard works. The real admin dashboard
 * (review queue, provider list, feedback inbox) is Sprint 8.
 *
 * Route guard: wrapped in <AdminRoute> in App.tsx — providers get
 * bounced to /, unauthenticated users go to /login.
 */

import { useAuth } from "../contexts/AuthContext";

export default function Admin() {
  const { user } = useAuth();

  return (
    <div className="page-narrow">
      <h1>Admin Dashboard</h1>
      <p>Logged in as {user?.email} (admin)</p>
      {/* Sprint 8: review queue, provider list, feedback inbox */}
    </div>
  );
}
