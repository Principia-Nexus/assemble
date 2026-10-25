import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Sparkles } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { api, errList } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loading } from "@/App";
import Stepper, { stepInfo } from "@/components/sheet/Stepper";
import IntakeTask from "@/components/sheet/IntakeTask";
import DraftTask from "@/components/sheet/DraftTask";
import PartnersTask from "@/components/sheet/PartnersTask";
import DecideTask from "@/components/sheet/DecideTask";
import HistoryDrawer from "@/components/sheet/HistoryDrawer";
import DemoTour from "@/components/sheet/DemoTour";
import PlanStrip from "@/components/sheet/PlanStrip";
import { clearDemoContent } from "@/lib/demoContent";
import { RouteDenied } from "@/components/RouteDenied";
import { Navigate } from "react-router-dom";
import { confirmLeave } from "@/lib/dirty";

export default function ProjectSheet() {
  const { user } = useAuth();
  const [sheet, setSheet] = useState(undefined);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);

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
  useEffect(() => {
    // Stop files dropped outside the read form from navigating away from the app.
    const stop = (e) => { if (!e.target.closest?.('[data-testid="read-document-form"]')) e.preventDefault(); };
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => { window.removeEventListener("dragover", stop); window.removeEventListener("drop", stop); };
  }, []);

  // Runs a mutation; returns error list (empty on success). Stale saves reload the sheet.
  const act = useCallback(async (method, url, body, okMsg) => {
    setBusy(true);
    try {
      const { data } = await api[method](url, body);
      if (data.sheet) setSheet(data.sheet);
      if (okMsg) toast.success(okMsg);
      return { ok: true, data };
    } catch (e) {
      const errs = errList(e);
      if (e.response?.status === 409) {
        toast.error(errs.join(" "));
        await load();
      } else if (e.response?.status !== 422) toast.error(errs.join(" "));
      return { ok: false, errors: errs };
    } finally {
      setBusy(false);
    }
  }, [load]);

  const info = useMemo(() => (sheet ? stepInfo(sheet) : null), [sheet]);
  const stepKey = sheet ? `assemble_step_${sheet.project.project_id}` : null;
  useEffect(() => { if (info && !selected) setSelected(sessionStorage.getItem(stepKey) || info.current); }, [info, selected, stepKey]);
  useEffect(() => { if (selected && stepKey) sessionStorage.setItem(stepKey, selected); }, [selected, stepKey]);

  if (loadError) return <RouteDenied message={loadError} />;
  if (sheet === undefined) return <Loading label="Loading your job sheet" />;
  if (!sheet) return <Navigate to="/projects" replace />;

  const select = (k) => { if (k === selected || confirmLeave()) setSelected(k); };
  const isCanon = sheet.project.synthetic && !!sheet.project.fixture_id;
  const reset = async () => { clearDemoContent(); await act("post", "/project/demo-reset", {}, "Example reset"); };

  const props = { sheet, act, busy, goTo: select, user };

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader onHistory={sheet ? () => setHistoryOpen(true) : null} />
      <main className={`mx-auto max-w-6xl px-4 pt-8 sm:px-6 ${tourOpen && isCanon ? "pb-80 sm:pb-64" : "pb-24"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 data-testid="project-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {sheet.intake.job_name || sheet.project.name}
            </h1>
            {sheet.intake.customer_name && <p data-testid="project-customer" className="mt-1 text-sm text-slate-500">{sheet.intake.customer_name}</p>}
          </div>
          <div className="no-print flex items-center gap-1">
        {isCanon && (
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setTourOpen(true)} data-testid="demo-tour-open">
            <Sparkles className="h-3.5 w-3.5" /> Guided tour
          </Button>
        )}
        {sheet.project.synthetic && user?.demo_key === "organizer" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7" disabled={busy} data-testid="demo-reset-button">
                <RotateCcw className="h-3.5 w-3.5" /> Reset this example
              </Button>
            </AlertDialogTrigger>
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
        )}
          </div>
        </div>
        <PlanStrip sheet={sheet} goTo={select} />
        <Stepper info={info} selected={selected} onSelect={select} />
        <div key={selected} className="rise mt-6">
          {selected === "intake" && <IntakeTask key={sheet.project.rev} {...props} />}
          {selected === "draft" && <DraftTask {...props} />}
          {selected === "ask" && <PartnersTask {...props} />}
          {selected === "decide" && <DecideTask {...props} />}
        </div>
      </main>
      <HistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} rev={sheet.project.rev} />
      {isCanon && tourOpen && (
        <DemoTour sheet={sheet} act={act} busy={busy} goTo={setSelected} onClose={() => { setTourOpen(false); localStorage.setItem("assemble_tour_closed", "1"); }} />
      )}
    </div>
  );
}
