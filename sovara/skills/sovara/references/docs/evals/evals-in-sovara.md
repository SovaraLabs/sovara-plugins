---
title: "Evals in Sovara"
description: "Follow an evaluation from recorded samples to comparisons and individual traces."
---

Sovara brings your benchmark results and agent traces together. Start with the
overall result, compare it with an earlier evaluation, and open individual
samples to understand what changed.

## Record your first evaluation

Your code runs the benchmark and grades the answers; Sovara records and displays
the results. Start with the [SDKs](/sdks/index) to connect your agent. The
[Python SDK reference](/sdks/python/api-reference#clientcreate_eval_run)
describes how to create an evaluation run and log sample results.

Each **evaluation run** groups one execution of your benchmark. Each **sample**
is an individual agent run with its own input, output, verdict, and trace.
Create a new evaluation run each time you execute the benchmark so you can
compare results over time.

Record your samples' inputs and outputs, and supply a correctness verdict from
your evaluator. You can also log custom fields on individual samples or on the
whole evaluation run, such as the dataset version or an aggregate score.

## Open your evaluation results

Open your project and select <strong><Icon icon="chart-no-axes-column" size={14} /> Evaluations</strong>
in the sidebar under **Track performance**.

<Frame>
  <img src="/media/evaluation-runs.png" alt="Sovara Evaluations view with Run A and Run B selectors, an accuracy trend, outcome changes, latency comparison, and a table of evaluation runs." />
</Frame>

The page has two parts: charts for tracking and comparing performance at the
top, and a table of evaluation runs below. With one evaluation, you can inspect
its samples and accuracy. Record at least two to compare them.

Use the table to find an evaluation by its date and logged fields:

- Open <strong><Icon icon="funnel" size={14} /> Filters</strong> to filter by date,
  search logged fields, filter by git commit, or narrow the accuracy range.
- Use <strong>Columns <Icon icon="eye" size={14} /></strong> to choose which
  fields appear. Click a column heading to sort the table.
- Click an evaluation row to open its samples.

## Compare two evaluation runs

At the top of the page, choose your baseline in **Run A** and the evaluation you
want to assess in **Run B**. Use evaluations of the same benchmark with the same
grading criteria for a meaningful comparison.

The summary shows accuracy for each evaluation, p95 latency, and the number of
matched samples. The charts help you answer three questions.

### Has accuracy changed over time?

**Accuracy over all evaluation runs** shows the history of your project's
evaluations. Hover over a point to see its date, accuracy, and sample count.
The selected Run A and Run B are highlighted.

By default, accuracy is the share of graded samples marked correct; ungraded
samples are excluded. A valid evaluation-level `accuracy` value logged through
the SDK overrides that calculation. This is why the summary accuracy can differ
from the outcomes of the matched samples shown beside it.

### Which samples improved or regressed?

**Outcome changes for matched samples** separates the results into four groups:

| Group | Run A → Run B |
| --- | --- |
| Still passing | Correct → Correct |
| Regressed | Correct → Incorrect |
| Fixed | Incorrect → Correct |
| Still failing | Incorrect → Incorrect |

Click a group to open those samples in **Run B**. Start with **Regressed** to
investigate new failures, then check **Fixed** to see where your change helped.

<Note>
  Samples match across evaluations by their exact recorded input text. Keep
  benchmark inputs consistent between runs. Inputs that are missing or occur
  more than once within either evaluation are excluded from matching. The four
  outcome groups include only matches with correctness verdicts in both runs.
</Note>

### Did the agent get faster or slower?

In **Latencies of matched samples**, each dot represents a matched sample with
recorded runtime in both evaluations. The horizontal axis is Run A; the vertical
axis is Run B. Dots below the diagonal are faster in Run B; dots above it are
slower. Hover over a dot to see the sample labels and both runtimes.

Green dots show fixed samples and red dots show regressions. Grey dots show
unchanged results, with a separate legend entry when ungraded matches are
present. The p95 summary highlights the slower end of the runtime distribution,
using available runtimes from matched samples in each evaluation.

## Inspect a sample and its trace

Open an evaluation row, or click an outcome group in the comparison, to see the
sample table. It shows inputs, outputs, runtime, correctness, and any custom
fields you logged. <strong><Icon icon="circle-check" size={14} /> Correct</strong>
and <strong><Icon icon="circle-x" size={14} /> Incorrect</strong> mark the
verdicts; a dash means no verdict is available.

Use <strong><Icon icon="funnel" size={14} /> Filters</strong> to narrow the
samples by content, input, output, runtime, or correctness. If you arrived from
an outcome group, the list is already limited to that group. Use **Reset** in
the filters to return to all samples.

The **Correct last run?** column refers to the preceding evaluation, which may
be different from the Run A you selected in the comparison.

Click a sample row to open its trace. Follow the model and tool calls to find
where the answer went wrong—for example, a retrieval that missed relevant
information or a tool call that used the wrong arguments. See
[Manual inspection](/observability/manual-inspection) for a guide to reading
traces.

## Evaluate your next change

Use what you learned from the failed samples to make a targeted change to your
agent. Run the benchmark again from your code, then return to
<strong><Icon icon="chart-no-axes-column" size={14} /> Evaluations</strong>
and select the new evaluation as **Run B**. Check both the fixes and regressions,
and compare latency alongside accuracy.
