import type { Flag, FlagSeverity } from "@/lib/types";

const SEVERITY_STYLES: Record<FlagSeverity, string> = {
  critical: "border-red-300 bg-red-50",
  high: "border-amber-300 bg-amber-50",
  medium: "border-sky-300 bg-sky-50",
};

const SEVERITY_PILL: Record<FlagSeverity, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-amber-500 text-white",
  medium: "bg-sky-500 text-white",
};

const SEVERITY_ORDER: Record<FlagSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

export function FlagsList({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) {
    return (
      <section className="rounded-2xl border border-ink-200 bg-white p-6 shadow-card">
        <h2 className="text-lg font-semibold text-ink-900">Flags</h2>
        <p className="mt-2 text-sm text-ink-500">Nothing critical surfaced.</p>
      </section>
    );
  }

  const sorted = [...flags].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-6 shadow-card">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-ink-900">Flags</h2>
        <span className="text-xs text-ink-500">{flags.length} total</span>
      </div>
      <ul className="space-y-3">
        {sorted.map((flag, i) => (
          <li
            key={i}
            className={`rounded-xl border p-4 ${SEVERITY_STYLES[flag.severity]}`}
          >
            <div className="mb-1 flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${SEVERITY_PILL[flag.severity]}`}
              >
                {flag.severity}
              </span>
              <h3 className="text-sm font-semibold text-ink-900">{flag.title}</h3>
            </div>
            <p className="text-sm text-ink-700">{flag.detail}</p>
            {flag.related_message_ids.length > 0 && (
              <p className="mt-2 text-xs text-ink-500">
                Related:{" "}
                {flag.related_message_ids
                  .map((id) => `#${id}`)
                  .join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
