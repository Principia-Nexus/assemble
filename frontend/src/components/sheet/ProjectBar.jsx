import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { confirmLeave, setDirty } from "@/lib/dirty";

export default function ProjectBar({ projectId, rev, children }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/projects").then((r) => setRows(r.data.projects)).catch(() => {}); }, [rev]);
  const go = (to) => { if (confirmLeave()) { setDirty(false); navigate(to); } };
  return (
    <div data-testid="project-bar" className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
        <Link to="/projects" onClick={(e) => { e.preventDefault(); go("/projects"); }} data-testid="project-bar-back"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 transition-colors hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" /> Projects
        </Link>
        {rows.length > 1 && (
          <Select value={projectId} onValueChange={(v) => v !== projectId && go(`/projects/${v}`)}>
            <SelectTrigger className="h-8 w-auto max-w-[60vw] gap-2 border-slate-200 text-sm sm:max-w-xs" data-testid="project-switcher" aria-label="Switch project">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rows.map((p) => <SelectItem key={p.project_id} value={p.project_id} data-testid={`project-switcher-option-${p.project_id}`}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-1">{children}</div>
      </div>
    </div>
  );
}
