/*---------------
 Top-level routing table + AuthProvider wrapper.

 Sprint 3: added AuthProvider, ProtectedRoute, AdminRoute.
 The AuthProvider wraps everything inside <BrowserRouter> so the
 auth context is available to Layout, pages, and route guards.
 ---------------*/
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import Search from "./pages/Search";
import Profile from "./pages/Profile";
import About from "./pages/About";
import Feedback from "./pages/Feedback";
import Join from "./pages/Join";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Search />} />
            <Route path="/providers/or/:city" element={<Search />} />
            <Route path="/providers/:slug/:id" element={<Profile />} />
            <Route path="/about" element={<About />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/join" element={<Join />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
