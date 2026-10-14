import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReaBackend } from "../rea-backend.js";
import { flattenResult, toMarkdownResult } from "../output.js";

// Pinned agentic entry for the 80% case: "understand X in target Y".
// Runs open -> inspect -> trace inside the hub; intermediate Evidence
// never enters model context, only the final markdown does.
export function registerInvestigateTool(server: McpServer, backend: ReaBackend): void {
  server.registerTool(
    "rea_investigate",
    {
      description:
        "Investigate a target with one question (e.g. how does search work). Opens the target, runs the right REA inspection, returns markdown summary with evidence ids. Prefer this over manual rea_search for first contact.",
      inputSchema: {
        target: z.string().describe("Absolute local path to binary, app dir, asar, apk, or capture"),
        question: z.string().describe("One question, e.g. how does clipboard sync work"),
        depth: z.enum(["quick", "standard", "deep"]).optional().describe("Effort level (default standard)"),
      },
    },
    async (args) => {
      const depth = args.depth ?? "standard";
      try {
        // Phase 1: open via session tool through the child.
        const openRes = await backend.call(
          "open_binary",
          JSON.stringify({ path: args.target }),
        );
        const openText = flattenResult(openRes, 2000);

        // Phase 2: pick inspection by keyword routing (hub-side, cheap).
        const q = args.question.toLowerCase();
        let inspectName = "binary_overview";
        let inspectArgs: Record<string, unknown> = {};
        if (/(decompile|function|pseudo)/.test(q)) {
          inspectName = "analyze_function";
          inspectArgs = {};
        } else if (/(string|search|xref|reference)/.test(q)) {
          inspectName = "search_strings";
          inspectArgs = {};
        } else if (/(electron|asar|javascript|module|ipc)/.test(q)) {
          inspectName = "analyze_javascript_application";
          inspectArgs = { path: args.target };
        } else if (/(android|apk|dex|manifest)/.test(q)) {
          inspectName = "inspect_android_package";
          inspectArgs = { path: args.target };
        }
        if (depth === "quick") {
          return {
            content: [{ type: "text", text: toMarkdownResult("Investigation opened", `${openText}\n\n_Question: ${args.question}_\n_Next: rea_search for ${inspectName}, rea_call to run._`) }],
          };
        }
        let body = "";
        try {
          const insp = await backend.call(inspectName, JSON.stringify(inspectArgs));
          body = flattenResult(insp, depth === "deep" ? 8000 : 5000);
        } catch (error) {
          body = `(direct inspection unavailable: ${error instanceof Error ? error.message : String(error)}; use rea_search + rea_call)`;
        }
        const lines = [
          `# Investigation: ${args.question}`,
          "",
          `**Target:** ${args.target}`,
          "",
          "## Session",
          "",
          openText,
          "",
          `## Finding (${inspectName})`,
          "",
          body,
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error investigating: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
