import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errText } from "@/lib/api";
import { fmtTime } from "@/lib/format";

// Recipient and message are built on the server; the organizer previews and deliberately sends.
export default function EmailInvite({ p, act, busy, id, onCopy }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const start = async () => {
    setOpen(true); setPreview(null); setError("");
    try { const { data } = await api.post(`/project/links/${p.link.token}/email-preview`); setPreview(data); }
    catch (e) { setError(errText(e)); }
  };
  const send = async () => {
    setSending(true);
    const r = await act("post", `/project/links/${p.link.token}/email-send`, {}, `Invitation emailed to ${preview.to}`);
    setSending(false);
    if (r.ok) setOpen(false); else setError(r.errors.join(" "));
  };
  return (
    <>
      <Button size="sm" variant="outline" disabled={busy} onClick={start} data-testid={`partner-card-email-${id}`}>
        <Mail className="h-4 w-4" /> {p.link.emailed_at ? "Email again" : "Email invitation"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="email-invite-dialog" className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Email the review invitation</DialogTitle></DialogHeader>
          {!preview && !error && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Preparing preview…</p>}
          {preview && (
            <div className="space-y-3 text-sm">
              <p><span className="text-slate-500">To </span><span data-testid="email-invite-to" className="break-all font-mono">{preview.to}</span></p>
              <p><span className="text-slate-500">Subject </span><span data-testid="email-invite-subject">{preview.subject}</span></p>
              <p data-testid="email-invite-body" className="rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-700">{preview.text}</p>
              {preview.emailed_at && <p className="text-xs text-slate-500">Last emailed {fmtTime(preview.emailed_at)}.</p>}
              {!preview.sendable && <p data-testid="email-invite-blocked" className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{preview.reason}</p>}
            </div>
          )}
          {error && <p role="alert" data-testid="email-invite-error" className="text-sm text-red-700">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="email-invite-cancel">Cancel</Button>
            {preview && !preview.sendable ? (
              <Button onClick={() => { onCopy(); setOpen(false); }} data-testid="email-invite-copy">Copy link instead</Button>
            ) : (
              <Button disabled={!preview?.sendable || sending} onClick={send} data-testid="email-invite-send">{sending ? "Sending…" : "Send email"}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
