---
title: "Troubleshooting"
description: "Diagnose missing TypeScript runs, steps, project assignment, and noisy logs."
---

<script src="/assets/sdk-nav.js"></script>

## Common checks

| Symptom | Check |
| --- | --- |
| No run appears | Confirm the entrypoint reaches and awaits `sovara_client.run(...)`. Check the terminal for a Sovara warning. |
| Run appears in the wrong project | Check the `projectName` passed to `new SovaraClient(...)`. |
| An LLM or supported framework tool call is missing | Confirm the call executes and completes before the `run(...)` callback returns. |
| A custom operation is missing | Wrap its shared execution boundary with `trace`. |
| Claude Agent SDK calls are missing | Import `query` or `startup` from `@sovara/runner/claude`. |
| Logs mix between concurrent runs | Set `captureLogs: false` on concurrent top-level runs. |

## The run stops with an incompatible server

The runner and the Sovara server it reached implement different versions of the
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

## Keep recorded work inside the run

The run callback must contain and await the real agent task:

```ts
const sovara_client = new SovaraClient({ projectName: "support-agent" });

const answer = await sovara_client.run("answer question", async () => {
  return await runAgent(question);
});
```

Promises started without `await` may continue after the run has closed, so
their LLM and tool calls will not belong to that run. Use
`sovara_client.subrun(...)` when delegated work should appear as a child run.

## Trace custom operations

Supported provider, framework tool, and MCP calls are recorded automatically.
Use `trace` for important application operations that do not pass through one
of those integrations, such as retrieval, database access, parsing, or custom
tool dispatch:

```ts
const retrieveContext = trace(async function retrieveContext(question: string) {
  return vectorSearch(question);
});
```

Prefer one shared dispatch wrapper over many helper wrappers.

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
