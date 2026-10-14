# rea-light-mcp

Lightweight MCP facade for [REA](https://github.com/morluto/rea) (Reverse Engineer Anything).

Full REA advertises ~139 tools / ~1.87MB of schemas with nesting up to depth 14 — strict providers (Muse Spark / Gemini / Moonshot `10-level` cap, Moonshot `~14KB`/schema cap) reject the **whole request** because of one deep tool, even for `hi`.

`rea-light-mcp` advertises **4 flat tools (depth 1, ~2KB total)** and keeps the full REA catalog hidden server-side behind a persistent REA MCP child.

## Tools

| Tool | Input (all depth 1) | What |
|------|---------------------|------|
| `rea_search` | `query:string, domain?:enum, limit?:1-10` | Keyword search over cached REA catalog, top 5 briefs |
| `rea_describe` | `name:string` | One tool's full schema as **markdown text** (never as schema) |
| `rea_call` | `name:string, args_json:string` | Run any REA tool; complex args travel as a **string**, validated server-side |
| `rea_investigate` | `target:string, question:string, depth?:enum` | Pinned agentic entry: open + inspect, final markdown only |

## Install

No installation — run with `npx` once published, or locally:

```bash
cd /home/md/src/mcp/rea-light-mcp && npm ci && npm run build
```

## Configure (OpenCode)

```jsonc
"rea-light": {
  "type": "local",
  "command": ["node", "/home/md/src/mcp/rea-light-mcp/dist/index.js"],
  "enabled": true,
  "environment": {
    // optional overrides:
    // "REA_COMMAND": "npx -y rea-agents@6.3.0 mcp",
    // "REA_TIMEOUT_MS": "120000",
    // "REA_LIGHT_ALLOW_WRITE": "1",
  }
}
```

Disable full `rea` while using this — that is the point.

## Env

| Var | Default | Notes |
|-----|---------|-------|
| `REA_COMMAND` | `npx -y rea-agents@6.3.0 mcp` | Pinned 139-tool release; avoids unreleased HEAD +33 groups |
| `REA_TIMEOUT_MS` | `120000` | stdio is sequential, like worklink-mcp |
| `REA_LIGHT_ALLOW_WRITE` | unset (read-only) | Set `1` to allow `annotate_*/set_*` write-path tools |

## Why not 5 flat tools?

Flat tools re-introduce deep schemas or lose capabilities. The hub keeps all 139+ capabilities with constant catalog bytes: search/describe/call is the 2026 dispatcher + progressive-discovery consensus (FastMCP search transforms, `tools/list -> search_tools + call_tool`).

## License

MIT
