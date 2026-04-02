/**
 * Shared layout — nav bar + footer, wraps all pages via <Outlet>.
 *
 * Nav updates based on auth state:
 *   - Logged out: "List With Us" + "Log In"
 *   - Logged in (provider): "Dashboard" + "Log Out"
 *   - Logged in (admin): "Dashboard" + "Admin" + "Log Out"
 *
 * The logout button is a <button>, not a <Link> — it triggers a
 * POST to /api/auth/logout (state-changing, needs CSRF). After
 * logout, navigate to home.
 */

import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function Layout() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div>
      <nav className="site-nav">
        <Link to="/" className="site-nav-brand">OralHealthProviders</Link>
        <div className="site-nav-links">
          <Link to="/providers/or/portland">Find a Provider</Link>
          <Link to="/about">About</Link>

          {/* Auth-dependent nav items — hidden while loading to avoid
              flash of wrong links */}
          {!isLoading && (
            <>
              {user ? (
                <>
                  <Link to="/dashboard">Dashboard</Link>
                  {user.role === "ADMIN" && <Link to="/admin">Admin</Link>}
                  <button onClick={handleLogout} className="nav-button">
                    Log Out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/join">List With Us</Link>
                  <Link to="/login">Log In</Link>
                </>
              )}
            </>
          )}
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
      <footer>
        <p>
          © 2026 Oral Health Providers · <Link to="/about">About</Link> ·{" "}
          <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL}`}>Give Us Feedback</a>
        </p>
      </footer>
    </div>
  );
}

export default Layout;
