import { createFileRoute } from "@tanstack/react-router";
import { Card, PageTitle, Sparkline } from "@/components/obd/ui";
import { PIDS, fmt, useObd } from "@/lib/obd/store";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live Data — VW T5 OBD Diagnostics" },
      { name: "description", content: "Live OBD II PIDs for the VW T5: MAF, fuel trims, O2 sensors, temperatures and timing." },
      { property: "og:title", content: "Live Data — VW T5 OBD Diagnostics" },
      { property: "og:description", content: "Streaming sensor values with sparkline history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Live,
});

function Live() {
  const { settings, update, values, history } = useObd();
  const groups = [...new Set(PIDS.map((p) => p.group))];
  return (
    <div className="space-y-4">
      <PageTitle title="Live Data" sub="Toggle sensors to focus on what matters" />
      <div className="flex items-center justify-between rounded-2xl bg-card p-1">
        <span className="pl-3 text-sm text-muted-foreground">Refresh</span>
        <div className="flex gap-1">
          {([1, 2, 5] as const).map((r) => (
            <button key={r} onClick={() => update({ refresh: r })} className={cn("rounded-xl px-4 py-2 text-sm font-semibold", settings.refresh === r ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{r}s</button>
          ))}
        </div>
      </div>
      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g}</h2>
          <Card className="divide-y divide-border p-0">
            {PIDS.filter((p) => p.group === g).map((p) => {
              const on = settings.enabled[p.key];
              const f = fmt(p, values[p.key], settings);
              return (
                <div key={p.key} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{p.name}</p>
                    <div className={cn("font-mono text-lg font-bold tabular-nums", !on && "text-muted-foreground")}>
                      {on ? f.text : "—"}<span className="ml-1 text-xs font-normal text-muted-foreground">{f.unit}</span>
                    </div>
                  </div>
                  <div className="w-20">{on && <Sparkline data={history[p.key]} />}</div>
                  <Switch checked={on} onCheckedChange={(v) => update({ enabled: { ...settings.enabled, [p.key]: v } })} aria-label={`Toggle ${p.name}`} />
                </div>
              );
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
