import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ScanLine, CheckCircle2 } from "lucide-react";
import { Card, PageTitle, SEV } from "@/components/obd/ui";
import { useObd } from "@/lib/obd/store";
import { DEMO_CODES, findDtc } from "@/lib/obd/dtcs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/codes")({
  head: () => ({
    meta: [
      { title: "Fault Codes — VW T5 OBD Diagnostics" },
      { name: "description", content: "Read and clear VW T5 Transporter fault codes with T5-specific causes and fixes." },
      { property: "og:title", content: "Fault Codes — VW T5 OBD Diagnostics" },
      { property: "og:description", content: "VW T5-specific DTC descriptions, probable causes and fix hints." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Codes,
});

function Codes() {
  const { codes, setCodes, setScanned } = useObd();
  const [scanning, setScanning] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const scan = () => {
    setScanning(true);
    setTimeout(() => { setCodes(codes.length ? codes : DEMO_CODES); setScanned(true); setScanning(false); }, 2200);
  };

  return (
    <div className="space-y-4">
      <PageTitle title="Fault Codes" sub={`${codes.length} stored trouble code${codes.length === 1 ? "" : "s"}`} />
      <button onClick={scan} disabled={scanning} className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-primary py-4 font-semibold text-primary-foreground active:scale-[.98] disabled:opacity-90">
        <ScanLine className={cn("h-5 w-5", scanning && "animate-pulse")} />
        {scanning ? "Reading codes…" : "Scan for codes"}
        {scanning && <span className="absolute inset-y-0 left-0 w-1/3 animate-[scan_1.1s_ease-in-out_infinite] bg-primary-foreground/20" />}
      </button>

      {scanning ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-card" />)}</div>
      ) : codes.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <p className="font-semibold">No fault codes</p>
          <p className="text-sm text-muted-foreground">All modules reported clean.</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {codes.map((c) => {
            const d = findDtc(c); if (!d) return null;
            const isOpen = open === c;
            return (
              <li key={c}>
                <Card className="p-0">
                  <button onClick={() => setOpen(isOpen ? null : c)} className="flex w-full items-start gap-3 p-4 text-left">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-bold">{d.code}</span>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", SEV[d.severity])}>{d.severity}</span>
                        <span className="text-[11px] text-muted-foreground">{d.system}</span>
                      </div>
                      <p className="mt-1 text-sm">{d.title}</p>
                    </div>
                    <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="space-y-3 border-t border-border px-4 py-3 text-sm animate-in fade-in">
                      <p>{d.description}</p>
                      <div><p className="text-xs font-semibold uppercase text-muted-foreground">Probable cause</p><p>{d.cause}</p></div>
                      <div className="rounded-xl bg-primary/10 p-3"><p className="text-xs font-semibold uppercase text-primary">Fix hint</p><p>{d.fix}</p></div>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {codes.length > 0 && !scanning && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="w-full rounded-2xl border border-destructive/50 py-3.5 font-semibold text-destructive active:scale-[.98]">Clear All Codes</button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-[380px] rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all fault codes?</AlertDialogTitle>
              <AlertDialogDescription>This erases stored codes and freeze-frame data in all modules. Fix the cause first, or the codes will return.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => setCodes([])}>Clear codes</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
