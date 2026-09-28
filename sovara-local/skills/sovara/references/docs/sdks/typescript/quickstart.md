---
title: "TypeScript SDK quickstart"
description: "Set up the Sovara TypeScript SDK and record an agent run."
---

<script src="/assets/sdk-nav.js"></script>

Sovara records supported LLM, MCP, and framework tool calls inside an SDK run.
Use `trace` for important custom operations that are not already captured.

## Install

Follow [Installation](/get-started/installation) to use an existing Sovara
environment or choose a local, remote, or headless setup. Then add the packages
used by this example:

```bash
npm install @sovara/runner @openai/agents zod
npm install --save-dev tsx
```

Set `OPENAI_API_KEY` in the environment before running the example.

## A complete example

This example uses two child agents to compare the weather in Zurich and
Boston. Their model and framework tool calls are recorded automatically;
`trace` records the custom comparison step.

```ts
import { Agent, run, tool } from "@openai/agents";
import { SovaraClient, trace } from "@sovara/runner"; // [!code ++]
import { z } from "zod";

const sovara_client = new SovaraClient({ projectName: "weather-agent" }); // [!code ++]
const temperature = z.object({ celsius: z.number() });

const getZurichTemperature = tool({
  name: "get_zurich_temperature",
  description: "Get the current temperature in Zurich in Celsius.",
  parameters: z.object({}),
  execute: async () => 22,
});

const getBostonTemperature = tool({
  name: "get_boston_temperature",
  description: "Get the current temperature in Boston in Celsius.",
  parameters: z.object({}),
  execute: async () => 27,
});

const zurichAgent = new Agent({
  name: "Zurich weather agent",
  instructions: "Call the weather tool and return the temperature.",
  model: "gpt-5.4-mini",
  tools: [getZurichTemperature],
  outputType: temperature,
});

const bostonAgent = new Agent({
  name: "Boston weather agent",
  instructions: "Call the weather tool and return the temperature.",
  model: "gpt-5.4-mini",
  tools: [getBostonTemperature],
  outputType: temperature,
});

const chooseWarmerCity = trace( // [!code ++]
  async function chooseWarmerCity(zurich: number, boston: number): Promise<string> {
    if (zurich === boston) return `Boston and Zurich are equally warm at ${zurich} C.`;
    const city = zurich > boston ? "Zurich" : "Boston";
    return `${city} is warmer (${boston} C in Boston, ${zurich} C in Zurich).`;
  }, // [!code ++]
  { name: "choose warmer city" }, // [!code ++]
); // [!code ++]

async function main(): Promise<void> {
  const question = "Which city is warmer, Boston or Zurich?";
  await sovara_client.run("compare city weather", async () => { // [!code ++]
    // Attach the user-visible request to the top-level run. // [!code ++]
    await sovara_client.logInput(question); // [!code ++]

    // Each subrun groups one delegated agent's work into an expandable child run. // [!code ++]
    const zurich = await sovara_client.subrun("Zurich weather agent", async () => { // [!code ++]
      const result = await run(zurichAgent, question);
      return result.finalOutput!.celsius;
    }); // [!code ++]

    const boston = await sovara_client.subrun("Boston weather agent", async () => { // [!code ++]
      const result = await run(bostonAgent, question);
      return result.finalOutput!.celsius;
    }); // [!code ++]

    const answer = await chooseWarmerCity(zurich, boston);
    // Attach the final user-visible result to the top-level run. // [!code ++]
    await sovara_client.logOutput(answer); // [!code ++]
    console.log(answer);
  }); // [!code ++]
}

void main();
```

<Note>
  Sovara records OpenAI Agents tools created with `tool()` and MCP calls
  automatically. Do not wrap those tools in `trace` as well; reserve it for
  important operations that are not already captured.
</Note>

<Note>
  Subruns are optional, but provide a useful abstraction for grouping child
  agents or delegated phases into expandable units.
</Note>

## Verify one run

Save the example as `weather_agent.ts`, then run it normally:

```bash
npx tsx weather_agent.ts
```

Open the `weather-agent` project in Sovara to inspect the run. A run typically
corresponds to one chat session or one workflow execution.

`logInput()` and `logOutput()` populate the Input and Output columns in the
Runs table, so you can scan results without opening each run:

<img
  className="docs-screenshot"
  src="/assets/screenshots/python-sdk-quickstart-runs.png"
  alt="Sovara Runs table showing the logged weather comparison input and output"
/>

Open the run to see both weather-agent subruns, their LLM and tool calls, and
the final `Choose Warmer City` step:

<img
  className="docs-screenshot"
  src="/assets/screenshots/python-sdk-quickstart-trace.png"
  alt="Sovara trace showing Zurich and Boston weather-agent subruns and the final city comparison"
/>

## Next steps

- [Use the SDK](/sdks/typescript/use-the-sdk) for subruns, durable runs and run keys, lessons, and metadata.
- [API reference](/sdks/typescript/api-reference) for the exact public surface.
- [Troubleshooting](/sdks/typescript/troubleshooting) for missing runs or steps.

## Explicit conversation turns

`run()` opens a recording session without an implicit turn. `turn(options, fn)`
declares a scoped interaction and returns the callback result. Work outside turn
callbacks is still captured, with no turn membership.

```ts
await sovara_client.run("conversation", async () => {
  await setup();
  await sovara_client.turn({ turnInput: "Hi." }, async () => respond());
  await sovara_client.turn({ turnInput: "Another question." }, async () => respond());
  await cleanup();
}, { runKey: "chat-123" });
```

These SDKs require `runner-api` 2. Upgrade app-server and exec-server together.
See [Using the SDK](/sdks/typescript/use-the-sdk#explicit-conversation-turns)
for separate recordings with the same run key, empty turns, subruns, and concurrent work.
