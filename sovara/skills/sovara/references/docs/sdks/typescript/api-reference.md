---
title: "API reference"
description: "The public client, run, tracing, subrun, logging, and lesson APIs in @sovara/runner."
---

<script src="/assets/sdk-nav.js"></script>

## `new SovaraClient(options)`

Creates a project-bound client. Project identity and connection configuration
belong to the client, not to individual runs.

```ts
const sovara_client = new SovaraClient({ projectName: "support-agent" });
```

| Option | Required | Purpose |
| --- | --- | --- |
| `projectName` | Yes | Project name selected by SDK code. Project admins can rename a project; update this value when they do. |
| `url` | No | Exec server URL; normally resolved from Sovara configuration. |
| `agentToken` | No | Project-scoped token for an agent host without a signed-in Sovara user. Defaults to `SOVARA_AGENT_TOKEN`. |
| `fetch` | No | Caller-owned `fetch` implementation used for lifecycle and runtime requests. |

## `sovara_client.run(name, fn, options?)`

Opens and finalizes a recording session around a synchronous or asynchronous
callback. No turn is created implicitly; work outside `turn()` remains recorded
without a turn.

```ts
await sovara_client.run("agent-task", async () => runAgent());
```

| Option | Purpose |
| --- | --- |
| `runKey` | Project-scoped correlation key. Reusing it opens another recording session in the same durable run; declare turns explicitly. |
| `clientRunId` | Deprecated compatibility alias for `runKey`. |
| `captureLogs` | Captures stdout/stderr unless set to `false`. |
| `lessonScope` | Folder path, path list, `null` for root/all, or `[]` to disable retrieval. |

`runKey` and `clientRunId` are trimmed and must be non-empty when supplied. If
both are provided, their normalized values must match. Keys are scoped to the
selected project.

Returns `Promise<T>` for the callback result and rethrows callback errors after
finalization.

For a remote agent host, keep the token in its secret manager or an excluded
`.env` file and configure the client once. A custom `fetch` is optional:

```ts
const sovara_client = new SovaraClient({
  projectName: "support-agent",
  url: "https://exec.example.com",
  agentToken: process.env.SOVARA_AGENT_TOKEN,
  fetch: customFetch, // Optional: proxy, custom CA, or other transport behavior.
});

await sovara_client.run("agent-task", async () => runAgent());
```

## `sovara_client.subrun(name, fn, options?)`

Creates a child run under the active run. The optional `lessonScope` replaces
the inherited lesson scope for that child.

```ts
await sovara_client.subrun("research", () => research(question));
```

Returns `Promise<T>` for the callback result and throws when no run is active.

## `sovara_client.turn(options, fn)`

Declares an interaction inside the current run or subrun and returns `Promise<T>`
for its sync or async callback result. `SovaraTurnOptions` has one optional field,
`turnInput?: string`. `null` and non-string values are rejected; text is preserved
exactly. Callback exit restores the parent context without a close request or
credential rotation. Callback errors propagate after restoring the context.

```ts
await sovara_client.run("conversation", async () => {
  return await sovara_client.turn({ turnInput: "Hi." }, () => respond());
}, { runKey: "chat-123" });
```

Nested turns in the same run and wrong-client use are errors. Tasks and streams
retain their originating scope; finish them before the outer run returns.
`logInput()`/`logOutput()` remain aggregate run properties. Empty turns are
retained. Requires runner-api 2; see [the usage guide](use-the-sdk#explicit-conversation-turns)
for continuous and per-interaction recording patterns.

## `trace(fn, options?)`

Wraps a synchronous or asynchronous function as a step, recording arguments,
return values, latency, status, and exceptions.

```ts
const lookupCustomer = trace(
  async function lookupCustomer(customerId: string) {
    return crm.get(customerId);
  },
  { name: "lookup_customer", meta: { system: "crm" } },
);
```

`name` defaults to the function or method name. `meta` adds step metadata.
Stage 3 method-decorator use is also supported when the TypeScript compiler is
configured for decorators.

## `sovara_client.lessonScope(scope, fn)`

Temporarily replaces the active lesson scope. Paths include descendants;
`null` or a root marker selects all lessons, and `[]` disables retrieval.

```ts
await sovara_client.lessonScope(["conventions/", "markets/"], runOneSample);
```

## `sovara_client.logInput(value)`

Stores the latest user-visible input on the active run. This value appears in
the Input column of the Runs table and replaces the previously logged input.
Objects and arrays are serialized as JSON.

```ts
await sovara_client.logInput({ question, customerId });
```

Returns `Promise<void>`. Outside an active run, it warns once and does nothing.

## `sovara_client.logOutput(value)`

Stores the latest user-visible output on the active run. This value appears in
the Output column of the Runs table and replaces the previously logged output.
Objects and arrays are serialized as JSON.

```ts
await sovara_client.logOutput({ answer, sources });
```

Returns `Promise<void>`. Outside an active run, it warns once and does nothing.

## `sovara_client.logMetrics(metrics)`

Adds filterable custom metrics to the active run. Values must be booleans or
finite numbers; keys must be lower snake case and at most 32 characters.

```ts
await sovara_client.logMetrics({ answered: true, latency_ms: 842 });
```

Returns `Promise<void>`. Logging the same key again updates its latest value.
Outside an active run, it warns once and does nothing.

## `sovara_client.getRunId()`

Returns the current run or subrun ID as a string, or `undefined` when called
outside an active run.

```ts
const runId = sovara_client.getRunId();
```
