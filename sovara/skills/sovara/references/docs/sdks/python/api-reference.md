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

## `client.run(name=None, *, run_id=None, eval_run_id=None, capture_logs=True, lesson_scope=<inherit>)`

Opens a recording session on a durable run, usable with `with` or `async with`.
No turn is created implicitly; work outside `turn()` remains recorded without a turn.

```python
with client.run("sync-agent"):
    ...

async with client.run("async-agent", run_id=chat_id):
    ...
```

| Argument | Purpose |
| --- | --- |
| `name` | Optional display name. Sovara generates one when omitted. |
| `run_id` | Optional. Pass your own stable identifier or a `sovara-` id. Reusing either value opens another recording session in the same durable run; declare turns explicitly. |
| `eval_run_id` | Optional eval run that owns this run. Set it when the run starts; subruns inherit it and it cannot change later. |
| `capture_logs` | Captures `stdout` and `stderr` by default. Disable for concurrent top-level runs. |
| `lesson_scope` | Folder path or list for this run. Omit to inherit; `None` selects root/all; `[]` disables retrieval. |

`run_id` is sent as given; the server derives the canonical id within the selected
project. A `sovara-` id must already exist in that project. `run_key` and
`client_run_id` were removed; pass `run_id` instead.

A `run_id` the server rejects as invalid (blank, longer than 1024 characters, or a
malformed `sovara-` id) raises `SovaraConfigError`. A `sovara-` id that does not exist
raises it only with `eval_run_id`; otherwise the run continues without recording.

Returns `SovaraRunContext`. Entering it yields the canonical run ID, generated if
`run_id` is omitted, or `None` if recording is unavailable. Reuse either value to
reach the same run.

## `client.subrun(name, *, lesson_scope=<inherit>)`

Creates a child run under the active run.

```python
with client.run("batch"):
    with client.subrun("sample-1"):
        run_one_sample()
```

`name` is required. Returns `SovaraRunContext`; entering it yields the subrun's run ID.

## `client.turn(*, turn_input=None)`

Declares an interaction inside the current run or subrun. Returns a context
manager usable with `with` and `async with`; entering yields a new turn ID, or
`None` in no-capture mode. `turn_input` accepts only `str` or `None` and preserves
text exactly. Exiting restores the parent context without closing or rotating
the recording. Nested turns in the same run and wrong-client use are errors.

```python
with client.run("conversation", run_id="chat-123"):
    with client.turn(turn_input="Hi.") as turn_id:
        reply = respond()
```

Calls and tasks retain the turn captured when they start. Finish parallel work
and consume streams before leaving the outer run. Logged `run_input`/`run_output`
remain aggregate run properties. Empty turns are retained. Scoped turns require
runner-api 4;
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

## `client.create_eval_run()`

Creates an eval run record in the client's project and returns its generated
`eval_run_id`. An eval run represents one evaluation execution: it groups agent
runs and stores aggregate results. This method creates the record; your code
executes the evaluation, recording each sample with `client.run(eval_run_id=...)`,
and logs its results.

## `client.log(*, run_id=..., eval_run_id=..., **fields)`

Logs to an explicit target, including after the recording context closes.
No identifier is inherited from a context. Agent runs and eval runs must already exist.

| Supplied targets | Meaning |
| --- | --- |
| `run_id` | Update that run or subrun: the canonical ID or your own identifier. |
| `eval_run_id` | Update custom fields on that eval run. |
| Both | Check that the eval run owns the run, then update the run's fields. |
| Neither | Validation error. |

Reserved run fields `run_input`, `run_output`, `groundtruth`, and
`llm_judge_output` accept strings. `llm_judge_is_correct` accepts a boolean.
All require `run_id`. `run_key` and `client_run_id` were removed; the provisional
`eval_id` name is also rejected (use `eval_run_id`). Other fields accept strictly
`bool`, `int`, finite `float`, or `str`. Explicit `None` is invalid.
Integers are stored as numbers, so they must be between -2**53 and 2**53;
larger values are rejected. Log very large identifiers as strings.
Writing a field replaces its previous value; omitted fields remain unchanged.
Passing a single target without fields is invalid; passing both without fields
only checks ownership. A run belongs to at most one eval
run, chosen by `run(eval_run_id=...)`; `log()` never assigns an owner, and
logging to a run another eval run owns is rejected. The eval run reads that
run's current values, rather than a frozen copy.
The app shows an eval run's accuracy from its samples' `llm_judge_is_correct`
verdicts, excluding samples without one; logging an `accuracy` fraction (0 to 1)
on the eval run overrides it. Other aggregate metrics must be logged explicitly
and are not recalculated when a run changes. Logging a judgment does not invoke a model.

`groundtruth` is the run's ground-truth annotation, the same value you edit in
the app. Log it while the run is active so the run's analysis uses it.

```python
eval_run_id = client.create_eval_run()
with client.run(eval_run_id=eval_run_id) as run_id:
    client.log(run_id=run_id, run_input=question, groundtruth=expected_answer)
    answer = agent(question)

client.log(
    run_id=run_id,
    eval_run_id=eval_run_id,
    run_output=answer,
    llm_judge_output="The answer matches the expected value.",
    llm_judge_is_correct=True,
    latency_ms=842,
)
client.log(eval_run_id=eval_run_id, accuracy=1.0, sample_count=1)
```

`log()` and `create_eval_run()` are synchronous and propagate errors. Unlike the
recording context's no-capture fallback, explicit logging fails when the server
is unavailable. If context entry yields `None`, skip run logging or handle the
unavailable recording; `log(run_id=None, ...)` is invalid.

Successful logging acknowledges a database commit. Writes are ordered with
other accepted writes to the same run within one exec-server process. A server
acknowledgement timeout or transport timeout leaves the write outcome unknown:
the write may still commit. The SDK does not automatically retry it. A request
that could not connect was never sent, so the SDK re-checks the exec server
(restarting a local one that stopped while idle) and sends it once more.

`log_input()`, `log_output()`, and `log_metrics()` were removed. Pass the same values
to `log(run_id=..., run_input=..., run_output=..., **metrics)` instead.

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
