---
title: "Pi"
description: "Bring your team's domain knowledge into Pi and review agent sessions together with Sovara."
---

Sovara helps teams manage domain knowledge and put it to work in AI agents.
Capture business rules, expert guidance, and lessons from experience in a shared
knowledge base. Deliver relevant knowledge to agents as they work, review how
they use it, and improve it together.

Requires Node.js 24.22.1 or newer.

1. [Install the Sovara CLI](/get-started/installation) and sign in with
   `sovara login`.
2. Install the extension, then start Pi from your project folder:

   ```sh
   pi install npm:@sovara/pi
   pi
   ```

3. Send a message in Pi. In Sovara, open the project matching your folder name.

Sessions are recorded automatically, and relevant lessons are added to Pi's context as you work.
Run `/sovara` in Pi to check the connection, project and recording status, and `/reload` after
installing or changing the connection.

Pi records to the server you signed in to. To use another one, set `SOVARA_SERVER_URL`, or
`execUrl` in `~/.pi/agent/sovara.json`. The project defaults to the folder where you start Pi; to
choose another name, add `.pi/sovara.json`:

```json
{ "projectName": "my-project" }
```

Subagents that Pi starts are recorded as child traces of the turn that started them. Parent and
subagent must use the same `@sovara/pi` version.

To uninstall, run `pi remove npm:@sovara/pi`.
