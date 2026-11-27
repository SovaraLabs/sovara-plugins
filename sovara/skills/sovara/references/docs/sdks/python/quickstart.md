---
title: "Python SDK quickstart"
description: "Set up the Sovara Python SDK and record a project-bound agent trace."
---

<script src="/assets/sdk-nav.js"></script>

Sovara records supported LLM, MCP, and explicitly traced tool calls inside an
SDK trace. Every Python integration starts with one project-bound
`SovaraClient`.

## Install

Use Python 3.10+, [install the CLI](/cli/install), then sign in with
`sovara login`. For a headless host, see the
[API reference](/sdks/python/api-reference).

Install the example's dependencies:

```bash
uv add sovara sovara-openai-agents
```

Set `OPENAI_API_KEY` in the environment before running the example. The model
calls use your provider account and incur its normal API charges.

## A complete example

Two child agents compare sample temperatures. Sovara records their model and
tool calls; `trace` adds the comparison step. The weather values are demo data.

```python
import sovara_openai_agents  # [!code ++]
from sovara import SovaraClient, auto_instrument, trace  # [!code ++]
from agents import Agent, Runner, function_tool

# Record model calls and agent tools; call before creating provider clients.  # [!code ++]
auto_instrument()  # [!code ++]
sovara_openai_agents.instrument()  # [!code ++]
sovara_client = SovaraClient(project_name="weather-agent")  # [!code ++]


@function_tool
def get_zurich_temperature() -> int:
    """Return the demo temperature in Zurich in Celsius."""
    return 22


@function_tool
def get_boston_temperature() -> int:
    """Return the demo temperature in Boston in Celsius."""
    return 27


zurich_agent = Agent(
    name="Zurich weather agent",
    instructions="Call the weather tool and return only the temperature.",
    model="gpt-5.4-mini",
    tools=[get_zurich_temperature],
    output_type=int,
)

boston_agent = Agent(
    name="Boston weather agent",
    instructions="Call the weather tool and return only the temperature.",
    model="gpt-5.4-mini",
    tools=[get_boston_temperature],
    output_type=int,
)


@trace(name="choose warmer city")  # [!code ++]
def choose_warmer_city(zurich: int, boston: int) -> str:
    if zurich == boston:
        return f"Boston and Zurich are equally warm at {zurich} C."
    city = "Zurich" if zurich > boston else "Boston"
    return f"{city} is warmer ({boston} C in Boston, {zurich} C in Zurich)."


def main() -> None:
    question = "Which city is warmer, Boston or Zurich?"
    with sovara_client.trace("compare city weather") as trace_id:  # [!code ++]
        # Attach the user-visible request to the top-level trace.  # [!code ++]
        if trace_id is not None:  # [!code ++]
            sovara_client.log(trace_id=trace_id, trace_input=question)  # [!code ++]

        # Each subtrace groups one delegated agent's work into an expandable child trace.  # [!code ++]
        with sovara_client.subtrace("Zurich weather agent"):  # [!code ++]
            zurich = Runner.run_sync(zurich_agent, question).final_output

        with sovara_client.subtrace("Boston weather agent"):  # [!code ++]
            boston = Runner.run_sync(boston_agent, question).final_output

        answer = choose_warmer_city(zurich, boston)
        # Attach the final user-visible result to the top-level trace.  # [!code ++]
        if trace_id is not None:  # [!code ++]
            sovara_client.log(trace_id=trace_id, trace_output=answer)  # [!code ++]

    print(answer)


if __name__ == "__main__":
    main()
```

<Note>
Use `trace` for custom operations; supported framework tools and MCP calls are
recorded automatically. Use optional subtraces to group child agents.
</Note>

## Verify one trace

Save the example as `weather_agent.py`, then run it normally:

```bash
uv run python weather_agent.py
```

Open the `weather-agent` project and select
<strong><Icon icon="play" size={14} /> Traces</strong> to inspect the recording.
Open the trace to see both subtraces, their model and tool calls, and the comparison
step. Logged input and output also appear in the Traces table.

## Next steps

- [Use the SDK](/sdks/python/use-the-sdk) for subtraces, durable traces and trace IDs, lessons, and metadata.
- [API reference](/sdks/python/api-reference) for the exact public surface.
- [Troubleshooting](/sdks/python/troubleshooting) for missing traces or steps.
