---
title: "Use the SDK"
description: "Understand project clients, traces, steps, subtraces, metadata, and lessons."
---

<script src="/assets/sdk-nav.js"></script>

## The ownership model

The Python SDK exposes two top-level building blocks:

- `SovaraClient` owns project identity and trace-scoped helpers.
- `trace` wraps application functions that should appear as steps.

```python
from sovara import SovaraClient, trace

sovara_client = SovaraClient(project_name="support-agent")
```

All trace, subtrace, logging, lesson, and control operations go through that client.
The project is not inferred from the working directory.

## Turn on automatic recording

Call `auto_instrument()` once at startup, before creating provider clients:

```python
import sovara

sovara.auto_instrument()
```

Inside a trace, it records:

- model calls made through `httpx`, `requests`, `urllib3` (including botocore) and `aiohttp`
- MCP client calls
- Google ADK tools

Clients created before the call are not recorded.

## Top-level traces

Use a top-level trace for a workflow, evaluation sample, batch job, or durable
conversation. A recording session opens that trace for appending work; a
[turn](#explicit-conversation-turns) groups one interaction within it.

```python
with sovara_client.trace("research-and-answer"):
    answer = run_agent()
```

The SDK registers the trace with the Sovara server when the context opens and
finalizes it when the context exits. The same context works with `with` and
`async with`.

For a durable conversation or workflow, pass your own stable identifier as
`trace_id`, or reuse the trace ID yielded by a previous SDK trace. Reuse either value
to add new steps to the same trace in that project.

```python
with sovara_client.trace("support chat", trace_id=chat_id) as trace_id:
    reply = agent.reply(message)
    if trace_id is not None:
        sovara_client.log(trace_id=trace_id, trace_input=message, trace_output=reply)
```

Keep prompts, messages, and secrets out of `trace_id`; use a stable ID such
as a chat, ticket, or job ID.

The context yields the trace ID. Omit `trace_id` to create a new trace. Pass
that ID to the CLI, here as `TRACE_ID`:

```bash
sovara probe "$TRACE_ID"
```

## Steps and explicit tracing

Inside a trace, supported provider and MCP calls become ordered steps with input,
output, latency, status, and error data. `trace` adds the same visibility to
important application work that automatic instrumentation does not capture. It
supports sync and async functions; for generators, record their consumption with an
[explicit step](#record-calls-sovara-does-not-capture).

```python
@trace
def lookup_customer(customer_id: str) -> dict:
    return crm.lookup(customer_id)
```

Place explicit tracing at shared tool or dispatch chokepoints. A trace filled
with miscellaneous helper calls is harder to understand than one that exposes
the agent's decisions and meaningful actions.

## Subtraces

Subtraces organize child agents, delegated branches, parallel work, and coherent
multi-step phases under the active trace.

```python
with sovara_client.trace("finance-eval"):
    with sovara_client.subtrace("sample-42"):
        trace_one_sample("sample-42")
```

Use `subtrace()` for child work. Nesting `trace()` does not create a child trace.

## Trace metadata

Use `log()` to attach input, output, and custom fields to a trace.

```python
with sovara_client.trace("answer-question") as trace_id:
    answer = agent(question)
    if trace_id is not None:
        sovara_client.log(trace_id=trace_id, trace_input=question, trace_output=answer,
                          answered=True, latency_budget_ms=2500)
```

Input and output must be strings; serialize structured values with `json.dumps()`.
Custom fields accept booleans, integers, finite floats, or strings. Omit absent
values instead of passing `None`. If recording is unavailable, `trace_id` is
`None`; skip logging for that trace. See the [API reference](/sdks/python/api-reference)
for details.

To group sample traces and record verdicts, follow the
[Evaluations guide](/evals/evals-in-sovara).

## Lessons

When automatic injection is enabled and the required models are configured,
supported model calls retrieve from the project's production lessons.
Unapplied proposals are not used. Narrow retrieval with `lesson_scope` on a trace or subtrace:

```python
with sovara_client.trace("answer-question", lesson_scope="financebench/"):
    answer = call_model(question)
```

Temporarily replace the active scope inside a smaller block:

```python
with sovara_client.lesson_scope(["conventions/", "markets/"]):
    answer = call_model(question)
```

See [runtime retrieval](/sovaradb/auto-injection) for project settings.

## Controls and concurrency

```python
with sovara_client.disable_tracing():
    warm_cache_without_recording()

with sovara_client.disable_lesson_injection():
    answer_without_lessons()
```

Async tasks inherit context. Create the `with_context(...)` wrapper inside the
active trace before submitting it to a thread pool; it also wraps coroutine functions:

```python
from concurrent.futures import ThreadPoolExecutor

with sovara_client.trace("parallel-research", capture_logs=False):
    with ThreadPoolExecutor() as pool:
        result = pool.submit(sovara_client.with_context(research), question).result()
```

Await tasks and consume provider streams before leaving the recording context.

For concurrent top-level traces, set `capture_logs=False` to avoid mixing process
stdout/stderr between traces.

## Run the application

Run the application normally. The SDK records the trace:

```bash
uv run python agent.py
```

Open Sovara to inspect the recorded trace.

Use the [API reference](/sdks/python/api-reference) for exact signatures.

## Explicit conversation turns

`trace()` opens a recording session; it does not create an implicit turn. Declare
interactions with scoped `turn()` blocks. Setup, cleanup, and other work outside
those blocks are still captured, with no turn membership.

```python
with sovara_client.trace("conversation", trace_id="chat-123"):
    setup()
    with sovara_client.turn(turn_input="Hi."):
        respond()
    with sovara_client.turn(turn_input="Another question."):
        respond()
    cleanup()
```

For one recording per interaction, reuse the same `trace_id` and declare
the interaction explicitly:

```python
for message in messages:
    with sovara_client.trace("conversation", trace_id="chat-123"):
        with sovara_client.turn(turn_input=message):
            respond()
```

Both `trace()` and `turn()` support `async with`. `turn_input` is an optional
string for the interaction; logged input and output describe the whole trace.
Do not nest turns in the same trace. Await tasks and consume streams before
leaving the recording context.

## Record calls Sovara does not capture

When a model, tool or MCP call isn't captured automatically, for example a custom model
client or a framework with its own transport, record it yourself. `start_step()`
reserves a step before the call, `activate()` keeps automatic recording from recording
the same call twice, and `finish()`, `fail()` or `cancel()` reports how it ended:

```python
from sovara import ToolCall, start_step

def run_tool(name: str, arguments: dict):
    step = start_step(ToolCall(name=name, arguments=arguments))
    with step.activate():
        try:
            result = dispatch(name, arguments)
        except Exception as exc:
            step.fail(exc)
            raise
    step.finish(result)
    return result
```

For an operation that already finished, `record_step(call, outcome)` records it in one
request. For a model call, pass `lessons=True` to `start_step()` to receive the matching
lessons as `step.lesson_context`; insert them into the request and report what you sent
with `execution=`. See the [API reference](/sdks/python/api-reference#explicit-steps).

Outside a trace these functions send nothing. Inside one they raise `RecordingError`
when the server fails.

## Share a recording across processes

Agent hooks often run as separate short-lived processes. One process opens a recording
and stores the returned handle; later ones resume it to add turns and steps; the last one
closes it.

The handle is a string that your code must keep between processes; Sovara doesn't store it
for you. In the example, `store_privately` and `load_handle` are your own helpers, not Sovara
functions: they save the handle to a file only the current user can read, and read it back.

```python
from pathlib import Path

import sovara
from sovara import SuccessOutcome, ToolCall

# Your own storage for the handle (not part of Sovara).
HANDLE_FILE = Path.home() / ".my-agent" / "sovara-handle"


def store_privately(handle: str) -> None:
    """Save the handle where only this user can read it; it contains a write token."""
    HANDLE_FILE.parent.mkdir(parents=True, exist_ok=True)
    HANDLE_FILE.touch(mode=0o600)
    HANDLE_FILE.write_text(handle)


def load_handle() -> str:
    """Read the handle a previous process saved."""
    return HANDLE_FILE.read_text()


# Session start
handle = sovara.open_recording(project_name="coding-agent", name="session")
store_privately(handle)

# Each prompt, in another process
with sovara.resume_recording(load_handle()):
    sovara.start_turn(turn_input=prompt)
    store_privately(sovara.export_recording())  # The handle now carries the turn.

# Each tool call
with sovara.resume_recording(load_handle()):
    sovara.record_step(ToolCall(name=tool, arguments=args), SuccessOutcome(output=result))

# Session end
sovara.close_recording(load_handle())
HANDLE_FILE.unlink()
```

- `open_recording(parent=handle)` opens a child trace, for example for a subagent.
- Inside a resumed recording, use `sovara.get_trace_id()` with `client.log()`.
- A handle contains a write token. Keep it private.
- Handles work across the Python and TypeScript SDKs.

## Framework integrations

LangChain, LangGraph, the OpenAI Agents SDK and Claude Code have their own packages, such as
`sovara-langchain` and `sovara-openai-agents`. See [Integrations](/integrations/overview).
