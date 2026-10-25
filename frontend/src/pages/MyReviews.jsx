import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { StatusPill } from "@/components/StatusPill";
import { api, errText } from "@/lib/api";
import { STATUS } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

export default function MyReviews() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.get("/my-reviews").then((r) => setData(r.data.reviews)).catch((e) => setError(errText(e)));
  }, []);
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="eyebrow">Partner reviews</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Reviews shared with you</h1>
        {user?.firm_id && (
          <p className="mt-2 text-sm"><Link to="/project" className="font-semibold text-slate-900 underline" data-testid="my-reviews-project-link">Go to your own job sheet</Link></p>
        )}
        <div className="mt-8 space-y-3">
          {error && <p data-testid="my-reviews-error" className="text-sm text-red-700">{error}</p>}
          {!data && !error && <p className="text-sm text-slate-500">Loading…</p>}
          {data?.length === 0 && (
            <div data-testid="my-reviews-empty" className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No review links yet. When an organizer shares a link with you, open it and sign in with the invited email.
            </div>
          )}
          {data?.map((r) => (
            <Link key={r.token} to={r.path} data-testid={`my-review-${r.token.slice(0, 8)}`}
              className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">{r.job_name || "Untitled job"}</p>
                <p className="text-xs text-slate-500">Your part as {r.partner_name}</p>
              </div>
              <StatusPill tone={STATUS[r.status]?.tone} label={STATUS[r.status]?.label} />
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
