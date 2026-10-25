import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Sparkles } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { StatusPill } from "@/components/StatusPill";
import { api, errList } from "@/lib/api";
import { OVERALL } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { Loading } from "@/App";
import Stepper, { stepInfo } from "@/components/sheet/Stepper";
import CreateProject from "@/components/sheet/CreateProject";
import IntakeTask from "@/components/sheet/IntakeTask";
import DraftTask from "@/components/sheet/DraftTask";
import PartnersTask from "@/components/sheet/PartnersTask";
import DecideTask from "@/components/sheet/DecideTask";
import HistoryDrawer from "@/components/sheet/HistoryDrawer";
import DemoTour from "@/components/sheet/DemoTour";
import { clearDemoContent } from "@/lib/demoContent";
import { RouteDenied } from "@/components/RouteDenied";

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
  useEffect(() => { if (info && !selected) setSelected(info.current); }, [info, selected]);

  if (loadError) return <RouteDenied message={loadError} />;
  if (sheet === undefined) return <Loading label="Loading your job sheet" />;

  const reset = async () => { clearDemoContent(); await act("post", "/project/demo-reset", {}, "Demo copy reset"); };

  const props = { sheet, act, busy, goTo: setSelected, user };
  const overall = sheet?.current?.checker?.overall;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader onHistory={sheet ? () => setHistoryOpen(true) : null} />
      {sheet?.project.synthetic && (
        <div data-testid="demo-toolbar" className="no-print">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2 px-4 pt-3 sm:px-6">
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setTourOpen(true)} data-testid="demo-tour-open">
                <Sparkles className="h-3.5 w-3.5" /> Guided tour
              </Button>
            {user?.demo_key === "organizer" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7" disabled={busy} data-testid="demo-reset-button">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset my demo copy
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset your demo copy?</AlertDialogTitle>
                    <AlertDialogDescription>Your job, links and responses return to the starting point. Other visitors are not affected.</AlertDialogDescription>
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
        </div>
      )}
      <main className={`mx-auto max-w-6xl px-4 pt-8 sm:px-6 ${tourOpen && sheet?.project.synthetic ? "pb-80 sm:pb-64" : "pb-24"}`}>
        {!sheet ? (
          <CreateProject act={act} busy={busy} />
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 data-testid="project-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {sheet.intake.job_name || sheet.project.name}
                </h1>
              </div>
              {sheet.current && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <StatusPill testId="project-overall-status" tone={OVERALL[overall].tone} label={OVERALL[overall].label} />
                </div>
              )}
            </div>
            <Stepper info={info} selected={selected} onSelect={setSelected} />
            <div key={selected} className="rise mt-6">
              {selected === "intake" && <IntakeTask key={sheet.project.rev} {...props} />}
              {selected === "draft" && <DraftTask {...props} />}
              {selected === "ask" && <PartnersTask {...props} />}
              {selected === "decide" && <DecideTask {...props} />}
            </div>
          </>
        )}
      </main>
      {sheet && <HistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} rev={sheet.project.rev} />}
      {sheet?.project.synthetic && tourOpen && (
        <DemoTour sheet={sheet} act={act} busy={busy} goTo={setSelected} onClose={() => { setTourOpen(false); localStorage.setItem("assemble_tour_closed", "1"); }} />
      )}
    </div>
  );
}
