import { useEffect, useMemo, useRef, useState } from "react";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label?: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  className?: string;
};

export default function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const current = useMemo(
    () => options.find((o) => o.value === value)?.label ?? value,
    [options, value]
  );

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // When the dropdown opens, scroll the currently selected option into view (optional UX nicety)
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;

    const active = list.querySelector<HTMLButtonElement>('[data-active="true"]');
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && <div className="text-xs font-extrabold text-white/70">{label}</div>}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="
          mt-2 flex w-full items-center justify-between
          rounded-2xl border border-white/10 bg-black/40
          px-4 py-3 text-sm font-extrabold text-white
          outline-none transition hover:bg-white/5
        "
      >
        <span>{current}</span>
        <span className={`transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {/* Animated dropdown panel */}
      <div
        className={`
          absolute left-0 right-0 z-30 mt-2
          overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70 backdrop-blur
          transition-all duration-200 ease-out
          ${open ? "max-h-80 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1"}
        `}
      >
        {/* This area is the actual scroll container */}
        <div
          ref={listRef}
          className="
            ppadun-dropdown-scroll max-h-80 overflow-y-auto overscroll-contain
            py-1
          "
          onWheel={(e) => {
            // Prevent option-list scrolling from leaking into page scroll
            e.stopPropagation();
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                data-active={active ? "true" : "false"}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`
                  w-full px-4 py-2 text-left text-sm font-extrabold transition
                  ${active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5 hover:text-white"}
                `}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
