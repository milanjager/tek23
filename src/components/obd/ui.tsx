import { Link, useRouterState } from "@tanstack/react-router";
import { Home, AlertTriangle, Activity, ListChecks, Settings as Cog } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useObd } from "@/lib/obd/store";

export function T5Silhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 90" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="VW T5 Transporter">
      <path d="M14 66 V40 Q14 30 22 26 L52 14 Q58 11 66 11 H206 Q218 11 220 22 L226 60 Q227 66 221 66" />
      <path d="M14 66 H38 M70 66 H164 M196 66 H221" />
      <path d="M24 30 L54 18 H72 V40 H22" />
      <path d="M80 18 H120 V40 H80 Z M128 18 H168 V40 H128 Z M176 18 H210 L213 40 H176 Z" />
      <path d="M74 18 V64 M124 42 V62" />
      <circle cx="54" cy="66" r="13" /><circle cx="54" cy="66" r="5" />
      <circle cx="180" cy="66" r="13" /><circle cx="180" cy="66" r="5" />
      <path d="M14 52 H22 M219 48 H226" />
    </svg>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>{children}</div>;
}

export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return <div className={cn("h-6", className)} />;
  const min = Math.min(...data), max = Math.max(...data), r = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${24 - ((v - min) / r) * 22 - 1}`).join(" ");
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className={cn("h-6 w-full text-primary", className)}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Gauge({ label, value, unit, pct }: { label: string; value: string; unit: string; pct: number }) {
  const r = 38, c = Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return (
    <Card className="flex flex-col items-center p-3">
      <svg viewBox="0 0 100 58" className="w-full">
        <path d="M12 50 A38 38 0 0 1 88 50" stroke="var(--muted)" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M12 50 A38 38 0 0 1 88 50" stroke="var(--primary)" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} style={{ transition: "stroke-dasharray .6s ease" }} />
      </svg>
      <div className="-mt-6 font-mono text-xl font-bold tabular-nums">{value}<span className="ml-1 text-xs text-muted-foreground">{unit}</span></div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}

export const SEV: Record<string, string> = {
  Critical: "bg-destructive/15 text-destructive border-destructive/40",
  Warning: "bg-warning/15 text-warning border-warning/40",
  Info: "bg-primary/15 text-primary border-primary/40",
};

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/codes", label: "Codes", icon: AlertTriangle },
  { to: "/live", label: "Live", icon: Activity },
  { to: "/templates", label: "Templates", icon: ListChecks },
  { to: "/settings", label: "Settings", icon: Cog },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { codes } = useObd();
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[430px] flex-col bg-background">
      <main key={path} className="flex-1 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] animate-in fade-in slide-in-from-bottom-2 duration-300">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-border bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <ul className="grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <li key={to}>
                <Link to={to} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors", active ? "text-primary" : "text-muted-foreground")}>
                  <Icon className="h-5 w-5" />
                  {label}
                  {to === "/codes" && codes.length > 0 && <span className="absolute right-4 top-1.5 h-2 w-2 rounded-full bg-destructive" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="mb-4">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </header>
  );
}
