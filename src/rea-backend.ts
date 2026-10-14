// Backend: one persistent REA MCP child behind the hub (facade pattern).
// The hub advertises 4 flat tools; the full REA catalog (~139 tools,
// ~1.87MB, depth up to 14) stays hidden server-side and is reached via
// search/describe/call. Session/Evidence is preserved because the child
// stays alive across calls (unlike per-call CLI spawning).
//
// Backend selection (env, all optional):
//   REA_COMMAND  — full command line for the REA server.
//                  Default: "npx -y rea-agents@6.3.0 mcp" (last measured
//                  139-tool release; avoids unreleased HEAD +33 tools).
//   REA_TIMEOUT_MS — tools/call timeout (default 120000; stdio is sequential).

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { domainOf, type ReaDomain, type ReaToolBrief, type ReaToolDef } from "./types.js";

const DEFAULT_COMMAND = "npx -y rea-agents@6.3.0 mcp";
const DEFAULT_TIMEOUT_MS = 120_000;

function parseCommand(cmd: string): { command: string; args: string[] } {
  const parts = cmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  const clean = parts.map((p) =>
    (p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))
      ? p.slice(1, -1)
      : p,
  );
  const [command = "npx", ...args] = clean;
  return { command, args };
}

export class ReaBackend {
  private client: Client | null = null;
  private cache: ReaToolDef[] = [];
  private cacheAt = 0;
  private readonly command: string;
  private readonly timeoutMs: number;

  constructor() {
    this.command = process.env.REA_COMMAND || DEFAULT_COMMAND;
    const t = Number(process.env.REA_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    this.timeoutMs = Number.isFinite(t) && t > 0 ? t : DEFAULT_TIMEOUT_MS;
  }

  get backendLabel(): string {
    return this.command;
  }

  private async ensureClient(): Promise<Client> {
    if (this.client) return this.client;
    const { command, args } = parseCommand(this.command);
    const transport = new StdioClientTransport({
      command,
      args,
      // Keep REA compact profile available if the operator opts in.
      // Hub already solves depth/size, so this is a passthrough, not required.
      env: { ...process.env } as Record<string, string>,
    });
    const client = new Client({ name: "rea-light-mcp-hub", version: "0.1.0" });
    await client.connect(transport);
    this.client = client;
    return client;
  }

  async close(): Promise<void> {
    try {
      await this.client?.close();
    } catch {
      // ignore close errors during shutdown
    }
    this.client = null;
    this.cache = [];
  }

  async listTools(refresh = false): Promise<ReaToolDef[]> {
    if (!refresh && this.cache.length > 0) return this.cache;
    const client = await this.ensureClient();
    const out: ReaToolDef[] = [];
    let cursor: string | undefined;
    do {
      const page = await client.listTools({ cursor });
      for (const t of page.tools) {
        const name = t.name;
        const description = t.description ?? "";
        out.push({
          name,
          description,
          domain: domainOf(name, description),
          inputSchema: t.inputSchema,
        });
      }
      cursor = page.nextCursor;
    } while (cursor);
    this.cache = out;
    this.cacheAt = Date.now();
    return out;
  }

  cacheAgeMs(): number {
    return this.cacheAt === 0 ? -1 : Date.now() - this.cacheAt;
  }

  // Keyword search over name+description (+ domain filter). BM25 upgrade
  // path: swap scorer, keep tool surface identical.
  async search(query: string, domain?: ReaDomain, limit = 5): Promise<ReaToolBrief[]> {
    const tools = await this.listTools();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const capped = Math.min(Math.max(limit, 1), 10);
    const scored = tools
      .filter((t) => !domain || t.domain === domain)
      .map((t) => {
        const hay = `${t.name} ${t.description}`.toLowerCase();
        let score = 0;
        for (const term of terms) {
          if (t.name.toLowerCase().includes(term)) score += 3;
          else if (hay.includes(term)) score += 1;
        }
        return { t, score };
      })
      .filter((s) => terms.length === 0 || s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, capped)
      .map((s) => ({ name: s.t.name, description: s.t.description, domain: s.t.domain }));
    return scored;
  }

  async describe(name: string): Promise<ReaToolDef | null> {
    const tools = await this.listTools();
    return tools.find((t) => t.name === name) ?? null;
  }

  // argsJson is a STRING on the advertised schema (depth 1). Parsed +
  // validated here and by REA itself. Never advertise nested objects —
  // that is the whole point of the hub.
  async call(name: string, argsJson: string): Promise<unknown> {
    let args: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(argsJson);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("args_json must be a JSON object");
      }
      args = parsed as Record<string, unknown>;
    } catch (error) {
      throw new Error(
        `Invalid args_json: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const client = await this.ensureClient();
    const res = await client.callTool({ name, arguments: args }, undefined, {
      timeout: this.timeoutMs,
    });
    return res;
  }
}
