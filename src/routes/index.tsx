import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Trash2, Activity, ListChecks, Bluetooth, Wifi } from "lucide-react";
import { Card, Gauge, T5Silhouette } from "@/components/obd/ui";
import { fmt, pid, useObd } from "@/lib/obd/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VW T5 OBD Diagnostics — Dashboard" },
      { name: "description", content: "Live OBD II dashboard for the VW T5 Transporter: RPM, speed, coolant temp and engine load." },
      { property: "og:title", content: "VW T5 OBD Diagnostics — Dashboard" },
      { property: "og:description", content: "Live OBD II dashboard for the VW T5 Transporter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const { settings, update, values, connected, codes } = useObd();
  const g = (k: "rpm" | "speed" | "coolant" | "load", max: number, min = 0) => {
    const f = fmt(pid(k), values[k], settings);
    return { value: f.text, unit: f.unit, pct: (values[k] - min) / (max - min) };
  };
  const actions = [
    { to: "/codes", label: "Read Fault Codes", icon: AlertTriangle, badge: codes.length || undefined },
    { to: "/codes", label: "Clear Codes", icon: Trash2 },
    { to: "/live", label: "Live Data", icon: Activity },
    { to: "/templates", label: "Templates", icon: ListChecks },
  ] as const;
  return (
    <div className="space-y-4">
      <div className="text-center">
        <T5Silhouette className="mx-auto h-20 text-primary" />
        <h1 className="mt-1 text-xl font-bold tracking-tight">VW T5 OBD Diagnostics</h1>
        <p className="text-xs text-muted-foreground">Transporter 2000+ · {settings.demo ? "Demo mode" : "Live adapter"}</p>
      </div>

      <div className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3", connected ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10")}>
        <span className={cn("h-2.5 w-2.5 rounded-full", connected ? "animate-pulse bg-success" : "bg-destructive")} />
        <div className="flex-1 text-sm font-semibold">{connected ? "Connected" : "Disconnected"}<span className="ml-1 font-normal text-muted-foreground">{connected ? "· simulated ELM327" : "· no adapter found"}</span></div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-card p-1">
        {([["bt", "ELM327 Bluetooth", Bluetooth], ["wifi", "ELM327 WiFi", Wifi]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => update({ adapter: k })} className={cn("flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm transition-colors", settings.adapter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            <I className="h-4 w-4" />{l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Gauge label="RPM" {...g("rpm", 5000)} />
        <Gauge label="Speed" {...g("speed", 180)} />
        <Gauge label="Coolant" {...g("coolant", 130, -20)} />
        <Gauge label="Engine Load" {...g("load", 100)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {actions.map(({ to, label, icon: I, ...r }) => (
          <Link key={label} to={to} className="active:scale-[.97] transition-transform">
            <Card className="relative flex flex-col gap-2">
              <I className="h-6 w-6 text-primary" />
              <span className="text-sm font-semibold">{label}</span>
              {"badge" in r && r.badge && <span className="absolute right-3 top-3 rounded-full bg-destructive px-2 text-xs font-bold text-destructive-foreground">{r.badge}</span>}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
