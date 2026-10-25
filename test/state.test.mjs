import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, stat, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { openState } from "../src/claude/state.mjs";

test("durable identity survives restart and simultaneous owners are refused", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sovara-claude-state-"));
  try {
    const first = await openState(directory, "project/session-A");
    first.data.agents.main = { traceId: "sovara-main", lessons: { confirmed: ["banana"] } };
    await first.save();
    await assert.rejects(openState(directory, "project/session-A"), /already has/);
    const other = await openState(directory, "project/session-B");
    assert.deepEqual(other.data.agents, {});
    await other.close();
    await first.close();
    const resumed = await openState(directory, "project/session-A");
    assert.equal(resumed.data.agents.main.traceId, "sovara-main");
    assert.deepEqual(resumed.data.agents.main.lessons.confirmed, ["banana"]);
    await resumed.close();
    for (const name of await readdir(directory)) assert.equal((await stat(join(directory, name))).mode & 0o077, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("a killed helper releases ownership without losing committed identity", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sovara-claude-crash-"));
  const child = spawn(process.execPath, ["--input-type=module", "--eval", `
    import {openState} from ${JSON.stringify(new URL("../src/claude/state.mjs", import.meta.url).href)};
    const state=await openState(process.argv[1], 'crash-session');
    state.data.agents.child={traceId:'durable-child'};
    await state.save();
    process.stdout.write('ready\\n');
    setInterval(()=>{}, 1000);
  `, directory], { stdio: ["ignore", "pipe", "pipe"] });
  try {
    const [output] = await once(child.stdout, "data");
    assert.equal(output.toString(), "ready\n");
    await assert.rejects(openState(directory, "crash-session"), /already has/);
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
    const resumed = await openState(directory, "crash-session");
    assert.equal(resumed.data.agents.child.traceId, "durable-child");
    await resumed.close();
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await rm(directory, { recursive: true, force: true });
  }
});
