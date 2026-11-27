---
title: "Integrations"
description: "Record LangChain, LangGraph, OpenAI Agents, Claude Code and Pi in Sovara with their integration packages."
---

Integrations record what only the framework knows about, such as agent steps, tool calls and
sessions, and add relevant lessons to model requests. Install the one for your framework next to
the [SDK](/sdks); `auto_instrument()` / `autoInstrument()` still records model calls over HTTP
and MCP calls.

<CardGroup cols={2}>
  <Card title="LangChain and LangGraph" icon="/assets/icons/integrations/langchain.svg" href="/integrations/langchain">
    Middleware for `create_agent`, or a chat-model wrapper for LangGraph and direct model use.
  </Card>
  <Card title="OpenAI Agents SDK" icon="/assets/icons/integrations/openai.svg" href="/integrations/openai-agents">
    Function tools and agent tools of your agents.
  </Card>
  <Card title="Claude Code" icon="/assets/icons/integrations/claude.svg" href="/integrations/claude-code">
    Each session as a trace, with lessons added to every prompt.
  </Card>
  <Card title="Pi" icon="pi" href="/integrations/pi">
    Each session as a trace, with lessons added to Pi's context.
  </Card>
</CardGroup>

| Framework | Python | TypeScript |
| --- | --- | --- |
| LangChain / LangGraph | `sovara-langchain` | `@sovara/langchain` |
| OpenAI Agents SDK | `sovara-openai-agents` | `@sovara/openai-agents` |
| Claude Code | `sovara-claude-code` | `@sovara/claude-code` |
| Pi | none | `@sovara/pi` |

<Note>
Model calls that an integration records itself (the LangChain middleware and chat-model wrapper,
Claude Code and Pi) are stored as conversations, not HTTP requests, so **Rerun** is not
available for them. Model calls captured over HTTP by `auto_instrument()` can be rerun.
</Note>

## Building an integration

Integrations use only the public SDK: the step API (`start_step`, `record_step`,
`retrieve_lessons`, ...), the cross-process functions, and `sovara.integration` /
`@sovara/sdk/integration`. Those helpers never let a Sovara outage break the host, retry only
briefly, and convert arbitrary values to JSON safely. See the
[Python](/sdks/python/api-reference#integrations) and
[TypeScript](/sdks/typescript/api-reference#integrations) API references.
