---
title: "API reference"
description: "The public Sovara Python SDK surface and exact client methods."
---

<script src="/assets/sdk-nav.js"></script>

The package exports `SovaraClient`, `auto_instrument`, `trace`, the
[explicit step](#explicit-steps) and [cross-process](#cross-process-recordings)
functions, the step data types (`LlmCall`, `ToolCall`, `McpCall`, `ConversationInput`,
`Message`, `TextBlock`, `SuccessOutcome`, `Execution`, ...) and the
[errors](#errors). Trace, logging and lesson helpers are methods on `SovaraClient`.
Import from `sovara` (or `sovara.integration` when building an integration); other modules are
internal.

## `auto_instrument()`

Installs recording for model calls made through `httpx`, `requests`, `urllib3`
(including botocore) and `aiohttp`, MCP client calls, and Google ADK tools.

- Call it once at startup, before creating provider clients.
- Libraries imported later are patched on import.
- Calling it again does nothing.

```python
import sovara

sovara.auto_instrument()
```

## `SovaraClient(*, project_name, api_key=None, base_url=None, agent_token=None, http_client=None, async_http_client=None)`

Creates a client bound to one project name. Project admins can rename a project
from the Sovara app; update this value when they do.

```python
from sovara import SovaraClient

client = SovaraClient(project_name="finance-agent")
```

| Parameter | Required | Purpose |
| --- | --- | --- |
| `project_name` | Yes | Stable project name for every top-level trace created by this client. |
| `base_url` | No | Sovara server URL. Set this option or `SOVARA_SERVER_URL`, or use the server you signed in to with `sovara login`. For a headless host, also configure `api_key`. |
| `api_key` | No | Project or organization API key. Defaults to `SOVARA_API_KEY`. [Create a key](/get-started/installation#api-keys). |
| `http_client` | No | Caller-owned synchronous `httpx.Client`. Sovara uses it for lifecycle and runtime requests and does not close it. |
| `async_http_client` | No | Caller-owned `httpx.AsyncClient` for `async with` traces and async methods; not closed by Sovara. |

`client.close()` / `await client.aclose()` release the connections the client opened.

For a remote server, pass `base_url` and `api_key` explicitly:

```python
import os
from sovara import SovaraClient

client = SovaraClient(
    project_name="finance-agent",
    base_url="https://sovara.example.com",
    api_key=os.environ["SOVARA_API_KEY"],
)
```

## `client.trace(name=None, *, trace_id=None, eval_run_id=None, capture_logs=True, lesson_scope=<inherit>)`

Opens a recording session on a durable trace, usable with `with` or `async with`.
No turn is created implicitly; work outside `turn()` remains recorded without a turn.

```python
with client.trace("sync-agent"):
    ...

async with client.trace("async-agent", trace_id=chat_id):
    ...
```

| Argument | Purpose |
| --- | --- |
| `name` | Optional display name. Sovara generates one when omitted. |
| `trace_id` | Optional. Pass your own stable identifier or the ID yielded by a previous SDK trace. Reuse it to add steps to the same trace in this project. |
| `eval_run_id` | Optional eval run that owns this trace. Set it when the trace starts; subtraces inherit it and it cannot change later. |
| `capture_logs` | Captures `stdout` and `stderr` by default. Disable for concurrent top-level traces. |
| `lesson_scope` | Folder path or list for this trace. Omit to inherit; `None` selects root/all; `[]` disables retrieval. |

Entering the context yields the trace ID, or `None` if recording is unavailable.
Use a stable `trace_id` to append to the same trace. A `sovara-` ID must already exist
in the project. A clean exit raises `RecordingError` if the server cannot complete the
recording; an exit caused by an exception never replaces that exception.

## `client.subtrace(name, *, lesson_scope=<inherit>)`

Creates a child trace under the active trace.

```python
with client.trace("batch"):
    with client.subtrace("sample-1"):
        trace_one_sample()
```

`name` is required. Returns `SovaraTraceContext`, supporting `with` and
`async with`; entering it yields
the subtrace's trace ID, or `None` in no-capture mode. Requires an enclosing trace
opened by the same client.

## `client.turn(*, turn_input=None)`

Groups one interaction in the active trace or subtrace. Supports `with` and
`async with`, yielding the turn ID or `None` if recording is unavailable.
`turn_input` accepts a string or `None`. Use the same client and do not nest
turns within a trace. Entry raises `RecordingError` if the server does not accept the
turn.

```python
with client.trace("conversation", trace_id="chat-123"):
    with client.turn(turn_input="Hi.") as turn_id:
        reply = respond()
```

Finish tasks and streams before leaving the trace. See the
[usage guide](/sdks/python/use-the-sdk#explicit-conversation-turns) for turn examples.

## `trace(fn=None, *, name=None, meta=None)`

Wraps a sync or async function as a tool-like step. It is the only top-level
instrumentation helper. It records a step inside the current trace and does not
open a trace; use `client.trace()` for that.

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
records raised exceptions, and re-raises them. Arguments and results that aren't JSON
values are recorded by type name only. Decorating a generator function raises
`SovaraConfigError`; record its consumption with [`start_step()`](#explicit-steps).

## Lesson methods

### `client.lesson_scope(scope)`

Temporarily replaces the active lesson scope. Paths include descendants;
`None` means root/all and `[]` disables retrieval.

```python
with client.lesson_scope(["conventions/", "markets/"]):
    call_model()
```

### `client.disable_lesson_injection()`

Temporarily prevents lesson retrieval while leaving tracing active, including for
explicit steps and `retrieve_lessons()`.

## `client.create_eval_run()`

Creates an evaluation in the client's project and returns its `eval_run_id`
(`await client.acreate_eval_run()` in async code).
Record samples with `client.trace(eval_run_id=...)`, then log results with `client.log()`.

## `client.log(*, trace_id=..., eval_run_id=..., **fields)`

Logs to an explicit target, including after the recording context closes.
No identifier is inherited from a context. Agent traces and eval runs must already exist.

| Supplied targets | Meaning |
| --- | --- |
| `trace_id` | Update that trace or subtrace using its Sovara ID or your own identifier. |
| `eval_run_id` | Update custom fields on that eval run. |
| Both | Check that the eval run owns the trace, then update the trace's fields. |
| Neither | Validation error. |

Reserved fields `trace_input`, `trace_output`, `groundtruth`, and `llm_judge_output`
accept strings; `llm_judge_is_correct` accepts a boolean. These require `trace_id`.
Custom fields accept booleans, strings, finite floats, and integers between
-2**53 and 2**53. Explicit `None` is invalid.

Writes replace supplied fields and leave others unchanged. Logging never changes
a trace's evaluation owner. `groundtruth` updates the trace annotation;
`llm_judge_is_correct` records a separate evaluation verdict.
See [Evaluations](/evals/evals-in-sovara) for aggregate metrics and accuracy.
On an eval sample, a numeric `latency_ms` replaces the measured runtime there.

```python
eval_run_id = client.create_eval_run()
with client.trace(eval_run_id=eval_run_id) as trace_id:
    if trace_id is None:
        raise RuntimeError("This evaluation requires a recorded sample.")
    client.log(trace_id=trace_id, trace_input=question, groundtruth=expected_answer)
    answer = agent(question)

client.log(
    trace_id=trace_id,
    eval_run_id=eval_run_id,
    trace_output=answer,
    llm_judge_output="The answer matches the expected value.",
    llm_judge_is_correct=True,
    latency_ms=842,
)
client.log(eval_run_id=eval_run_id, accuracy=1.0, sample_count=1)
```

`log()` and `create_eval_run()` raise on errors; `await client.alog(...)` and
`acreate_eval_run()` are the async forms. Skip trace logging when recording yields
`None`. The SDK retries transient failures itself without applying a write twice. If
a call still fails, the write may have succeeded: `log()` replaces the supplied fields,
so repeating it is harmless, but check before repeating `create_eval_run()`.

## `client.get_trace_id()`

Returns the current trace or subtrace ID as a string, or `None` when called outside
an active trace.

```python
trace_id = client.get_trace_id()
```

## Context and tracing controls

### `client.with_context(fn)`

Captures the current context and returns a wrapper for another thread. Each call runs in
a fresh copy of it; a coroutine function runs as a task in that copy.

```python
executor.submit(client.with_context(eval_sample), sample)
```

### `client.disable_tracing()`

Temporarily disables automatic recording and `trace`. Explicit steps and logging still
record.

```python
with client.disable_tracing():
    noisy_or_sensitive_work()
```

## Explicit steps

Record calls that automatic recording doesn't capture. Each function has an async form
with an `a` prefix (`astart_step`, `arecord_step`, `aretrieve_lessons`), as do the `Step`
methods (`aend`, `afinish`, `afail`, `acancel`). A step belongs to the recording, turn and
lesson scope active when it starts, so it can end in another task. Outside a trace,
arguments are still validated, then nothing is sent: `start_step()` returns an inactive
step whose methods do nothing, and the others return `None`.

### `start_step(call, *, lessons=False, step_uuid=None)`

Reserves a step for a call about to run and returns a `Step`. `call` is an `LlmCall`,
`ToolCall` or `McpCall`; a copy is recorded. `lessons=True` (LLM calls only) retrieves
lessons for it.

| `Step` member | Purpose |
| --- | --- |
| `id`, `call`, `recorded`, `done` | Step UUID, recorded call, whether the server accepted the step, whether it ended. |
| `lesson_context` | `LessonContext(text, retrieval_id)` to insert into a conversation call, or `None`. |
| `prepared_request` | For an `HttpModelInput` call: the request with lessons already inserted, or `None`. |
| `activate()` | `with step.activate():` around the call stops automatic recording from recording it again. |
| `finish(output=None, *, execution=None, latency_seconds=None)` | Report success. |
| `fail(error=None, *, output=None, execution=None, latency_seconds=None)` | Report failure; an exception is recorded as its class name and message. |
| `cancel(reason=None, *, output=None, execution=None, latency_seconds=None)` | Report cancellation, with optional partial output. |
| `end(outcome, *, execution=None, latency_seconds=None)` | Report a `SuccessOutcome`, `ErrorOutcome` or `CancelledOutcome`. |

Latency defaults to the time since `start_step()`. Repeating the same report is
harmless; a different report after one was accepted raises `SovaraConfigError`.

A model call with lessons, where `send` is your client:

```python
from sovara import (
    ConversationInput, ConversationOutput, Execution, LlmCall, Message, TextBlock, start_step,
)

def ask(messages: list[Message]) -> Message:
    call = LlmCall(provider="acme", model="acme-1", input=ConversationInput(messages=tuple(messages)))
    step = start_step(call, lessons=True)
    lessons = step.lesson_context
    sent = list(messages)
    if lessons is not None:
        sent.append(Message(role="user", content=(TextBlock(text=lessons.text),)))
    execution = Execution(
        input=ConversationInput(messages=tuple(sent)),
        injected_retrieval_id=lessons.retrieval_id if lessons else None,
    )
    with step.activate():
        try:
            reply = send(sent)
        except Exception as exc:
            step.fail(exc, execution=execution)
            raise
    step.finish(ConversationOutput(message=reply), execution=execution)
    return reply
```

`execution` describes what was actually sent. After lessons were offered, a successful
model step must report it; set `injected_retrieval_id` only if you inserted them.
Insert the lessons as one separate user message at the end, as above, and leave it out of
later calls; retrieval then matches the conversation's history and uses only what is new.

Mark a message that stands in for earlier history, such as a compaction summary, with
`summary=True`. Lesson retrieval reads it as background and follows the latest user request.
Lessons whose text is still in the conversation are not retrieved again.

### `record_step(call, outcome, *, execution=None, latency_seconds=None, step_uuid=None)`

Records an operation that already finished, in one request, and returns its step ID.
Lessons are never retrieved for it.

```python
from sovara import SuccessOutcome, ToolCall, record_step

record_step(ToolCall(name="cache_lookup", arguments={"key": key}), SuccessOutcome(output=value))
```

### `retrieve_lessons(context, *, ignore_lesson_ids=())`

Returns lessons for free-form text without reserving a step, or `None` when none match or
lessons are disabled. Report insertion through a model step's `execution`.

## Cross-process recordings

Share one recording between processes, such as an agent's hooks. These are root
functions of `sovara`; `open_recording`, `start_turn` and `close_recording` have async
forms with an `a` prefix.

| Function | Purpose |
| --- | --- |
| `open_recording(*, project_name, name=None, trace_id=None, eval_run_id=None, lesson_scope=..., base_url=None, agent_token=None, http_client=None, parent=None)` | Open a recording that stays open until `close_recording()`, and return its handle. Binds nothing in the calling process. With `parent=handle`, open a child trace under that handle's turn instead (omit project, trace and connection arguments). |
| `resume_recording(handle, *, http_client=None, async_http_client=None)` | `with` / `async with` block that binds the handle's recording, turn and lesson scope. Sends nothing on entry or exit and does not close the recording. |
| `start_turn(turn_input=None)` | Start a turn in the bound recording; it stays bound for the rest of the block. Returns the turn ID, or `None` without a recording. |
| `export_recording()` | Return a handle for the bound recording and its current turn, or `None`. Export again after `start_turn()` to pass the turn on. |
| `get_trace_id()` | The bound recording's trace ID, whichever client or handle bound it. |
| `close_recording(handle, *, http_client=None)` | Close the recording. Closing again with the same handle succeeds for 24 hours. |

- Inside a resumed recording, use these functions and the explicit step functions.
  `client.log(trace_id=sovara.get_trace_id(), ...)` also works.
- A handle contains the recording's write token, not the project credential. Keep it
  private.
- Handles work across the Python and TypeScript SDKs.

## Files in recorded calls

When the Sovara server stores files, base64 files in model calls, such as images, PDFs and
audio, are uploaded in the background and the recorded step refers to them. Files waiting to
upload may total 64 MiB by default, and the SDK's memory use grows with that limit. Set
`SOVARA_FILE_UPLOAD_QUEUE_MIB` before your application starts to change it, or to `0` to keep
every file inside its recorded step. A file that does not fit also stays inside its step.
Uploads still running when the process exits get 10 s to finish; in a short-lived process,
call `sovara.integration.flush_recordings(timeout)` before it exits.

## Errors

| Exception | Meaning |
| --- | --- |
| `SovaraConfigError` | Invalid arguments or use, or the server rejected the credential or request. A `ValueError`. Fix the code or configuration. |
| `CompatibilityError` | The Sovara server and SDK versions are incompatible. Follow the update instructions in the error message. |
| `RecordingError` | The server could not be reached or did not accept a write. `code`, `status_code` and `retryable` describe it; the write may still have succeeded. |
| `ProtocolDeprecationWarning` | A warning: the server has scheduled retirement of the protocol this SDK uses. Update the SDK. |

- Never raise `RecordingError`: automatic recording, `@trace`, the integration packages,
  and opening a trace (it yields `None`).
- Raise `RecordingError`: `log`, `create_eval_run`, explicit steps, cross-process
  functions, entering `turn()` and a clean trace exit. Catch it where the agent must keep
  running.
- `SovaraConfigError` and `CompatibilityError` always propagate.

## Integrations

Framework integrations are separate packages; see [Integrations](/integrations/overview).
`sovara.integration` holds the helpers they build on: fail-safe `begin` / `report`,
`report_raised`, `json_value`, `capture_active`, `subtrace`, `log_trace_io`,
`short_retries` and `flush_recordings`.

Inside `short_retries()`, Sovara never holds up the application for long: transient failures
are retried for 5 s, and each request gives up after 5 s, or 10 s for a step that waits for
lessons (never later than the HTTP client's own timeout). From synchronous code, step finishes
and recording completion are sent in the background, in order, and their failures are only
logged; asynchronous code awaits them, since a task left on an event loop dies with it.
`flush_recordings(timeout)` waits for background sends; call it before closing an HTTP client
they use or before a short-lived process exits.

`auto_instrument()` and the integration packages record inside `short_retries()` themselves,
so this applies to every call they record. For example, a model call of `sovara-langchain`
gets no lessons when retrieval takes longer than 10 s.
