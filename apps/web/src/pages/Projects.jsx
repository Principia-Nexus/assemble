import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Plus } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errText, newKey, setProjectId } from "@/lib/api";
import { fmtTime, slug } from "@/lib/format";
import { Loading } from "@/App";
import { RouteDenied } from "@/components/RouteDenied";

const TONE = { Draft: "bg-slate-100 text-slate-700", "Needs information": "bg-amber-50 text-amber-800", "Awaiting partner review": "bg-sky-50 text-sky-800" };

function NewProjectDialog({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", customer: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(newKey());
  useEffect(() => { if (open) { setError(""); } }, [open]);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const { data } = await api.post("/projects", { name: f.name, customer: f.customer || null, request_key: key.current });
      navigate(`/projects/${data.project_id}`);
    } catch (err) { setError(errText(err)); setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="new-project-dialog" className="sm:max-w-md">
        <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="np-name" className="text-xs font-semibold text-slate-700">Project name</Label>
            <Input id="np-name" autoFocus required maxLength={200} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="new-project-name-input" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-cust" className="text-xs font-semibold text-slate-700">Customer <span className="font-normal text-slate-500">(optional)</span></Label>
            <Input id="np-cust" maxLength={200} value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} data-testid="new-project-customer-input" />
          </div>
          {error && <p role="alert" data-testid="new-project-error" className="text-sm text-red-700">{error}</p>}
          <DialogFooter>
            <Button type="submit" className="w-full sm:w-auto" disabled={busy || !f.name.trim()} data-testid="new-project-submit-button">
              {busy ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectRow({ p }) {
  const navigate = useNavigate();
  return (
    <li>
      <button type="button" onClick={() => navigate(`/projects/${p.project_id}`)} data-testid={`project-row-${slug(p.name)}`}
        className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
            {p.name}
          </p>
          <p className="mt-0.5 truncate text-sm text-slate-500">{p.customer || "Customer not set"}</p>
        </div>
        <span data-testid={`project-status-${slug(p.name)}`} className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline ${TONE[p.status]}`}>{p.status}</span>
        <span className="hidden w-48 shrink-0 text-right text-xs text-slate-500 md:inline">Edited {fmtTime(p.updated_at)}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
      </button>
      <p className="-mt-2 px-5 pb-3 text-xs text-slate-500 sm:hidden">{p.status} · Edited {fmtTime(p.updated_at)}</p>
    </li>
  );
}

export default function Projects() {
  setProjectId(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    api.get("/projects").then((r) => setRows(r.data.projects)).catch((e) => {
      if (e.response?.status === 402) { window.location.replace("/pilot"); return; }
      setError(errText(e));
    });
  }, []);
  if (error) return <RouteDenied message={error} />;
  if (!rows) return <Loading label="Loading projects" />;
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-10 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <h1 data-testid="projects-title" className="text-3xl font-bold tracking-tight text-slate-900">Projects</h1>
          <Button onClick={() => setOpen(true)} data-testid="new-project-button"><Plus className="h-4 w-4" /> New project</Button>
        </div>
        {rows.length ? (
          <ul data-testid="projects-list" className="stagger mt-6 divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
            {rows.map((p) => <ProjectRow key={p.project_id} p={p} />)}
          </ul>
        ) : (
          <p data-testid="projects-empty" className="mt-6 rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">No projects yet.</p>
        )}
      </main>
      <NewProjectDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
