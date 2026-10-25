import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth, homeFor } from "@/context/AuthContext";
import { setProjectId } from "@/lib/api";
import Login from "@/pages/Login";
import { dropBootDots } from "@/components/LogoDots";
import Projects from "@/pages/Projects";
import AuthCallback from "@/pages/AuthCallback";
import ProjectSheet from "@/pages/ProjectSheet";
import Review from "@/pages/Review";
import MyReviews from "@/pages/MyReviews";
import Summary from "@/pages/Summary";
import QuoteReview from "@/pages/QuoteReview";
import { PilotOffer, PaymentSuccess, PaymentCancel } from "@/pages/Pilot";

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
  if (!user) return <Login />;
  dropBootDots();
  return <Navigate to={homeFor(user)} replace />;
}

// Remounts the page per project so no state from one project can render into another.
function Keyed({ Page }) {
  const { projectId } = useParams();
  setProjectId(projectId);
  return <Page key={projectId} />;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/projects" element={<Protected><Projects /></Protected>} />
      <Route path="/projects/:projectId" element={<Protected><Keyed Page={ProjectSheet} /></Protected>} />
      <Route path="/projects/:projectId/summary" element={<Protected><Keyed Page={Summary} /></Protected>} />
      <Route path="/project" element={<Navigate to="/projects" replace />} />
      <Route path="/summary" element={<Navigate to="/projects" replace />} />
      <Route path="/reviews" element={<Protected><MyReviews /></Protected>} />
      <Route path="/pilot" element={<Protected><PilotOffer /></Protected>} />
      <Route path="/payment/success" element={<Protected><PaymentSuccess /></Protected>} />
      <Route path="/payment/cancel" element={<Protected><PaymentCancel /></Protected>} />
      <Route path="/quote/:token" element={<QuoteReview />} />
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
        <Toaster position="bottom-right" offset={96} richColors visibleToasts={2} />
      </AuthProvider>
    </BrowserRouter>
  );
}
