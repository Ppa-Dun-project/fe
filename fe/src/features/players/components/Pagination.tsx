type Props = {
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
};

export default function Pagination({ page, totalPages, onChange }: Props) {
  return (
    <div className="mx-auto mt-5 flex w-fit items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-black text-white/90 transition hover:bg-white/5 disabled:opacity-40"
      >
        Prev
      </button>

      <div className="text-xs font-black text-white/60">
        Page <span className="text-white">{page}</span> / {totalPages}
      </div>

      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-black text-white/90 transition hover:bg-white/5 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}