import type { Channel } from "@/lib/types";

const STYLES: Record<Channel, string> = {
  email: "bg-blue-50 text-blue-700 ring-blue-200",
  slack: "bg-violet-50 text-violet-700 ring-violet-200",
  whatsapp: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const LABELS: Record<Channel, string> = {
  email: "Email",
  slack: "Slack",
  whatsapp: "WhatsApp",
};

export function ChannelBadge({ channel }: { channel: Channel }) {
  const style = STYLES[channel] ?? "bg-ink-100 text-ink-700 ring-ink-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset ${style}`}
    >
      {LABELS[channel] ?? channel}
    </span>
  );
}
