---
title: "Install"
description: "Install the Sovara CLI and verify that it can reach Sovara."
---

The Sovara CLI is a standalone binary named `sovara`. It is not installed by
the Python SDK or TypeScript SDK.

After installing, run `sovara login` and follow the
sign-in prompts. Run `sovara status` to check your connection.

<Note>
For an enterprise deployment, use `sovara login --url https://sovara.company.com`
with your organization's Sovara URL. Without `--url`, login uses
`https://app.sovara-labs.com`.
</Note>

## macOS, Linux, and WSL

```bash
curl -fsSL https://apps.sovara-labs.com/cli/install.sh | sh
```

Open a new terminal after installation, then sign in and verify:

```bash
sovara --version
sovara login
sovara status
```

## Windows PowerShell

```powershell
irm https://apps.sovara-labs.com/cli/install.ps1 | iex
```

Open a new terminal, run `sovara --version`, sign in with `sovara login`, and run `sovara status`.

## Windows CMD

```cmd
curl -fsSL https://apps.sovara-labs.com/cli/install.cmd -o install.cmd && install.cmd && del install.cmd
```

Open a new terminal, run `sovara --version`, sign in with `sovara login`, and run `sovara status`.

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

After installing the CLI and signing in to your Sovara server, let a coding
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
