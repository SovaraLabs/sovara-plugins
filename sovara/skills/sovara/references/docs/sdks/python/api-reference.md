---
title: "API reference"
description: "The public Sovara Python SDK surface and exact client methods."
---

<script src="/assets/sdk-nav.js"></script>

The package exports `SovaraClient` and `trace`. Run-scoped helpers are methods
on `SovaraClient`; module-level `run`, `subrun`, and logging helpers are not
supported.

## `SovaraClient(*, project_name, base_url=None, agent_token=None, http_client=None)`

Creates a client bound to one project name. Project admins can rename a project
from the Sovara app; update this value when they do.

```python
from sovara import SovaraClient

client = SovaraClient(project_name="finance-agent")
```

| Parameter | Required | Purpose |
| --- | --- | --- |
| `project_name` | Yes | Stable project name for every top-level run created by this client. |
| `base_url` | No | Exec server URL. Defaults to `SOVARA_EXEC_SERVER_URL` or the local exec server. |
| `agent_token` | No | Project-scoped token for an agent host without a signed-in Sovara user. |
| `http_client` | No | Caller-owned synchronous `httpx.Client`. Sovara uses it for lifecycle and runtime requests and does not close it. |

`client.project_name` is read-only. For a remote agent host, keep the token in
the host's secret manager or an excluded `.env` file and pass it explicitly:

```python
import os
import httpx
from sovara import SovaraClient

http_client = httpx.Client()  # Optional: proxy, custom CA, or other transport settings.
client = SovaraClient(
    project_name="finance-agent",
    base_url="https://exec.example.com",
    agent_token=os.environ["SOVARA_AGENT_TOKEN"],
    http_client=http_client,
)
```

The custom client is optional. Without it, Sovara creates and manages its
normal internal HTTP client.

## `client.run(name=None, *, run_key=None, client_run_id=None, capture_logs=True, lesson_scope=<inherit>)`

Opens a recording session on a durable run, usable with `with` or `async with`.
No turn is created implicitly; work outside `turn()` remains recorded without a turn.

```python
with client.run("sync-agent"):
    ...

async with client.run("async-agent", run_key=chat_id):
    ...
```

| Argument | Purpose |
| --- | --- |
| `name` | Optional display name. Sovara generates one when omitted. |
| `run_key` | Optional project-scoped correlation key. Reusing it opens another recording session in the same durable run; declare turns explicitly. |
| `client_run_id` | Deprecated compatibility alias for `run_key`. |
| `capture_logs` | Captures `stdout` and `stderr` by default. Disable for concurrent top-level runs. |
| `lesson_scope` | Folder path or list for this run. Omit to inherit; `None` selects root/all; `[]` disables retrieval. |

`run_key` and `client_run_id` are trimmed and must be non-empty when supplied.
If both are provided, their normalized values must match. Keys are scoped to
the selected project.

Returns `SovaraRunContext`.

## `client.subrun(name, *, lesson_scope=<inherit>)`

Creates a child run under the active run.

```python
with client.run("batch"):
    with client.subrun("sample-1"):
        run_one_sample()
```

`name` is required. Returns `SovaraRunContext`.

## `client.turn(*, turn_input=None)`

Declares an interaction inside the current run or subrun. Returns a context
manager usable with `with` and `async with`; entering yields a new turn ID, or
`None` in no-capture mode. `turn_input` accepts only `str` or `None` and preserves
text exactly. Exiting restores the parent context without closing or rotating
the recording. Nested turns in the same run and wrong-client use are errors.

```python
with client.run("conversation", run_key="chat-123"):
    with client.turn(turn_input="Hi.") as turn_id:
        reply = respond()
```

Calls and tasks retain the turn captured when they start. Finish parallel work
and consume streams before leaving the outer run. `log_input()`/`log_output()`
remain aggregate run properties. Empty turns are retained. Requires runner-api 2;
see [the usage guide](use-the-sdk#explicit-conversation-turns) for both patterns.

## `trace(fn=None, *, name=None, meta=None)`

Wraps a sync or async function as a tool-like step. It is the only top-level
instrumentation helper.

```python
from sovara import trace

@trace(name="lookup_customer", meta={"system": "crm"})
def lookup_customer(customer_id: str):
    return crm.get(customer_id)
```

| Argument | Purpose |
| --- | --- |
| `fn` | Function to wrap. Omit when using decorator options. |
| `name` | Optional step name; defaults to the function name. |
| `meta` | Optional step metadata. |

The wrapper preserves the call signature, records arguments and return values,
records raised exceptions, and re-raises them.

## Lesson methods

### `client.lesson_scope(scope)`

Temporarily replaces the active lesson scope. Paths include descendants;
`None` means root/all and `[]` disables retrieval.

```python
with client.lesson_scope(["conventions/", "markets/"]):
    call_model()
```

### `client.disable_lesson_injection()`

Temporarily prevents automatic lesson retrieval while leaving tracing active.

## `client.log_input(input)`

Stores the latest user-visible input string on the active run. This value
appears in the Input column of the Runs table and replaces the previously
logged input.

```python
sovara_client.log_input(question)
```

Outside an active run, it logs a warning and does nothing.

## `client.log_output(output)`

Stores the latest user-visible output string on the active run. This value
appears in the Output column of the Runs table and replaces the previously
logged output.

```python
sovara_client.log_output(answer)
```

Outside an active run, it logs a warning and does nothing.

## `client.log_metrics(**metrics)`

Adds filterable custom metrics to the active run. Values must be booleans,
integers, or finite floats; keys must be lower snake case and at most 32
characters.

```python
sovara_client.log_metrics(answered=True, latency_ms=842)
```

Logging the same key again updates its latest value. Outside an active run, it
logs a warning and does nothing.

## `client.get_run_id()`

Returns the current run or subrun ID as a string, or `None` when called outside
an active run.

```python
run_id = sovara_client.get_run_id()
```

## Context and tracing controls

### `client.with_context(fn)`

Captures the current context and returns a wrapper for another thread.

```python
executor.submit(client.with_context(eval_sample), sample)
```

### `client.disable_tracing()`

Temporarily disables supported provider, MCP, and explicit `trace` recording.

```python
with client.disable_tracing():
    noisy_or_sensitive_work()
```
