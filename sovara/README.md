# Sovara for Claude Code

Bring your company's knowledge into Claude Code and inspect its model and tool calls in Sovara.

## Install

Use Claude Code 2.1.310 or later and Node.js 24.22.1 or later on macOS or Linux. Node must be available as `node` in the shell that starts Claude.

```sh
claude plugin marketplace add SovaraLabs/sovara-plugins
claude plugin install sovara@sovara-labs
```

Restart Claude Code after installation. The included Sovara skill and MCP connection let you ask for lessons, inspect traces, and propose knowledge changes. Sign in through `/mcp` with your Sovara account to use those tools.

## Enable automatic lessons and tracing

Choose an existing Sovara project you can access. With the Sovara desktop app running and signed in locally:

```sh
export SOVARA_PROJECT_NAME="my-project"
claude
```

For a remote deployment, also set its Sovara SDK server URL and the agent token issued for your project:

```sh
export SOVARA_URL="https://sovara.example.com"
export SOVARA_AGENT_TOKEN="<project-agent-token>"
```

Keep credentials in your environment or secret manager. MCP sign-in and automatic tracing use separate connections. Claude keeps using its existing API key or subscription.

Ask a question that needs your project's knowledge, then have Claude use a tool. Open the project in Sovara and find its **Claude Code** trace to inspect the calls and supplied lessons. A resumed Claude session continues the same trace; local sub-agents appear beneath their parents.

Lessons remain in Claude's conversation. Sovara excludes lessons already present there, makes them eligible again after compaction, and tracks each child separately. Resuming a child continues its existing Sovara trace.

Unset `SOVARA_PROJECT_NAME` to disable automatic lessons and tracing. The skill and MCP tools remain available.

## Limits

- Capture contains the conversation and results exposed by Claude. Private provider requests, internal retries, and compaction model calls are not captured. Exact request replay is unavailable.
- Automatic lessons cover prompts, completed tool batches, local child startup, supported child messages, and committed compaction. Internal model requests may not expose a delivery hook.
- Agents in another process or remote runtime need their own integration. A forced process kill or lost connection can leave incomplete observations or an unfinished recording.
- Windows is not supported by the local Unix-socket helper. Managed settings must permit the plugin's hooks.

## Privacy

Automatic integration sends visible conversation content, tool inputs and results, lesson-retrieval context, and usage to your configured Sovara deployment. That deployment's permissions and model-provider settings apply. The local helper reads the configured Sovara credentials and keeps a private session file containing trace IDs and lesson-delivery hashes, not credentials or conversation text.

MCP tools authenticate separately through OAuth and send their requested task context and arguments. [Privacy policy](https://sovara-labs.com/legal/privacy-policy) · [Support](mailto:hello@sovara-labs.com).
