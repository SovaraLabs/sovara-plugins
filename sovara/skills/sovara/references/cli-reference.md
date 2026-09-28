# Sovara CLI Reference

Load this file only when exact command flags, output shapes, or troubleshooting details are needed.

Every command and subcommand accepts `-h` and `--help` for its exact usage and flags.

## Contents

- [Project Scope](#project-scope)
- [Setup and Status](#setup-and-status)
- [Runs and Inspection](#runs-and-inspection)
- [Step Rerun](#step-rerun)
- [Replay Keys](#replay-keys)
- [Annotations](#annotations)
- [Project Issues](#project-issues)
- [Lessons](#lessons)
- [Troubleshooting](#troubleshooting)

## Project Scope

SDK code owns project identity. The CLI does not infer project scope from the
working directory. Use the bundled
[Python usage guide](docs/sdks/python/use-the-sdk.md) or
[TypeScript usage guide](docs/sdks/typescript/use-the-sdk.md) for the current
client contract.

Use `sovara projects` to list projects. `sovara tags list`, `sovara runs`, and every
`sovara lessons` and `sovara issues` subcommand require `--project-id`.

Project ID flags accept a full ID, any unambiguous ID prefix, or an exact project name.

```bash
sovara projects
sovara tags list --project-id "support-agent"
sovara runs --project-id a6cbns64
sovara lessons retrieve --project-id "support-agent" "Customer asks for a refund exception"
sovara lessons ls --project-id a6cbns64
```

## Setup and Status

Run guided repository setup from the agent directory:

```text
usage: sovara setup [--path DIR]
usage: sovara onboard [--path DIR]
```

Both commands detect Codex and Claude Code, ask which to use when both are
installed, refresh that assistant's global Sovara skill, and launch it in the
current working directory or the directory selected by `--path`. `setup`
instruments an agent repository. `onboard` checks benchmark samples against
human-reviewed ground truth using recorded evidence.

Advanced skill installation remains separate:

```text
usage: sovara install-skill [--level global|project]
                            [--project-dir dir]
                            [--target codex|claude|both]
```

Check app-server reachability and the active user with:

```text
usage: sovara status
```

App commands use the active **Local** or remembered remote connection selected
in the Sovara desktop app. For a remote connection, they also use its signed-in
desktop session. They do not have separate endpoint configuration.

List, resolve, or create projects with:

```text
usage: sovara projects [project-id-prefix-or-name]
usage: sovara projects create --name NAME [--description TEXT]
```

Manage the bundled local exec server with:

```text
usage: sovara exec-server start [--server-url URL]
usage: sovara exec-server stop [--server-url URL]
```

Without an explicit URL, `start` launches the bundled exec server when the
configured local endpoint is not healthy. With `--server-url`, it only
health-checks that endpoint. `stop` accepts only a local URL, stops the server
and its Qdrant sidecar, and succeeds when they are already stopped.

## Runs and Inspection

### `sovara runs`

```text
usage: sovara runs --project-id PROJECT_ID
                   [--limit N] [--offset N] [--sort KEY] [--dir asc|desc]
                   [--name TEXT] [--run-id ID_OR_PREFIX | --run-key KEY]
                   [--label up,down,none] [--tag-id IDS]
                   [--code-version SHAS] [--metric-filters JSON]
                   [--time-from ISO] [--time-to ISO]
                   [--latency-min SECONDS] [--latency-max SECONDS]
```

Use the API-shaped pagination and filter flags. The result
includes `distinct_code_versions` and `custom_metric_columns`. Use
`sovara tags list --project-id PROJECT_SELECTOR` to discover tag IDs. Multiple
comma-separated tag IDs are ANDed. `--metric-filters` accepts the same JSON as
the API, for example `{"quality":{"kind":"number","min":0.8}}`.

All commands that target one run accept exactly one of these selector forms:

```text
<run-id-or-prefix>
--project-id PROJECT_SELECTOR --run-key KEY
```

Run keys are exact and project-scoped. UUIDs and unambiguous UUID prefixes do
not require a project selector.

### `sovara probe`

```text
usage: sovara probe (<run-id> | --project-id PROJECT --run-key KEY) [--step STEP] [--steps STEPS] [--preview]
                    [--scope SCOPE] [--range START:END]
                    [--include-step-uuids]
                    [--input] [--output] [--key-regex KEY_REGEX]
```

Use at most one detailed selector: `--step` or `--steps`. `--steps` accepts
comma-separated exact refs and top-level ranges such as `1-5,8,6.3.1`. Detailed
selectors cannot be combined with overview scoping or `--range`.

Recommended sequence:

```bash
sovara probe <run_id>
sovara probe <run_id> --scope 6 --range :20
sovara probe <run_id> --scope 6.3 --range :20
sovara probe <run_id> --step 2 --preview
sovara probe <run_id> --step 2 --input --key-regex "body.max_tokens$"
```

`--preview` truncates large string fields in selected step snapshots.
`--include-step-uuids` is for debugging internal durable IDs only.
For LLM steps, inspection returns the actual input sent to the model, including
the supplementary user message containing lessons applied to that step.
`--preview` truncates large values;
`--input` returns them in full.

Overview ranges are zero-based and end-exclusive. The default is `:20`, and one
page may contain at most 100 steps. An overview returns immediate steps only;
when a returned step is a subrun, use its dotted ref with `--scope` to inspect
that subrun. This works at arbitrary depth (`6`, `6.3`, `6.3.2`).

### `sovara step-overview`

```text
usage: sovara step-overview (<run-id> | --project-id PROJECT --run-key KEY) --step <step-ref>
```

Uses Sovara's Fast Helper Model for compact semantic summaries of LLM steps and
may consume model quota. Use `sovara probe <run_id> --step <step_ref> --preview`
for tool steps or when the model is not configured.

### `sovara logs`

```text
usage: sovara logs (<run-id> | --project-id PROJECT --run-key KEY) [--tail TAIL] [--grep GREP]
                   [--context CONTEXT] [--line-numbers]
```

Examples:

```bash
sovara logs b6aaf796 --tail 40
sovara logs b6aaf796 --grep "Cache miss" --context 2 --line-numbers
```

Create a diagnostic archive with:

```text
usage: sovara diagnostics [--output <path>] [--include-system-logs]
```

Normal Sovara application logs are always archived on macOS, Windows, and Linux.
`--include-system-logs` additionally collects the last 30 minutes of
Sovara-related macOS Unified Logs, Windows Application/Defender/Code
Integrity/AppLocker events, or Linux systemd journal entries. OS logs may
contain sensitive machine metadata. Collection is best-effort, never requests
elevated privileges, and writes `system/system-log-collection.txt` with
`status=unavailable` when the platform source cannot be read.

## Step Rerun

### `sovara rerun`

```text
usage: sovara rerun (<run-id> | --project-id PROJECT --run-key KEY) --step <step-ref> [--disable-lesson-injection] [--set KEY=VALUE] [--set-file KEY=PATH] [--set-json KEY=JSON]
```

Use this only for recorded LLM call steps. Find the step ref with `probe`, then
inspect input keys before editing:

```bash
sovara probe <run_id_or_prefix>
sovara probe <run_id_or_prefix> --step <step_ref> --input --key-regex "body"
```

Edit options:

- `--set KEY=VALUE`: set a flattened input key to a string.
- `--set-json KEY=JSON`: set a flattened input key to a JSON value.
- `--set-file KEY=PATH`: set a flattened input key to file contents.
- `--disable-lesson-injection`: remove this step's recorded lesson injection and
  skip fresh retrieval for the rerun.

Examples:

```bash
sovara rerun <run_id_or_prefix> --step 3
sovara rerun <run_id_or_prefix> --step 3 --disable-lesson-injection
sovara rerun <run_id_or_prefix> --step 3 --set body.messages.0.content="Use the policy excerpt only."
sovara rerun <run_id_or_prefix> --step 3 --set-json body.max_tokens=512
sovara rerun <run_id_or_prefix> --step 3 --set-file body.system.0.text=prompt_variant.txt
```

The command returns JSON containing `status`, `run_id`, `step_ref`,
`overwritten_output`, and the replay's `lesson_retrieval` snapshot. Reruns
perform current lesson retrieval by default; use the snapshot rather than the
replayed prompt to verify what happened.
Only keys shown by `probe` for the selected step can be edited.

## Replay Keys

### `sovara replay-keys`

```text
usage: sovara replay-keys <command> [options]
```

Subcommands:

- `list --project-id PROJECT`: show masked provider key previews for one project.
- `set <provider> --project-id PROJECT --api-key-env ENV_VAR`: store a project key from an environment variable.
- `set <provider> --project-id PROJECT --api-key-stdin`: store a project key from stdin.
- `unset <provider> --project-id PROJECT`: remove a project key.

Examples:

```bash
sovara replay-keys list --project-id PROJECT
sovara replay-keys set anthropic --project-id PROJECT --api-key-env ANTHROPIC_API_KEY
sovara replay-keys set palantir --project-id PROJECT --api-key-env TWG_PALANTIR_TOKEN
printf '%s' "$OPENAI_API_KEY" | sovara replay-keys set openai --project-id PROJECT --api-key-stdin
sovara replay-keys unset anthropic --project-id PROJECT
```

Never recommend passing raw provider keys as command-line arguments. Use env or
stdin so keys do not land in shell history.

## Annotations

```bash
sovara runs --annotation needed --project-id PROJECT_SELECTOR --limit 5
sovara runs --annotation needed --project-id PROJECT_SELECTOR --sort failureScore --dir desc --failure-min 0.5
sovara runs --annotation annotated --project-id PROJECT_SELECTOR --limit 5
sovara runs --annotation annotated --project-id PROJECT_SELECTOR --run-key KEY
sovara tags list --project-id PROJECT_SELECTOR
sovara runs inspect <run_id_or_prefix>
sovara runs annotate <run_id_or_prefix> --label success
sovara runs annotate <run_id_or_prefix> --label failure --groundtruth "<expected outcome>" --steps 6.3.1,6.3.2
```

Queue responses preserve failure/novelty scores, tags, analysis statuses, and
`distinct_code_versions`. Filters cover paging, name/run ID, text query, time,
runtime, code version, failure/novelty score, analysis state, and tag IDs.
Annotated lists additionally accept `--label up,down`. Failure
annotations require `--groundtruth`; pass `--steps` to persist focused evidence
by step ref.

`runs inspect` returns the complete run-annotation response. Read the
`recommendation` field for the `AnnotationRecommendation` object, or `null` when
no recommendation exists. Read its `analysis` for the deep-analysis verdict,
`evidence.adjudication_pairs` for completed artifact checks,
`evidence.top_failure_evidence` for closest retained failure matches, and
`evidence.most_novel_evidence` for novel chunks. Each chunk locator includes
`run_id`, `step_uuid`, display `step_ref`, `field`, and zero-based `chunk_index`.
`failure_embedding_artifact` is `true` for an artifact, `false` for a completed
verdict that retained the pair as plausible failure evidence, and `null` when
the pair was not checked.

Completed runs participate automatically. Use `sovara runs analyze RUN` for
explicit deep analysis and `sovara runs unannotate RUN` to clear a saved label
and ground truth.

## Project Issues

```text
usage: sovara issues {list,get,create,comment,close} ...
```

Every issue command requires `--project-id`. Reference arguments
are positive project reference numbers without a leading `#`.

```bash
sovara issues list --project-id PROJECT_SELECTOR [--status open|closed]
                   [--view all|assigned|created] [--query TEXT]
                   [--limit N] [--offset N]
sovara issues get 42 --project-id PROJECT_SELECTOR
sovara issues create --project-id PROJECT_SELECTOR --title "Retry behavior is unclear" [--body "See #17."]
sovara issues comment 42 --project-id PROJECT_SELECTOR --body "Reproduced in the latest run."
sovara issues close 42 --project-id PROJECT_SELECTOR
```

`list` defaults to open issues in the `all` view. Search covers issue titles
and bodies. `get` returns complete issue details and comments. `create`,
`comment`, and `close` return the resulting issue or comment as JSON.

Issues and lessons share project reference numbers. `issues get` and
`issues comment` reject a reference that resolves to lesson comments.
Issue bodies and comments may mention lessons using `#N`.

## Lessons

```text
usage: sovara lessons {ls,get,create,update,retrieve,mkdir,mv,cp,rm,proposals,history} ...
```

Every lessons command requires `--project-id PROJECT` (a project ID or name).
Reads default to Production. Add `--proposal ID` to read or edit that proposal.
An edit without `--proposal` creates a new proposal and returns its `proposal_id`
and `head_revision_id`. Subsequent edits must pass that ID explicitly. There is
no hidden current proposal and no edit command publishes directly.

For a read/edit sequence, pass the returned `revision_id` as `--expected-revision`
to prevent overwriting intervening edits. If omitted, the CLI reads the current
revision immediately before the operation. A 409 requires reading the workspace
again and reconciling changes; the CLI never retries a conflicting write.

| Command | Purpose / API |
| --- | --- |
| `ls [path] [-R]`, `get ID[,ID...]` | Read a coherent scope using `GET /lessons/workspace/current`; responses include its revision |
| `create --title TEXT --content-file FILE --when-to-use TEXT` | Add a lesson using `POST /lessons` |
| `update ID --content-file FILE` | Change provided fields using `PUT /lessons/ID` |
| `mkdir PATH` | Add a folder using `POST /lessons/folders` |
| `mv SRC DST`, `mv -i ID[,ID...] DST` | Rename/move a folder or move lessons using `/lessons/folders` or `/lessons/items/move` |
| `cp SRC DST`, `cp -i ID[,ID...] DST` | Copy via `/lessons/items/copy`; `--source-proposal ID` (or `production`) copies between scopes; `--source-revision` guards that source |
| `rm ID`, `rm -r PATH` | Propose deletion using `/lessons/items/delete` or `/lessons/ID` |
| `retrieve TEXT [--path PATH]` | Run retrieval against published Production lessons |
| `proposals list [--closed] [--limit 30] [--before CURSOR]` | List proposals; paged responses return `next_cursor` |
| `proposals create [--title TEXT]` | Start an empty proposal from Production |
| `proposals show ID`, `proposals diff ID` | Read saved workspace/review state or saved diff |
| `proposals rename ID --title TEXT` | Rename the proposal |
| `proposals conflicts ID` | Inspect field merge against current Production |
| `proposals resolve ID --resolutions-file FILE` | Save all conflicting field choices under head and Production guards |
| `proposals review ID` | Persist a model review of the saved head; no publication |
| `proposals apply ID` | Publish atomically; review is advisory, merge conflicts block publication |
| `proposals close ID`, `proposals reopen ID` | Change proposal state under the head guard |
| `proposals timeline ID [--before CURSOR]` | Read saved edits, review feedback, and publication activity |
| `proposals comments list ID` | Read proposal discussion |
| `proposals comments add ID --body-file FILE` | Add feedback |
| `proposals comments edit ID COMMENT --body TEXT` | Edit your comment |
| `proposals comments delete ID COMMENT` | Delete your comment |
| `history [--before REVISION]` | Page through Production publications |

Proposal actions map to `/lessons/proposals/ID/<action>` (rename uses `PUT`
on its `/title` resource; comments use its `/comments` resource). `apply` and `resolve`
accept `--expected-production` in addition to `--expected-revision`. `review`
reviews the saved head; save pending editor/file changes first. Changes to the
proposal, Production, or discussion make previous approval stale. Review and
Apply have an eleven minute client timeout; the review job is bounded at ten minutes.

Text inputs accept `--content` or `--content-file FILE`; `-` reads stdin. Comment
bodies and conflict JSON support the same file/stdin convention. Creation requires
nonempty title, content, and when-to-use. Updates preserve omitted fields, including
source `run_id`/`step_uuid`; use `--run-id` or `--run-key` plus `--step` to attach
provenance. Optional metadata includes `--summary`, `--path`, repeated `--alias`
and `--keyword`. All commands return JSON suitable for agents.

```bash
sovara lessons get LESSON --project-id PROJECT
sovara lessons update LESSON --project-id PROJECT --content-file lesson.md --expected-revision REVISION
# Use the proposal_id returned by that edit for the remaining work.
sovara lessons mkdir reliability/ --proposal PROPOSAL --project-id PROJECT
sovara lessons proposals diff PROPOSAL --project-id PROJECT
sovara lessons proposals review PROPOSAL --project-id PROJECT
sovara lessons proposals apply PROPOSAL --project-id PROJECT
```

Edit a proposal, review it, then apply it explicitly when publication is requested.
To reuse a deleted lesson, find its
proposal in `lessons history`, inspect `lessons proposals diff ID`, and copy the
content into a new lesson.


Conflict resolution uses the same server merge plan in the UI and CLI. `proposals conflicts ID`
returns `lessons`, each with `conflicts` (field names) and `text_merges` (ordered text and conflict
segments). Disjoint line edits combine automatically. For overlapping edits, choose or edit the
conflicting passages, then concatenate the segments into the final field value. Titles and lists
remain atomic. For a whole-lesson conflict (`lesson`, such as deletion versus editing), choose
`"production"` or `"proposal"`. Folder conflicts appear in `folders`; use their first `paths`
entry as the resolution key with `{"folder": "production"}` or `{"folder": "proposal"}`.
This selects that side for all listed folders and affected lessons, including moved lessons;
Their folder choice resolves their structural conflicts. You may also submit text edits keyed
by the retained lesson IDs.

Pass `proposals resolve ID --resolutions-file FILE --expected-revision HEAD
--expected-production PRODUCTION` the exact revision IDs from that preview. FILE is a JSON object
keyed by lesson ID and then by conflicting field, for example:

```json
{"lesson-id": {"title": "Resolved title", "content": "Complete resolved content"}}
```

Include every conflicting lesson/folder and field. You may include additional editable fields
or non-conflicting lessons from the merge preview to edit surrounding text in the same save. Use `{}` for a clean rebase. A stale
revision returns 409; read the preview again and reconcile before retrying. Saving resolutions
updates the proposal; it does not publish it. No changes remaining closes the proposal.

## Troubleshooting

### Sandboxed / restricted filesystem

Grant the assistant write access to `~/.sovara` or rerun
`sovara install-skill` so it can configure that access. Sovara credentials and
local state live there.

### App server not reachable

Open the Sovara desktop app and verify its active app-server connection in the
selector on the **Projects** page. With **Local** selected, keep the app open so
the bundled backend is available. For a remembered remote connection, verify
its origin under **Settings > App-server connection settings** and sign in through the
app. CLI app commands automatically use the selected desktop app-server
connection and, when it is remote, its session.

### Rerun reports a missing replay key

Set the provider key shown in the error with `sovara replay-keys set <provider>
--project-id PROJECT --api-key-env <ENV_VAR>` or `--api-key-stdin`, then retry
`sovara rerun`.

### Exec server not reachable

`sovara exec-server start` follows the selected desktop connection: it checks
the shared URL for remote connections or starts the local exec server when needed.
`--server-url` and `SOVARA_EXEC_SERVER_URL` remain explicit overrides. Remote
checks use `/runner/health`, falling back to `/health` only on 404 for older
servers. SDKs also ask the installed CLI to start the local server when needed.

`sovara exec-server stop` is idempotent. If it fails, the failure is not merely
that the server was already stopped; check port `5960` and
`~/.sovara/logs/exec_server.log` for the remaining process or backend error.

Recommended persistent locations:

| OS | Location |
| --- | --- |
| macOS zsh | `~/.zshenv` |
| Linux zsh | `~/.zshenv` |
| Linux bash | `~/.bashrc` or `~/.profile` |
| Windows | User/System environment variables |

### Wrong or missing project

Set a stable project name on the SDK client. Existing project names are
immutable. Use the bundled [Python usage guide](docs/sdks/python/use-the-sdk.md)
or [TypeScript usage guide](docs/sdks/typescript/use-the-sdk.md) for exact
configuration.

## Run tags

Every tag command requires `--project-id`. Create tags, assign them to a run, or
remove them:

```bash
sovara tags create --project-id Payments --name "Needs review" --color '#0969da'
sovara tags list --project-id Payments
sovara tags set <run-id-or-prefix> --project-id Payments --tag-ids <tag-id>,<other-tag-id>
sovara tags set <run-id-or-prefix> --project-id Payments --tag-ids ''
sovara tags delete <tag-id> --project-id Payments
```

`set` replaces the complete tag list. Include every tag you want to keep; an empty
`--tag-ids` clears it. Deleting a tag removes all its run assignments. The default
creation color is blue; see the MCP tool reference
for the supported palette.

## Automations

Every automation command requires `--project-id`. Commands return JSON.

```bash
sovara automations create --project-id Payments --name "Daily failure review" --prompt "Summarize new failed runs" --cron '0 9 * * 1-5' --timezone Europe/Zurich --enabled=false
sovara automations list --project-id Payments --enabled=false --limit 20
sovara automations get <automation-id> --project-id Payments
sovara automations update <automation-id> --project-id Payments --prompt "Summarize recurring failures"
sovara automations resume <automation-id> --project-id Payments
sovara automations pause <automation-id> --project-id Payments
sovara automations run <automation-id> --project-id Payments
sovara automations executions <automation-id> --project-id Payments --limit 20
sovara automations recent-runs --project-id Payments
sovara automations execution <execution-id> --project-id Payments
sovara automations reasoning-options --project-id Payments
sovara automations delete <automation-id> --project-id Payments
```

Schedules use five-field cron expressions and IANA timezones. Creation enables the
schedule unless `--enabled=false` is supplied. Use `--thinking-level` to select a
supported reasoning level and `--remember-previous-runs` to include earlier outputs
in execution context. Defaults are `medium` and `false`, respectively.

Updates change only explicitly supplied options. Mutations fetch the current
revision before applying the change; provide `--expected-revision N` to require a
specific revision you have already reviewed. A revision conflict requires reading
the automation again before retrying.

List commands support `--limit` and `--cursor`; pass the returned `next_cursor`
to fetch another page. `list` also accepts `--search` and `--enabled` filters.
`recent-runs` lists executions that have started, while `executions` also shows
queued work. `execution` reads the shared result, including output and status.

Saved automations continue running independently of the CLI or MCP connection.
Pause or delete them to stop future scheduled work. Scheduled and immediate
executions consume your organization's model usage.
