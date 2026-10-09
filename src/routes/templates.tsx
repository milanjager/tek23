import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Snowflake, Activity, Gauge, Wind, Fuel, Disc, Flame, Factory, Clock, X, CheckCircle2, XCircle, ArrowRight, type LucideIcon } from "lucide-react";
import { Card, PageTitle } from "@/components/obd/ui";
import { TEMPLATES, type Template } from "@/lib/obd/templates";
import { fmt, pid, useObd } from "@/lib/obd/store";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = { Snowflake, Activity, Gauge, Wind, Fuel, Disc, Flame, Factory };

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Diagnostic Templates — VW T5 OBD Diagnostics" },
      { name: "description", content: "Beginner-friendly guided diagnostic flows for common VW T5 problems: turbo, EGR, glow plugs, DPF and more." },
      { property: "og:title", content: "Diagnostic Templates — VW T5 OBD Diagnostics" },
      { property: "og:description", content: "Step-by-step guided checks for common VW T5 issues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Templates,
});

function Templates() {
  const [active, setActive] = useState<Template | null>(null);
  return (
    <div className="space-y-3">
      <PageTitle title="Templates" sub="Guided checks for common T5 problems" />
      {TEMPLATES.map((t) => {
        const I = ICONS[t.icon];
        return (
          <Card key={t.id}>
            <div className="flex gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><I className="h-6 w-6" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.summary}</p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" />{t.time}</span>
                  <span className={cn("rounded-full px-2 py-0.5 font-semibold", t.difficulty === "Beginner" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{t.difficulty}</span>
                </div>
              </div>
            </div>
            <button onClick={() => setActive(t)} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[.98]">Run Template</button>
          </Card>
        );
      })}
      {active && <Flow t={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function Flow({ t, onClose }: { t: Template; onClose: () => void }) {
  const { values, codes, settings } = useObd();
  const [i, setI] = useState(0);
  const [results, setResults] = useState<(boolean | null)[]>(t.steps.map(() => null));
  const done = i >= t.steps.length;
  const step = t.steps[i];

  const evaluate = () => {
    let ok: boolean | null = null;
    if (step.pid && step.range) { const v = values[step.pid]; ok = v >= step.range[0] && v <= step.range[1]; }
    else if (step.codes) ok = !step.codes.some((c) => codes.includes(c));
    return ok;
  };
  const record = (ok: boolean) => { const r = [...results]; r[i] = ok; setResults(r); };
  const auto = !done ? evaluate() : null;
  const passed = results.filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] flex-col bg-background animate-in slide-in-from-bottom duration-300">
      <header className="flex items-center gap-3 border-b border-border px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex-1"><p className="font-semibold">{t.name}</p><p className="text-xs text-muted-foreground">{done ? "Complete" : `Step ${i + 1} of ${t.steps.length}`}</p></div>
        <button onClick={onClose} aria-label="Close" className="rounded-full bg-card p-2"><X className="h-5 w-5" /></button>
      </header>
      <div className="h-1 bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(Math.min(i, t.steps.length) / t.steps.length) * 100}%` }} /></div>
      <ol className="flex gap-2 overflow-x-auto px-4 py-3">
        {t.steps.map((s, k) => (
          <li key={k} className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold", results[k] === true ? "border-success bg-success/20 text-success" : results[k] === false ? "border-destructive bg-destructive/20 text-destructive" : k === i ? "border-primary text-primary" : "border-border text-muted-foreground")}>{k + 1}</li>
        ))}
      </ol>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {done ? (
          <Card className="mt-4 text-center">
            {passed === t.steps.length ? <CheckCircle2 className="mx-auto h-12 w-12 text-success" /> : <XCircle className="mx-auto h-12 w-12 text-warning" />}
            <p className="mt-2 text-lg font-bold">{passed}/{t.steps.length} checks passed</p>
            <ul className="mt-4 space-y-2 text-left text-sm">
              {t.steps.map((s, k) => <li key={k} className="flex items-center gap-2">{results[k] ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}{s.title}</li>)}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">Failed steps point you to the area to inspect. Check Fault Codes for fix hints.</p>
          </Card>
        ) : (
          <Card className="mt-2 space-y-4">
            <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{i + 1}</span><h2 className="text-lg font-bold">{step.title}</h2></div>
            <p className="text-sm">{step.instruction}</p>
            <div className="rounded-xl bg-muted p-3 text-sm"><p className="text-xs font-semibold uppercase text-muted-foreground">What to look for</p>{step.lookFor}</div>
            {step.pid && (() => { const p = pid(step.pid); const f = fmt(p, values[step.pid], settings); return (
              <div className="flex items-baseline justify-between rounded-xl border border-border p-3"><span className="text-sm text-muted-foreground">{p.name}</span><span className="font-mono text-2xl font-bold tabular-nums">{f.text}<span className="ml-1 text-xs text-muted-foreground">{f.unit}</span></span></div>
            ); })()}
            {step.codes && <div className="flex flex-wrap gap-1.5">{step.codes.map((c) => <span key={c} className={cn("rounded-md px-2 py-1 font-mono text-xs", codes.includes(c) ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground")}>{c}</span>)}</div>}
            {auto !== null && (
              <div className={cn("flex items-center gap-2 rounded-xl p-3 text-sm font-semibold", auto ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                {auto ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}{auto ? "Looks good — PASS" : "Out of spec — FAIL"}
              </div>
            )}
          </Card>
        )}
      </div>
      <footer className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {done ? (
          <button onClick={onClose} className="w-full rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground">Finish</button>
        ) : auto !== null ? (
          <button onClick={() => { record(auto); setI(i + 1); }} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground">Record & next <ArrowRight className="h-4 w-4" /></button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { record(false); setI(i + 1); }} className="rounded-2xl border border-destructive/50 py-3.5 font-semibold text-destructive">Fail</button>
            <button onClick={() => { record(true); setI(i + 1); }} className="rounded-2xl bg-success py-3.5 font-semibold text-success-foreground">Pass</button>
          </div>
        )}
      </footer>
    </div>
  );
}
