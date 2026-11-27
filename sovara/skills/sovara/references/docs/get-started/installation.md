---
title: "Installation"
description: "Install the Sovara CLI, sign in, and add the SDK to your agent."
---

Install the Sovara CLI, sign in to your Sovara server, and install the SDK for
your agent's language.

<Note>
View your recorded runs at [app.sovara-labs.com](https://app.sovara-labs.com).
Open your project and select **Traces** to inspect them. For an enterprise
deployment, open your organization's Sovara URL instead.
</Note>

## Sovara CLI

Sovara's CLI gives you terminal access to trace inspection, trace queries, logs,
and shared skill guidance. The Python SDK and TypeScript SDK do not install the
`sovara` command.

<Tabs>
  <Tab title="macOS, Linux, WSL">
    ```bash
    curl -fsSL https://apps.sovara-labs.com/cli/install.sh | sh
    ```
  </Tab>

  <Tab title="Windows PowerShell">
    ```powershell
    irm https://apps.sovara-labs.com/cli/install.ps1 | iex
    ```
  </Tab>

  <Tab title="Windows CMD">
    ```cmd
    curl -fsSL https://apps.sovara-labs.com/cli/install.cmd -o install.cmd && install.cmd && del install.cmd
    ```
  </Tab>
</Tabs>

Open a new terminal window if `sovara` is not found immediately, then verify the
installation:

```bash
sovara --version
```

Install the Sovara skill for Codex and Claude Code:

```bash
sovara install-skill --target both
```

## Sign in

Sign in to your Sovara server. The CLI opens your browser; after you sign in,
type the code shown in the browser into the terminal. Then verify the
connection:

```bash
sovara login
sovara status
```

<Note>
For an enterprise deployment, use `sovara login --url https://sovara.company.com`
with your organization's Sovara URL. Without `--url`, login uses
`https://app.sovara-labs.com`.
</Note>

For a headless agent host without a saved sign-in, set the SDK's
Sovara server URL and API key instead; see the
[Python](/sdks/python/api-reference) or
[TypeScript](/sdks/typescript/api-reference) API reference.

## Python SDK

Install `sovara` in the Python environment where your agent runs. Use the same
package manager that owns your project environment.

<Tabs>
  <Tab title="uv">
    ```bash
    uv add sovara
    ```
  </Tab>

  <Tab title="pip">
    ```bash
    python -m pip install sovara
    ```
  </Tab>

  <Tab title="poetry">
    ```bash
    poetry add sovara
    ```
  </Tab>
</Tabs>

## TypeScript SDK

Install `@sovara/sdk` in the Node.js project where your agent runs.

<Tabs>
  <Tab title="npm">
    ```bash
    npm install @sovara/sdk
    ```
  </Tab>

  <Tab title="pnpm">
    ```bash
    pnpm add @sovara/sdk
    ```
  </Tab>

  <Tab title="yarn">
    ```bash
    yarn add @sovara/sdk
    ```
  </Tab>
</Tabs>

## API keys

Create keys in **Settings → Project access → Project API Keys** or
**Settings → Sovara API Keys**. Keys cover their project or organization;
admins manage them, and members can view their metadata.

Choose recording permissions and an optional expiry. Organization keys allow
project creation and rename by default; deletion is opt-in. Create the project
before recording.

Save the secret when it is shown. Set `SOVARA_API_KEY` or pass `api_key` (Python) /
`apiKey` (TypeScript) to `SovaraClient`, along with the project name. To replace a
key, create a new one, update your clients, then revoke the old key.
