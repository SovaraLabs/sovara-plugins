const bridges = new Map();
const turns = new Map();
const warned = new Set();
const compactions = new Set();

async function connect($) {
  const projectName = await $.env.get("SOVARA_PROJECT_NAME");
  const externalSocket = await $.env.get("SOVARA_CLAUDE_BRIDGE_SOCKET");
  if (!projectName && !externalSocket) return null;
  const sessionId = await $.session.id();
  let ready = bridges.get(sessionId);
  if (!ready) {
    ready = (async () => {
      const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec((await $.session.version()).version);
      const version = match?.slice(1).map(Number);
      if (!version || version[0] < 2 || (version[0] === 2 && (version[1] < 1 || (version[1] === 1 && version[2] < 310)))) {
        throw new Error("Automatic Sovara integration requires Claude Code 2.1.310 or later.");
      }
      if (externalSocket) {
        const token = await $.env.get("SOVARA_CLAUDE_BRIDGE_TOKEN");
        if (!token) throw new Error("Missing application bridge credentials.");
        return { socketPath: externalSocket, token };
      }
      return new Promise((resolve, reject) => {
        void (async () => {
          const stream = $.process.spawn({ argv: ["node", $.plugin.root + "/runtime/claude-helper.mjs"], input: JSON.stringify({ projectName, sessionId }) });
          let text = "";
          let connected = false;
          for await (const chunk of stream) {
            if (chunk.stream !== "stdout" || connected) continue;
            text += chunk.text;
            if (text.length > 8192) throw new Error("Invalid helper handshake.");
            const newline = text.indexOf("\n");
            if (newline < 0) continue;
            const result = JSON.parse(text.slice(0, newline));
            if (result.protocol !== 1 || typeof result.socketPath !== "string" || typeof result.token !== "string") throw new Error("Invalid helper handshake.");
            connected = true;
            resolve(result);
          }
          bridges.delete(sessionId);
          reject(new Error("The Sovara helper stopped."));
        })().catch((error) => { bridges.delete(sessionId); reject(error); });
      });
    })();
    bridges.set(sessionId, ready);
  }
  return ready;
}

async function request($, event, close = false) {
  const bridge = await connect($);
  if (!bridge) return undefined;
  const response = await $.http.fetch("http://sovara-claude/" + (close ? "close" : "event"), {
    socketPath: bridge.socketPath, method: "POST", headers: { authorization: "Bearer " + bridge.token },
    body: JSON.stringify({ id: crypto.randomUUID(), event }),
  });
  if (!response.ok) throw new Error("Sovara host recording failed.");
  return JSON.parse(response.text).value;
}

async function safely($, work) {
  try { return await work(); }
  catch {
    try {
      const sessionId = await $.session.id();
      if (!warned.has(sessionId)) {
        warned.add(sessionId);
        await $.ui.log("Sovara could not complete an integration event. This session may have missing lessons or observations; check the Sovara connection.");
      }
    } catch { /* Host shutdown can also make the warning surface unavailable. */ }
    return undefined;
  }
}

async function lessons($, agentId, prompt) {
  if (!(await connect($))) return undefined;
  const messages = await $.session.messages({ as: "api", ...(agentId ? { agentId } : {}) });
  return request($, { type: "lessons", agentId, prompt, messages, agents: await $.agent.list() });
}

function withContext(result, delivery) {
  return delivery?.text ? { ...result, additionalContext: [...(result.additionalContext ?? []), delivery.text] } : result;
}

export function register(on) {
  on("classic.UserPromptSubmit", async ($, e, next) => {
    const result = await next(e);
    return withContext(result, await safely($, () => lessons($, undefined, e.prompt)));
  });
  on("classic.PostToolBatch", async ($, e, next) => {
    const result = await next(e);
    return withContext(result, await safely($, () => lessons($, e.agent_id)));
  });
  on("classic.SubagentStart", async ($, e, next) => {
    const result = await next(e);
    // The host exposes the initial task at turn.start before it installs that
    // task in session.messages. Retrieval must see it for the very first call.
    return withContext(result, await safely($, () => lessons($, e.agent_id, turns.get(e.agent_id)?.text)));
  });
  on("session.send", async ($, e, next) => {
    const delivery = await safely($, async () => {
      if (!(await connect($))) return undefined;
      const agents = await $.agent.list();
      const matches = agents.filter((agent) => agent.id === e.to || agent.name === e.to);
      if (matches.length !== 1) return undefined;
      return lessons($, matches[0].id, e.text);
    });
    return next(delivery?.text ? { ...e, text: e.text + "\n\n" + delivery.text } : e);
  });
  on("session.append", async ($, e, next) => {
    const scope = await safely($, async () => JSON.stringify([await $.session.id(), e.agentId ?? null]));
    let rewritten = e;
    // The committed boundary precedes the summary row. Rewrite that row before
    // it is installed, so automatic compaction does not leave the next call bare.
    if (e.door === "compaction" && e.message.role === "user" && compactions.has(scope)) {
      const delivery = await safely($, async () => request($, {
        type: "lessons", agentId: e.agentId, agents: await $.agent.list(),
        messages: [{ role: "user", content: e.message.content }],
      }));
      if (delivery !== undefined) compactions.delete(scope);
      if (delivery?.text) rewritten = { ...e, message: { ...e.message,
        content: [...e.message.content, { type: "text", text: delivery.text }] } };
    }
    const result = await next(rewritten);
    if (e.door === "compaction" && result.message?.name === "compact_boundary") {
      const reset = await safely($, async () => request($, { type: "compacted", agentId: e.agentId, boundary: result.uuid, agents: await $.agent.list() }));
      if (reset && scope) compactions.add(scope);
    }
    return result;
  });
  on("turn.start", async ($, e, next) => {
    turns.set(e.agentId ?? null, { turnId: e.turnId, text: e.text });
    await safely($, async () => request($, { type: "turn-start", ...e, agents: await $.agent.list() }));
    return next(e);
  });
  on("turn.step", async function* ($, e, next) {
    const started = await safely($, async () => {
      if (!(await connect($))) return undefined;
      return request($, { type: "model-start", ...e, agents: await $.agent.list(),
        messages: await $.session.messages({ as: "api", ...(e.agentId ? { agentId: e.agentId } : {}) }) });
    });
    let completed = false;
    try {
      const result = yield* next(e);
      completed = true;
      if (started) await safely($, () => request($, { type: "model-end", key: started.key, result }));
      return result;
    } catch (error) {
      completed = true;
      if (started) await safely($, () => request($, { type: "model-end", key: started.key, cancelled: next.signal.aborted, error: String(error) }));
      throw error;
    } finally {
      if (started && !completed) await safely($, () => request($, { type: "model-end", key: started.key, cancelled: true }));
    }
  });
  on("tool.call", async ($, e, next) => {
    const started = await safely($, async () => {
      if (!(await connect($))) return undefined;
      const turnId = turns.get(e.agentId ?? null)?.turnId;
      if (!turnId) return undefined;
      const tools = await $.tool.list();
      const { tool, tool_use_id, agentId, ...input } = e;
      return request($, { type: "tool-start", turnId, agentId, callId: tool_use_id, name: tool, input,
        mcp: tools.some((candidate) => candidate.name === tool && candidate.mcp === true), agents: await $.agent.list() });
    });
    try {
      const result = await next(e);
      if (started) await safely($, () => request($, { type: "tool-end", key: started.key, result }));
      return result;
    } catch (error) {
      if (started) await safely($, () => request($, { type: "tool-end", key: started.key, cancelled: next.signal.aborted, error: String(error) }));
      throw error;
    }
  });
  on("turn.complete", async ($, e, next) => {
    const result = await next(e);
    await safely($, () => request($, { type: "turn-end", ...e }));
    if (turns.get(e.agentId ?? null)?.turnId === e.turnId) turns.delete(e.agentId ?? null);
    return result;
  });
  on("session.end", async ($, e, next) => {
    const result = await next(e);
    await safely($, () => request($, null, true));
    bridges.delete(e.sessionId);
    return result;
  });
}
