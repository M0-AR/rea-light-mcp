// Flat shared types. No nested objects here on purpose — every advertised
// input schema in tools/* stays at depth 1 (scalars only) so strict
// providers (Muse Spark / Gemini / Moonshot 10-level cap) never reject
// the whole request because of one deep tool.

export interface ReaToolBrief {
  name: string;
  description: string;
  domain: string;
}

export interface ReaToolDef extends ReaToolBrief {
  inputSchema: unknown;
}

export type ReaDomain =
  | "native"
  | "managed"
  | "js"
  | "web"
  | "mobile"
  | "runtime";

export const REA_DOMAINS: ReaDomain[] = [
  "native",
  "managed",
  "js",
  "web",
  "mobile",
  "runtime",
];

// Heuristic domain tagger for cached tool names/descriptions.
// Runs hub-side only; never advertised as a schema.
export function domainOf(name: string, description: string): ReaDomain {
  const hay = `${name} ${description}`.toLowerCase();
  if (/(adb|android|apk|jeb|flutter|jadx)/.test(hay)) return "mobile";
  if (/(managed|dotnet|nativeaot|clr|cil)/.test(hay)) return "managed";
  if (/(electron|javascript|webmcp|web_|browser|har|mitm)/.test(hay))
    return hay.includes("inspect_web") || hay.includes("browser") ? "web" : "js";
  if (/(frida|gdb|rizin|cutter|process|pcap|signal|sqlite|evm|wasm|firmware)/.test(hay))
    return "runtime";
  return "native";
}
