import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { register } from "../sovara/hooks/register.js";

function fixture() {
  const handlers = new Map();
  register((name, handler) => handlers.set(name, handler));
  const calls = [];
  const sessionId = randomUUID();
  const $ = {
    env: { async get(key) { return key === "SOVARA_CLAUDE_BRIDGE_SOCKET" ? "/private/test.sock" : key === "SOVARA_CLAUDE_BRIDGE_TOKEN" ? "test-token" : undefined; } },
    session: { async id() { return sessionId; }, async version() { return { version: "2.1.310" }; }, async messages() { return []; } },
    agent: { async list() { return []; } },
    http: { async fetch(url, options) {
      const { event } = JSON.parse(options.body);
      calls.push(event);
      return { ok: true, text: JSON.stringify({ value: event.type === "compacted" ? { generation: "new" } : { text: "Fresh lesson after compaction." } }) };
    } },
    ui: { async log() {} },
  };
  return { $, handlers, calls };
}

test("compaction resets only after committed boundary and rewrites the next summary before storage", async () => {
  const { $, handlers, calls } = fixture();
  const append = handlers.get("session.append");
  const boundary = { door: "compaction", uuid: "b1", agentId: "child", message: { type: "system", name: "compact_boundary", content: [] } };
  let committed = false;
  const boundaryResult = await append($, boundary, async (e) => { committed = true; assert.equal(calls.length, 0); return { message: e.message, uuid: e.uuid }; });
  assert.equal(committed, true);
  assert.equal(boundaryResult.uuid, "b1");
  assert.equal(calls[0].type, "compacted");
  assert.equal(calls[0].agentId, "child");
  const summary = { door: "compaction", uuid: "s1", agentId: "child", message: { type: "user", role: "user", content: [{ type: "text", text: "Summary." }] } };
  const original = structuredClone(summary);
  const result = await append($, summary, async (e) => {
    assert.deepEqual(e.message.content.map((b) => b.text), ["Summary.", "Fresh lesson after compaction."]);
    return { message: e.message, uuid: e.uuid };
  });
  assert.deepEqual(summary, original);
  assert.equal(result.uuid, "s1");
  assert.deepEqual(calls[1].messages, [{ role: "user", content: original.message.content }]);
  await append($, summary, async (e) => { assert.equal(e, summary); return { message: e.message, uuid: e.uuid }; });
  assert.equal(calls.length, 2);
});

test("uncommitted, failed and other-conversation compaction never resets or injects", async () => {
  const { $, handlers, calls } = fixture();
  const append = handlers.get("session.append");
  const boundary = { door: "compaction", uuid: "b1", agentId: "child", message: { type: "system", name: "compact_boundary", content: [] } };
  await assert.rejects(append($, boundary, async () => { throw new Error("host failure"); }), /host failure/);
  assert.equal(calls.length, 0);
  await append($, boundary, async (e) => ({ message: e.message, uuid: e.uuid }));
  const summary = { door: "compaction", uuid: "s1", message: { type: "user", role: "user", content: [{ type: "text", text: "Main summary." }] } };
  await append($, summary, async (e) => { assert.equal(e, summary); return { message: e.message, uuid: e.uuid }; });
  assert.equal(calls.length, 1);
});

test("connection and warning failures preserve the original host result and error", async () => {
  const { $, handlers } = fixture();
  $.http.fetch = async () => { throw new Error("offline"); };
  $.ui.log = async () => { throw new Error("host gone"); };
  const original = { additionalContext: ["another hook"] };
  let executions = 0;
  const result = await handlers.get("classic.UserPromptSubmit")($, { prompt: "hello" }, async () => { executions++; return original; });
  assert.equal(result, original);
  assert.equal(executions, 1);
  const error = new Error("original host error");
  await assert.rejects(handlers.get("classic.UserPromptSubmit")($, {}, async () => { throw error; }), (thrown) => thrown === error);
});

test("each child's first retrieval includes its own task before the host stores it", async () => {
  const { $, handlers, calls } = fixture();
  for (const id of ["a", "b"]) await handlers.get("turn.start")($,
    { agentId: id, turnId: `turn-${id}`, text: `Task for ${id}` }, async () => ({}));
  for (const id of ["b", "a"]) {
    await handlers.get("classic.SubagentStart")($, { agent_id: id }, async () => ({}));
    assert.equal(calls.at(-1).prompt, `Task for ${id}`);
    assert.deepEqual(calls.at(-1).messages, []);
  }
  await handlers.get("turn.start")($, { agentId: "a", turnId: "next-a", text: "New task" }, async () => ({}));
  await handlers.get("turn.complete")($, { agentId: "a", turnId: "turn-a" }, async () => ({}));
  await handlers.get("classic.SubagentStart")($, { agent_id: "a" }, async () => ({}));
  assert.equal(calls.at(-1).prompt, "New task");
});
