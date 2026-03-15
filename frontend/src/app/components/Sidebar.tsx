import { Link, useLocation, useNavigate } from "react-router";
import { LayoutDashboard, FileText, FileStack, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";
import { useAuthStore } from "../store/authStore";
import { useProtocolTabsStore } from "../store/protocolTabsStore";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Дашборд" },
  { path: "/protocols", icon: FileText, label: "Протоколы" },
  { path: "/templates", icon: FileStack, label: "Шаблоны" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const logout = useAuthStore((state) => state.logout);
  const clearTabs = useProtocolTabsStore((state) => state.clear);

  return (
    <aside className="flex w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">RadAssist</h1>
            <p className="text-xs text-muted-foreground">PRO</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);

          return (
            <Link key={item.path} to={item.path}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <div className="border-t border-border p-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-full justify-start gap-3"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          <span>{theme === "dark" ? "Светлая тема" : "Темная тема"}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await logout();
            clearTabs();
            navigate("/login");
          }}
          className="mt-2 w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span>Выйти</span>
        </Button>
      </div>
    </aside>
  );
}
