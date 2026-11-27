---
title: "Annotate and analyze traces"
description: "Inspect, label, analyze, and clear trace annotations."
---

Annotations turn important traces into labeled examples. Use them when a trace is a
clear success, a clear failure, or useful evidence for future evaluation.

Use the trace ID shown in Sovara or a unique ID prefix. To use your own
identifier from the SDK, include `--project-id`. Trace lists require a project;
`--trace-id` filters them by a fragment of the trace ID.

## Automatic participation

Every completed trace participates automatically. There is no annotation queue
setting or manual enqueue/dismiss operation. A trace is annotated when it has
nonempty ground truth or a thumbs-up. A thumbs-down without ground truth still
needs annotation. Ground truth and labels belong to the trace; analysis is computed
separately and never changes either.

## List annotation work

```bash
sovara traces --project-id <project-id-or-name> --annotation needed --limit 10
sovara traces --project-id <project-id-or-name> --annotation needed --sort failureScore --dir desc --failure-min 0.5
sovara traces --project-id <project-id-or-name> --annotation annotated --limit 10
sovara traces --project-id <project-id-or-name> --annotation annotated --label down --code-version <short-sha>
```

`traces` always requires a project. The selector accepts a full
project ID, an unambiguous ID prefix, or an exact project name.
Queue filters also cover name/trace ID, text query, time, runtime, novelty score,
analysis state, and tag IDs. Run `sovara tags list --project-id <project>` to
map tag names to IDs. Responses retain scores, statuses, tags, and
`distinct_code_versions`, which can be fed back into later filters.

## Inspect before labeling

```bash
sovara traces inspect <trace-id>
sovara probe <trace-id>
sovara probe <trace-id> --step <step-ref> --preview
```

`traces inspect` returns the complete trace-annotation response. The persisted
`AnnotationRecommendation` is under `recommendation` and may be `null` when the
trace has no recommendation. It includes the analysis verdict and hint,
scoring/status fields, every completed artifact-adjudication pair, closest
retained failure evidence, and most-novel evidence.

Evidence locators expose `trace_id`, `step_uuid`, display `step_ref`, `field`, and
zero-based `chunk_index`. In `evidence.adjudication_pairs`,
`failure_embedding_artifact` is `true` for an embedding artifact, `false` for a
completed verdict that retained the pair as plausible failure evidence, and
`null` when the pair was not checked.

Use step refs from `probe` when you want the label to point at specific
evidence.

## Save a success

```bash
sovara traces annotate <trace-id> --label success
```

Add optional ground truth when it helps future reviewers:

```bash
sovara traces annotate <trace-id> \
  --label success \
  --groundtruth "The answer cites the contract renewal policy and gives the correct date."
```

## Save a failure

Failure annotations require ground truth:

```bash
sovara traces annotate <trace-id> \
  --label failure \
  --groundtruth "The answer should use the current refund policy and refuse unsupported exceptions."
```

Focus the failure on specific steps:

```bash
sovara traces annotate <trace-id> \
  --label failure \
  --groundtruth "The retrieval step missed the enterprise policy page." \
  --steps 4,6.2
```

## Request deep analysis

```bash
sovara traces analyze <trace-id>
```

This schedules deep analysis and returns the trace ID and scheduling status.
Use `sovara traces inspect <trace-id>` to read progress and the completed recommendation.
Completed recordings are scored automatically when models are configured; deep
analysis is requested explicitly. Failure resemblance and novelty are available
in `sovara traces` output and can be filtered and sorted across the whole project.

## Clear an annotation

```bash
sovara traces unannotate <trace-id>
```

This clears both the label and ground truth, keeps the recorded trace, and
invalidates derived reference evidence so affected scores can be recomputed.
For a thumbs-up-only annotation, clearing the thumbs-up in the UI is also enough.
If a trace has both a thumbs-up and ground truth, clearing only one leaves it annotated.
Unannotation never excludes a trace from future annotation work.

The Traces table contains Deep Analysis, Failure resemblance and Novelty.
Use the right-click menu or Actions dropdown to request deep analysis; open its
panel to inspect the explanation, label the trace and edit ground truth. The panel
slides over the right two thirds of Traces, keeping the remaining third visible.
