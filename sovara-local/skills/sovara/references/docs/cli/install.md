---
title: "Install"
description: "Install the Sovara CLI and verify that it can reach Sovara."
---

The Sovara CLI is a standalone binary named `sovara`. It is not installed by
the Python SDK or TypeScript runner.

Installing the CLI does not require the desktop app. `sovara status` checks the
active app-server connection: keep the desktop app running for **Local**, or add
and select a remote app-server connection in the desktop app. The CLI has no
separate app-server setting. SDK runs can also start the local execution server
when needed.

## macOS, Linux, and WSL

```bash
curl -fsSL https://apps.sovara-labs.com/cli/install.sh | sh
```

Open a new terminal after installation, then verify:

```bash
sovara --version
sovara status
```

## Windows PowerShell

```powershell
irm https://apps.sovara-labs.com/cli/install.ps1 | iex
```

Open a new terminal and run `sovara --version` and `sovara status`.

## Windows CMD

```cmd
curl -fsSL https://apps.sovara-labs.com/cli/install.cmd -o install.cmd && install.cmd && del install.cmd
```

Open a new terminal and run `sovara --version` and `sovara status`.

## Update the CLI

Check for a newer release without installing it:

```bash
sovara update --check
```

Install the latest release and refresh the assistant skill:

```bash
sovara update
```

## Set up an agent repository

After installing the CLI and connecting to a Sovara environment, let a coding
assistant add and verify the SDK integration:

```bash
cd agent-dir
sovara setup
```

Pass `--path /path/to/agent` to launch setup outside the current directory.
After setup, run `sovara onboard` from the agent repository for
benchmark-grounded, human-reviewed onboarding.

To install guidance without launching an assistant, use:

```bash
sovara install-skill --target both
```

See [Assistant skill](/cli/assistant-skill) for advanced installation options.
