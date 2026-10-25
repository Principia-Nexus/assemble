import { Link } from "react-router-dom";
import { History, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export function Brand({ light = false }) {
  return (
    <Link to="/" data-testid="brand-home-link" className={`text-2xl font-medium tracking-tight sm:text-[28px] ${light ? "text-[#FFFFFF]" : "text-[#0E5E8C]"}`}>
      Assemble
    </Link>
  );
}

export default function AppHeader({ onHistory }) {
  const { user, logout } = useAuth();
  return (
    <header className="no-print sticky top-0 z-30 border-b border-[#E5E7EB] bg-[#FFFFFF]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Brand />
        <div className="flex items-center gap-1 sm:gap-2">
          <span data-testid="header-user-name" className="hidden text-xs text-slate-500 md:inline">
            {user?.firm_name || user?.name}
          </span>
          {onHistory && (
            <Button variant="ghost" size="sm" onClick={onHistory} data-testid="history-drawer-trigger">
              <History className="h-4 w-4" /> <span className="hidden sm:inline">History</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild data-testid="header-my-reviews-link">
            <Link to="/reviews"><Inbox className="h-4 w-4" /> <span className="hidden sm:inline">My reviews</span></Link>
          </Button>
          <Button variant="outline" size="sm" onClick={logout} data-testid="header-logout-button"
            className="rounded-none border-[#0E5E8C] bg-transparent font-mono text-[11px] uppercase tracking-[0.16em] text-[#0E5E8C] hover:bg-[#0E5E8C] hover:text-[#FFFFFF]">
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
