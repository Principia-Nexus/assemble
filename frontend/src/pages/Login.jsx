import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
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
  useEffect(() => {
    api.get("/auth/demo-accounts").then((r) => setDemo(r.data)).catch(() => setDemo(false));
  }, []);
  if (demo === false) return <p className="text-xs text-red-700">Demo accounts could not be loaded.</p>;
  if (!demo) return <p className="text-xs text-slate-500">Loading demo accounts…</p>;
  return (
    <div data-testid="demo-accounts-panel" className="space-y-3">
      <span className="eyebrow">Practice logins</span>
      <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
        {demo.accounts.map((a) => (
          <li key={a.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{a.firm}</p>
              <p className="truncate font-mono text-[11px] text-slate-500">{a.role} · {a.email}</p>
            </div>
            <Button size="sm" variant={a.key === "organizer" ? "default" : "outline"} disabled={busy}
              onClick={() => onUse(a.email, demo.password)} data-testid={`signin-demo-${a.key}-button`}>
              Use
            </Button>
          </li>
        ))}
      </ul>
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

  if (user) return <Navigate to={next || homeFor(user)} replace />;

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      const u = await fn();
      navigate(next || homeFor(u), { replace: true });
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E8DCC4] lg:grid lg:grid-cols-[1.1fr_1fr]">
      <section className="relative m-6 hidden flex-col justify-between border border-[#3A4A5E] bg-[#1B2838] p-12 text-[#EDE3CF] lg:flex">
        <Brand light />
        <div className="max-w-md rise">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[#C9BB9E]">One job · a few trusted partners</p>
          <h1 className="text-5xl font-normal leading-[1.02] tracking-tight text-[#EDE3CF] xl:text-6xl">
            Does this job work on the terms proposed?
          </h1>
          <p className="mt-6 text-lg font-light leading-relaxed text-[#D9CDB4]">
            Check the job, prepare a draft, ask each partner privately, then decide. An independent checker shows what fits and what does not.
          </p>
          <ol className="mt-10 space-y-3 font-mono text-xs uppercase tracking-[0.14em] text-[#C9BB9E]">
            {["Check this job", "Prepare a draft", "Ask each partner", "Decide next action"].map((t, i) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-sm border border-[#6B7B90] text-[#EDE3CF]">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs font-light text-[#B5A88E]">A confirmation covers proposal-stage terms only. It is not an award, contract or crew hold.</p>
      </section>

      <section className="mx-auto flex w-full max-w-md flex-col justify-center gap-8 px-5 py-10 sm:px-8">
        <div className="lg:hidden"><Brand /></div>
        {next?.startsWith("/review/") && (
          <p data-testid="signin-review-notice" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Sign in with the email the organizer invited to open your private review.
          </p>
        )}
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
                {busy ? "Creating…" : "Create account as organizer"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
        {error && <p data-testid="signin-error" className="-mt-4 text-sm text-red-700">{error}</p>}
        <GoogleButton next={next} />
        {tab === "signin" && <DemoAccounts busy={busy} onUse={(email, pw) => run(() => login(email, pw))} />}
      </section>
    </div>
  );
}
