import { homedir } from "node:os";
import { join } from "node:path";
import { SovaraClient } from "@sovara/sdk";
import { openState } from "./state.mjs";
import { ClaudeSession } from "./session.mjs";
import { startBridge } from "./bridge.mjs";

let input = "";
for await (const part of process.stdin) {
  input += part;
  if (input.length > 65536) throw new Error("Invalid Claude helper configuration.");
}
const config = JSON.parse(input);
if (typeof config.sessionId !== "string" || !config.sessionId || typeof config.projectName !== "string" || !config.projectName.trim()) {
  throw new Error("Claude session ID and Sovara project name are required.");
}
const configuredUrl = process.env.SOVARA_URL?.trim() || process.env.SOVARA_EXEC_SERVER_URL?.trim()
  || `http://127.0.0.1:${process.env.SOVARA_EXEC_SERVER_PORT?.trim() || "5960"}`;
const parsedUrl = new URL(configuredUrl);
if (!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
  throw new Error("Invalid Sovara server URL.");
}
const url = parsedUrl.href.replace(/\/+$/, "");
const binding = JSON.stringify([url, config.projectName.trim(), config.sessionId]);
const state = await openState(process.env.SOVARA_CLAUDE_STATE_DIR || join(homedir(), ".sovara", "integrations", "claude-code"), binding);
const client = new SovaraClient({ projectName: config.projectName, url,
  autoInstrumentation: { providerHttp: false, mcp: false }, drainTimeoutMs: 4000 });
const session = new ClaudeSession({ client, state });
const bridge = await startBridge(session);
process.stdout.write(JSON.stringify({ protocol: 1, socketPath: bridge.socketPath, token: bridge.token }) + "\n");
let closing;
function stop() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 6000);
  void bridge.close().then(() => { clearTimeout(deadline); process.exit(0); }, () => { clearTimeout(deadline); process.exit(1); });
}
for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(signal, stop);
