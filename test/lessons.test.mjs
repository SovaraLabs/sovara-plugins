import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyLessons, resetLessons, reconcileLessons, prepareLessonDelivery, lessonScope } from "../src/claude/lessons.mjs";

const retrieval = { lessons: [{ lesson_id: "banana" }], rendered_lessons_block: "Julian likes bananas.", retrieval_id: "selection-1" };
const message = (text, role = "user") => [{ role, content: [{ type: "text", text }] }];

test("selected or partially delivered lessons remain eligible; whole user context confirms", () => {
  const state = emptyLessons();
  const delivery = prepareLessonDelivery(state, "main", retrieval);
  assert.deepEqual(state.confirmed, []);
  reconcileLessons(state, message(delivery.text.slice(0, -10)));
  reconcileLessons(state, message(delivery.text, "assistant"));
  assert.deepEqual(state.confirmed, []);
  reconcileLessons(state, message(`Host context\n${delivery.text}\nEnd context`));
  assert.deepEqual(state.confirmed, ["banana"]);
  assert.deepEqual(state.pending, []);
});

test("successful compaction permits reinjection even if summary retained the complete old text", () => {
  let state = emptyLessons();
  const first = prepareLessonDelivery(state, "main", retrieval);
  reconcileLessons(state, message(first.text));
  state = resetLessons(state, "committed-boundary-1");
  reconcileLessons(state, message(first.text));
  assert.deepEqual(state.confirmed, []);
  const second = prepareLessonDelivery(state, "main", retrieval);
  assert.notEqual(first.generation, second.generation);
  reconcileLessons(state, message(first.text));
  assert.deepEqual(state.confirmed, []);
  reconcileLessons(state, message(second.text));
  assert.deepEqual(state.confirmed, ["banana"]);
  assert.equal(resetLessons(state, "committed-boundary-1"), state);
});

test("main, child, nested child and fork have independent exclusions; resume keeps its own", () => {
  const main = emptyLessons();
  const child = emptyLessons();
  const mainNote = prepareLessonDelivery(main, lessonScope("session-A", null), retrieval);
  const childNote = prepareLessonDelivery(child, lessonScope("session-A", "child"), retrieval);
  reconcileLessons(main, message(mainNote.text));
  reconcileLessons(child, message(mainNote.text));
  assert.deepEqual(child.confirmed, []);
  reconcileLessons(child, message(childNote.text));
  const resumed = JSON.parse(JSON.stringify(child));
  reconcileLessons(resumed, message(childNote.text));
  assert.deepEqual(resumed.confirmed, ["banana"]);
  assert.notEqual(lessonScope("session-A", "child"), lessonScope("session-B", "child"));
  assert.notEqual(lessonScope("session-A", "child"), lessonScope("session-A", "nested"));
  assert.deepEqual(emptyLessons().confirmed, []);
});

test("unreadable child conversation is never treated as empty main context", () => {
  assert.throws(() => reconcileLessons(emptyLessons(), { deny: "Unavailable child" }), /could not be read/);
});

test("a lesson removed while hooks were absent becomes eligible from the actual conversation", () => {
  const state = emptyLessons();
  const delivery = prepareLessonDelivery(state, "main", retrieval);
  reconcileLessons(state, message(delivery.text));
  assert.deepEqual(state.confirmed, ["banana"]);
  const resumed = JSON.parse(JSON.stringify(state));
  reconcileLessons(resumed, message("A summary mentioning banana, without its lesson text."));
  assert.deepEqual(resumed.confirmed, []);
  assert.deepEqual(resumed.delivered, []);
  assert.ok(!JSON.stringify(resumed).includes("Julian likes bananas"));
});

test("pending retry state is bounded and persists no lesson contents", () => {
  const state = emptyLessons();
  for (let i = 0; i < 40; i++) prepareLessonDelivery(state, "main", retrieval);
  assert.equal(state.pending.length, 32);
  assert.ok(!JSON.stringify(state).includes("Julian likes bananas"));
  assert.deepEqual(state.confirmed, []);
});
