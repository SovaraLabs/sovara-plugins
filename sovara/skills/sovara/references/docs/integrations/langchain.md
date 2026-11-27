---
title: "LangChain and LangGraph"
description: "Bring your team's domain knowledge to LangChain and LangGraph agents with Sovara."
---

Sovara helps teams manage domain knowledge and put it to work in AI agents.
Capture business rules, expert guidance, and lessons from experience in a shared
knowledge base. Deliver relevant knowledge to agents as they work, review how
they use it, and improve it together.

<CodeGroup>
```bash Python
pip install "sovara-langchain[agent]"   # without [agent] if you only use wrap_chat_model
```

```bash TypeScript
npm install @sovara/langchain @sovara/sdk
```
</CodeGroup>

Inside a trace, use the middleware for `create_agent`, or wrap the chat model for anything else
(LangGraph nodes, prebuilt agents, structured output). Use one per model. Put the middleware
last, so it records the model and prompt that other middleware settled on, and each retry by
other middleware as its own step.

```python
import sovara_langchain
from sovara_langchain import SovaraMiddleware, wrap_chat_model

agent = create_agent(model, tools, middleware=[*other_middleware, SovaraMiddleware()])

sovara_langchain.instrument_tools()  # tool calls of agents that don't use the middleware
model = wrap_chat_model(ChatOpenAI(model="gpt-5.4")).bind_tools(tools)
```

```ts
import { sovaraMiddleware } from "@sovara/langchain";
import { wrapChatModel } from "@sovara/langchain/chat-model";
import { instrumentTools } from "@sovara/langchain/tools";

const agent = createAgent({ model, tools, middleware: [...otherMiddleware, sovaraMiddleware()] });
instrumentTools(); // tool calls outside the agent middleware
const wrapped = wrapChatModel(new ChatOpenAI({ model: "gpt-5.4" })).bindTools(tools);
```

Lessons are one temporary user message at the end of the request; the agent's messages are
never changed. Outside a trace, calls pass through unrecorded, and if Sovara is unavailable they
still run.

Requires `langchain-core` 1.x (`langchain` 1.1+ for the middleware) in Python, or
`@langchain/core` 1.2+ (`langchain` 1.5+ for the middleware) in TypeScript.
