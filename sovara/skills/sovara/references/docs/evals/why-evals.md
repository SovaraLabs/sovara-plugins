---
title: "Why evals?"
description: "Measure your agent’s quality, catch regressions, and understand what to improve."
---

How often does your agent get the task right? A benchmark turns that question
into something you can measure: a set of realistic tasks with clear criteria
for success. Run it regularly to track quality and see whether your changes
actually help.

## Know how good your agent is

An eval measures how often your agent succeeds across the tasks you care about.
It gives you a baseline for comparing changes to prompts, models, tools, and
lessons.

A larger, more representative benchmark gives you more confidence in the
results. Include everyday tasks, difficult cases, and failures from production.
Clear success criteria and reliable grading matter more than adding duplicates
of cases you already cover.

## Know when quality changes

Your agent can get worse even when its code stays the same. Data can become
incomplete or outdated, users can start asking different questions, and model
providers can change the model or its configuration behind the same endpoint.

Run your benchmark regularly to detect changes in accuracy and latency. Keep a
stable set of cases to track regressions, and add cases from recent usage to
keep the benchmark relevant to your users.

## Know what to improve

Failed samples show you where to investigate: missing knowledge, poor
retrieval, incorrect tool use, or an instruction the agent did not follow.

Inspect the failures, make a targeted change, and rerun the benchmark. Compare
which samples improved and which regressed to check that your fix helps
without introducing problems elsewhere.

## Provide evidence for regulated use

In finance, insurance, and healthcare, demonstrating that an AI system works
as intended can be part of meeting regulatory obligations. Evals provide
repeatable evidence for validation before deployment and as the system changes.

<Accordion title="Examples from FINMA, SEC and FDA">

- **FINMA:** Its AI guidance examines whether supervised institutions test
  accuracy, robustness, and stability, define expected results and performance
  indicators, and monitor ongoing output quality and data drift. See
  [FINMA Guidance 08/2024, sections 2.4–2.5](https://www.finma.ch/en/~/media/finma/dokumente/dokumentencenter/myfinma/4dokumentation/finma-aufsichtsmitteilungen/20241218-finma-aufsichtsmitteilung-08-2024.pdf).
- **SEC:** Staff guidance for robo-advisers recommends considering compliance
  policies for testing and backtesting algorithmic code and monitoring its
  performance after deployment. See
  [Robo-Advisers, section 3](https://www.sec.gov/investment/im-guidance-2017-02.pdf).
- **FDA:** For AI-enabled medical device software, its final guidance on
  predetermined change control plans recommends describing how planned
  modifications will be developed, validated, and implemented to maintain
  safety and effectiveness. See
  [FDA guidance on predetermined change control plans](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/marketing-submission-recommendations-predetermined-change-control-plan-artificial-intelligence).

These sources address specific regulated uses and supervisory expectations;
they do not impose one universal benchmark requirement on every AI agent.
A benchmark contributes evidence to a broader validation process.

</Accordion>

Sovara connects evaluation results to the underlying traces, so you can move
from a score to understanding what happened. Next:
[Evals in Sovara](/evals/evals-in-sovara).
