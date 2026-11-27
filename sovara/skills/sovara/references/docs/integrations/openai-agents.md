---
title: "OpenAI Agents SDK"
description: "Connect OpenAI Agents to Sovara to review agent runs and apply your team's domain knowledge."
---

Sovara helps teams manage domain knowledge and put it to work in AI agents.
Capture business rules, expert guidance, and lessons from experience in a shared
knowledge base. Deliver relevant knowledge to agents as they work, review how
they use it, and improve it together.

<CodeGroup>
```bash Python
pip install sovara-openai-agents
```

```bash TypeScript
npm install @sovara/openai-agents @sovara/sdk
```
</CodeGroup>

Call once at startup, before creating agents, next to `auto_instrument()`. Function tools are
recorded as tool steps; in Python, agent tools open a child trace. Model calls are recorded by
`auto_instrument()`.

```python
import sovara_openai_agents
from sovara import auto_instrument

auto_instrument()
sovara_openai_agents.instrument()
```

```ts
import { autoInstrument } from "@sovara/sdk";
import { instrumentOpenAIAgents } from "@sovara/openai-agents";

await autoInstrument();
await instrumentOpenAIAgents();
```
