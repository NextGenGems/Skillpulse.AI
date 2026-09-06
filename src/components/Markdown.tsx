/** Minimal markdown-ish renderer for lesson content (headings, lists, code, quotes). */
export function Markdown({ content }: { content: string }) {
  const blocks = content.trim().split(/\n\n+/);
  return (
    <div className="prose-sp space-y-3 text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (block.startsWith("# ")) {
          return (
            <h1 key={i} className="text-2xl font-bold tracking-tight">
              {block.slice(2)}
            </h1>
          );
        }
        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="text-xl font-semibold">
              {block.slice(3)}
            </h2>
          );
        }
        if (block.startsWith("```")) {
          const body = lines.slice(1, lines[lines.length - 1] === "```" ? -1 : undefined).join("\n");
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-lg bg-zinc-900 p-3 text-sm text-zinc-100"
            >
              <code>{body}</code>
            </pre>
          );
        }
        if (lines.every((l) => l.startsWith("- ") || l.startsWith("* ") || l.startsWith("> "))) {
          if (lines[0].startsWith("> ")) {
            return (
              <blockquote
                key={i}
                className="border-l-4 border-violet-400 pl-3 text-zinc-600 dark:text-zinc-300"
              >
                {lines.map((l) => l.replace(/^>\s?/, "")).join(" ")}
              </blockquote>
            );
          }
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^\d+\.\s+/, ""))}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i}>{renderInline(block)}</p>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-zinc-100 px-1 py-0.5 text-[13px] dark:bg-zinc-800">
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
