import assert from "node:assert/strict";
import { test } from "node:test";
import { ClaudeSession } from "../src/claude/session.mjs";

function fixture() {
  let sequence = 0;
  const rows = [];
  const scopes = [];
  const selection = { lessons: [{ lesson_id: "banana" }], rendered_lessons_block: "Julian likes bananas.", retrieval_id: "r1" };
  function handle(kind, input, traceId) {
    const row = { kind, input, traceId, recordingId: `r${++sequence}`, state: "active" };
    Object.assign(row, {
      async finish(output) { row.state = "finished"; row.output = output; },
      async fail(error, options) { row.state = "failed"; row.error = error.message; row.failureOptions = options; },
      async cancel() { row.state = "cancelled"; },
    });
    rows.push(row);
    return row;
  }
  function scope(traceId = `trace${++sequence}`) {
    const row = handle("recording", null, traceId);
    Object.assign(row, {
      async startChild() { return scope(); }, async attachChild(id) { return scope(id); },
      async startTurn(input) {
        const turn = handle("turn", input, traceId);
        turn.startModelObservation = async (options) => handle("model", options, traceId);
        turn.startTool = async (options) => handle("tool", options, traceId);
        return turn;
      },
      async retrieveLessons(options) { scopes.push(options); return selection; },
    });
    return row;
  }
  const state = { data: { binding: "project/session", agents: {} }, async save() {}, async close() {} };
  const client = { async startRecording() { return scope("root"); } };
  return { session: new ClaudeSession({ client, state }), rows, scopes, state };
}

test("duplicate starts settle once; main and resumed child retain the same trace and separate turns", async () => {
  const { session, rows } = fixture();
  const agents = [{ id: "child", description: "Child task", type: "general-purpose" }];
  await session.dispatch({ type: "turn-start", turnId: "main" });
  const event = { type: "model-start", turnId: "c1", agentId: "child", agents, index: 0, model: "fixture", messages: [] };
  const first = await session.dispatch(event);
  const duplicate = await session.dispatch(event);
  assert.deepEqual(duplicate, first);
  assert.equal(rows.filter((r) => r.kind === "model").length, 1);
  await session.dispatch({ type: "model-end", key: first.key, result: { stopReason: "end_turn", answer: "done", usage: { input_tokens: 12, output_tokens: 3 } } });
  await session.dispatch({ type: "turn-end", turnId: "c1", agentId: "child", reason: "answer" });
  const initial = rows.filter((r) => r.kind === "recording" && r.traceId !== "root")[0];
  await session.dispatch({ type: "turn-start", turnId: "c2", agentId: "child", agents });
  const recordings = rows.filter((r) => r.kind === "recording" && r.traceId === initial.traceId);
  assert.equal(recordings.length, 2);
  assert.notEqual(recordings[0].recordingId, recordings[1].recordingId);
  await session.close();
  assert.equal(rows.filter((r) => r.kind === "model")[0].state, "finished");
});

test("retrieval excludes only confirmed target delivery and resets at committed compaction", async () => {
  const { session, scopes } = fixture();
  const first = await session.dispatch({ type: "lessons", messages: [], prompt: "Does Julian like bananas?" });
  await session.dispatch({ type: "lessons", messages: [] });
  assert.deepEqual(scopes[1].ignoreLessonIds, []);
  const messages = [{ role: "user", content: [{ type: "text", text: first.text }] }];
  await session.dispatch({ type: "lessons", messages });
  assert.deepEqual(scopes[2].ignoreLessonIds, ["banana"]);
  await session.dispatch({ type: "compacted", boundary: "boundary1" });
  await session.dispatch({ type: "lessons", messages });
  assert.deepEqual(scopes[3].ignoreLessonIds, []);
  await session.close();
});

test("unknown parent cannot silently become a main child; child context denial cannot fall back", async () => {
  const { session, rows } = fixture();
  await assert.rejects(session.dispatch({ type: "turn-start", agentId: "unknown", turnId: "u", agents: [] }), /parent/);
  await assert.rejects(session.dispatch({ type: "lessons", messages: { deny: "unavailable" } }), /unavailable/);
  assert.equal(rows.length, 0);
  await session.close();
});

test("closing records unfinished work as cancelled and does not close an application-owned parent", async () => {
  const f = fixture();
  const parent = { state: "active", traceId: "app", recordingId: "app-r", async startTurn() { return { startTool: async () => ({ async cancel() { parent.toolCancelled = true; } }), async cancel() { parent.turnCancelled = true; } }; }, async finish() { parent.state = "finished"; } };
  const session = new ClaudeSession({ state: f.state, rootRecording: parent });
  await session.dispatch({ type: "tool-start", turnId: "t", callId: "tool1", name: "Read", input: {} });
  await session.close();
  assert.equal(parent.state, "active");
  assert.equal(parent.toolCancelled, true);
  assert.equal(parent.turnCancelled, true);
});

test("a new host turn closes abandoned capture and ignores late terminal events without touching other agents", async () => {
  const { session, rows } = fixture();
  const old = await session.dispatch({ type: "model-start", turnId: "old", index: 0, model: "fixture", messages: [] });
  const agents = [{ id: "child", type: "general-purpose" }];
  const child = await session.dispatch({ type: "model-start", agentId: "child", turnId: "child-turn", agents, index: 0, model: "fixture", messages: [] });
  await session.dispatch({ type: "turn-start", turnId: "new" });
  assert.equal(rows.filter((row) => row.kind === "turn")[0].state, "cancelled");
  assert.equal(session.steps.has(old.key), false);
  assert.equal(session.steps.has(child.key), true);
  const active = rows.filter((row) => row.kind === "turn").at(-1);
  await session.dispatch({ type: "model-end", key: old.key, result: { stopReason: "end_turn" } });
  await session.dispatch({ type: "turn-end", turnId: "old", reason: "answer" });
  assert.equal(active.state, "active");
  assert.equal(session.steps.has(child.key), true);
  await session.close();
});

test("returned tool errors retain the host result while thrown errors and model errors do not invent output", async () => {
  const { session, rows } = fixture();
  const result = { isError: true, text: "Controlled error", content: [{ type: "text", text: "Original details" }] };
  const tool = await session.dispatch({ type: "tool-start", turnId: "t", callId: "mcp1", name: "mcp__test__fail", mcp: true, input: {} });
  await session.dispatch({ type: "tool-end", key: tool.key, result });
  assert.equal(rows.at(-1).state, "failed");
  assert.equal(rows.at(-1).input.kind, "mcp");
  assert.deepEqual(rows.at(-1).failureOptions, { output: result });
  const thrown = await session.dispatch({ type: "tool-start", turnId: "t", callId: "t2", name: "Read", input: {} });
  await session.dispatch({ type: "tool-end", key: thrown.key, error: "Thrown" });
  assert.equal(rows.at(-1).failureOptions, undefined);
  const model = await session.dispatch({ type: "model-start", turnId: "t", index: 0, model: "fixture", messages: [] });
  await session.dispatch({ type: "model-end", key: model.key, error: "Provider unavailable" });
  assert.equal(rows.at(-1).failureOptions, undefined);
  await session.close();
});
