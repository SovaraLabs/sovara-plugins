# Repository setup

Read this guide when installing Sovara, instrumenting an agent repository, or
answering SDK setup questions. Load only the references needed for that task.

## Agent instrumentation

### Traces and subtraces

A trace is the user-visible job, conversation, or workflow. A subtrace is a coherent
delegated unit inside it: a child agent or a clearly distinguished multi-step
phase with its own LLM and tool activity. During SDK setup, inspect the agent's
execution structure and add subtrace boundaries where they make the trace easier
to understand:

- Represent parallel child agents as sibling subtraces and agents launched by
  other agents as nested subtraces.
- Use subtraces for meaningful phases that users should be able to expand and
  inspect independently, not for individual LLM calls, tool calls, or small
  helper functions; those remain steps.
- Do not manually wrap framework-native subagents that Sovara already records
  automatically.

### Explicit conversation turns

Current SDKs separate recording lifetime from logical interactions. `trace()`
records work without an implicit turn; declare meaningful conversation sections
with scoped `client.turn(...)` using the matching Python or TypeScript reference.
Use the same `trace_id` for durable conversations. Do not introduce
manual next-turn transitions or duplicate subagent instrumentation. Finish tasks
and streams before closing the outer recording.

## Setup workflow

Use this workflow when asked to set up or instrument an agent repository. The
goal is a complete, readable trace with minimal code changes. Minimal means a
few well-chosen execution chokepoints, not merely an outer trace that omits the
agent's meaningful work.

1. Inspect the repository before editing. Find the package manager, agent
   entrypoint, normal run command, complete execution path, provider calls,
   tool dispatch boundaries, child agents, parallel work, existing tests, and
   whether the agent is written in Python or TypeScript.
2. Check `sovara --version`. If the CLI is missing, read the bundled
   [CLI installation guide](references/docs/cli/install.md) and run its
   platform-appropriate installer. When already following this skill, do not
   run `sovara setup` recursively; install the CLI and continue this workflow.
3. Run `sovara status`. If it succeeds, keep using the configured server and
   do not sign in to another one. If it fails, read the bundled release snapshot
   of the general [installation guide](references/docs/get-started/installation.md),
   inspect existing Sovara URLs and SDK configuration, and sign in with
   `sovara login` (`--url <url>` for enterprise deployments), or configure the SDK
   with `SOVARA_SERVER_URL` and `SOVARA_API_KEY` for a headless host. Follow the
   [API-key guide](references/docs/get-started/installation.md#api-keys) for key
   scope and role selection. Ask for a URL only when an enterprise deployment
   is intended and its URL cannot be determined from existing context.
4. Read the matching bundled SDK quickstart, usage guide, and API reference
   listed under **Bundled documentation** below. Those snapshots are the source
   of truth for the released SDK contract. Read the matching troubleshooting
   snapshot only when setup or recording fails.
5. Determine one stable project name from repository context. Ask the user only
   when there is no defensible choice. Project identity belongs in SDK code,
   never in the working directory or `sovara record`.
6. Install the matching SDK using the repository's existing dependency
   workflow. Do not replace package managers or reorganize the application.
7. Add a project-bound SDK entrypoint around every user-visible agent
   execution, following the matching SDK snapshots rather than remembered API
   shapes. Leave `lesson_scope` / `lessonScope` omitted unless intentionally
   restricting or disabling retrieval. An empty list (`[]`) disables lessons.
8. Turn on automatic recording once at startup, before provider clients or agents
   are created: `sovara.auto_instrument()` in Python, `await autoInstrument()` in
   TypeScript. Rely on automatic provider and MCP instrumentation when it already
   produces useful steps. Identify important tool calls, retrieval, database work, or
   other operations that are not captured and wrap their shared chokepoints
   with `trace`. Prefer one wrapper at a shared dispatch boundary over many leaf
   decorations.
9. Use subtraces as meaningful abstractions for child agents, delegated work,
   parallel branches, and coherent multi-step phases. Do not avoid a useful
   subtrace merely to reduce the diff, and do not duplicate framework-native
   subagent recording.
10. Preserve behavior, prompts, model configuration, error handling, streaming,
   and concurrency. Use the SDK's context-propagation helper where the language
   guide requires it.
11. Run the existing free tests and the agent's normal command. Ask before any
   verification that makes a paid external API call. When you need the trace ID
   for CLI inspection, you may use `sovara record -- <normal-agent-command>`
   during verification. Do not present this optional CLI wrapper as the
   application's normal run command.
12. Inspect the trace with `sovara probe <trace-id>` or, when your own trace identifier
    is the available handle, `sovara probe <your-trace-id> --project-id PROJECT`. Verify that the important LLM
    calls, tool calls, subtraces, inputs, and outputs are visible and correctly
    structured. A trace that exists but omits meaningful activity is not a
    successful setup.

Trace overviews list immediate steps and keep subtraces collapsed with their
summaries. Descend through nested subtraces with dotted refs, for example
`sovara probe <trace-id> --scope 3` followed by `--scope 3.2`; these return the
children `3.1, 3.2` and `3.2.1, 3.2.2`, respectively. Page within the current
scope with zero-based, end-exclusive ranges such as `--range :20` or
`--range 20:40`.

Finish with a concise handoff covering what changed, how the integration works,
the application's normal next command, where to find the trace, and useful
inspection or improvement next steps.

For later project-scoped CLI work, use `sovara projects` to find a selector.
`sovara traces`, and all `sovara lessons` and
`sovara issues` commands
require `--project-id`. Selectors may
be a full ID, an unambiguous ID prefix, or an exact project name.
Commands that target one trace take its trace ID or an unambiguous prefix; with
`--project-id PROJECT` they also take your own identifier.
Use `sovara traces inspect <trace-id>` to retrieve the complete trace-annotation
response before deciding which evidence to probe. Its `recommendation` field is
null when no recommendation exists.

Annotation status is derived from ground truth or a thumbs-up. Completed traces
participate automatically; do not enqueue or dismiss them. Use `traces annotate`
for success or corrected failure, `traces analyze` for explicit deep analysis, and
`traces unannotate` to clear both label and ground truth when requested. Read the
[trace annotation guide](references/docs/cli/annotations.md) for this workflow.

## Bundled documentation

These files are generated byte-for-byte from `/docs` when a Sovara release is
prepared. Read only the files needed for the current language and task:

- **General installation**: [installation.md](references/docs/get-started/installation.md)
  — load when the user asks about installation choices or `sovara status`
  cannot reach the configured environment.
- **CLI installation**: [install.md](references/docs/cli/install.md)
- **Python SDK**: [quickstart](references/docs/sdks/python/quickstart.md),
  [usage guide](references/docs/sdks/python/use-the-sdk.md),
  [API reference](references/docs/sdks/python/api-reference.md), and
  [troubleshooting](references/docs/sdks/python/troubleshooting.md)
- **TypeScript SDK**: [quickstart](references/docs/sdks/typescript/quickstart.md),
  [usage guide](references/docs/sdks/typescript/use-the-sdk.md),
  [API reference](references/docs/sdks/typescript/api-reference.md), and
  [troubleshooting](references/docs/sdks/typescript/troubleshooting.md)

For installation and SDK questions, consult these snapshots before answering.
Do not substitute remembered APIs or hand-written installation instructions.
