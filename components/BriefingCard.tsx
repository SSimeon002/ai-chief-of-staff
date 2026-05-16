"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function BriefingCard({
  briefing,
  generatedAt,
}: {
  briefing: string;
  generatedAt: string;
}) {
  const stamp = new Date(generatedAt).toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-6 shadow-card sm:p-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Daily briefing</h2>
          <p className="text-sm text-ink-500">Generated {stamp}</p>
        </div>
        <span className="rounded-full bg-ink-900 px-3 py-1 text-xs font-medium text-white">
          &lt; 2 min read
        </span>
      </div>
      <div className="prose-brief max-w-none text-[15px]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing}</ReactMarkdown>
      </div>
    </section>
  );
}
