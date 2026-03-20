/*---------------
 Top-level routing table
 Map every URL in your app to the component that should render for it
 and wrap them all in a shared Layout (the nav bar and footer)
 
 React renders this first, and everything else flows from it

 Mostly this is plain JavaScript; TypeScript is opt-in strictness
 Wait for the data models and interfaces and components :)
 ---------------*/
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Profile from "./pages/Profile";
import About from "./pages/About";
import Join from "./pages/Join";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/providers/or/:city" element={<Search />} />
          <Route path="/providers/:slug/:id" element={<Profile />} />
          <Route path="/about" element={<About />} />
          <Route path="/join" element={<Join />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
