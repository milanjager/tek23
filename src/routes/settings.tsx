import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Card, PageTitle } from "@/components/obd/ui";
import { useObd, type Protocol } from "@/lib/obd/store";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — VW T5 OBD Diagnostics" },
      { name: "description", content: "OBD protocol, units, demo mode and VIN decoder for the VW T5 Transporter." },
      { property: "og:title", content: "Settings — VW T5 OBD Diagnostics" },
      { property: "og:description", content: "Configure protocol, units and decode your T5 VIN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const YEARS: Record<string, number> = { "1": 2001, "2": 2002, "3": 2003, "4": 2004, "5": 2005, "6": 2006, "7": 2007, "8": 2008, "9": 2009, A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, Y: 2000 };
const PLANTS: Record<string, string> = { H: "Hannover, Germany", P: "Poznań, Poland" };

function decode(vin: string) {
  const v = vin.toUpperCase();
  if (v.length !== 17) return { error: "VIN must be 17 characters." };
  if (/[IOQ]/.test(v)) return { error: "VIN cannot contain I, O or Q." };
  if (!v.startsWith("WV")) return { error: "Not a Volkswagen VIN (should start with WV1/WV2)." };
  const model = v.slice(6, 8);
  return {
    rows: [
      ["Manufacturer", v.startsWith("WV1") ? "VW Commercial (panel van)" : v.startsWith("WV2") ? "VW Commercial (bus/Caravelle)" : "Volkswagen"],
      ["Model", model === "7H" ? "Transporter T5 (7H)" : model === "7J" ? "Transporter T5 (7J)" : `Code ${model}`],
      ["Model year", String(YEARS[v[9]] ?? "Unknown")],
      ["Plant", PLANTS[v[10]] ?? v[10]],
      ["Serial", v.slice(11)],
    ],
  };
}

function Seg<T extends string>({ value, opts, onChange }: { value: T; opts: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-muted p-1">
      {opts.map(([k, l]) => <button key={k} onClick={() => onChange(k)} className={cn("flex-1 rounded-lg py-2 text-sm font-semibold", value === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{l}</button>)}
    </div>
  );
}
const Row = ({ label, children }: { label: string; children: ReactNode }) => <div className="space-y-2"><p className="text-sm font-semibold">{label}</p>{children}</div>;

function SettingsPage() {
  const { settings, update } = useObd();
  const [vin, setVin] = useState(settings.vin);
  const res = vin ? decode(vin) : null;
  const protocols: [Protocol, string][] = [["auto", "Auto"], ["iso9141", "ISO 9141-2"], ["iso14230", "ISO 14230 (KWP2000)"], ["iso15765", "ISO 15765 (CAN)"]];
  return (
    <div className="space-y-4">
      <PageTitle title="Settings" />
      <Card className="space-y-4">
        <Row label="OBD protocol">
          <div className="grid grid-cols-2 gap-2">
            {protocols.map(([k, l]) => <button key={k} onClick={() => update({ protocol: k })} className={cn("rounded-xl border px-3 py-2.5 text-left text-sm", settings.protocol === k ? "border-primary bg-primary/15 text-primary" : "border-border")}>{l}</button>)}
          </div>
          <p className="text-xs text-muted-foreground">Most T5s use KWP2000 (pre-2010) or CAN (2010+ facelift). Auto detects it.</p>
        </Row>
        <Row label="Speed"><Seg value={settings.speedUnit} opts={[["kmh", "km/h"], ["mph", "mph"]]} onChange={(v) => update({ speedUnit: v })} /></Row>
        <Row label="Temperature"><Seg value={settings.tempUnit} opts={[["C", "°C"], ["F", "°F"]]} onChange={(v) => update({ tempUnit: v })} /></Row>
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-semibold">Demo mode</p><p className="text-xs text-muted-foreground">Simulated data when no adapter is connected</p></div>
          <Switch checked={settings.demo} onCheckedChange={(v) => update({ demo: v })} />
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-semibold">VIN decoder</p>
        <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase().slice(0, 17))} onBlur={() => update({ vin })} placeholder="WV1ZZZ7HZ8H000000" className="w-full rounded-xl border border-border bg-muted px-3 py-3 font-mono text-base tracking-wider outline-none focus:border-primary" autoCapitalize="characters" />
        {res && ("error" in res ? <p className="text-sm text-destructive">{res.error}</p> : (
          <dl className="divide-y divide-border text-sm">{res.rows!.map(([k, v]) => <div key={k} className="flex justify-between py-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl>
        ))}
      </Card>

      <Card className="space-y-2 text-sm">
        <p className="font-semibold">About</p>
        <p className="text-muted-foreground">VW T5 OBD Diagnostics · v1.0.0</p>
        <p className="text-muted-foreground">OBD II (SAE J1979) is mandatory on EU petrol vans since 2001 and diesels since 2004. Generic PIDs work on any ELM327 adapter; manufacturer modules (ABS, airbag) may need a VW-specific tool.</p>
      </Card>
    </div>
  );
}
