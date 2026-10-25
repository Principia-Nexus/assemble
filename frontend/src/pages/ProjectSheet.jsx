import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { MoreHorizontal, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { api, errList } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loading } from "@/App";
import { RouteDenied } from "@/components/RouteDenied";
import HistoryDrawer from "@/components/sheet/HistoryDrawer";
import { clearDemoContent } from "@/lib/demoContent";
import { useItems } from "@/components/ws/useItems";
import { conditions, firmName, matches, packages, statusSentence } from "@/components/ws/derive";
import AppHeader from "@/components/AppHeader";
import GraphView from "@/components/ws/GraphView";
import ListView from "@/components/ws/ListView";
import WeekView from "@/components/ws/WeekView";
import ReportView from "@/components/ws/ReportView";
import Inspector from "@/components/ws/Inspector";
import Composer from "@/components/ws/Composer";
import ToolSheet from "@/components/ws/ToolSheet";

const VIEWS = ["graph", "list", "week", "report"];
const NEW_TITLE = { group: "New group", task: "New task", milestone: "New milestone", condition: "New question" };
const useWidth = () => {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return w;
};
const WAITING = ["awaiting", "link_not_shared", "no_link", "needs_rereview", "expired", "change_requested", "declined"];
// One state-driven action: Draft plan -> Review draft -> Send for review -> Awaiting <firm> -> Customer quote.
function primaryAction(sheet) {
  if (!sheet.current && !sheet.preview) return { label: "Draft plan", tool: "check" };
  if (sheet.preview) return { label: "Review draft", tool: "decide" };
  const ps = sheet.current.partners || [];
  if (ps.some((x) => ["no_link", "link_not_shared", "needs_rereview"].includes(x.status))) return { label: "Send for review", tool: "review" };
  const wait = ps.filter((x) => WAITING.includes(x.status));
  if (wait.length) return { label: `Awaiting ${wait[0].name.replace(/ ?\(Synthetic\)/, "").split(" ")[0]}${wait.length > 1 ? ` +${wait.length - 1}` : ""}`, tool: "responses" };
  return { label: "Customer quote", tool: "quote" };
}
const typing = (el) => !!el?.closest?.("input,textarea,select,[contenteditable=true]");

export default function ProjectSheet() {
  const { user } = useAuth();
  const width = useWidth();
  const [sheet, setSheet] = useState(undefined);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [q, setQ] = useState("");
  const [view, setViewState] = useState(null);
  const search = useRef(null), composer = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/project");
      setSheet(data.sheet);
      setLoadError("");
    } catch (e) {
      if (e.response?.status === 402) { window.location.replace("/pilot"); return; }
      setLoadError(errList(e).join(" "));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = useCallback(async (method, url, body, okMsg) => {
    setBusy(true);
    try {
      const { data } = await api[method](url, body);
      if (data.sheet) setSheet(data.sheet);
      if (okMsg) toast.success(okMsg);
      return { ok: true, data };
    } catch (e) {
      const errs = errList(e);
      if (e.response?.status === 409) { if (url !== "/project/intake") toast.error(errs.join(" ")); await load(); }
      else if (e.response?.status !== 422) toast.error(errs.join(" "));
      return { ok: false, errors: errs };
    } finally { setBusy(false); }
  }, [load]);

  const rev = sheet?.project.rev;
  const { items, edges, save, run, undo, adopt, reload } = useItems(rev, load);
  const pid = sheet?.project.project_id;
  useEffect(() => { if (pid && !view) setViewState("graph"); }, [pid, view]);
  const setView = setViewState;

  const pkgs = useMemo(() => (sheet ? packages(sheet) : []), [sheet]);
  const conds = useMemo(() => (sheet ? conditions(sheet) : []), [sheet]);
  const hot = useMemo(() => new Set(), []);
  const filter = useCallback((x) => matches(q, x.title, x.notes, x.result, x.scope, sheet && firmName(sheet, x.firm_id || x.owner),
    ...(x.site_ids || []), ...(x.sites || []).flatMap((s) => [s.site_id, s.name])), [q, sheet]);

  useEffect(() => {
    const key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); search.current?.focus(); return; }
      if (e.key === "/" && !typing(e.target)) { e.preventDefault(); composer.current?.openMenu(); return; }
      if (e.key === "Escape" && !tool && !historyOpen) {
        if (selectedId) setSelectedId(null);
        else if (composer.current?.isOpen()) composer.current.close();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selectedId, tool, historyOpen]);

  if (loadError) return <RouteDenied message={loadError} />;
  if (sheet === undefined || !view) return <Loading label="Loading your project" />;
  if (!sheet) return <Navigate to="/projects" replace />;

  const narrow = width < 720;
  const target = selectedId && (items.find((i) => i.item_id === selectedId) || pkgs.find((p) => p.id === selectedId) || conds.find((c) => c.id === selectedId));
  const onAdd = async (k) => {
    if (!k.startsWith("item:")) { setTool(k); return; }
    const kind = k.slice(5);
    const r = await run([{ op: "create", kind, fields: { title: NEW_TITLE[kind] } }], `Added ${NEW_TITLE[kind].toLowerCase()}`);
    if (r.ok) setSelectedId(r.batch.touched[0]); else toast.error(r.errors.join(" "));
  };
  const runOps = async (ops, summary) => { const r = await run(ops, summary); if (!r.ok) toast.error(r.errors.join(" ")); return r; };
  const doUndo = async (batchId) => { const r = await undo(batchId); if (r.ok) toast.success("Undone"); else toast.error(r.errors.join(" ")); return r; };
  const stale = async () => { const { data } = await api.get("/project"); setSheet(data.sheet); reload().catch(() => {}); return data.sheet.project.rev; };
  const primary = primaryAction(sheet);
  const suggestions = items.length ? ["What's still open?", "Summarize the plan"] : ["Organize this job into scope groups", conds.length ? "What's still open?" : "Summarize the plan"];
  const saveText = { saving: "Saving…", saved: "Saved", failed: "Not saved" }[save] || (busy ? "Saving…" : "");
  const reset = async () => { clearDemoContent(); await act("post", "/project/demo-reset", {}, "Example reset"); };
  const viewProps = { sheet, items, pkgs, conds, onSelect: setSelectedId, selectedId, hot, filter };

  return (
    <div className="ws flex h-[100dvh] flex-col overflow-hidden bg-slate-50 text-slate-900" data-testid="workspace">
      <div className="no-print shrink-0"><AppHeader onHistory={() => setHistoryOpen(true)} /></div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="no-print border-b border-slate-200 bg-white" data-testid="workspace-header">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setTool("details")} className="group flex items-center gap-2 text-left" aria-label="Edit job details" data-testid="project-title-edit">
                  <h1 data-testid="project-title" className="break-words text-[22px] font-bold sm:text-[26px] leading-tight tracking-tight text-slate-900">{sheet.intake.job_name || sheet.project.name}</h1>
                  <Pencil className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-slate-700" />
                </button>
                {saveText && <span data-testid="save-state" aria-live="polite" className={`text-xs ${save === "failed" ? "text-red-700" : "text-slate-500"}`}>{saveText}</span>}
              </div>
              <p data-testid="status-sentence" className="mt-0.5 text-sm text-slate-500">{[sheet.intake.customer_name, statusSentence(sheet)].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2" data-testid="workspace-toolbar">
              <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5" role="tablist" aria-label="Views">
                {VIEWS.map((v) => (
                  <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} data-testid={`toolbar-view-${v}`}
                    className={`rounded px-3 py-1 text-[13px] font-semibold capitalize transition-colors ${view === v ? "bg-[#1A2838] text-white" : "text-slate-600 hover:text-slate-900"}`}>{v === "week" ? "calendar" : v}</button>
                ))}
              </div>
              <label className="order-last flex h-8 w-full items-center sm:order-none sm:w-[200px] gap-2 rounded-md border border-slate-200 bg-white px-2.5">
                <Search className="h-3.5 w-3.5 text-slate-500" /><span className="sr-only">Search this project</span>
                <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setQ("")} placeholder="Filter" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" data-testid="toolbar-search" />
                {q && <button type="button" onClick={() => setQ("")} className="text-[11px] text-[#215273]" data-testid="toolbar-search-clear">Clear</button>}
              </label>
              <Button size="sm" className="h-8 bg-[#1A2838] transition-[background-color,transform] hover:bg-[#2F4A66] active:scale-[.97]" onClick={() => setTool(primary.tool)} data-testid="primary-action">{primary.label}</Button>
              {primary.tool !== "quote" && (sheet.current || sheet.preview) && <Button size="sm" variant="outline" className="h-8 transition-colors" onClick={() => setTool("quote")} data-testid="open-quote">Quote</Button>}
              {sheet.project.synthetic && user?.demo_key === "organizer" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="outline" className="h-8 w-8" aria-label="More" data-testid="header-overflow"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onSelect={() => setResetOpen(true)} data-testid="demo-reset-button">Reset this example</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          {q && conds.length > 0 && <p className="mx-auto max-w-[1440px] px-4 pb-2 sm:px-6 text-xs text-amber-800" data-testid="filter-conditions-note">{conds.length} open condition{conds.length === 1 ? "" : "s"} in this project</p>}
        </div>
        <div className="relative flex min-h-0 flex-1">
          <main key={view} className="ws-view-in min-w-0 flex-1" data-testid={`view-${view}`}>
            {view === "graph" && <GraphView {...viewProps} edges={edges} focus={hot.size ? hot : null} run={runOps} layout={sheet.project.layout} />}
            {view === "list" && <ListView {...viewProps} run={runOps} />}
            {view === "week" && <WeekView {...viewProps} />}
            {view === "report" && <ReportView {...viewProps} />}
          </main>
          {target && (
            <div className={narrow ? "fixed inset-0 z-40" : "no-print shrink-0"}>
              <Inspector target={target} sheet={sheet} items={items} edges={edges} run={run} onClose={() => setSelectedId(null)} openTool={setTool} />
            </div>
          )}
          <div className="no-print pointer-events-none absolute bottom-0 left-0 z-20" style={{ right: target && !narrow ? 360 : 0 }}>
            <Composer ref={composer} sheet={sheet} onSheet={setSheet} onAdopt={(b) => adopt(b)} onUndo={doUndo} onAdd={onAdd} suggestions={suggestions} onStale={stale} />
          </div>
        </div>
      </div>
      <ToolSheet tool={tool} onClose={() => setTool(null)} onTool={setTool} sheet={sheet} act={act} busy={busy} user={user} />
      <HistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} rev={sheet.project.rev} />
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset this example?</AlertDialogTitle>
            <AlertDialogDescription>Only this example returns to its starting point. Your other projects are not changed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="demo-reset-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={reset} data-testid="demo-reset-confirm">Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
