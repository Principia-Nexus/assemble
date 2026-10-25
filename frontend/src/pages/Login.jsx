import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errText } from "@/lib/api";
import { useAuth, homeFor } from "@/context/AuthContext";
import { Brand } from "@/components/AppHeader";

function GoogleButton({ next }) {
  const go = () => {
    sessionStorage.setItem("assemble_next", next || "");
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/project";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  return (
    <Button type="button" variant="outline" className="w-full h-11" onClick={go} data-testid="signin-google-button">
      Continue with Google
    </Button>
  );
}

function Field({ id, label, ...props }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-slate-700">{label}</Label>
      <Input id={id} className="h-10" {...props} />
    </div>
  );
}

function DemoAccounts({ onUse, busy }) {
  const [demo, setDemo] = useState(null);
  const [showPartners, setShowPartners] = useState(false);
  useEffect(() => {
    api.get("/auth/demo-accounts").then((r) => setDemo(r.data)).catch(() => setDemo(false));
  }, []);
  if (demo === false) return <p className="text-xs text-red-700">Demo accounts could not be loaded.</p>;
  if (!demo) return <p className="text-xs text-slate-500">Loading the example…</p>;
  const org = demo.accounts.find((a) => a.key === "organizer");
  const partners = demo.accounts.filter((a) => a.key !== "organizer");
  return (
    <div data-testid="demo-accounts-panel" className="space-y-3">
      {org && (
        <Button className="h-14 w-full flex-col gap-0 text-base" disabled={busy} onClick={() => onUse(org.email, demo.password)} data-testid="signin-demo-organizer-button">
          Try the example
          <span className="text-[11px] font-normal opacity-80">Synthetic example · organizer view</span>
        </Button>
      )}
      <div className="overflow-hidden rounded-md border border-slate-300 bg-white">
        <button type="button" className="flex h-11 w-full items-center justify-center gap-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50" onClick={() => setShowPartners(!showPartners)} aria-expanded={showPartners} data-testid="signin-review-as-partner-toggle">
          Review as a partner
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showPartners ? "rotate-180" : ""}`} />
        </button>
        {showPartners && (
          <ul data-testid="signin-partner-list" className="divide-y divide-slate-200 border-t border-slate-200">
            {partners.map((a) => (
              <li key={a.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{a.firm}</p>
                  <p className="truncate font-mono text-[11px] text-slate-500">{a.role} · {a.email}</p>
                </div>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onUse(a.email, demo.password)} data-testid={`signin-demo-${a.key}-button`} aria-label={`Sign in as ${a.firm}`}>
                  Use
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Login() {
  const { user, login, register } = useAuth();
  const [params] = useSearchParams();
  const next = params.get("next");
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", name: "", firm_name: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("signin");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const fits = (u) => {
    if (!next) return false;
    if (next.startsWith("/review/")) return true;
    if (next.startsWith("/project") || next.startsWith("/summary")) return !!u?.firm_id;
    if (next.startsWith("/reviews")) return !u?.firm_id;
    return true;
  };
  const dest = (u) => (fits(u) ? next : homeFor(u));

  if (user) return <Navigate to={dest(user)} replace />;

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      const u = await fn();
      navigate(dest(u), { replace: true });
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E8DCC4]">
      <section className="flex w-full max-w-md flex-col justify-center gap-8 px-5 py-10 sm:px-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Brand />
        </div>
        {next?.startsWith("/review/") && (
          <p data-testid="signin-review-notice" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Sign in with the email the organizer invited to open your private review.
          </p>
        )}
        {tab === "signin" && <DemoAccounts busy={busy} onUse={(email, pw) => run(() => login(email, pw))} />}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin" data-testid="signin-tab">Sign in</TabsTrigger>
            <TabsTrigger value="register" data-testid="register-tab">Create account</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => login(form.email, form.password)); }}>
              <Field id="email" label="Email" type="email" value={form.email} onChange={set("email")} required data-testid="login-email-input" />
              <Field id="password" label="Password" type="password" value={form.password} onChange={set("password")} required data-testid="login-password-input" />
              <Button type="submit" className="h-11 w-full" disabled={busy} data-testid="login-submit-button">
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => register(form)); }}>
              <Field id="name" label="Your name" value={form.name} onChange={set("name")} required data-testid="register-name-input" />
              <Field id="firm" label="Firm name" value={form.firm_name} onChange={set("firm_name")} required data-testid="register-firm-input" />
              <Field id="remail" label="Email" type="email" value={form.email} onChange={set("email")} required data-testid="register-email-input" />
              <Field id="rpassword" label="Password (8+ characters)" type="password" value={form.password} onChange={set("password")} required data-testid="register-password-input" />
              <Button type="submit" className="h-11 w-full" disabled={busy} data-testid="register-submit-button">
                {busy ? "Creating…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
        {error && <p data-testid="signin-error" className="-mt-4 text-sm text-red-700">{error}</p>}
        <GoogleButton next={next} />
      </section>
    </div>
  );
}
