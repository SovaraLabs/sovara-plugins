import { createHash, randomUUID } from "node:crypto";

const digest = (text) => createHash("sha256").update(text).digest("hex");

/** Delivery state belongs to one host conversation, not its ancestors. */
export function emptyLessons() {
  return { generation: randomUUID(), boundary: null, confirmed: [], delivered: [], pending: [] };
}

export function resetLessons(state, boundary) {
  if (typeof boundary !== "string" || !boundary) throw new TypeError("Missing compaction boundary.");
  if (state.boundary === boundary) return state;
  return { ...emptyLessons(), boundary };
}

function textBlocks(messages) {
  if (!Array.isArray(messages)) throw new TypeError("The target conversation could not be read.");
  const text = [];
  for (const message of messages) {
    // Only user-side context confirms delivery. A model quoting an ID does not.
    if (message?.role !== "user") continue;
    if (typeof message.content === "string") text.push(message.content);
    else if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block?.type === "text" && typeof block.text === "string") text.push(block.text);
      }
    }
  }
  return text;
}

/** Confirm an entire delivered block, never just an ID left in a summary. */
export function reconcileLessons(state, messages) {
  const blocks = textBlocks(messages);
  const confirmed = new Set();
  const delivered = [];
  const pending = [];
  const previous = new Set(state.delivered);
  for (const delivery of [...state.delivered, ...state.pending]) {
    const found = blocks.some((text) => {
      const start = text.indexOf(delivery.start);
      if (start < 0) return false;
      const end = text.indexOf(delivery.end, start + delivery.start.length);
      if (end < 0) return false;
      return digest(text.slice(start, end + delivery.end.length)) === delivery.digest;
    });
    if (found) {
      delivered.push(delivery);
      for (const id of delivery.ids) confirmed.add(id);
    } else if (!previous.has(delivery)) pending.push(delivery);
  }
  state.confirmed = [...confirmed];
  state.delivered = delivered;
  state.pending = pending;
  return state;
}

/** Selection alone does not add IDs to exclusions. No lesson text is persisted here. */
export function prepareLessonDelivery(state, scope, retrieved) {
  const ids = [...new Set(retrieved.lessons.map((lesson) => lesson.lesson_id))];
  if (!ids.length || !retrieved.rendered_lessons_block?.trim()) return null;
  if (ids.some((id) => typeof id !== "string" || !id)) throw new TypeError("Invalid lesson ID.");
  const nonce = randomUUID();
  const marker = `sovara-lessons:${scope}:${state.generation}:${nonce}`;
  const start = `<!-- ${marker}:start -->`;
  const end = `<!-- ${marker}:end -->`;
  const text = `${start}\n${retrieved.rendered_lessons_block}\n${end}`;
  state.pending.push({ start, end, ids, digest: digest(text), retrievalId: retrieved.retrieval_id });
  // Unacknowledged deliveries never suppress retrieval, and cannot grow without bound.
  state.pending = state.pending.slice(-32);
  return { text, ids, generation: state.generation, retrievalId: retrieved.retrieval_id };
}

export function lessonScope(binding, agentId) {
  return digest(JSON.stringify([binding, agentId ?? null])).slice(0, 24);
}
