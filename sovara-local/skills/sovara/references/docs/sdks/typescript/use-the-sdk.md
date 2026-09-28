---
title: "Use the SDK"
description: "Understand TypeScript project identity, runs, steps, subruns, metadata, and lessons."
---

<script src="/assets/sdk-nav.js"></script>

## Project-owned top-level runs

Create one `SovaraClient` for a stable project name. Use one top-level run for
one user request, conversation turn, eval sample, batch job, or other execution
you want to inspect.

```ts
const sovara_client = new SovaraClient({ projectName: "support-agent" });

await sovara_client.run("research-and-answer", () => runAgent());
```

The client ensures the exec server is reachable, registers the run, executes
the callback in an `AsyncLocalStorage` scope, and finalizes the run in
`finally`.

For a durable conversation or job, pass an application-owned correlation ID.
Reusing it within the same project appends to the canonical Sovara run.

```ts
await sovara_client.run(
  "support chat",
  () => agent.reply(message),
  { runKey: chatId },
);
```

Keep prompts and secrets out of `runKey`. `clientRunId` remains accepted as a
deprecated alias during the compatibility period. `run()` returns the callback
result. To read Sovara's durable canonical UUID, call
`sovara_client.getRunId()` inside the callback while the run is active.
The CLI can address this run using either that UUID or the application key:

```bash
sovara probe --project-id support-agent --run-key "$CHAT_ID"
```

## Steps and explicit tracing

Supported provider, framework tool, and MCP calls inside a run become ordered
steps. Wrap an important uncaptured application boundary with `trace`:

```ts
const lookupCustomer = trace(async function lookupCustomer(customerId: string) {
  return crm.lookup(customerId);
});
```

Prefer shared tool or dispatch chokepoints. A trace filled with miscellaneous
helper calls is harder to understand than one that exposes agent decisions and
actions.

## Subruns

Use `sovara_client.subrun(...)` for child agents, delegated branches, parallel
work, and coherent multi-step phases:

```ts
await sovara_client.run("finance-eval", () =>
  sovara_client.subrun("sample-42", () => runOneSample("sample-42")),
);
```

Nested top-level runs are ignored with a warning. Use a subrun when child work
should appear in the run tree.

## Run metadata

```ts
await sovara_client.run("answer-question", async () => {
  await sovara_client.logInput(question);
  const answer = await agent(question);
  await sovara_client.logOutput(answer);
  await sovara_client.logMetrics({ answered: true, latencyBudgetMs: 2500 });
});
```

Metrics accept booleans, integers, and finite numbers.

## Lessons

Automatic lesson injection is project-wide by default for supported model
calls. Narrow retrieval with the run's `lessonScope` option:

```ts
await sovara_client.run(
  "answer-question",
  () => callModel(question),
  { lessonScope: "support/refunds/" },
);
```

Temporarily replace the active scope with `sovara_client.lessonScope(...)`.
Sovara retrieves lessons independently for each supported model call and adds a
supplementary user message only to the copied request sent to the provider. It
does not change the conversation objects owned by your app.

## Logs and concurrency

Log capture is enabled by default. Pass `{ captureLogs: false }` as the third
argument to `run()` for concurrent top-level runs to avoid mixing process output.

## Run the application

Run the application normally. The SDK records the run:

```bash
npm run start
```

Open Sovara to inspect the recorded run.

Use the [API reference](/sdks/typescript/api-reference) for exact signatures.

## Explicit conversation turns

`run()` opens a recording session without an implicit turn. `turn(options, fn)`
declares a scoped interaction and returns the callback result. Work outside turn
callbacks is still captured, with no turn membership.

```ts
await sovara_client.run("conversation", async () => {
  await setup();
  await sovara_client.turn({ turnInput: "Hi." }, async () => respond());
  await sovara_client.turn({ turnInput: "Another question." }, async () => respond());
  await cleanup();
}, { runKey: "chat-123" });
```

For one recording per interaction, reuse the same project-scoped key and declare
each interaction explicitly:

```ts
for (const message of messages) {
  await sovara_client.run("conversation", async () => {
    return await sovara_client.turn({ turnInput: message }, () => respond());
  }, { runKey: "chat-123" });
}
```

Each callback installs an immutable context and restores its parent on exit.
There is no turn-close request or credential rotation. Empty callbacks remain
visible as empty turns. `turnInput` accepts only a string or `undefined`; `null`
and other types are rejected before requests. Empty strings, Unicode, spaces,
and line breaks are preserved exactly. `logInput()` and `logOutput()` remain
latest-value properties of the whole run, separate from the interaction input.

Same-run nested turns and using a different client inside the run are rejected.
A subrun's invocation belongs to the parent's turn; the child starts without a
turn and may declare its own. Tasks inherit the originating `AsyncLocalStorage`
scope, so a later turn never reassigns them. Await parallel tasks and fully
consume streams before the outer `run()` callback returns. Concurrent turn
sections are logical groups, not a total timeline.

These SDKs require `runner-api` 2. Upgrade app-server and exec-server together;
version-1 servers and servers without compatibility metadata are rejected before
the agent code starts. An unreachable server keeps the no-capture fallback,
including execution of turn callbacks.
