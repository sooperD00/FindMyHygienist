import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div>
      <h1>404 — Page Not Found</h1>
      <p>We couldn't find what you're looking for.</p>
      <Link to="/">Back to Home</Link>
    </div>
  );
}

export default NotFound;
