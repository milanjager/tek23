import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export type WalkStep = {
  target: string;
  title: string;
  text: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  prepare?: () => void;
};

export function Walkthrough({
  open,
  steps,
  onClose,
  onFinish,
}: {
  open: boolean;
  steps: WalkStep[];
  onClose: () => void;
  onFinish?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const current = steps[step];

  useEffect(() => {
    if (!open || !current) return;
    current.prepare?.();
    // Let UI update before measuring
    const t = setTimeout(updateRect, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => updateRect();
    window.addEventListener("resize", onResize);
    const wrap = document.getElementById("stage-canvas");
    if (wrap) wrap.addEventListener("scroll", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      if (wrap) wrap.removeEventListener("scroll", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step, steps.length]);

  function updateRect() {
    if (!current) return;
    const el = document.querySelector(`[data-walkthrough="${current.target}"]`) as HTMLElement | null;
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }

  function next() {
    if (step >= steps.length - 1) {
      onFinish?.();
      onClose();
    } else {
      setStep((s) => s + 1);
    }
  }
  function prev() {
    setStep((s) => Math.max(0, s - 1));
  }

  if (!open || !current) return null;

  const isCenter = !rect || current.position === "center";
  const pad = 8;
  const box = rect
    ? {
        left: rect.left - pad,
        top: rect.top - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : { left: "50%", top: "50%", width: 0, height: 0 };

  // Tooltip placement
  let tooltipStyle: React.CSSProperties = {};
  if (rect) {
    const margin = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tw = tooltipRef.current?.offsetWidth ?? 280;
    const th = tooltipRef.current?.offsetHeight ?? 140;
    const prefer = current.position ?? "bottom";
    const fitsBelow = rect.bottom + margin + th <= vh;
    const fitsAbove = rect.top - margin - th >= 0;
    const fitsRight = rect.right + margin + tw <= vw;
    const fitsLeft = rect.left - margin - tw >= 0;

    const placement =
      prefer === "top" && fitsAbove ? "top"
      : prefer === "bottom" && fitsBelow ? "bottom"
      : prefer === "left" && fitsLeft ? "left"
      : prefer === "right" && fitsRight ? "right"
      : fitsBelow ? "bottom"
      : fitsAbove ? "top"
      : fitsRight ? "right"
      : "left";

    switch (placement) {
      case "top":
        tooltipStyle = { left: Math.max(margin, Math.min(vw - tw - margin, (rect.left + rect.right) / 2 - tw / 2)), top: rect.top - margin - th };
        break;
      case "bottom":
        tooltipStyle = { left: Math.max(margin, Math.min(vw - tw - margin, (rect.left + rect.right) / 2 - tw / 2)), top: rect.bottom + margin };
        break;
      case "left":
        tooltipStyle = { left: rect.left - margin - tw, top: Math.max(margin, Math.min(vh - th - margin, (rect.top + rect.bottom) / 2 - th / 2)) };
        break;
      case "right":
        tooltipStyle = { left: rect.right + margin, top: Math.max(margin, Math.min(vh - th - margin, (rect.top + rect.bottom) / 2 - th / 2)) };
        break;
    }
  } else {
    tooltipStyle = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100]" aria-hidden={false}>
      {/* Backdrop with spotlight cutout via box-shadow */}
      <div
        className="fixed rounded-xl transition-all duration-300 ease-out"
        style={{
          left: typeof box.left === "number" ? box.left : box.left,
          top: typeof box.top === "number" ? box.top : box.top,
          width: box.width,
          height: box.height,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-10 w-[min(22rem,92vw)] rounded-2xl border border-white/15 bg-neutral-900/90 p-4 text-white shadow-2xl backdrop-blur-md transition-all duration-300 ease-out"
        style={tooltipStyle}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-lime-400">{current.title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
            aria-label="Zavřít návod"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-[13px] leading-relaxed text-neutral-200">{current.text}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`block h-1.5 w-1.5 rounded-full ${i === step ? "bg-lime-400" : "bg-neutral-600"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <button
                onClick={prev}
                className="inline-flex items-center rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
              >
                <ChevronLeft size={14} className="mr-0.5" /> Zpět
              </button>
            )}
            <button
              onClick={next}
              className="inline-flex items-center rounded-lg bg-lime-500 px-3 py-1.5 text-xs font-bold text-neutral-950 hover:bg-lime-400"
            >
              {step === steps.length - 1 ? "Dokončit" : "Další"}
              {step < steps.length - 1 && <ChevronRight size={14} className="ml-0.5" />}
            </button>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-neutral-500">
          Krok {step + 1} / {steps.length} · Esc = zavřít · ← → = kroky
        </div>
      </div>
    </div>
  );
}
