import { createServer } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdtemp, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Also used by programmatic wrappers, whose application retains SDK ownership. */
export async function startBridge(session) {
  const directory = await mkdtemp(join(tmpdir(), "svr-cc-"));
  await chmod(directory, 0o700);
  const socketPath = join(directory, "s");
  const token = randomBytes(32).toString("hex");
  const expected = Buffer.from(`Bearer ${token}`);
  const requests = new Map();
  let stopping;
  const server = createServer(async (request, response) => {
    const supplied = Buffer.from(request.headers.authorization ?? "");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      response.writeHead(401).end(); return;
    }
    if (request.method !== "POST" || (request.url !== "/event" && request.url !== "/close")) {
      response.writeHead(404).end(); return;
    }
    try {
      let length = 0;
      const chunks = [];
      for await (const chunk of request) {
        length += chunk.length;
        if (length > 8 * 1024 * 1024) { response.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      const data = JSON.parse(body.toString("utf8"));
      if (typeof data.id !== "string" || data.id.length > 80 || !data.id) {
        response.writeHead(400).end(); return;
      }
      const fingerprint = createHash("sha256").update(request.url).update(body).digest("hex");
      let entry = requests.get(data.id);
      if (entry && entry.fingerprint !== fingerprint) { response.writeHead(409).end(); return; }
      if (!entry) {
        // Never evict work still in flight: a retry could otherwise dispatch it twice.
        if (requests.size >= 128) {
          const oldest = [...requests].find(([, value]) => value.settled);
          if (!oldest) { response.writeHead(429).end(); return; }
          requests.delete(oldest[0]);
        }
        entry = { fingerprint, settled: false };
        entry.pending = (request.url === "/close" ? session.close().then(() => null) : session.dispatch(data.event))
          .then((value) => ({ status: 200, body: JSON.stringify({ value }) }),
            () => ({ status: 503, body: JSON.stringify({ error: "Sovara could not record this host event." }) }))
          .finally(() => { entry.settled = true; });
        requests.set(data.id, entry);
      }
      const result = await entry.pending;
      response.writeHead(result.status, { "content-type": "application/json" }).end(result.body);
      if (request.url === "/close") void close();
    } catch {
      response.writeHead(400).end();
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  await chmod(socketPath, 0o600);
  function close() {
    stopping ??= (async () => {
      try { await session.close(); }
      finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
        await rm(directory, { recursive: true, force: true });
      }
    })();
    return stopping;
  }
  return { socketPath, token, close };
}
