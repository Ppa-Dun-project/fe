import { useEffect } from "react";

export type ToastVariant = "info" | "error" | "success" | "injury" | "depth";

export type ToastMessage = {
  id: number;
  text: string;
  variant: ToastVariant;
  // 옵션: 기본 dismiss 시간보다 더 길게 띄우고 싶을 때 사용 (예: 알림 토스트).
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

const DEFAULT_DISMISS_MS = 3500;

export default function Toast({ toasts, onDismiss }: Props) {
  // 각 toast 가 마운트되면 (개별 durationMs 또는 기본 시간 후) 자동 dismiss.
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
            "pointer-events-auto max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur",
            VARIANT_CLASS[t.variant],
          ].join(" ")}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
