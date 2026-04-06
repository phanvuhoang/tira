import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "@/lib/hashLocation";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import UploadPage from "@/pages/upload";
import CustomCompany from "@/pages/custom-company";
import ReportHistory from "@/pages/history";
import LoginPage from "@/pages/login";
import AdminPage from "@/pages/admin";
import { useState } from "react";
import { setToken } from "@/lib/auth";
import {
  BarChart3,
  Building2,
  Upload,
  PlusCircle,
  Shield,
  Menu,
  X,
  FileText,
  Settings,
  LogOut,
  User,
} from "lucide-react";

interface UserInfo {
  id: string;
  username: string;
  role: "admin" | "editor" | "viewer";
  email?: string;
}

interface SidebarProps {
  user: UserInfo;
  onLogout: () => void;
}

function Sidebar({ user, onLogout }: SidebarProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user.role === "admin";

  // Preserve last dashboard URL with params when navigating back
  const dashboardHref = (() => {
    const currentHash = window.location.hash;
    if (currentHash.startsWith("#/dashboard?")) return currentHash.slice(1);
    return "/dashboard";
  })();

  const links = [
    { href: "/", label: "Phân tích", icon: BarChart3, adminOnly: false },
    { href: dashboardHref, label: "Dashboard", icon: Shield, adminOnly: false },
    { href: "/custom", label: "Công ty mới", icon: PlusCircle, adminOnly: false },
    { href: "/upload", label: "Tải dữ liệu", icon: Upload, adminOnly: false },
    { href: "/history", label: "Lịch sử", icon: FileText, adminOnly: false },
    { href: "/admin", label: "Quản trị", icon: Settings, adminOnly: true },
  ].filter((link) => !link.adminOnly || isAdmin);

  const isActive = (href: string) => {
    if (href === "/") return location === "/" || location === "";
    return location.startsWith(href);
  };

  const roleLabel = {
    admin: "Quản trị viên",
    editor: "Biên tập viên",
    viewer: "Xem",
  }[user.role];

  return (
    <>
      {/* Mobile toggle */}
      <button
        data-testid="mobile-menu-toggle"
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-card border border-border shadow-md"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[hsl(144,97%,27%)] to-[hsl(144,97%,20%)] flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">TIRA</h1>
              <p className="text-[11px] text-sidebar-foreground/60 leading-tight">
                Tax Index Risk Analysis
              </p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                data-testid={`nav-${link.href.replace("/", "") || "home"}`}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {link.label}
                {link.href === "/admin" && (
                  <span
                    className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: "hsl(0, 72%, 30%)", color: "hsl(0, 72%, 80%)" }}
                  >
                    Admin
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info + footer */}
        <div className="px-3 py-3 border-t border-sidebar-border space-y-2">
          {/* User info */}
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-sidebar-accent/30">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "hsl(144, 97%, 20%)" }}
            >
              <User className="w-3.5 h-3.5" style={{ color: "hsl(144, 77%, 55%)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-medium truncate"
                style={{ color: "hsl(0, 0%, 90%)" }}
                data-testid="sidebar-username"
              >
                {user.username}
              </p>
              <p
                className="text-[10px] truncate"
                style={{ color: "hsl(215, 20%, 55%)" }}
              >
                {roleLabel}
              </p>
            </div>
            <button
              onClick={onLogout}
              data-testid="btn-logout"
              title="Đăng xuất"
              className="p-1.5 rounded-md hover:bg-sidebar-accent/60 transition-colors"
              style={{ color: "hsl(215, 20%, 55%)" }}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-2">
            <div className="flex items-center gap-2 text-[11px] text-sidebar-foreground/40">
              <Building2 className="w-3.5 h-3.5" />
              <span>1,656 công ty niêm yết</span>
            </div>
            <PerplexityAttribution />
          </div>
        </div>
      </aside>
    </>
  );
}

function AppLayout() {
  const [user, setUser] = useState<UserInfo | null>(null);

  const handleLogin = (u: UserInfo, token: string) => {
    setToken(token);
    setUser(u);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/custom" component={CustomCompany} />
          <Route path="/upload" component={UploadPage} />
          <Route path="/history" component={ReportHistory} />
          <Route path="/admin">
            {user.role === "admin" ? <AdminPage /> : <NotFound />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppLayout />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
