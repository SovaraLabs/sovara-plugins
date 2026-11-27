---
title: "Use the SDK"
description: "Understand TypeScript project identity, traces, steps, subtraces, metadata, and lessons."
---

<script src="/assets/sdk-nav.js"></script>

## Turn on automatic recording

Await `autoInstrument()` once at startup, before creating provider clients or agents and
before any code keeps its own reference to `fetch`:

```ts
import { autoInstrument } from "@sovara/sdk";

await autoInstrument();
```

Inside a trace, it records:

- model calls made through `fetch`, `node:http` and the AWS SDK's HTTP/2 handler
- MCP client tool calls

Top-level `await` needs an ES module (for example a `.mts` file). Otherwise, await it at
the start of your entry function.

## Project-owned top-level traces

Create one `SovaraClient` for a stable project name. Use one top-level trace for
a workflow, evaluation sample, batch job, or durable conversation. A recording
session appends work to that trace; a [turn](#explicit-conversation-turns) groups
one interaction within it.

```ts
import { SovaraClient, trace } from "@sovara/sdk";

const sovara_client = new SovaraClient({ projectName: "support-agent" });

await sovara_client.trace("research-and-answer", () => traceAgent());
```

For a durable conversation or job, pass your own stable identifier as `traceId`,
or reuse the ID from `getTraceId()` in a previous SDK trace. Reuse either value to add steps
to the same trace in that project.

```ts
await sovara_client.trace(
  "support chat",
  () => agent.reply(message),
  { traceId: chatId },
);
```

Keep prompts and secrets out of `traceId`. `trace()` returns the callback result. To
read the trace ID, call `sovara_client.getTraceId()` inside the callback
while the trace is active. Pass that ID to the CLI, here as `TRACE_ID`:

```bash
sovara probe "$TRACE_ID"
```

## Steps and explicit tracing

Supported provider, framework tool, and MCP calls inside a trace become ordered
steps. Wrap an important uncaptured application boundary with `trace`:

```ts
const lookupCustomer = trace(async function lookupCustomer(customerId: string) {
  return crm.lookup(customerId);
});
```

Prefer shared tool or dispatch chokepoints. A trace filled with miscellaneous
helper calls is harder to understand than one that exposes agent decisions and
actions.

## Subtraces

Use `sovara_client.subtrace(...)` for child agents, delegated branches, parallel
work, and coherent multi-step phases:

```ts
await sovara_client.trace("finance-eval", () =>
  sovara_client.subtrace("sample-42", () => traceOneSample("sample-42")),
);
```

Use `subtrace()` for child work. Nesting `trace()` does not create a child trace.

## Trace metadata

Use `log()` with an explicit trace to attach input, output, and custom fields:

```ts
await sovara_client.trace("answer-question", async () => {
  const traceId = sovara_client.getTraceId();
  const answer = await agent(question);
  if (traceId) {
    await sovara_client.log({
      traceId,
      traceInput: question,
      traceOutput: answer,
      fields: { answered: true, latency_budget_ms: 2500 },
    });
  }
});
```

Input and output must be strings; serialize structured values with `JSON.stringify()`.
Custom `fields` accept booleans, strings, and finite numbers (integers within ±2**53).
`getTraceId()` returns `undefined` when recording is unavailable; skip logging then.
`log()` also works after the trace ends. See the
[API reference](/sdks/typescript/api-reference) for validation rules.

## Evaluation samples

Create an evaluation, record each sample under it with `evalRunId`, then log verdicts and
aggregate results:

```ts
const evalRunId = await sovara_client.createEvalRun();
let traceId: string | undefined;
const answer = await sovara_client.trace("sample-42", async () => {
  traceId = sovara_client.getTraceId();
  return agent(question);
}, { evalRunId });
if (traceId) {
  await sovara_client.log({ traceId, evalRunId, traceOutput: answer, llmJudgeIsCorrect: true });
}
await sovara_client.log({ evalRunId, fields: { accuracy: 1.0 } });
```

See [Evaluations](/evals/evals-in-sovara) for metrics and verdicts.

## Lessons

When automatic injection is enabled and the required models are configured,
supported model calls retrieve from the project's production lessons.
Unapplied proposals are not used. Narrow retrieval with the trace's `lessonScope` option:

```ts
await sovara_client.trace(
  "answer-question",
  () => callModel(question),
  { lessonScope: "support/refunds/" },
);
```

Temporarily replace the active scope with `sovara_client.lessonScope(...)`
inside the trace. Use `null` for all folders or `[]` for no lessons:

```ts
await sovara_client.trace("answer-question", async () => {
  return await sovara_client.lessonScope("support/refunds/", () => callModel(question));
});
```

See [runtime retrieval](/sovaradb/auto-injection) for project settings.

## Logs and concurrency

Log capture is enabled by default. Pass `{ captureLogs: false }` as the third
argument to `trace()` for concurrent top-level traces to avoid mixing process output.

## Run the application

Run the application normally. The SDK records the trace:

```bash
npm run start
```

Open Sovara to inspect the recorded trace.

Use the [API reference](/sdks/typescript/api-reference) for exact signatures.

## Explicit conversation turns

`trace()` opens a recording session without an implicit turn. `turn(options, fn)`
declares a scoped interaction and returns the callback result. Work outside turn
callbacks is still captured, with no turn membership.

```ts
await sovara_client.trace("conversation", async () => {
  await setup();
  await sovara_client.turn({ turnInput: "Hi." }, async () => respond());
  await sovara_client.turn({ turnInput: "Another question." }, async () => respond());
  await cleanup();
}, { traceId: "chat-123" });
```

For one recording per interaction, reuse the same `traceId` and declare
each interaction explicitly:

```ts
for (const message of messages) {
  await sovara_client.trace("conversation", async () => {
    return await sovara_client.turn({ turnInput: message }, () => respond());
  }, { traceId: "chat-123" });
}
```

`turnInput` is an optional string for the interaction; logged input and output
describe the whole trace. Do not nest turns in the same trace. Await tasks and
consume streams before the outer callback returns.

## Record calls Sovara does not capture

When a model, tool or MCP call isn't captured automatically, record it yourself.
`startStep()` reserves a step before the call, `activate()` keeps automatic recording
from recording the same call twice, and `finish()`, `fail()` or `cancel()` reports how it
ended:

```ts
import { startStep, type JsonObject } from "@sovara/sdk";

async function runTool(name: string, args: JsonObject) {
  const step = await startStep({ kind: "tool", name, arguments: args });
  let result;
  try {
    result = await step.activate(() => dispatch(name, args));
  } catch (error) {
    await step.fail(error);
    throw error;
  }
  await step.finish(result);
  return result;
}
```

For an operation that already finished, `recordStep(call, outcome)` records it in one
request. For a model call, pass `{ lessons: true }` to `startStep()` to receive matching
lessons as `step.lessonContext`; insert them into the request and report what you sent
with `execution`. See the [API reference](/sdks/typescript/api-reference#explicit-steps).

Outside a trace these functions send nothing. Inside one they reject with
`RecordingError` when the server fails.

## Share a recording across processes

Agent hooks often run as separate short-lived processes. One process opens a recording
and stores the returned handle; later ones resume it to add turns and steps; the last one
closes it.

The handle is a string that your code must keep between processes; Sovara doesn't store it
for you. In the example, `storePrivately` and `loadHandle` are your own helpers, not Sovara
functions: they save the handle to a file only the current user can read, and read it back.

```ts
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { closeRecording, exportRecording, openRecording, recordStep, resumeRecording, startTurn } from "@sovara/sdk";

// Your own storage for the handle (not part of Sovara).
const handleFile = join(homedir(), ".my-agent", "sovara-handle");

// Save the handle where only this user can read it; it contains a write token.
async function storePrivately(handle: string): Promise<void> {
  await mkdir(dirname(handleFile), { recursive: true });
  await writeFile(handleFile, handle, { mode: 0o600 });
}

// Read the handle a previous process saved.
const loadHandle = () => readFile(handleFile, "utf8");

// Session start
await storePrivately(await openRecording({ projectName: "coding-agent", name: "session" }));

// Each prompt, in another process
await resumeRecording(await loadHandle(), async () => {
  await startTurn(prompt);
  await storePrivately(exportRecording()!); // The handle now carries the turn.
});

// Each tool call
await resumeRecording(await loadHandle(), () =>
  recordStep({ kind: "tool", name: tool, arguments: args }, { status: "success", output: result }),
);

// Session end
await closeRecording(await loadHandle());
await rm(handleFile);
```

- `openRecording({ parent: handle })` opens a child trace, for example for a subagent.
- Inside a resumed recording, use `getTraceId()` with `sovara_client.log()`.
- A handle contains a write token. Keep it private.
- Handles work across the Python and TypeScript SDKs.

## Framework integrations

LangChain, LangGraph, the OpenAI Agents SDK, Claude Code and Pi have their own packages, such
as `@sovara/langchain` and `@sovara/openai-agents`. See [Integrations](/integrations/overview).
