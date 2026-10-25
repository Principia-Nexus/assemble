import { money } from "@/lib/format";

const ANSWERED = ["confirmed", "confirmed_conditional", "declined", "change_requested"];

export function openConditions(cur) {
  const fromResponses = cur.partners.filter((p) => p.response?.conditions).map((p) => ({ scope: p.name, text: p.response.conditions, source: "their response" }));
  return [...(cur.checker.open_conditions || []), ...fromResponses];
}

export const answered = (p) => ANSWERED.includes(p.status);

export function scopedResult(checker) {
  if (checker.overall === "fail") return { label: "Schedule or budget fails", tone: "declined" };
  if (checker.overall === "unknown") return { label: "Some checks can't run yet", tone: "pending" };
  return { label: "Schedule and budget fit", tone: "confirmed" };
}

export function nextStep(sheet) {
  const cur = sheet.current;
  if (sheet.preview) return { text: `Proposed changes v${sheet.preview.version.number} are open and not selected yet.`, label: "Review proposed changes", task: "decide", focus: "amendment-panel" };
  if (!sheet.intake.weeks || !sheet.intake.sites.length) return { text: "Add the job's details or read a document.", label: "Check", task: "intake" };
  if (!cur) return { text: "No candidate plan yet.", label: "Draft", task: "draft" };
  if (cur.checker.overall === "fail") return { text: `Plan v${cur.version.number} fails a check.`, label: "Repair the draft", task: "draft" };
  const noLink = cur.partners.filter((p) => !p.link);
  if (noLink.length) return { text: `${noLink.length} partner${noLink.length > 1 ? "s" : ""} ${noLink.length > 1 ? "have" : "has"} no review link yet.`, label: "Create review links", task: "ask" };
  const open = sheet.change_requests.filter((c) => c.status === "open");
  if (open.length) return { text: `${open.length} change request${open.length > 1 ? "s" : ""} waiting.`, label: "Handle change requests", task: "decide", focus: "change-requests" };
  const waiting = cur.partners.filter((p) => !answered(p));
  if (waiting.length) return { text: `Waiting on ${waiting.map((p) => p.name).join(", ")} to answer these terms.`, label: "See partner status", task: "ask" };
  if (cur.partners.some((p) => ["declined", "change_requested"].includes(p.status))) return { text: "A partner declined or asked for a change.", label: "Decide", task: "decide" };
  const n = openConditions(cur).length;
  if (n) return { text: `Every partner answered; ${n} condition${n > 1 ? "s are" : " is"} still open.`, label: "Review open conditions", task: "decide", focus: "decide-open-conditions" };
  return { text: `Every partner confirmed plan v${cur.version.number} at ${money(cur.checker.total_cents)}.`, label: "Open summary", href: "summary" };
}
