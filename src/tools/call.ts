import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReaBackend } from "../rea-backend.js";
import { flattenResult, toErrorText } from "../output.js";

// The key trick: args_json is a STRING (depth 1). Complex validation
// happens server-side after parse, so strict providers never see nesting.
const BLOCKED = new Set<string>([
  // Mutating / write-path ops stay blocked in read-only default.
  // Set REA_LIGHT_ALLOW_WRITE=1 to bypass (still logged).
  "annotate_native_function",
  "set_address_name",
  "set_addresses_names",
  "set_comment",
  "set_inline_comment",
  "set_bookmark",
  "unset_bookmark",
]);

export function registerCallTool(server: McpServer, backend: ReaBackend): void {
  server.registerTool(
    "rea_call",
    {
      description:
        "Run any REA tool by name. Pass arguments as a JSON object string. Example args_json: {\"document\":\"main\",\"address\":\"0x1000\"}. Get the schema via rea_describe first.",
      inputSchema: {
        name: z.string().describe("Exact REA tool name from rea_search"),
        args_json: z.string().describe("JSON object string with the tool arguments"),
      },
    },
    async (args) => {
      try {
        if (BLOCKED.has(args.name) && process.env.REA_LIGHT_ALLOW_WRITE !== "1") {
          return {
            content: [
              {
                type: "text",
                text: `Blocked write-path tool ${args.name} in read-only default. Set REA_LIGHT_ALLOW_WRITE=1 to allow.`,
              },
            ],
            isError: true,
          };
        }
        const result = await backend.call(args.name, args.args_json);
        return { content: [{ type: "text", text: flattenResult(result) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: toErrorText(`calling REA tool ${args.name}`, error) }],
          isError: true,
        };
      }
    },
  );
}
