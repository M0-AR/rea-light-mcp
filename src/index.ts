#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ReaBackend } from "./rea-backend.js";
import { registerSearchTool } from "./tools/search.js";
import { registerDescribeTool } from "./tools/describe.js";
import { registerCallTool } from "./tools/call.js";
import { registerInvestigateTool } from "./tools/investigate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));

const backend = new ReaBackend();

const server = new McpServer({
  name: "rea-light",
  version: pkg.version,
});

registerSearchTool(server, backend);
registerDescribeTool(server, backend);
registerCallTool(server, backend);
registerInvestigateTool(server, backend);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error(`rea-light-mcp ${pkg.version} running on stdio (backend: ${backend.backendLabel})`);

const shutdown = async () => {
  await backend.close();
  await server.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
