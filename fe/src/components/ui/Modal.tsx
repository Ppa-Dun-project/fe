import { type PropsWithChildren, useEffect } from "react";

type Size = "default" | "large";

type Props = PropsWithChildren<{
  open: boolean;
  title?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  // Default is max-w-2xl. "large" is max-w-4xl — suitable for two-column layouts.
  size?: Size;
}>;

const SIZE_CLASS: Record<Size, string> = {
  default: "max-w-2xl",
  large: "max-w-4xl",
};

export default function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = "default",
}: Props) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* overlay — fixed so it stays put while the panel scrolls */}
      <button
        aria-label="Close modal"
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* panel — vertical margin lets long content scroll within the viewport */}
      <div
        className={[
          "relative mx-auto my-10 w-[92%] rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl",
          SIZE_CLASS[size],
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-sm text-white/80 hover:bg-white/5 transition"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 text-white/80">{children}</div>

        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
