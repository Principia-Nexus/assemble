import { Link } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export function RouteDenied({ message }) {
  const { user } = useAuth();
  const partner = user && !user.firm_id;
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <div data-testid="sheet-load-error" role="alert" className="space-y-4 rounded-md border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-bold text-slate-900">{partner ? "This page is for the job's organizer" : "This page could not load"}</h1>
          <p className="text-sm text-slate-600">{message}</p>
          {partner && <Button asChild data-testid="route-denied-reviews-button"><Link to="/reviews">Go to my reviews</Link></Button>}
        </div>
      </main>
    </div>
  );
}
