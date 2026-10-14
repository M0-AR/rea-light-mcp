import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReaBackend } from "../rea-backend.js";
import type { ReaDomain } from "../types.js";

const DOMAIN_VALUES = ["native", "managed", "js", "web", "mobile", "runtime"] as const;

// Depth-1 schema: scalars only. No nesting on purpose.
export function registerSearchTool(server: McpServer, backend: ReaBackend): void {
  server.registerTool(
    "rea_search",
    {
      description:
        "Search REA capabilities by keyword. Returns top matching tool names with one-line descriptions (no full schemas). Call rea_describe for one tool, then rea_call to run it.",
      inputSchema: {
        query: z.string().describe("Keyword query, e.g. decompile, apk, electron, tracing"),
        domain: z.enum(DOMAIN_VALUES).optional().describe("Optional domain filter"),
        limit: z.number().int().min(1).max(10).optional().describe("Max results 1-10 (default 5)"),
      },
    },
    async (args) => {
      try {
        const results = await backend.search(args.query, args.domain as ReaDomain | undefined, args.limit ?? 5);
        if (results.length === 0) {
          return { content: [{ type: "text", text: "No REA tools match that query." }] };
        }
        const lines = [`## REA matches (${results.length})`, ""];
        for (const r of results) {
          lines.push(`### ${r.name}`);
          lines.push(`- **Domain:** ${r.domain}`);
          if (r.description) lines.push(`- **What:** ${r.description.split("\n")[0]}`);
          lines.push("");
        }
        lines.push("_Next: rea_describe for full schema, then rea_call to run._");
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error searching REA: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
