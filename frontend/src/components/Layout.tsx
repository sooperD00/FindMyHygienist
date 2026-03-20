import { Link, Outlet } from "react-router-dom";

function Layout() {
  return (
    <div>
      <nav>
        <Link to="/">OHP</Link>
        <Link to="/providers/or/portland">Find a Provider</Link>
        <Link to="/about">About</Link>
        <Link to="/join">List With Us</Link>
        <Link to="/login">Log In</Link>
      </nav>
      <main>
        <Outlet />
      </main>
      <footer>
        <p>© 2026 Oral Health Providers · <Link to="/about">About</Link> · <a href="mailto:nicole@oralhealthproviders.org">Give Us Feedback</a></p>
      </footer>
    </div>
  );
}

export default Layout;
