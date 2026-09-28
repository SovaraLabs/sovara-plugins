---
title: "Annotate and analyze runs"
description: "Inspect, label, analyze, and clear run annotations."
---

Annotations turn important runs into labeled examples. Use them when a run is a
clear success, a clear failure, or useful evidence for future evaluation.

Commands that target one run accept either its Sovara UUID (or an unambiguous
UUID prefix) or `--project-id PROJECT --run-key KEY`. Annotation lists always
require a project and can filter with either `--run-id` or `--run-key`.

## Automatic participation

Every completed run participates automatically. There is no annotation queue
setting or manual enqueue/dismiss operation. A run is annotated when it has
nonempty ground truth or a thumbs-up. A thumbs-down without ground truth still
needs annotation. Ground truth and labels belong to the run; analysis is computed
separately and never changes either.

## List annotation work

```bash
sovara runs --project-id <project-id-or-name> --annotation needed --limit 10
sovara runs --project-id <project-id-or-name> --annotation needed --sort failureScore --dir desc --failure-min 0.5
sovara runs --project-id <project-id-or-name> --annotation annotated --limit 10
sovara runs --project-id <project-id-or-name> --annotation annotated --label down --code-version <short-sha>
sovara runs --project-id <project-id-or-name> --annotation annotated --run-key <run-key>
```

`runs` always requires a project. The selector accepts a full
project ID, an unambiguous ID prefix, or an exact project name.
Queue filters also cover name/run ID, text query, time, runtime, novelty score,
analysis state, and tag IDs. Run `sovara tags list --project-id <project>` to
map tag names to IDs. Responses retain scores, statuses, tags, and
`distinct_code_versions`, which can be fed back into later filters.

## Inspect before labeling

```bash
sovara runs inspect <run-id>
sovara probe <run-id>
sovara probe <run-id> --step <step-ref> --preview
```

`runs inspect` returns the complete run-annotation response. The persisted
`AnnotationRecommendation` is under `recommendation` and may be `null` when the
run has no recommendation. It includes the analysis verdict and hint,
scoring/status fields, every completed artifact-adjudication pair, closest
retained failure evidence, and most-novel evidence.

Evidence locators expose `run_id`, `step_uuid`, display `step_ref`, `field`, and
zero-based `chunk_index`. In `evidence.adjudication_pairs`,
`failure_embedding_artifact` is `true` for an embedding artifact, `false` for a
completed verdict that retained the pair as plausible failure evidence, and
`null` when the pair was not checked.

Use step refs from `probe` when you want the label to point at specific
evidence.

## Save a success

```bash
sovara runs annotate <run-id> --label success
```

Add optional ground truth when it helps future reviewers:

```bash
sovara runs annotate <run-id> \
  --label success \
  --groundtruth "The answer cites the contract renewal policy and gives the correct date."
```

## Save a failure

Failure annotations require ground truth:

```bash
sovara runs annotate <run-id> \
  --label failure \
  --groundtruth "The answer should use the current refund policy and refuse unsupported exceptions."
```

Focus the failure on specific steps:

```bash
sovara runs annotate <run-id> \
  --label failure \
  --groundtruth "The retrieval step missed the enterprise policy page." \
  --steps 4,6.2
```

## Request deep analysis

```bash
sovara runs analyze <run-id>
```

This schedules deep analysis and returns the run ID and scheduling status.
Use `sovara runs inspect <run-id>` to read progress and the completed recommendation.
Completed recordings are scored automatically when models are configured; deep
analysis is requested explicitly. Failure resemblance and novelty are available
in `sovara runs` output and can be filtered and sorted across the whole project.

## Clear an annotation

```bash
sovara runs unannotate <run-id>
```

This clears both the label and ground truth, keeps the recorded run, and
invalidates derived reference evidence so affected scores can be recomputed.
For a thumbs-up-only annotation, clearing the thumbs-up in the UI is also enough.
If a run has both a thumbs-up and ground truth, clearing only one leaves it annotated.
Unannotation never excludes a run from future annotation work.

The desktop Runs table contains Deep Analysis, Failure resemblance and Novelty.
Use the right-click menu or Actions dropdown to request deep analysis; open its
panel to inspect the explanation, label the run and edit ground truth. The panel
slides over the right two thirds of Runs, keeping the remaining third visible.

Legacy `annotations list/inspect/set/analyze` commands are transition aliases.
`annotations enqueue` and `annotations remove` are no longer supported. Use
`runs unannotate` explicitly when clearing saved human input is intended.
