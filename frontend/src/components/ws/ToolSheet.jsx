import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import IntakeTask from "@/components/sheet/IntakeTask";
import ExtractPanel from "@/components/sheet/ExtractPanel";
import DraftTask from "@/components/sheet/DraftTask";
import PartnersTask from "@/components/sheet/PartnersTask";
import DecideTask from "@/components/sheet/DecideTask";
import QuotePanel from "./QuotePanel";

export const TOOL_TITLES = { details: "Job details", source: "Add source", check: "Draft plan", review: "Send for review", responses: "Responses", decide: "Review draft", quote: "Customer quote" };
const STEP_TO_TOOL = { intake: "details", draft: "check", ask: "review", decide: "decide" };

// Precise editors for every capability the old step pages held; reachable from Add, the inspector and the overflow menu.
export default function ToolSheet({ tool, onClose, onTool, sheet, act, busy, user }) {
  const props = { sheet, act, busy, user, goTo: (step) => onTool(STEP_TO_TOOL[step] || step) };
  return (
    <Sheet open={!!tool} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-[#FFFFFF] p-0 sm:max-w-[860px]" data-testid={`tool-sheet-${tool}`}>
        <div className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#FFFFFF]/95 px-5 py-3 backdrop-blur">
          <SheetTitle className="text-[15px] font-semibold text-[#1A2838]">{TOOL_TITLES[tool]}</SheetTitle>
        </div>
        <div className="px-4 py-5 sm:px-6">
          {tool === "details" && <IntakeTask key={sheet.project.rev} {...props} />}
          {tool === "source" && <ExtractPanel sheet={sheet} act={act} busy={busy} />}
          {tool === "check" && <DraftTask {...props} />}
          {(tool === "review" || tool === "responses") && <PartnersTask {...props} />}
          {tool === "decide" && <DecideTask {...props} />}
          {tool === "quote" && <QuotePanel />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
