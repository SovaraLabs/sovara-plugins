---
title: "Troubleshooting"
description: "Diagnose missing Python runs, steps, project assignment, and context."
---

<script src="/assets/sdk-nav.js"></script>

## Common checks

| Symptom | Check |
| --- | --- |
| No run appears | Confirm the entrypoint enters `sovara_client.run(...)`. Check the terminal for a Sovara warning. |
| Run appears in the wrong project | Check the `project_name` passed to `SovaraClient(...)`. |
| An LLM or supported framework tool call is missing | Confirm the call executes before the `run(...)` context exits. |
| A custom operation is missing | Wrap its shared execution boundary with `trace`. |
| Threaded work attaches to the wrong run | Submit `sovara_client.with_context(fn)` to the executor. |
| Logs mix between concurrent runs | Set `capture_logs=False` on concurrent top-level runs. |

## The run stops with an incompatible server

The SDK and the Sovara server it reached implement different versions of the
`runner-api` contract, so the run stops instead of recording against a server
that cannot serve it:

```
Incompatible runner-api: client supports [1], server supports [2].
Update the affected component or select a compatible server.
```

The message names both sides. Update whichever one is behind, or point
`SOVARA_EXEC_SERVER_URL` at a server that shares a version. Nothing was
recorded, because the check runs before the run is registered.

An older component that predates compatibility checks is not affected. It sends
no version metadata, is treated as legacy, and keeps working.

## Check the installed SDK

Confirm the interpreter that runs the agent can import the public API:

```bash
python -c "from sovara import SovaraClient, trace; print('ok')"
python -c "import sys; print(sys.executable)"
```

## Keep recorded work inside the run

The run context must contain the real agent task:

```python
sovara_client = SovaraClient(project_name="support-agent")

with sovara_client.run("answer question"):
    answer = run_agent(question)
```

For async agent code, use `async with` and await the task before leaving the
context. Work moved to another thread needs `sovara_client.with_context(...)`
so it retains the active run.

## Trace custom operations

Supported provider, framework tool, and MCP calls are recorded automatically.
Use `trace` for important application operations that do not pass through one
of those integrations, such as retrieval, database access, parsing, or custom
tool dispatch:

```python
from sovara import trace

@trace
def retrieve_context(question: str) -> list[str]:
    return vector_search(question)
```

Prefer one shared dispatch wrapper over many helper decorators.

## Inspect what was recorded

```bash
sovara probe <run-id>
sovara probe <run-id> --step <step-ref> --preview
sovara logs <run-id> --tail 40
```

Use visible step refs from `probe`, not internal UUIDs.

## Turns and recording compatibility

Current Python and TypeScript SDKs require `runner-api` 2. A version-1 server
or missing metadata causes a compatibility error before the agent callback;
upgrade both app-server and exec-server together. Server unavailability keeps
the existing no-capture mode.

A run with no explicit `turn()` sections has no turns. Calls outside sections
are recorded without turn membership. If a late response appears in an earlier
turn, it retains the scope in which the operation began; a subsequent section
does not change its identity. Await tasks and consume streams before closing the
outer recording. A long-lived Claude Agent SDK connection keeps the context
captured when it connects; open it in the interaction whose work it represents.

Turn input is separate from the latest run input/output. Empty turns are kept.
Same-run nested sections and operations through a different client are rejected.
