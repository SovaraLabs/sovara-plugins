---
title: "Troubleshooting"
description: "Diagnose missing TypeScript traces, steps, project assignment, and noisy logs."
---

<script src="/assets/sdk-nav.js"></script>

## Common checks

| Symptom | Check |
| --- | --- |
| No trace appears | Confirm the entrypoint reaches and awaits `sovara_client.trace(...)`. Check the terminal for a Sovara warning. |
| A trace appears without model or tool steps | Await `autoInstrument()` once at startup, before creating provider clients or agents. |
| `CompatibilityError` | The Sovara server is older than the SDK. Update the Sovara server. |
| An evaluation sample is missing from Traces | Look in <strong><Icon icon="chart-no-axes-column" size={14} /> Evaluations</strong>; the main Traces view excludes evaluation-owned samples. |
| Lessons are missing | Check that the key allows lessons, the proposal was applied, automatic injection is enabled, required models are configured, and the lesson scope includes the right folders. |
| Trace appears in the wrong project | Check the `projectName` passed to `new SovaraClient(...)`. |
| An LLM or supported framework tool call is missing | Confirm the call executes and completes before the `trace(...)` callback returns. |
| A custom operation is missing | Wrap its shared execution boundary with `trace`. |
| Logs mix between concurrent traces | Set `captureLogs: false` on concurrent top-level traces. |

## Recording is unavailable

[Install the CLI](/cli/install) and sign in with `sovara login`; the
SDK records to that server. On a headless host, set `url` and `apiKey` (or
`SOVARA_API_KEY`); see the
[API reference](/sdks/typescript/api-reference).

An unreachable server may let your agent continue without recording.
`getTraceId()` returns `undefined` in that case; skip `log()` for that trace.

Explicit calls such as `log()` reject with `RecordingError` when the server fails.
Catch it where the agent must keep running. See [Errors](/sdks/typescript/api-reference#errors).

## Missing custom steps

Await `autoInstrument()` before creating clients or agents or capturing a reference to
`fetch`. Add `trace` only to operations that are not already recorded:

```ts
const retrieveContext = trace(async function retrieveContext(question: string) {
  return vectorSearch(question);
});
```

## Inspect what was recorded

```bash
sovara probe <trace-id>
sovara probe <trace-id> --step <step-ref> --preview
sovara logs <trace-id> --tail 40
```

Use step references shown by `probe`.

## Traces and turns

Keep agent work inside `trace()` and await tasks and streams before the callback
returns. Declare conversation turns with `turn()`; they are not created automatically.
Do not nest turns in the same trace or use a different client inside it.
See [the usage guide](/sdks/typescript/use-the-sdk#explicit-conversation-turns).
