// Markdown + truncation helpers. Hub returns text only so large REA
// payloads never blow up model context (AWS guidance: default few fields,
// detail on demand).

const DEFAULT_MAX_CHARS = 6000;

export function truncate(text: string, maxChars = DEFAULT_MAX_CHARS): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars).trimEnd() + "\n\n...[truncated]";
}

export function toMarkdownResult(title: string, body: string): string {
  return `# ${title}\n\n${body}`;
}

export function toErrorText(action: string, error: unknown): string {
  return `Error ${action}: ${error instanceof Error ? error.message : String(error)}`;
}

// REA tool results can be MCP content blocks or raw JSON. Flatten to text.
export function flattenResult(result: unknown, maxChars = DEFAULT_MAX_CHARS): string {
  if (result == null) return "(empty result)";
  if (typeof result === "string") return truncate(result, maxChars);
  try {
    const asJson = JSON.stringify(result, null, 2);
    return truncate(asJson ?? String(result), maxChars);
  } catch {
    return truncate(String(result), maxChars);
  }
}
