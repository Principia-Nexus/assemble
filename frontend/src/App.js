import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth, homeFor } from "@/context/AuthContext";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import ProjectSheet from "@/pages/ProjectSheet";
import Review from "@/pages/Review";
import MyReviews from "@/pages/MyReviews";
import Summary from "@/pages/Summary";

export const Loading = ({ label = "Loading" }) => (
  <div data-testid="page-loading" className="min-h-screen flex items-center justify-center text-sm text-slate-500 font-mono">
    {label}…
  </div>
);

function Protected({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === null) return <Loading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  if (user === null) return <Loading />;
  return <Navigate to={user ? homeFor(user) : "/login"} replace />;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/project" element={<Protected><ProjectSheet /></Protected>} />
      <Route path="/reviews" element={<Protected><MyReviews /></Protected>} />
      <Route path="/summary" element={<Protected><Summary /></Protected>} />
      <Route path="/review/:token" element={<Protected><Review /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-right" richColors visibleToasts={2} />
      </AuthProvider>
    </BrowserRouter>
  );
}
