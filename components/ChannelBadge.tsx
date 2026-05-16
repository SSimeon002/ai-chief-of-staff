import { Icon } from "./Icon";
import type { Channel } from "@/lib/types";

const LABEL: Record<Channel, string> = {
  email: "Email",
  slack: "Slack",
  whatsapp: "WhatsApp",
};

export function ChannelBadge({ channel }: { channel: Channel }) {
  const I = Icon[channel];
  return (
    <span className="chan" data-chan={channel}>
      {I ? <I /> : null}
      {LABEL[channel] ?? channel}
    </span>
  );
}
