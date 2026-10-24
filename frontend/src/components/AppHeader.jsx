import { Link } from "react-router-dom";
import { LogOut, History, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export function Brand() {
  return (
    <Link to="/" data-testid="brand-home-link" className="flex items-baseline gap-2">
      <span className="text-lg font-extrabold tracking-tight text-slate-900">Assemble</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">powered by Fabric</span>
    </Link>
  );
}

export default function AppHeader({ onHistory }) {
  const { user, logout } = useAuth();
  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Brand />
        <div className="flex items-center gap-1 sm:gap-2">
          <span data-testid="header-user-name" className="hidden text-xs text-slate-500 md:inline">
            {user?.name} · {user?.firm_name}
          </span>
          {onHistory && (
            <Button variant="ghost" size="sm" onClick={onHistory} data-testid="history-drawer-trigger">
              <History className="h-4 w-4" /> <span className="hidden sm:inline">History</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild data-testid="header-my-reviews-link">
            <Link to="/reviews"><Inbox className="h-4 w-4" /> <span className="hidden sm:inline">My reviews</span></Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={logout} data-testid="header-logout-button">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
