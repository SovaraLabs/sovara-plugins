---
name: optimizing-agents
description: Use when recording Sovara agent runs, inspecting run steps, reading run logs, annotating runs, creating/managing lessons, or tracking follow-up work in Sovara project issues.
---

# Optimizing agents with Sovara

Use this workflow to record a run, inspect what happened, rerun one LLM step when a focused edit would answer a concrete question, label useful traces, and turn repeatable lessons into Lessons Store entries that Sovara can inject into future context.

These workflows also apply through connected MCP tools; follow the MCP guidance
in [SKILL.md](SKILL.md) and use the advertised tool schemas. The shell examples
below are the CLI path. For exact CLI flags or output shapes, load
[references/cli-reference.md](references/cli-reference.md).

## Quick Loop

1. Record or locate a run.
2. Inspect the run-step overview before opening full step payloads.
3. Use logs for stdout/stderr questions.
4. Rerun one LLM step only when a small input edit is the right experiment.
5. Annotate important runs.
6. Create or update lessons only after identifying a reusable lesson.
7. Create or update a project issue only when the human asks to track concrete follow-up work.
8. Re-run and compare the new run before claiming the lesson improved behavior.

## Gotchas

Read these once before working through the rest of this file. They defy reasonable assumptions and cause most failed runs.

- **`sovara record` is passive.** It runs the exact command after `--`, then
  prints metadata for the top-level run created by the SDK. It does not
  instrument code, choose a project, or configure the run. Use it when you need
  the run ID for CLI inspection; do not present it as the application's normal
  run command.
- **`--preview` is for selected step snapshots.** Use it with `--step` or `--steps` when you need truncated payloads instead of the full values.
- **Use step refs, not node UUIDs.** Step refs are the visible handles from probe output; raw step UUIDs are internal debugging IDs.
- **Step rerun needs a project replay key.** Use `sovara replay-keys set <provider> --project-id PROJECT --api-key-env <ENV_VAR>` or `--api-key-stdin`; never pass raw API keys as command-line arguments or write them into prompts.
- **`sovara rerun` is for LLM calls only.** Inspect tool calls and custom traced functions with `probe`; rerun the full agent when behavior depends on external tool state.
- **Run selectors are uniform.** Commands that target one run accept either a Sovara UUID or unambiguous UUID prefix, or the exact project-scoped SDK key as `--project-id PROJECT --run-key KEY`. Do not treat a positional value as a run key.
- **SDK code owns project identity.** The CLI and working directory do not select a project. Read the matching bundled SDK usage guide for the current client contract.
- **Sovara records supported LLM, framework-tool, and MCP calls automatically; uncaptured custom work needs explicit tracing.** Trace important retrieval, database, or domain-tool dispatch chokepoints so they appear in `probe`; read the matching bundled SDK usage guide for exact syntax.
- **The Sovara CLI is not bundled with the Python SDK or `@sovara/runner`.** It is a standalone binary; users must install it separately. See the bundled [CLI installation guide](references/docs/cli/install.md).
- **Preserve lesson provenance.** When a lesson comes from a concrete step, pass `--step <step_ref>` with either `--run-id <uuid_or_prefix>` or `--run-key <key>` and the required project selector. Omit the run selector and step when there is no concrete source. Updates preserve existing provenance when these flags are omitted.

## Record Runs

Instrument the agent with the matching SDK first and run it normally. When the
current task needs terminal run metadata for CLI inspection, use the optional
language-neutral record wrapper:

```bash
sovara record -- python agent.py
sovara record -- uv run python -m module.support_agent --ticket-id 42
```

For parallel jobs, invoke `sovara record` separately for each process. Each
process must create its own SDK run:

```bash
for i in 0 1 2 3; do
  sovara record -- python -m module.support_agent --ticket-id "$i" &
done
wait
```

The wrapper returns the child exit code and prints JSON with `status`,
`exit_code`, `duration_seconds`, and `run_observed`. When an SDK run was
observed it also includes `run_id`, project metadata, and `inspect_command`.
Without an SDK-created run, `run_observed` is false.

## Inspect Runs

Start with a compact run-step overview:

```bash
sovara probe <run_id_or_prefix>
sovara probe <run_id_or_prefix> --range :20
```

The overview lists only the immediate steps in its current scope. Subruns are
collapsed rows with their persisted summaries. Open nested subruns one level at
a time with their dotted step refs:

```text
root
├── 1
├── 2
└── 3 subrun
    ├── 3.1
    └── 3.2 subrun
        ├── 3.2.1
        └── 3.2.2
```

```bash
sovara probe <run_id_or_prefix> --scope 3 --range :20
sovara probe <run_id_or_prefix> --scope 3.2 --range :20
```

The first scoped command returns `3.1` and `3.2`; the second returns `3.2.1`
and `3.2.2`.

Use `step_ref` values from the overview when drilling into details:

```bash
sovara probe <run_id_or_prefix> --step 2 --preview
```

Use `--key-regex` for targeted full values instead of dumping entire payloads:

```bash
sovara probe <run_id_or_prefix> --step 2 --input --key-regex "body.max_tokens$"
```

For LLM steps, inspection returns the actual input sent to the model, including
the supplementary user message containing lessons applied to that step. Use a
targeted key regex when you only need one input field.

Use `step-overview` for a semantic summary of an LLM step. It uses the configured
Fast Helper Model and may consume model quota; inspect tool steps with `probe`.

```bash
sovara step-overview <run_id_or_prefix> --step 2
```

Use logs for captured stdout/stderr:

```bash
sovara logs <run_id_or_prefix> --tail 40
sovara logs <run_id_or_prefix> --grep "Cache miss" --context 2 --line-numbers
```

## Rerun One LLM Step

Use step rerun to test a focused prompt or parameter edit without rerunning the
whole agent. Start by inspecting the run and the exact input keys:

```bash
sovara probe <run_id_or_prefix>
sovara probe <run_id_or_prefix> --step <step_ref> --input --key-regex "body"
```

Configure the provider replay key if it is not already saved:

```bash
sovara replay-keys list --project-id PROJECT
sovara replay-keys set anthropic --project-id PROJECT --api-key-env ANTHROPIC_API_KEY
sovara replay-keys set palantir --project-id PROJECT --api-key-env TWG_PALANTIR_TOKEN
```

Then rerun the LLM step:

```bash
sovara rerun <run_id_or_prefix> --step <step_ref>
sovara rerun <run_id_or_prefix> --step <step_ref> --disable-lesson-injection
sovara rerun <run_id_or_prefix> --step <step_ref> --set-json body.max_tokens=512
sovara rerun <run_id_or_prefix> --step <step_ref> --set-file body.system.0.text=prompt_variant.txt
```

Use `--set KEY=VALUE` for string edits, `--set-json KEY=JSON` for numbers,
booleans, arrays, objects, or null, and `--set-file KEY=PATH` for larger text.
Only edit keys shown by `probe`; unknown keys are rejected.
Reruns perform current lesson retrieval by default. Use
`--disable-lesson-injection` for the comparison run without retrieving or
injecting lessons at the selected step. Read the returned `lesson_retrieval` snapshot
instead of inferring retrieval behavior from the replayed prompt.
If the command says the step is not replayable, inspect it with `probe` and run
the full agent instead.

## Annotate Runs

List runs needing annotation and annotated examples:

```bash
sovara runs --project-id "support-agent" --annotation needed --limit 5
sovara runs --project-id "support-agent" --annotation annotated --limit 5
```

Narrow large projects with the same filters as the UI. Discover tag IDs first;
the list responses also expose available code versions.

```bash
sovara tags list --project-id "support-agent"
sovara runs --project-id "support-agent" --tag-id <tag_id> --code-version <short_sha> --limit 20
sovara runs --project-id "support-agent" --annotation needed --sort failureScore --dir desc --failure-min 0.5
```

Use `--offset` for the next page. Run filters include failure/novelty score,
analysis state, tag, runtime, timestamp, and free-text query; annotated lists
also accept `--label up,down`.

Completed runs participate automatically; never enqueue or dismiss them.
A run is annotated when it has ground truth or a thumbs-up. Do not fabricate
expected text merely to mark a successful run as annotated. Request deep analysis
with `sovara runs analyze RUN` when needed, then inspect its result.

Inspect before annotating:

```bash
sovara runs inspect <run_id_or_prefix>
sovara probe <run_id_or_prefix>
sovara probe <run_id_or_prefix> --step 2 --preview
```

Start with `runs inspect` when a recommendation exists. Use its
`analysis` verdict and the exact `run_id`, `step_uuid`, `step_ref`, `field`, and
`chunk_index` locators in `evidence.adjudication_pairs`,
`evidence.top_failure_evidence`, and `evidence.most_novel_evidence` to choose
targeted `probe` reads. A null
`failure_embedding_artifact` means the pair was not adjudicated; it is not a
negative verdict.

Write direct annotations only when the label is clear:

```bash
sovara runs annotate <run_id_or_prefix> --label success
sovara runs annotate <run_id_or_prefix> --label failure --groundtruth "The output should satisfy the user's stated requirements." --steps 6.3.1,6.3.2
```

`--label` must be `success` or `failure`. `--groundtruth` is required for failures and optional for successes.

Use `sovara runs unannotate RUN` only when clearing the human annotation is intended:
it clears both the label and ground truth without deleting the run or excluding it
from work.

## Trace Custom Work

Sovara records supported LLM, framework-tool, and MCP calls automatically. Add
explicit tracing only around important application work that those integrations
do not capture, such as retrieval, database access, parsing, or custom tool
dispatch. Prefer one shared execution chokepoint over many helper wrappers.

Use the bundled [Python usage guide](references/docs/sdks/python/use-the-sdk.md)
and [API reference](references/docs/sdks/python/api-reference.md), or the
[TypeScript usage guide](references/docs/sdks/typescript/use-the-sdk.md) and
[API reference](references/docs/sdks/typescript/api-reference.md), for the exact
tracing contract and syntax.

## Project Issues

Use project issues for concrete follow-up work, not as a substitute for reusable
lessons. Read existing issues before creating a possible duplicate. Create,
comment on, or close an issue only when the human clearly asks for that mutation.

```bash
sovara issues list --project-id PROJECT_SELECTOR --status open --query "retry"
sovara issues get 42 --project-id PROJECT_SELECTOR
sovara issues create --project-id PROJECT_SELECTOR --title "Retry behavior is unclear" --body "See #17."
sovara issues comment 42 --project-id PROJECT_SELECTOR --body "Reproduced in the latest run."
sovara issues close 42 --project-id PROJECT_SELECTOR
```

Use the positive project reference number without a leading `#`. Issue bodies
and comments may mention lessons with `#N`; the server maintains those
relationships. `issues get` and `issues comment` reject lesson comments.

## Lessons

Create a lesson when the user wants to capture a reusable rule, policy, domain
fact, or correction. Its source may be a recorded run or information supplied by
the user. Good lessons are concise, actionable, self-contained, retrieval-friendly,
and non-conflicting.

Before saving a lesson:

1. Identify the reusable lesson from the supplied information; inspect the source
   run when one exists.
2. Check existing lessons with `sovara lessons retrieve`, use
   `sovara lessons ls -R` to inspect the taxonomy, and fetch complete records
   with `sovara lessons get`, always passing the target `--project-id`.
3. Generalize beyond the originating example without overfitting to incidental details, while
   keeping the lesson narrow enough to affect only the agent paths where it should apply.
4. Attach provenance with `--run-id <uuid_or_prefix> --step <step_ref>` or
   `--run-key <key> --step <step_ref>` when
   creating a lesson from a concrete step. An update preserves existing
   provenance when these flags are omitted.
5. Check that the proposal preserves the intended rule. For agent-debugging work,
   validate improvement with a fresh run and compare traces.

Create and update examples:

```bash
sovara lessons create \
  --project-id "support-agent" \
  --title "Retry rate-limited API calls" \
  --content "When an upstream API returns HTTP 429, retry with exponential backoff and jitter before surfacing failure." \
  --when-to-use "When implementing or debugging calls to rate-limited upstream APIs." \
  --path "reliability/api/" \
  --run-id "<run_uuid_or_prefix>" \
  --step 3

# Reuse the proposal_id returned by create; no edit changes Production.
sovara lessons update <lesson_id> --proposal <proposal_id> --project-id "support-agent" --content-file lesson.md
sovara lessons proposals diff <proposal_id> --project-id "support-agent"
sovara lessons proposals review <proposal_id> --project-id "support-agent"
sovara lessons proposals apply <proposal_id> --project-id "support-agent"
```

Read the workspace before editing and pass its `revision_id` with
`--expected-revision`. Review operates on saved proposal data. Review is advisory: Apply can publish without approval when there are no merge
conflicts. Intervening edits, discussion, or Production changes make a review
stale; reviewing again is recommended before applying. Apply only when publication
is requested; otherwise return the saved proposal for review.
See the lessons CLI reference for structural edits, comments, and corpus history.

## Troubleshooting

- **Sandboxed filesystem**: grant the assistant write access to `~/.sovara` or
  rerun `sovara install-skill` so it can configure that access.
- **App-server connection not reachable**: run `sovara status`. For the Local
  connection, open the desktop app. For a remembered remote connection, verify
  the active app-server connection under **Settings > App-server connection settings**
  and sign in through the app. CLI app commands use that connection and, when it
  is remote, its session; do not configure a separate app endpoint in the shell.
- **Replay key missing**: set the provider key with `sovara replay-keys set <provider> --project-id PROJECT --api-key-env <ENV_VAR>` and retry `sovara rerun`.
- **Exec server not reachable**: for the default local endpoint, let the SDK ask
  the installed CLI to start its bundled server or run `sovara exec-server
  start`. For a remote or headless environment, repair the configured SDK URL,
  token, or server; `exec-server start` does not start a remote service. Use the
  matching bundled SDK troubleshooting and API snapshots for exact settings.
- **Wrong project**: change the project name on the SDK client. A project renamed
  in the Sovara app needs the same change; use the matching bundled SDK
  troubleshooting snapshot for exact configuration.
- **CLI missing**: If `error: Failed to spawn: sovara` or `sovara: command not found` appears, install the Sovara CLI and confirm it is on `PATH`.
- **Module missing during record**: Install the module into the same virtual environment used by `sovara record`, or invoke the venv's Python directly after `--`.
