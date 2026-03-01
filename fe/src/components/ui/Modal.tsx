import { type PropsWithChildren, useEffect } from "react";

type Props = PropsWithChildren<{
  open: boolean;
  title?: string;
  onClose: () => void;
  footer?: React.ReactNode;
}>;

export default function Modal({ open, title, onClose, children, footer }: Props) {
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
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <button
        aria-label="Close modal"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* panel */}
      <div className="relative mx-auto mt-20 w-[92%] max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/5 transition"
          >
            ESC
          </button>
        </div>

        <div className="mt-4 text-white/80">{children}</div>

        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}