import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, Inbox, LogOut, Plus } from "lucide-react";
import { api, errText, newKey } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { confirmLeave, setDirty } from "@/lib/dirty";

// Project navigation only — not a status checklist.
export default function ProjectRail({ currentId, name }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const key = useRef(newKey());
  useEffect(() => { api.get("/projects").then((r) => setProjects(r.data.projects)).catch(() => {}); }, [currentId, name]);
  const go = (id) => { if (id !== currentId && confirmLeave()) { setDirty(false); navigate(`/projects/${id}`); } };
  const create = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const { data } = await api.post("/projects", { name: title.trim(), request_key: key.current });
      key.current = newKey();
      setTitle(""); setAdding(false); setError("");
      navigate(`/projects/${data.project_id}`);
    } catch (err) { setError(errText(err)); }
  };
  return (
    <nav className="flex h-full w-[192px] flex-col border-r border-[#E2E8F0] bg-[#FFFFFF]" aria-label="Projects" data-testid="workspace-project-rail">
      <Link to="/projects" className="px-4 pb-1 pt-4 font-serif text-[22px] font-semibold tracking-tight text-[#1A2838]" data-testid="rail-wordmark">Assemble</Link>
      <p className="truncate px-4 text-[11.5px] text-[#64748B]" data-testid="rail-firm">{user?.firm_name || user?.name}</p>
      <div className="px-3 pt-4">
        {adding ? (
          <form onSubmit={create} className="space-y-1.5">
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setAdding(false)} placeholder="Project name" aria-label="Project name"
              className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#215273]" data-testid="rail-new-project-input" />
            {error && <p className="text-[11px] text-[#A93A3A]">{error}</p>}
            <div className="flex gap-1.5">
              <button type="submit" className="h-8 flex-1 rounded-lg bg-[#1A2838] text-[12.5px] font-medium text-white hover:bg-[#2F4A66]" data-testid="rail-new-project-create">Create</button>
              <button type="button" onClick={() => setAdding(false)} className="h-8 rounded-lg px-2 text-[12.5px] text-[#64748B] hover:bg-[#F1F5F9]">Cancel</button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] text-[13px] font-medium text-[#1A2838] shadow-sm transition-colors hover:bg-white" data-testid="rail-new-project-button">
            <Plus className="h-4 w-4" /> New project
          </button>
        )}
      </div>
      <p className="px-4 pb-1 pt-5 font-mono text-[10.5px] font-medium uppercase tracking-wider text-[#2F4A66]">Projects</p>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2">
        {projects.map((p) => (
          <li key={p.project_id}>
            <button type="button" onClick={() => go(p.project_id)} aria-current={p.project_id === currentId ? "page" : undefined} data-testid={`rail-project-${p.project_id}`}
              className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] leading-snug transition-colors ${p.project_id === currentId ? "bg-[#E8EEF5] font-semibold text-[#1A2838]" : "text-[#2F4A66] hover:bg-[#F1F5F9]"}`}>
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" /><span className="min-w-0 break-words">{p.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="space-y-0.5 border-t border-[#E2E8F0] p-2">
        <Link to="/reviews" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-[#2F4A66] hover:bg-[#F1F5F9]" data-testid="rail-my-reviews"><Inbox className="h-4 w-4" /> My reviews</Link>
        <Link to="/projects" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-[#2F4A66] hover:bg-[#F1F5F9]" data-testid="rail-all-projects"><CalendarDays className="h-4 w-4" /> All projects</Link>
        <button type="button" onClick={() => { if (confirmLeave()) { setDirty(false); logout(); } }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-[#2F4A66] hover:bg-[#F1F5F9]" data-testid="rail-logout">
          <LogOut className="h-4 w-4" /> <span className="min-w-0 truncate">Sign out · {user?.name}</span>
        </button>
      </div>
    </nav>
  );
}
