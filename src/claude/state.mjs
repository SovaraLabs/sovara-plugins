import { createHash } from "node:crypto";
import { mkdir, open, lstat } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** One helper owns a host session. Persist identities, never credentials or messages. */
export async function openState(directory, binding) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)) {
    throw new Error("Sovara Claude state directory must be private (mode 0700).");
  }
  const key = createHash("sha256").update(binding).digest("hex");
  const path = join(directory, `${key}.sqlite`);
  const file = await open(path, "a", 0o600);
  await file.close();
  const fileStat = await lstat(path);
  if (!fileStat.isFile() || fileStat.isSymbolicLink() || (fileStat.mode & 0o077)) {
    throw new Error("Sovara Claude state file must be private (mode 0600).");
  }
  // SQLite retains the OS lock across commits and releases it on process death.
  // This avoids stale PID locks and unsafe check-then-delete recovery races.
  const database = new DatabaseSync(path);
  let data;
  try {
    database.exec("PRAGMA locking_mode=EXCLUSIVE; BEGIN EXCLUSIVE; CREATE TABLE IF NOT EXISTS session_state (id INTEGER PRIMARY KEY CHECK (id=1), data TEXT NOT NULL); COMMIT;");
    const row = database.prepare("SELECT data FROM session_state WHERE id=1").get();
    data = row ? JSON.parse(row.data) : { version: 1, binding, agents: {} };
    if (data.version !== 1 || data.binding !== binding || !data.agents || typeof data.agents !== "object") {
      throw new Error("Invalid Sovara Claude session state.");
    }
  } catch (error) {
    database.close();
    if (error.message.includes("database is locked")) throw new Error("This Claude session already has a Sovara helper.");
    throw error;
  }
  let closed = false;
  return {
    data,
    async save() {
      if (closed) throw new Error("Claude session state is closed.");
      database.prepare("INSERT INTO session_state(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").run(JSON.stringify(data));
    },
    async close() {
      if (closed) return;
      closed = true;
      database.close();
    },
  };
}
