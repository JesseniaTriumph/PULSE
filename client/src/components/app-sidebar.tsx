import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Bell,
  Settings,
  LogOut,
  Zap,
  Sun,
  Moon,
  GraduationCap,
  Building2,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { toast } = useToast();
  const prevCountRef = useRef<number | null>(null);

  const { data: alertData } = useQuery<{ count: number }>({
    queryKey: ["/api/alerts/unread-count"],
    refetchInterval: 60_000,
  });
  const unreadCount = alertData?.count || 0;

  useEffect(() => {
    if (alertData === undefined) return;
    if (prevCountRef.current !== null && alertData.count > prevCountRef.current) {
      const newAlerts = alertData.count - prevCountRef.current;
      toast({
        title: `${newAlerts} new alert${newAlerts > 1 ? "s" : ""}`,
        description: "New attendance alerts require your attention.",
      });
    }
    prevCountRef.current = alertData.count;
  }, [alertData?.count]);

  const navItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/students", label: "Students", icon: GraduationCap },
    { path: "/schedule", label: "Schedule", icon: CalendarDays },
    { path: "/alerts", label: "Alerts", icon: Bell, badge: unreadCount },
    ...(isAdmin ? [
      { path: "/cohorts", label: "Classes", icon: Building2 },
      { path: "/instructors", label: "Instructors", icon: Users },
    ] : []),
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-violet-500/10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/20 flex-shrink-0">
            <Zap className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight pulse-glow" data-testid="text-sidebar-title">PULSE</h1>
              <p className="text-xs text-muted-foreground truncate">{user?.displayName}</p>
              <Badge variant="outline" className="text-[10px] border-violet-500/30 mt-0.5">
                {user?.role}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-auto" data-testid="nav-sidebar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          return (
            <Link key={item.path} href={item.path}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                  isActive
                    ? "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30"
                    : "hover:bg-violet-500/5 text-muted-foreground hover:text-foreground border border-transparent"
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-violet-600 dark:text-violet-400" : ""}`} />
                {!collapsed && (
                  <>
                    <span className="text-sm font-medium flex-1">{item.label}</span>
                    {item.badge ? (
                      <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30 text-xs px-1.5 min-w-[20px] justify-center" data-testid="badge-alert-count">
                        {item.badge}
                      </Badge>
                    ) : null}
                  </>
                )}
                {collapsed && item.badge ? (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full" />
                ) : null}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-violet-500/10 space-y-1">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg hover:bg-violet-500/5 text-muted-foreground hover:text-foreground transition-all"
          data-testid="button-theme-toggle"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {!collapsed && <span className="text-sm">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>
        <button
          onClick={() => logout.mutate()}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg hover:bg-rose-500/5 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 transition-all"
          data-testid="button-logout"
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="text-sm">Sign Out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg hover:bg-violet-500/5 text-muted-foreground transition-all hidden md:flex"
          data-testid="button-collapse-sidebar"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-background/80 backdrop-blur-sm border border-violet-500/20 no-print"
        data-testid="button-mobile-menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static h-full z-40 bg-background/95 backdrop-blur-md border-r border-violet-500/10 transition-all duration-200 no-print ${
          collapsed ? "w-[60px]" : "w-[240px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
