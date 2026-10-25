import { Link } from "react-router-dom";
import { FolderOpen, History, Inbox, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { confirmLeave, setDirty } from "@/lib/dirty";

export function Brand({ light = false, large = false }) {
  const guard = (e) => { if (!confirmLeave()) e.preventDefault(); else setDirty(false); };
  return (
    <Link to="/" onClick={guard} data-testid="brand-home-link" className={`font-semibold tracking-tight ${large ? "text-5xl sm:text-6xl lg:text-7xl" : "text-2xl sm:text-[28px]"} ${light ? "text-[#FFFFFF]" : "text-[#1A2838]"}`}>
      Assemble
    </Link>
  );
}

export default function AppHeader({ onHistory }) {
  const { user, logout } = useAuth();
  const guard = (e) => { if (!confirmLeave()) e.preventDefault(); else setDirty(false); };
  return (
    <header className="no-print sticky top-0 z-30 border-b border-[#E5E7EB] bg-[#FFFFFF]">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Brand />
          <span data-testid="header-user-name" className="hidden truncate border-l border-slate-300 pl-3 text-sm leading-5 text-slate-500 md:inline">
            {user?.firm_name || user?.name}
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {onHistory && (
            <Button variant="ghost" size="sm" onClick={onHistory} data-testid="history-drawer-trigger">
              <History className="h-4 w-4" /> <span className="hidden sm:inline">History</span>
            </Button>
          )}
          {user?.firm_id && (
            <Button variant="ghost" size="sm" asChild data-testid="header-projects-link">
              <Link to="/projects" onClick={guard}><FolderOpen className="h-4 w-4" /> <span className="hidden sm:inline">Projects</span></Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild data-testid="header-my-reviews-link">
            <Link to="/reviews" onClick={guard}><Inbox className="h-4 w-4" /> <span className="hidden sm:inline">My reviews</span></Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => { if (confirmLeave()) { setDirty(false); logout(); } }} data-testid="header-logout-button" aria-label="Sign out"
            className="rounded-none border-2 border-[#1A2838] bg-transparent px-2 text-sm font-semibold text-[#1A2838] hover:bg-[#1A2838] hover:text-[#FFFFFF] min-[400px]:px-3">
            <LogOut className="h-4 w-4 min-[400px]:hidden" /><span className="hidden min-[400px]:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
