import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api, errText } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const RETURN = "assemble_review_return";

async function demoAccount(match) {
  const { data } = await api.get("/auth/demo-accounts");
  return { acc: data.accounts.find(match), password: data.password };
}

// Example projects only: sign in as that firm's demo account, open its review, and switch back afterwards.
export function ReviewAsPartner({ sheet, owner }) {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const st = (sheet.current?.partners || []).find((x) => x.partner_id === owner);
  if (!sheet.project.synthetic || user?.demo_key !== "organizer" || !st?.link?.path) return null;
  const go = async () => {
    try {
      const { acc, password } = await demoAccount((a) => a.email === st.link.invite_email);
      if (!acc) { toast.error("No example account for this firm."); return; }
      sessionStorage.setItem(RETURN, window.location.pathname);
      await login(acc.email, password);
      navigate(st.link.path);
    } catch (e) { toast.error(errText(e)); }
  };
  return <Button size="sm" variant="outline" className="w-full bg-white" onClick={go} data-testid="inspector-review-as-partner">Review as partner</Button>;
}

export function BackToOrganizer() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const back = sessionStorage.getItem(RETURN);
  if (!back || !user || user.demo_key === "organizer") return null;
  const go = async () => {
    try {
      const { acc, password } = await demoAccount((a) => a.key === "organizer");
      await login(acc.email, password);
      sessionStorage.removeItem(RETURN);
      navigate(back);
    } catch (e) { toast.error(errText(e)); }
  };
  return <Button size="sm" variant="outline" onClick={go} data-testid="review-back-to-organizer">Back to organizer</Button>;
}
