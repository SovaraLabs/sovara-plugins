import assert from "node:assert/strict";
import { test } from "node:test";
import { request } from "node:http";
import { stat } from "node:fs/promises";
import { startBridge } from "../src/claude/bridge.mjs";

function send(bridge, data, token = bridge.token) {
  return new Promise((resolve, reject) => {
    const req = request({ socketPath: bridge.socketPath, path: "/event", method: "POST", headers: { authorization: `Bearer ${token}` } }, (response) => {
      let text = "";
      response.setEncoding("utf8").on("data", (chunk) => { text += chunk; }).on("end", () => resolve({ status: response.statusCode, text }));
    });
    req.on("error", reject).end(JSON.stringify(data));
  });
}

test("private bridge authenticates before dispatch and concurrent retries execute one SDK operation", async () => {
  let count = 0;
  let closed = false;
  const bridge = await startBridge({ async dispatch() { count++; await new Promise((resolve) => setTimeout(resolve, 10)); return { recorded: true }; }, async close() { closed = true; } });
  try {
    assert.equal((await stat(bridge.socketPath)).mode & 0o077, 0);
    assert.equal((await send(bridge, { id: "same", event: {} }, "incorrect")).status, 401);
    assert.equal(count, 0);
    const results = await Promise.all(Array.from({ length: 5 }, () => send(bridge, { id: "same", event: {} })));
    assert.ok(results.every((result) => result.status === 200));
    assert.equal(count, 1);
    assert.equal((await send(bridge, { id: "same", event: { different: true } })).status, 409);
    assert.equal(count, 1);
  } finally { await bridge.close(); }
  assert.equal(closed, true);
});

test("SDK errors never expose credentials or context in the local response", async () => {
  const bridge = await startBridge({ async dispatch() { throw new Error("secret-marker-provider-key"); }, async close() {} });
  try {
    const result = await send(bridge, { id: "error", event: {} });
    assert.equal(result.status, 503);
    assert.ok(!result.text.includes("secret-marker"));
  } finally { await bridge.close(); }
});
