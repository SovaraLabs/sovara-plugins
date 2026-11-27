---
title: "API reference"
description: "The public client, trace, tracing, subtrace, logging, and lesson APIs in @sovara/sdk."
---

<script src="/assets/sdk-nav.js"></script>

The main package exports `SovaraClient`, `autoInstrument`, `trace`, the
[explicit step](#explicit-steps) and [cross-process](#cross-process-recordings)
functions, the [errors](#errors), and TypeScript types for options and step data
(`Call`, `Outcome`, `Execution`, `Message`, ...). Integration packages build on
`@sovara/sdk/integration`; other paths are internal.

## `autoInstrument()`

Installs recording for model calls made through `fetch`, `node:http` and the AWS SDK's
HTTP/2 handler, and MCP client tool calls.

- Await it once at startup, before creating provider clients or agents and before code
  keeps its own reference to `fetch`.
- Calling it again does nothing.

```ts
import { autoInstrument } from "@sovara/sdk";

await autoInstrument();
```

## `new SovaraClient(options)`

Creates a project-bound client. Project identity and connection configuration
belong to the client, not to individual traces.

```ts
import { SovaraClient, trace } from "@sovara/sdk";

const sovara_client = new SovaraClient({ projectName: "support-agent" });
```

| Option | Required | Purpose |
| --- | --- | --- |
| `projectName` | Yes | Project name selected by SDK code. Project admins can rename a project; update this value when they do. |
| `url` | No | Sovara server URL. Set this option or `SOVARA_SERVER_URL`, or use the server you signed in to with `sovara login`. For a headless host, also configure `apiKey`. |
| `apiKey` | No | Project or organization API key. Defaults to `SOVARA_API_KEY`. [Create a key](/get-started/installation#api-keys). |
| `fetch` | No | Caller-owned `fetch` implementation used for lifecycle and runtime requests. |

## `sovara_client.trace(name, fn, options?)`

Opens and finalizes a recording session around a synchronous or asynchronous
callback. No turn is created implicitly; work outside `turn()` remains recorded
without a turn.

```ts
await sovara_client.trace("agent-task", async () => traceAgent());
```

| Option | Purpose |
| --- | --- |
| `traceId` | Your own stable identifier or the ID from `getTraceId()` in a previous SDK trace. Reuse it to add steps to the same trace in this project. |
| `evalRunId` | Existing evaluation run in this project that owns the sample trace. Set on creation; inherited by subtraces and cannot be reassigned. |
| `captureLogs` | Captures stdout/stderr unless set to `false`. |
| `lessonScope` | Folder path, path list, `null` for root/all, or `[]` to disable retrieval. |

Returns the callback result as `Promise<T>`. Use `getTraceId()` inside the callback
to read the trace ID. A supplied `sovara-` ID must already exist in the project.

If the server is unreachable, the callback may run without recording and
`getTraceId()` returns `undefined`. Authentication, compatibility, and callback
errors propagate. After the callback succeeds, the promise rejects with
`RecordingError` if the server cannot complete the recording.

For a remote server:

```ts
const sovara_client = new SovaraClient({
  projectName: "support-agent",
  url: "https://sovara.example.com",
  apiKey: process.env.SOVARA_API_KEY,
});
```

## `sovara_client.subtrace(name, fn, options?)`

Creates a child trace under the active trace. The optional `lessonScope` replaces
the inherited lesson scope for that child.

```ts
await sovara_client.subtrace("research", () => research(question));
```

Returns `Promise<T>` for the callback result. Requires an enclosing trace
opened by the same client; the callback still executes if that enclosing trace
is in no-capture mode.

## `sovara_client.turn(options, fn)`

Groups one interaction in the active trace or subtrace. Accepts optional
`turnInput?: string` and returns the callback result as `Promise<T>`.

```ts
await sovara_client.trace("conversation", async () => {
  return await sovara_client.turn({ turnInput: "Hi." }, () => respond());
}, { traceId: "chat-123" });
```

Use the same client and do not nest turns within a trace. Rejects with `RecordingError`
if the server does not accept the turn. Finish tasks and streams before the outer trace
returns. See the
[usage guide](/sdks/typescript/use-the-sdk#explicit-conversation-turns) for examples.

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
The curried form `trace(options)(fn)` and Stage 3 method decorators are also
supported. Use standard decorators rather than TypeScript's legacy
`experimentalDecorators` mode. Wrapping a synchronous function preserves its
synchronous return value; wrapping an async function preserves its promise. Wrapping a
generator function throws `SovaraConfigError`; record its consumption with
[`startStep()`](#explicit-steps).

## `sovara_client.lessonScope(scope, fn)`

Temporarily replaces the active lesson scope. Paths include descendants;
`null` or a root marker selects all lessons, and `[]` disables retrieval.
Restores the previous scope when the callback completes and returns the callback
result as `Promise<T>`. It can wrap an existing trace's work or establish a scope
for traces opened inside the callback. Inside an active trace, use the same client.

```ts
await sovara_client.lessonScope(["conventions/", "markets/"], traceOneSample);
```

## `sovara_client.createEvalRun()`

Creates an evaluation in the client's project and resolves to its `evalRunId`. Record
samples with `trace(..., { evalRunId })`, then log results with `log()`.

## `sovara_client.log(options)`

Logs to an explicit target, including after the trace has ended. No identifier is
inherited from the active trace; read it with `getTraceId()` inside the callback. Agent
traces and eval runs must already exist.

| Supplied targets | Meaning |
| --- | --- |
| `traceId` | Update that trace or subtrace using its Sovara ID or your own identifier. |
| `evalRunId` | Update custom fields on that eval run. |
| Both | Check that the eval run owns the trace, then update the trace's fields. |
| Neither | `SovaraConfigError`. |

`traceInput`, `traceOutput`, `groundtruth` and `llmJudgeOutput` accept strings and
`llmJudgeIsCorrect` a boolean; they require `traceId`. Serialize structured values with
`JSON.stringify()`. `fields` holds custom fields: booleans, strings, finite numbers, and
integers between -2**53 and 2**53. Omit a field rather than passing `null`.

```ts
const evalRunId = await sovara_client.createEvalRun();
let traceId: string | undefined;
const answer = await sovara_client.trace("sample-1", async () => {
  traceId = sovara_client.getTraceId();
  return agent(question);
}, { evalRunId });
if (traceId) {
  await sovara_client.log({
    traceId,
    evalRunId,
    traceInput: question,
    traceOutput: answer,
    llmJudgeIsCorrect: true,
    fields: { latency_ms: 842 },
  });
}
await sovara_client.log({ evalRunId, fields: { accuracy: 1.0, sample_count: 1 } });
```

Writes replace the supplied fields and leave others unchanged. On an eval sample, a
numeric `latency_ms` field replaces the measured runtime on the
[Evaluations](/evals/evals-in-sovara) page. Validation errors reject with
`SovaraConfigError` and server failures with `RecordingError`. The SDK retries transient
failures itself; if a call still fails the write may have succeeded, so check before
repeating `createEvalRun()`.

## `sovara_client.disableTracing(fn)` and `sovara_client.disableLessonInjection(fn)`

Run `fn` without automatic recording and `trace` steps, or without lessons (including for
explicit steps and `retrieveLessons()`). Explicit steps and logging still record. Both
return `fn`'s result.

```ts
await sovara_client.disableTracing(() => warmCacheWithoutRecording());
```

## `sovara_client.getTraceId()`

Returns the current trace or subtrace ID as a string, or `undefined` when called
outside an active trace.

```ts
const traceId = sovara_client.getTraceId();
```

## Explicit steps

Record calls that automatic recording doesn't capture. A step belongs to the recording,
turn and lesson scope active when it starts, so it can end in another task. Outside a
trace, arguments are still validated, then nothing is sent: `startStep()` resolves to an
inactive step whose methods do nothing, and the others resolve to `null`. Step data uses
the wire types: calls are `{ kind: "llm" | "tool" | "mcp", ... }`, outcomes
`{ status: "success" | "error" | "cancelled", ... }`.

### `startStep(call, options?)`

Reserves a step for a call about to run and resolves to a `Step`. Options: `lessons`
(LLM calls only) retrieves lessons for it; `stepUuid` sets its ID.

| `Step` member | Purpose |
| --- | --- |
| `id`, `call`, `recorded`, `done` | Step UUID, recorded call, whether the server accepted the step, whether it ended. |
| `lessonContext` | `{ text, retrieval_id }` to insert into a conversation call, or `null`. |
| `preparedRequest` | For an HTTP model call: the request with lessons already inserted, or `null`. |
| `activate(fn)` | Runs `fn` without automatic recording, so the owned call isn't recorded twice. |
| `finish(output?, { execution?, latencySeconds? })` | Report success. |
| `fail(error?, { output?, execution?, latencySeconds? })` | Report failure. |
| `cancel(reason?, { output?, execution?, latencySeconds? })` | Report cancellation, with optional partial output. |
| `end(outcome, { execution?, latencySeconds? })` | Report an outcome object. |

Latency defaults to the time since `startStep()`. Repeating the same report is harmless;
a different report after one was accepted rejects with `SovaraConfigError`.

A model call with lessons, where `send` is your client:

```ts
import { startStep, type Message } from "@sovara/sdk";

async function ask(messages: Message[]): Promise<Message> {
  const input = { format: "conversation" as const, messages };
  const step = await startStep({ kind: "llm", provider: "acme", model: "acme-1", input }, { lessons: true });
  const lessons = step.lessonContext;
  const sent: Message[] = lessons
    ? [...messages, { role: "user", content: [{ type: "text", text: lessons.text }] }]
    : messages;
  const execution = {
    input: { format: "conversation" as const, messages: sent },
    injected_retrieval_id: lessons?.retrieval_id ?? null,
  };
  let reply: Message;
  try {
    reply = await step.activate(() => send(sent));
  } catch (error) {
    await step.fail(error, { execution });
    throw error;
  }
  await step.finish({ message: reply }, { execution });
  return reply;
}
```

`execution` describes what was actually sent. After lessons were offered, a successful
model step must report it; set `injected_retrieval_id` only if you inserted them.
Insert the lessons as one separate user message at the end, as above, and leave it out of
later calls; retrieval then matches the conversation's history and uses only what is new.

Mark a message that stands in for earlier history, such as a compaction summary, with
`summary: true`. Lesson retrieval reads it as background and follows the latest user request.
Lessons whose text is still in the conversation are not retrieved again.

### `recordStep(call, outcome, options?)`

Records an operation that already finished, in one request, and resolves to its step ID.
Options: `execution`, `latencySeconds`, `stepUuid`. Lessons are never retrieved for it.

```ts
await recordStep({ kind: "tool", name: "cache_lookup", arguments: { key } }, { status: "success", output: value });
```

### `retrieveLessons(context, { ignoreLessonIds? })`

Resolves to lessons for free-form text without reserving a step, or `null` when none match
or lessons are disabled. Report insertion through a model step's `execution`.

## Cross-process recordings

Share one recording between processes, such as an agent's hooks.

| Function | Purpose |
| --- | --- |
| `openRecording({ projectName, name?, traceId?, evalRunId?, lessonScope?, url?, agentToken?, fetch? })` | Open a recording that stays open until `closeRecording()`, and resolve to its handle. Binds nothing in the calling process. |
| `openRecording({ parent, name?, lessonScope?, fetch? })` | Open a child trace under the parent handle's turn. |
| `resumeRecording(handle, fn, { fetch? })` | Run `fn` with the handle's recording, turn and lesson scope bound. Sends nothing and does not close the recording. |
| `startTurn(turnInput?)` | Start a turn in the bound recording; it stays bound for the rest of the callback. Resolves to the turn ID, or `null` without a recording. |
| `exportRecording()` | A handle for the bound recording and its current turn, or `null`. Export again after `startTurn()` to pass the turn on. |
| `getTraceId()` | The bound recording's trace ID, whichever client or handle bound it. |
| `closeRecording(handle, { fetch? })` | Close the recording. Closing again with the same handle succeeds for 24 hours. |

- Inside a resumed recording, use these functions and the explicit step functions.
  `sovara_client.log({ traceId: getTraceId(), ... })` also works.
- A handle contains the recording's write token, not the project credential. Keep it
  private.
- Handles work across the Python and TypeScript SDKs.

## Files in recorded calls

When the Sovara server stores files, base64 files in model calls, such as images, PDFs and
audio, are uploaded in the background and the recorded step refers to them. Files waiting to
upload may total 64 MiB by default, and the SDK's memory use grows with that limit. Set
`SOVARA_FILE_UPLOAD_QUEUE_MIB` before your application starts to change it, or to `0` to keep
every file inside its recorded step. A file that does not fit also stays inside its step.
In a short-lived process, `await flushRecordings(timeoutMs)` before it exits, with a timeout
long enough for the uploads.

## Errors

| Error | Meaning |
| --- | --- |
| `SovaraConfigError` | Invalid arguments or use, or the server rejected the credential or request. Fix the code or configuration. |
| `CompatibilityError` | The Sovara server and SDK versions are incompatible. Follow the update instructions in the error message. |
| `RecordingError` | The server could not be reached or did not accept a write. `code`, `status` and `retryable` describe it; the write may still have succeeded. |

- Never reject with `RecordingError`: automatic recording, `trace`, the integration
  packages, and starting a trace (the callback runs unrecorded).
- Reject with `RecordingError`: `log`, `createEvalRun`, explicit steps, cross-process
  functions, `turn()` and completing a trace. Catch it where the agent must keep running.
- `SovaraConfigError` and `CompatibilityError` always propagate.

## Integrations

Framework integrations are separate packages; see [Integrations](/integrations/overview).
`@sovara/sdk/integration` holds the helpers they build on: fail-safe `begin` / `report`,
`reportInBackground`, `jsonValue`, `isCaptureActive`, `withShortRetries` and
`flushRecordings`.

Inside `withShortRetries()`, Sovara never holds up the application for long: transient
failures are retried for 5 s, each request gives up after 5 s (10 s for a step that waits for
lessons), and step finishes and recording completion are sent in the background, in order,
with failures only logged. `await flushRecordings(timeoutMs)` waits for those sends; call it
before a short-lived process exits.

`autoInstrument()` and the integration packages record inside `withShortRetries()`
themselves, so this applies to every call they record. For example, a model call of
`@sovara/langchain` gets no lessons when retrieval takes longer than 10 s.
