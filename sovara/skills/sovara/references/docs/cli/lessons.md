---
title: "Lessons"
description: "Read and manage Sovara lessons from the CLI."
---

Lessons are reusable instructions, domain facts, and operating rules that
Sovara can retrieve for future agent traces.

## Create lessons with a coding assistant

For human-reviewed lesson creation from recorded behavior, run `sovara onboard`
or follow the [assistant skill workflow](/cli/assistant-skill). Codex or Claude
Code can inspect and annotate a relevant trace, confirm ground truth with you,
decide whether a lesson is appropriate, attach provenance, and test retrieval
and behavior. The commands below are for managing lessons directly.

Every `sovara lessons` subcommand requires `--project-id`. The
selector accepts a full project ID, an unambiguous ID prefix, or an exact
project name. Examples below use a shell variable to keep commands readable:

```bash
PROJECT=support-agent
```

## List and read lessons

```bash
sovara lessons ls --project-id "$PROJECT"
sovara lessons ls --project-id "$PROJECT" "support/refunds/"
sovara lessons ls -R --project-id "$PROJECT" "support/"
sovara lessons get <lesson-id> --project-id "$PROJECT"
sovara lessons get <lesson-id>,<lesson-id> --project-id "$PROJECT"
```

`ls` returns lessons and immediate child folders. Omit the path or pass `""` to
list the root folder. Add `-R` / `--recursive` to include compact lesson records
from descendant folders; full lesson content is omitted. `get` returns complete
lesson details. Multiple comma-separated IDs are returned under a `lessons`
array in the requested order.

## Retrieve lessons for context

```bash
sovara lessons retrieve --project-id "$PROJECT" "Customer asks for a refund exception"
```

Use `retrieve` to see which lessons match concrete agent context. Optionally
scope retrieval to a folder with `--path` / `-p`.

To check a proposal before applying it, add `--proposal <proposal-id>`. Sovara
retrieves as if the proposal were merged into current Production, without
publishing it, and returns the proposal revision, Production revision and corpus
it used under `lesson_source`. Add `--expected-revision` to fail with a conflict
if the proposal has changed since you last read it:

```bash
sovara lessons retrieve --project-id "$PROJECT" --proposal "$PROPOSAL" \
  --expected-revision "$REVISION" "Customer asks for a refund exception"
```

## Create a lesson

Creation saves to a proposal and requires a title, content, and retrieval-oriented usage hint:

```bash
sovara lessons create \
  --project-id "$PROJECT" \
  --title "Retry rate-limited provider calls" \
  --content "When an upstream API returns HTTP 429, retry with exponential backoff and jitter." \
  --when-to-use "When a provider request fails because of rate limiting" \
  --path "reliability/providers/" \
  --trace-id "<trace-id>" \
  --step 3
```

The response includes a `proposal_id`. Pass `--proposal <proposal-id>` to
subsequent edits to keep related changes together. Without it, each edit creates
a new proposal. Reads default to production; add `--proposal` to inspect saved
proposal contents. Retrieval uses published Production lessons unless you pass
`--proposal`.

To link a lesson to a recorded step, pass the source trace with `--trace-id` and
the step reference shown by `sovara probe` with `--step`. You can use your own
SDK identifier for the trace. Omit both flags when there is no recorded source.

```bash
sovara lessons create \
  --project-id "$PROJECT" \
  --title "Retry rate-limited provider calls" \
  --content "Retry HTTP 429 responses with exponential backoff and jitter." \
  --when-to-use "When a provider request is rate limited" \
  --trace-id "<your-trace-id>" \
  --step 3
```

## Improve a lesson

Save an update in a proposal:

```bash
sovara lessons update <lesson-id> \
  --project-id "$PROJECT" \
  --content "Retry HTTP 429 responses with exponential backoff and jitter." \
  --trace-id "<trace-id>"
```

## Manage folders

```bash
sovara lessons mkdir "support/refunds/" --project-id "$PROJECT"
sovara lessons mv -i <lesson-id> "support/refunds/" --project-id "$PROJECT"
sovara lessons cp "support/refunds/" "support/escalations/" --project-id "$PROJECT"
```

Pass the same explicit project selector and `--proposal <proposal-id>` to keep
folder operations in the same proposal. `lessons rm <lesson-id>` or
`lessons rm -r <folder-path>` proposes removal; production changes only on Apply.

## Review and publish a proposal

```bash
sovara lessons proposals show <proposal-id> --project-id "$PROJECT"
sovara lessons proposals diff <proposal-id> --project-id "$PROJECT"
sovara lessons proposals review <proposal-id> --project-id "$PROJECT"
sovara lessons proposals apply <proposal-id> --project-id "$PROJECT"
```

Review saves model feedback without publishing and may incur provider charges.
Apply publishes saved changes to the production lesson corpus; review is advisory
and unresolved merge conflicts block publication. Apply only after the user approves publication.

Pass `--expected-revision <revision-id>` from a prior read to guard an edit or
proposal action. Apply and conflict resolution also accept
`--expected-production <production-revision-id>`. If omitted, the CLI reads the
current revision immediately before the action. On a conflict, read the proposal
again and reconcile changes before retrying.

Use `lessons proposals close <proposal-id>` to discard an open proposal without
publishing, `lessons proposals reopen <proposal-id>` to resume a closed proposal,
and `lessons history` to inspect production publications. These commands also
require `--project-id`.
