import { X } from "lucide-react";
import QualPanel from "@/components/sheet/QualPanel";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import IntakeTask from "@/components/sheet/IntakeTask";
import ExtractPanel from "@/components/sheet/ExtractPanel";
import DraftTask from "@/components/sheet/DraftTask";
import PartnersTask from "@/components/sheet/PartnersTask";
import DecideTask from "@/components/sheet/DecideTask";
import QuotePanel from "./QuotePanel";

export const TOOL_TITLES = { details: "Job details", source: "Add source", check: "Draft plan", review: "Send for review", responses: "Responses", decide: "Review draft", quote: "Customer quote", qualify: "Requirements and evidence" };
const STEP_TO_TOOL = { intake: "details", draft: "check", ask: "review", decide: "decide" };

// Precise editors for every capability the old step pages held; reachable from Add, the inspector and the overflow menu.
export default function ToolSheet({ tool, onClose, onTool, sheet, act, busy, user }) {
  const props = { sheet, act, busy, user, goTo: (step) => onTool(STEP_TO_TOOL[step] || step) };
  return (
    <Sheet open={!!tool} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-[#FFFFFF] p-0 sm:max-w-[860px] [&>button.absolute]:hidden" data-testid={`tool-sheet-${tool}`}>
        <div className="sticky top-0 z-10 flex items-center border-b border-[#E2E8F0] bg-[#FFFFFF]/95 px-5 py-3 backdrop-blur">
          <SheetTitle className="text-[15px] font-semibold text-[#1A2838]">{TOOL_TITLES[tool]}</SheetTitle>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded-md p-1.5 text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#1A2838] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#215273]" data-testid="tool-sheet-close"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-4 py-5 sm:px-6">
          {tool === "details" && <IntakeTask key={sheet.project.project_id} {...props} />}
          {tool === "source" && <ExtractPanel sheet={sheet} act={act} busy={busy} />}
          {tool === "check" && <DraftTask {...props} />}
          {tool === "qualify" && <QualPanel sheet={sheet} act={act} busy={busy} />}
          {(tool === "review" || tool === "responses") && <PartnersTask {...props} />}
          {tool === "decide" && <DecideTask {...props} />}
          {tool === "quote" && <QuotePanel />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
