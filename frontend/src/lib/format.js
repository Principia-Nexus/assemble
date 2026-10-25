const TZ = "America/Los_Angeles";

export function money(c) {
  if (c == null) return "Unknown";
  const neg = c < 0;
  const s = (Math.abs(c) / 100).toLocaleString("en-US", {
    minimumFractionDigits: Math.abs(c) % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${neg ? "-" : ""}$${s}`;
}

export function fmtDate(iso) {
  if (!iso) return "Unknown";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return d.toLocaleDateString("en-US", { timeZone: iso.length === 10 ? "UTC" : TZ, month: "short", day: "numeric", year: "numeric" });
}

export function fmtTime(iso, withYear = false) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), hour: "numeric", minute: "2-digit" }) + " PT";
}

export const c2s = (c) => (c == null ? "" : c % 100 ? (c / 100).toFixed(2) : String(c / 100));
export const n2s = (n) => (n == null ? "" : String(n));

export const STATUS = {
  no_link: { label: "No review link yet", tone: "unknown" },
  link_not_shared: { label: "Link created, not marked as shared", tone: "unknown" },
  awaiting: { label: "Awaiting response (no response is not agreement)", tone: "pending" },
  needs_rereview: { label: "Terms changed: must review again", tone: "pending" },
  confirmed: { label: "Confirmed proposed terms", tone: "confirmed" },
  confirmed_conditional: { label: "Confirmed with conditions", tone: "pending" },
  change_requested: { label: "Change requested", tone: "pending" },
  declined: { label: "Declined", tone: "declined" },
  expired: { label: "Terms expired: recheck needed", tone: "declined" },
  removed: { label: "No sites in the current plan", tone: "unknown" },
};

export const CHECK = {
  pass: { label: "Pass", tone: "confirmed" },
  fail: { label: "Fail", tone: "declined" },
  unknown: { label: "Unknown", tone: "unknown" },
};

export const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
