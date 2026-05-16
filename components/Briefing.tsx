"use client";

import { Fragment, useMemo, type ReactNode } from "react";

type Block =
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] };

// Lightweight markdown parser. The briefing only uses: ## headings, paragraphs,
// bullet lists with "- ", **bold**, and [#N] / [#N, #N] message references.
function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split(/\n/);
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      out.push({ kind: "h2", text: line.slice(3).trim() });
      i++;
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (lines[i].startsWith("- ") || lines[i].startsWith("* "))
      ) {
        items.push(lines[i].slice(2));
        i++;
      }
      out.push({ kind: "ul", items });
    } else if (line.trim() === "") {
      i++;
    } else {
      const buf = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !lines[i].startsWith("## ") &&
        !lines[i].startsWith("- ") &&
        !lines[i].startsWith("* ")
      ) {
        buf.push(lines[i]);
        i++;
      }
      out.push({ kind: "p", text: buf.join(" ") });
    }
  }
  return out;
}

function inlineFormat(
  text: string,
  onRefClick?: (id: number) => void
): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[(#\d+(?:\s*,\s*#\d+)*)\]/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) out.push(text.slice(lastIdx, m.index));
    if (m[1] != null) {
      out.push(<strong key={`b${key++}`}>{m[1]}</strong>);
    } else if (m[2] != null) {
      const ids = m[2]
        .split(/\s*,\s*/)
        .map((s) => Number(s.replace(/^#/, "")));
      ids.forEach((id, i) => {
        if (i > 0)
          out.push(
            <span
              key={`s${key++}`}
              style={{ margin: "0 2px", color: "var(--ink-4)" }}
            >
              ·
            </span>
          );
        out.push(
          <a
            key={`r${key++}`}
            className="ref"
            onClick={() => onRefClick?.(id)}
            role="button"
          >
            #{id}
          </a>
        );
      });
    }
    lastIdx = re.lastIndex;
  }
  if (lastIdx < text.length) out.push(text.slice(lastIdx));
  return out;
}

export function Briefing({
  markdown,
  onRefClick,
}: {
  markdown: string;
  onRefClick?: (id: number) => void;
}) {
  const blocks = useMemo(() => parseBlocks(markdown), [markdown]);

  return (
    <div className="briefing">
      {blocks.map((b, i) => {
        if (b.kind === "h2") return <h2 key={i}>{b.text}</h2>;
        if (b.kind === "p")
          return (
            <p key={i}>
              {inlineFormat(b.text, onRefClick).map((node, j) => (
                <Fragment key={j}>{node}</Fragment>
              ))}
            </p>
          );
        if (b.kind === "ul")
          return (
            <ul key={i}>
              {b.items.map((it, j) => (
                <li key={j}>
                  {inlineFormat(it, onRefClick).map((node, k) => (
                    <Fragment key={k}>{node}</Fragment>
                  ))}
                </li>
              ))}
            </ul>
          );
        return null;
      })}
    </div>
  );
}
