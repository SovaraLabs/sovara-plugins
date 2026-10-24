import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { emptyLessons, lessonScope, prepareLessonDelivery, reconcileLessons, resetLessons } from "./lessons.mjs";

const keyOf = (id) => JSON.stringify(id ?? null);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const tokenKeys = ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"];

function usageOf(usage) {
  if (!usage) return undefined;
  return Object.fromEntries(tokenKeys.filter((key) => Number.isSafeInteger(usage[key]) && usage[key] >= 0).map((key) => [key, usage[key]]));
}

function errorOf(value) {
  return new Error(typeof value === "string" ? value : "Claude host operation failed.");
}

/** Owns SDK lifetimes; host hooks own execution and never run a provider twice. */
export class ClaudeSession {
  constructor({ client, state, rootRecording }) {
    this.client = client;
    this.state = state;
    this.rootRecording = rootRecording;
    this.ownsRoot = !rootRecording;
    this.agents = new Map();
    this.turns = new Map();
    this.steps = new Map();
    this.completed = new Set();
    this.queue = Promise.resolve();
    this.closing = false;
  }

  dispatch(event) {
    if (this.closing) return Promise.reject(new Error("Claude recording is closing."));
    const task = this.queue.then(() => this.handle(event));
    this.queue = task.catch(() => {});
    return task;
  }

  async scope(agentId, infos = [], ancestors = new Set()) {
    const key = keyOf(agentId);
    if (ancestors.has(key)) throw new Error("Cyclic host agent hierarchy.");
    ancestors.add(key);
    const active = this.agents.get(key);
    if (active?.state === "active") return active;
    const saved = this.state.data.agents[key];
    let recording;
    if (agentId == null) {
      recording = this.rootRecording;
      if (!recording) recording = await this.client.startRecording("Claude Code", {
        traceId: saved?.traceId ?? `claude-code:${digest(this.state.data.binding)}`,
        captureLogs: false,
      });
      if (recording.state !== "active") throw new Error("The application recording is no longer active.");
    } else {
      const info = infos.find((row) => row.id === agentId);
      if (!info && !saved) throw new Error("The host has not identified this agent's parent.");
      const parentId = info ? (info.parentId ?? null) : saved.parentId;
      if (saved && saved.parentId !== parentId) throw new Error("The host agent's parent changed.");
      const parent = await this.scope(parentId, infos, ancestors);
      if (saved) {
        // Finalization returns before the server's durable write queue necessarily drains.
        const deadline = Date.now() + 2000;
        for (;;) {
          try { recording = await parent.attachChild(saved.traceId); break; }
          catch (error) {
            if (error.status !== 409 || Date.now() >= deadline || !JSON.stringify(error.body).includes("child_not_attachable")) throw error;
            await delay(40);
          }
        }
      } else recording = await parent.startChild(info.description || info.type || "Claude subagent");
      if (!saved) this.state.data.agents[key] = { parentId, traceId: recording.traceId, lessons: emptyLessons() };
    }
    if (!saved && agentId == null) this.state.data.agents[key] = { parentId: null, traceId: recording.traceId, lessons: emptyLessons() };
    this.agents.set(key, recording);
    await this.state.save();
    return recording;
  }

  async turn(event) {
    if (typeof event.turnId !== "string" || !event.turnId) throw new TypeError("Missing host turn ID.");
    const key = JSON.stringify([event.agentId ?? null, event.turnId]);
    let turn = this.turns.get(key);
    if (turn) return turn;
    if (this.completed.has(`turn:${key}`)) throw new Error("Host turn already completed.");
    // A cancelled host hook may lose its final RPC. A new turn of the same
    // conversation proves the old one stopped; other agents remain independent.
    for (const [previousKey, previous] of this.turns) {
      if (JSON.parse(previousKey)[0] !== (event.agentId ?? null)) continue;
      try { await previous.cancel("Claude started another turn before completion was recorded."); }
      finally {
        this.releaseTurn(previousKey);
        this.turns.delete(previousKey);
        this.remember(`turn:${previousKey}`);
      }
    }
    turn = await (await this.scope(event.agentId, event.agents)).startTurn({ turnInput: event.text ?? "" });
    this.turns.set(key, turn);
    return turn;
  }

  remember(key) {
    this.completed.add(key);
    if (this.completed.size > 4096) this.completed.delete(this.completed.values().next().value);
  }

  releaseTurn(turnKey) {
    for (const [key, entry] of this.steps) if (entry.turnKey === turnKey) {
      this.steps.delete(key);
      this.remember(key);
    }
  }

  async handle(event) {
    if (!event || typeof event !== "object" || typeof event.type !== "string") throw new TypeError("Invalid Claude event.");
    if (event.agentId != null && (typeof event.agentId !== "string" || !event.agentId)) throw new TypeError("Invalid host agent ID.");
    if (event.type === "turn-start") {
      const turn = await this.turn(event);
      return { traceId: turn.traceId, recordingId: turn.recordingId };
    }
    if (event.type === "lessons") {
      if (!Array.isArray(event.messages)) throw new Error("Target conversation is unavailable.");
      const scope = await this.scope(event.agentId, event.agents);
      const saved = this.state.data.agents[keyOf(event.agentId)];
      reconcileLessons(saved.lessons, event.messages);
      await this.state.save();
      const selected = await scope.retrieveLessons({
        rawContext: JSON.stringify({ messages: event.messages, ...(event.prompt ? { prompt: event.prompt } : {}) }),
        ignoreLessonIds: saved.lessons.confirmed,
        signal: AbortSignal.timeout(8000),
      });
      const delivery = prepareLessonDelivery(saved.lessons, lessonScope(this.state.data.binding, event.agentId), selected);
      await this.state.save();
      return delivery;
    }
    if (event.type === "compacted") {
      await this.scope(event.agentId, event.agents);
      const saved = this.state.data.agents[keyOf(event.agentId)];
      saved.lessons = resetLessons(saved.lessons, event.boundary);
      await this.state.save();
      return { generation: saved.lessons.generation };
    }
    if (event.type === "model-start") {
      const key = JSON.stringify([event.agentId ?? null, event.turnId, "model", event.index]);
      if (this.steps.has(key) || this.completed.has(key)) return { key };
      const turn = await this.turn(event);
      const saved = this.state.data.agents[keyOf(event.agentId)];
      if (Array.isArray(event.messages)) reconcileLessons(saved.lessons, event.messages);
      await this.state.save();
      const handle = await turn.startModelObservation({
        model: event.model,
        ...(Array.isArray(event.messages) ? { messages: event.messages } : {}),
        capture: {
          source: "host_event", completeness: "partial",
          limitations: ["Host-visible conversation; provider request, hidden instructions and internal retries are unavailable.",
            "The host reports aggregate usage and substitutes zero for unavailable counters."],
        },
        metadata: { integration: "claude-code", hostTurnId: event.turnId, hostAgentId: event.agentId ?? null,
          stepIndex: event.index, lessonIds: saved.lessons.confirmed, lessonGeneration: saved.lessons.generation },
      });
      this.steps.set(key, { handle, turnKey: JSON.stringify([event.agentId ?? null, event.turnId]) });
      return { key };
    }
    if (event.type === "tool-start") {
      if (typeof event.callId !== "string" || !event.callId) throw new TypeError("Missing host tool-use ID.");
      const key = JSON.stringify([event.agentId ?? null, "tool", event.callId]);
      if (this.steps.has(key) || this.completed.has(key)) return { key };
      const turn = await this.turn(event);
      const options = { name: event.name, input: event.input, callId: event.callId,
        kind: event.mcp ? "mcp" : "tool", meta: { integration: "claude-code", hostAgentId: event.agentId ?? null,
          hostToolKind: event.mcp ? "mcp" : "tool" } };
      // Successful Agent calls are represented by the existing subtrace delegation.
      const handle = event.name === "Agent" ? null : await turn.startTool(options);
      this.steps.set(key, { handle, turn, options, turnKey: JSON.stringify([event.agentId ?? null, event.turnId]) });
      return { key };
    }
    if (event.type === "model-end" || event.type === "tool-end") {
      if (this.completed.has(event.key)) return { completed: true };
      const entry = this.steps.get(event.key);
      if (!entry) throw new Error("Observation start was not recorded.");
      let handle = entry.handle;
      const error = event.error ?? event.result?.deny ?? (event.result?.isError ? event.result.text || "Tool returned an error." : null);
      if (!handle && error) handle = await entry.turn.startTool({ ...entry.options,
        meta: { ...entry.options.meta, capture: "Rejected delegation reported after host completion." } });
      if (handle) {
        if (event.cancelled) await handle.cancel("Claude host operation cancelled.");
        else if (error) await handle.fail(errorOf(error),
          event.type === "tool-end" && event.result !== undefined ? { output: event.result } : undefined);
        else if (event.type === "model-end") {
          if (!event.result?.stopReason) await handle.fail(new Error("Host model step ended without a response."));
          else await handle.finish({ content: event.result, usage: usageOf(event.result.usage) });
        } else await handle.finish(event.result);
      }
      this.steps.delete(event.key);
      this.remember(event.key);
      return { completed: true };
    }
    if (event.type === "turn-end") {
      const key = JSON.stringify([event.agentId ?? null, event.turnId]);
      if (this.completed.has(`turn:${key}`)) return { completed: true };
      const turn = this.turns.get(key);
      if (!turn) throw new Error("Host turn start was not recorded.");
      try {
        if (event.reason === "aborted") await turn.cancel();
        else if (event.reason === "error") await turn.fail(new Error("Claude turn failed."));
        else await turn.finish();
      } finally {
        this.releaseTurn(key);
        this.turns.delete(key);
        this.remember(`turn:${key}`);
      }
      if (event.agentId != null) {
        const recording = this.agents.get(keyOf(event.agentId));
        if (event.reason === "aborted") await recording.cancel();
        else if (event.reason === "error") await recording.fail(new Error("Claude subagent failed."));
        else await recording.finish();
        this.agents.delete(keyOf(event.agentId));
      }
      return { completed: true };
    }
    throw new TypeError("Unsupported Claude event.");
  }

  async close() {
    if (this.closing) return this.closePromise;
    this.closing = true;
    this.closePromise = (async () => {
      await this.queue;
      const failures = [];
      for (const entry of this.steps.values()) if (entry.handle) {
        try { await entry.handle.cancel("Claude helper stopped before completion."); } catch (error) { failures.push(error); }
      }
      for (const turn of this.turns.values()) {
        try { await turn.cancel(); } catch (error) { failures.push(error); }
      }
      // Children before parents. Handles are inserted after their parents are opened.
      for (const [key, recording] of [...this.agents].reverse()) {
        if (key === keyOf(null) && !this.ownsRoot) continue;
        try { await recording.finish(); } catch (error) { failures.push(error); }
      }
      await this.state.close();
      if (failures.length) throw new AggregateError(failures, "Some Claude observations did not finish recording.");
    })();
    return this.closePromise;
  }
}
