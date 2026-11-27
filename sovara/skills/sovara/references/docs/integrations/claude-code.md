---
title: "Claude Code"
description: "Bring your team's domain knowledge into Claude Code and review agent sessions together with Sovara."
---

Sovara helps teams manage domain knowledge and put it to work in AI agents.
Capture business rules, expert guidance, and lessons from experience in a shared
knowledge base. Deliver relevant knowledge to agents as they work, review how
they use it, and improve it together.

The Sovara plugin for Claude Code does two things:

- **Records sessions** in Sovara: your prompts, every tool call (inputs, outputs and errors) and
  Claude's final reply, so your team can review them together.
- **Adds your team's knowledge to prompts.** When a prompt matches a lesson, Claude receives that
  lesson as extra context before it answers.

## Prerequisites

- Claude Code
- Python 3.10+ (`uv` or `pip`) or Node.js 24.22.1+
- A Sovara account, and your organization's Sovara URL if you use a dedicated deployment
- To use lessons, an organization admin must configure models under **Settings → Tooling models**,
  at least the **Fast Model** used by the default **Accuracy** retrieval setting. Retrieval
  warnings call it *Fast Helper Model*. Without it, sessions are still recorded but lessons are
  not added to prompts.

## Set up

<Steps>
  <Step title="Install the hook program">
    Install the `sovara-claude-code` command with one runtime:

    ```sh
    uv tool install sovara-claude-code     # Python (uv)
    pip install sovara-claude-code         # Python (pip)
    npm install -g @sovara/claude-code     # Node.js 24.22.1+
    ```
  </Step>
  <Step title="Sign in to Sovara">
    [Install the Sovara CLI](/get-started/installation), then sign in and check the connection:

    ```sh
    sovara login        # or: sovara login --url <your Sovara URL>
    sovara status       # shows the connected server
    sovara projects     # lists your projects
    ```

    The plugin uses this sign-in, so you don't need an API key on your workstation. In headless
    environments, set `SOVARA_SERVER_URL` and `SOVARA_API_KEY` instead. A project API key records
    only to its existing project; to have projects created on first use, use an organization
    API key.
  </Step>
  <Step title="Install the plugin">
    Choose whether to record one repository or every Claude Code session on your machine.

    <Tabs>
      <Tab title="One repository">
        Run from the root of the repository:

        ```sh
        claude plugin marketplace add SovaraLabs/sovara-claude-code
        claude plugin install sovara-recording@sovara-claude-code --scope project
        ```

        This writes `.claude/settings.json`; commit it to share the setup with your team. Each
        teammate still installs the hook program, signs in, and runs
        `claude plugin marketplace add SovaraLabs/sovara-claude-code` once, because the
        marketplace is registered per user, not in the repository.
      </Tab>
      <Tab title="All repositories">
        Run inside Claude Code:

        ```text
        /plugin marketplace add SovaraLabs/sovara-claude-code
        /plugin install sovara-recording@sovara-claude-code
        ```

        <Note>
          At this scope, every Claude Code session on your machine is recorded, including
          prompts, tool inputs and outputs such as file contents and command output, and replies.
        </Note>
      </Tab>
    </Tabs>

    Restart Claude Code so the hooks take effect. To stop recording, run
    `/plugin uninstall sovara-recording@sovara-claude-code`, or remove the plugin entry from
    `.claude/settings.json` for a project-scoped install.
  </Step>
</Steps>

## Try it

Create a small repository:

```sh
mkdir loan-calc-demo && cd loan-calc-demo && git init
cat > loan.py <<'EOF'
def monthly_payment(principal, annual_rate, years):
    r, n = annual_rate / 12, years * 12
    return principal / n if r == 0 else principal * r / (1 - (1 + r) ** -n)

if __name__ == "__main__":
    print(round(monthly_payment(500_000, 0.02, 25), 2))
EOF
```

Create the project and add a lesson. The rule below is only an example. CLI edits are saved as a
proposal, so apply it with the `proposal_id` from the JSON output. In the web app, add lessons
under **Lessons**, save your changes and select **Apply to production**.

```sh
sovara projects create --name loan-calc-demo

sovara lessons create --project-id loan-calc-demo \
  --title "Swiss mortgage affordability rule" \
  --when-to-use "Questions about mortgage payments or loan affordability" \
  --content "Test affordability at an imputed 5% rate plus 1% maintenance; housing cost must stay at or below 1/3 of gross income. Quote amounts in CHF."

sovara lessons proposals apply <proposal-id> --project-id loan-calc-demo
```

Start Claude Code in `loan-calc-demo` and ask:

> I want a CHF 800,000 mortgage on a CHF 1M flat at 1.8% over 25 years. Use `loan.py` to work out
> the monthly payment and check affordability, then add a `unittest` test for it.

Claude applies the 5% and one-third rule from the lesson, although the prompt doesn't mention it.
Review the session under **Traces** in the `loan-calc-demo` project, or from the CLI:

```sh
sovara traces --project-id loan-calc-demo
# List the steps, then inspect one
sovara probe <trace-id> --project-id loan-calc-demo
sovara probe <trace-id> --project-id loan-calc-demo --step 1 --preview
```

## How it works

The plugin runs `sovara-claude-code` on Claude Code's session events:

| Claude Code event | What Sovara does |
| --- | --- |
| Session start | Opens a trace for the session in the project |
| Prompt submitted | Starts a turn and retrieves matching lessons, which Claude receives as extra context |
| Tool succeeded or failed | Records the tool call with its input and output, or its error |
| Claude finished replying | Records the prompt and Claude's final reply |
| Session end | Closes the trace |

- **Project:** the name of the folder you start Claude Code in. With `sovara login`, a missing
  project is created on first use if your account can create projects. Set
  `SOVARA_PROJECT=<name>` to record to a different project.
- **Resuming** a session (`claude --resume`) continues the same trace.
- **Overhead:** each prompt waits briefly while Sovara looks up matching lessons. Recording tool
  calls adds very little.
- **Availability:** if Sovara is unreachable, Claude Code works as normal and the session isn't
  recorded.

Each turn records the prompt, the tool calls and the final reply. Claude's intermediate
messages, the model name and token usage are not recorded, and the trace doesn't show which
lessons were added to a prompt; run `sovara lessons retrieve` to see which lessons a prompt
matches. Sessions are recorded as conversations rather than HTTP model calls, so **Rerun** is
not available on their steps.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No traces appear | Run `sovara status` and `sovara projects`. If the sign-in expired or points to the wrong server, run `sovara login` again. Restart Claude Code after installing the plugin, and make sure `sovara-claude-code` is on your `PATH` (`which sovara-claude-code` on macOS and Linux, `where sovara-claude-code` on Windows). |
| Lessons are never used | Run `sovara lessons retrieve --project-id <project> "<your prompt>"`. A *required retrieval models have not been verified* warning means an admin must configure **Settings → Tooling models**. Also check that **Automatic lesson injection** is on in the project's **Settings → Lessons**, and that the lesson's proposal was applied to production. If retrieval returns no lessons and no warning, broaden the lesson's **When to use** description. |
| Traces land in the wrong project | Set `SOVARA_PROJECT=<project-name>` before starting Claude Code. |
