import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReaBackend } from "../rea-backend.js";
import { truncate } from "../output.js";

export function registerDescribeTool(server: McpServer, backend: ReaBackend): void {
  server.registerTool(
    "rea_describe",
    {
      // Full schema returned as TEXT output, never as an advertised schema —
      // providers validate output text leniently, input schemas strictly.
      description:
        "Get one REA tool's full input schema and example as markdown text. Use after rea_search, before rea_call.",
      inputSchema: {
        name: z.string().describe("Exact REA tool name from rea_search"),
      },
    },
    async (args) => {
      try {
        const def = await backend.describe(args.name);
        if (!def) {
          return {
            content: [{ type: "text", text: `Unknown REA tool: ${args.name}. Run rea_search first.` }],
            isError: true,
          };
        }
        const schemaText = truncate(JSON.stringify(def.inputSchema, null, 2), 4000);
        const lines = [
          `# ${def.name}`,
          "",
          `**Domain:** ${def.domain}`,
          "",
          def.description,
          "",
          "**Input schema (as text — copy fields into rea_call args_json):**",
          "```json",
          schemaText,
          "```",
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error describing REA tool: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
