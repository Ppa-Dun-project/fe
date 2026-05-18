import { useEffect } from "react";

export type ToastVariant = "info" | "error" | "success" | "injury" | "depth";

export type ToastMessage = {
  id: number;
  text: string;
  variant: ToastVariant;
  // Optional: use when a toast should stay up longer than the default dismiss time (e.g. notification toasts).
  durationMs?: number;
};

type Props = {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
};

const VARIANT_CLASS: Record<ToastVariant, string> = {
  info: "border-white/15 bg-white/10 text-white",
  error: "border-rose-400/40 bg-rose-500/15 text-rose-100",
  success: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
  injury: "border-rose-500/60 bg-rose-600/25 text-rose-50",
  depth: "border-amber-400/60 bg-amber-500/25 text-amber-50",
};

const DEFAULT_DISMISS_MS = 10000;

export default function Toast({ toasts, onDismiss }: Props) {
  // Each toast auto-dismisses once mounted (after its individual durationMs or the default duration).
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(
        () => onDismiss(t.id),
        t.durationMs ?? DEFAULT_DISMISS_MS
      )
    );
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            "pointer-events-auto flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur",
            VARIANT_CLASS[t.variant],
          ].join(" ")}
        >
          <span className="flex-1">{t.text}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-current opacity-60 transition hover:bg-white/10 hover:opacity-100"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
