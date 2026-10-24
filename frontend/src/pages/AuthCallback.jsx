import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, errText } from "@/lib/api";
import { useAuth, homeFor } from "@/context/AuthContext";
import { toast } from "sonner";

export default function AuthCallback() {
  const { setUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const sid = new URLSearchParams(location.hash.slice(1)).get("session_id");
    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id: sid });
        setUser(data);
        const next = sessionStorage.getItem("assemble_next");
        sessionStorage.removeItem("assemble_next");
        navigate(next || homeFor(data), { replace: true });
      } catch (e) {
        toast.error(errText(e));
        setUser(false);
        navigate("/login", { replace: true });
      }
    })();
  }, [location.hash, navigate, setUser]);

  return null;
}
