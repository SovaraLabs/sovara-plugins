---
title: "Troubleshooting"
description: "Diagnose missing Python traces, steps, project assignment, and context."
---

<script src="/assets/sdk-nav.js"></script>

## Common checks

| Symptom | Check |
| --- | --- |
| No trace appears | Confirm the entrypoint enters `sovara_client.trace(...)`. Check the terminal for a Sovara warning. |
| A trace appears without model or tool steps | Call `sovara.auto_instrument()` once at startup, before creating provider clients. |
| `CompatibilityError` | The Sovara server is older than the SDK. Update the Sovara server. |
| An evaluation sample is missing from Traces | Look in <strong><Icon icon="chart-no-axes-column" size={14} /> Evaluations</strong>; the main Traces view excludes evaluation-owned samples. |
| Lessons are missing | Check that the key allows lessons, the proposal was applied, automatic injection is enabled, required models are configured, and the lesson scope includes the right folders. |
| Trace appears in the wrong project | Check the `project_name` passed to `SovaraClient(...)`. |
| An LLM or supported framework tool call is missing | Confirm the call executes before the `trace(...)` context exits. |
| A custom operation is missing | Wrap its shared execution boundary with `trace`. |
| Threaded work attaches to the wrong trace | Submit `sovara_client.with_context(fn)` to the executor. |
| Logs mix between concurrent traces | Set `capture_logs=False` on concurrent top-level traces. |

## Recording is unavailable

[Install the CLI](/cli/install) and sign in with `sovara login`; the
SDK records to that server. On a headless host, set `base_url` and configure
`api_key` or `SOVARA_API_KEY`; see the
[API reference](/sdks/python/api-reference).

An unreachable server may let your agent continue without recording. Check the
trace ID before logging:

```python
with sovara_client.trace("answer-question") as trace_id:
    answer = run_agent(question)
    if trace_id is not None:
        sovara_client.log(trace_id=trace_id, trace_output=answer)
```

Explicit calls such as `log()` raise `RecordingError` when the server fails. Catch it
where the agent must keep running. See [Errors](/sdks/python/api-reference#errors).

## Missing custom steps

Call `sovara.auto_instrument()` before creating provider clients and tools. Framework tools
need their [integration](/integrations/overview), for example `sovara_openai_agents.instrument()`
with the supported `openai-agents>=0.13.6,<0.14` version installed by the integration.
Add `@trace` only to operations that are not already recorded:

```python
from sovara import trace

@trace
def retrieve_context(question: str) -> list[str]:
    return vector_search(question)
```

## Inspect what was recorded

```bash
sovara probe <trace-id>
sovara probe <trace-id> --step <step-ref> --preview
sovara logs <trace-id> --tail 40
```

Use step references shown by `probe`.

## Traces and turns

Keep agent work inside `trace()` and await tasks and streams before leaving it.
Use `with_context()` when passing work to another thread.

Declare conversation turns with `turn()`; they are not created automatically.
Do not nest turns in the same trace or use a different client inside it.
See [the usage guide](/sdks/python/use-the-sdk#explicit-conversation-turns).
