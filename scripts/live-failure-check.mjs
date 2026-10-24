// Opt-in paid acceptance: no Sovara server is required for this failure-isolation case.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { startBridge } from "../src/claude/bridge.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const events = [];
const marker = "SOVARA_FAILURE_CANARY_DO_NOT_EXPOSE";
const bridge = await startBridge({
  async dispatch(event) {
    events.push(event.type);
    throw new Error(marker);
  },
  async close() {},
});
try {
  const { stdout, stderr } = await promisify(execFile)("claude", [
    "-p", "--plugin-dir", root + "sovara", "--model", process.env.SOVARA_TEST_CLAUDE_MODEL || "haiku",
    "--max-budget-usd", "2", "--setting-sources", "", "--settings", '{"disableAllHooks":false}',
    "--tools", "Read", "--allowedTools", "Read", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
    "--output-format", "json", "--",
    `Read ${root}package.json exactly once. Report its package name and FAILURE_ISOLATION_OK. Do not use other tools or change files.`,
  ], { cwd: root, env: { ...process.env, SOVARA_CLAUDE_BRIDGE_SOCKET: bridge.socketPath,
    SOVARA_CLAUDE_BRIDGE_TOKEN: bridge.token }, timeout: 90000, maxBuffer: 4 * 1024 * 1024 });
  const answer = JSON.parse(stdout);
  assert.equal(answer.is_error, false);
  assert.ok(answer.result.includes("sovara-plugins"));
  assert.ok(answer.result.includes("FAILURE_ISOLATION_OK"));
  assert.equal(events.filter((type) => type === "tool-start").length, 1);
  assert.ok(events.filter((type) => type === "model-start").length >= 2);
  assert.ok(!stdout.includes(marker) && !stderr.includes(marker));
  console.log(JSON.stringify({ passed: true, model: process.env.SOVARA_TEST_CLAUDE_MODEL || "haiku",
    observedAttempts: events, note: "Native answer/tool preserved with all recording attempts rejected; no persisted-capture claim." }));
} finally {
  await bridge.close();
}
