---
title: "Use the SDK"
description: "Understand project clients, runs, steps, subruns, metadata, and lessons."
---

<script src="/assets/sdk-nav.js"></script>

## The ownership model

The Python SDK exposes two top-level building blocks:

- `SovaraClient` owns project identity and run-scoped helpers.
- `trace` wraps application functions that should appear as steps.

```python
from sovara import SovaraClient, trace

sovara_client = SovaraClient(project_name="support-agent")
```

All run, subrun, logging, lesson, and control operations go through that client.
The project is not inferred from the working directory.

## Top-level runs

Use one top-level run for one user request, conversation turn, eval sample,
batch job, or other execution you want to inspect.

```python
with sovara_client.run("research-and-answer"):
    answer = run_agent()
```

The SDK registers the run with the exec server when the context opens and
finalizes it when the context exits. The same context works with `with` and
`async with`.

For a durable conversation or workflow, pass an application-owned correlation
ID. Reusing it appends new steps to the same canonical Sovara run.

```python
with sovara_client.run("support chat", run_key=chat_id) as run_id:
    sovara_client.log_input(message)
    reply = agent.reply(message)
    sovara_client.log_output(reply)
```

Keep prompts, messages, and secrets out of `run_key`; use a stable ID such
as a chat, ticket, or job ID.

`client_run_id` remains accepted as a deprecated alias during the compatibility
period. The value bound by `as run_id` is Sovara's durable canonical UUID.
The CLI can address this run using either that UUID or the application key:

```bash
sovara probe --project-id support-agent --run-key "$CHAT_ID"
```

## Steps and explicit tracing

Inside a run, supported provider and MCP calls become ordered steps with input,
output, latency, status, and error data. `trace` adds the same visibility to
important application work that automatic instrumentation does not capture.

```python
@trace
def lookup_customer(customer_id: str) -> dict:
    return crm.lookup(customer_id)
```

Place explicit tracing at shared tool or dispatch chokepoints. A trace filled
with miscellaneous helper calls is harder to understand than one that exposes
the agent's decisions and meaningful actions.

## Subruns

Subruns organize child agents, delegated branches, parallel work, and coherent
multi-step phases under the active run.

```python
with sovara_client.run("finance-eval"):
    with sovara_client.subrun("sample-42"):
        run_one_sample("sample-42")
```

Nested top-level `client.run(...)` calls are ignored with a warning. Use
`client.subrun(...)` when the child work should appear in the run tree.

## Run metadata

Add the user-visible input/output and small scalar metrics from inside a run.

```python
with sovara_client.run("answer-question"):
    sovara_client.log_input(question)
    answer = agent(question)
    sovara_client.log_output(answer)
    sovara_client.log_metrics(answered=True, latency_budget_ms=2500)
```

Metric values must be booleans, integers, or finite floats. Keep prompts,
responses, lists, dictionaries, and secrets out of metrics.

## Lessons

Automatic lesson injection is project-wide by default for supported model
calls. Narrow retrieval with `lesson_scope` on a run or subrun:

```python
with sovara_client.run("answer-question", lesson_scope="financebench/"):
    answer = call_model(question)
```

Temporarily replace the active scope inside a smaller block:

```python
with sovara_client.lesson_scope(["conventions/", "markets/"]):
    answer = call_model(question)
```

Sovara retrieves lessons independently for each supported model call and adds a
supplementary user message only to the copied request sent to the provider. It
does not change the conversation objects owned by your app.

## Controls and concurrency

```python
with sovara_client.disable_tracing():
    warm_cache_without_recording()

with sovara_client.disable_lesson_injection():
    answer_without_lessons()
```

Async tasks inherit context. Wrap callables submitted to a thread pool with
`sovara_client.with_context(...)`.

For concurrent top-level runs, set `capture_logs=False` to avoid mixing process
stdout/stderr between runs.

## Run the application

Run the application normally. The SDK records the run:

```bash
python agent.py
```

Open Sovara to inspect the recorded run.

Use the [API reference](/sdks/python/api-reference) for exact signatures.

## Explicit conversation turns

`run()` opens a recording session; it does not create an implicit turn. Declare
interactions with scoped `turn()` blocks. Setup, cleanup, and other work outside
those blocks are still captured, with no turn membership.

```python
with sovara_client.run("conversation", run_key="chat-123"):
    setup()
    with sovara_client.turn(turn_input="Hi."):
        respond()
    with sovara_client.turn(turn_input="Another question."):
        respond()
    cleanup()
```

For one recording per interaction, reuse the same project-scoped key and declare
the interaction explicitly:

```python
for message in messages:
    with sovara_client.run("conversation", run_key="chat-123"):
        with sovara_client.turn(turn_input=message):
            respond()
```

Both `run()` and `turn()` support `async with`. A turn block returns its new
`turn_id`, or `None` when the outer run is operating without capture. Exiting the
block restores the previous context; it sends no close request and does not
rotate the recording credential. Empty blocks remain visible as empty turns.
`turn_input` accepts only `str` or `None`, preserves empty strings, Unicode,
spaces, and line breaks exactly, and describes this interaction. `log_input()`
and `log_output()` remain latest-value properties of the whole run.

Same-run nested turns and using a different client inside the run are rejected.
A subrun's invocation step belongs to the parent's turn, while the child starts
without a turn and may declare its own. Async tasks inherit their originating
turn, and `with_context()` propagates it to threads; another block never reassigns
that work. Await all tasks and consume streams before leaving the outer recording.
Concurrent turn sections are logical groups, not a total timeline.

These SDKs require `runner-api` 2. Upgrade app-server and exec-server together;
a server offering only version 1 or no compatibility metadata is rejected before
the agent code starts. An unreachable server retains the existing no-capture
fallback, including scoped turn blocks.
