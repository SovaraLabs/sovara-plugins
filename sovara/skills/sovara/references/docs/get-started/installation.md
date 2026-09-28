---
title: "Installation"
description: "Install Sovara and prepare your local development environment."
---

Install the Sovara CLI first so you can check whether an existing Sovara
environment is already available. Then choose a local, remote, or headless
setup and install the SDK for your agent's language.

## Sovara CLI

Sovara's CLI gives you terminal access to run inspection, trace queries, logs,
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

## Connect to Sovara

The desktop app starts with its fixed **Local** app-server connection. To add a
remote app-server connection, open **Settings > App-server connection settings** and
enter the origin provided by your administrator. New remote deployments must set
`SOVARA_ORG_ID` to the Sovara organization ID provided for that deployment. Desktop shows the
organization name next to each connection as soon as the server can resolve it,
or its organization ID as a fallback. Choose any remembered app-server connection
from the selector on the **Projects** page; remote connections prompt you to sign in. CLI
app commands automatically follow the active app-server connection:

```bash
sovara status
```

- If `sovara status` succeeds, the CLI is using the desktop's active app-server
  connection and, when it is remote, its signed-in session.
- To change environments, choose another app-server connection from the selector
  on the **Projects** page. CLI app commands do not have separate app-server
  configuration.
- For a headless or CI agent host, configure the execution-server URL and agent
  token through the [Python API
  reference](/sdks/python/api-reference) or [TypeScript API
  reference](/sdks/typescript/api-reference). Headless agent configuration is
  for recording and runtime traffic; user-facing CLI app commands use the
  desktop app-server connection.

## Sovara desktop app

The desktop app gives you a local workspace for recording, inspecting, and
improving agent runs. Choose the installer for your operating system.

<div className="install-downloads">
  <div className="install-downloads-header">
    <span>Latest installers</span>
  </div>

  <div className="install-download-grid">
    <section className="install-download-card">
      <div className="install-os-mark">
        <img
          className="install-os-logo install-os-logo-light"
          src="/assets/icons/apple-logo-light.svg"
          alt=""
        />
        <img
          className="install-os-logo install-os-logo-dark"
          src="/assets/icons/apple-logo-dark.svg"
          alt=""
        />
      </div>
      <div className="install-card-title">macOS</div>
      <p>For Apple Silicon Macs.</p>
      <a
        className="install-download-link"
        href="https://apps.sovara-labs.com/api/update/download?platform=darwin&arch=arm64"
      >
        Apple Silicon (.dmg)
      </a>
    </section>

    <section className="install-download-card">
      <div className="install-os-mark">
        <img
          className="install-os-logo install-os-logo-light"
          src="/assets/icons/windows-logo-light.svg"
          alt=""
        />
        <img
          className="install-os-logo install-os-logo-dark"
          src="/assets/icons/windows-logo-dark.svg"
          alt=""
        />
      </div>
      <div className="install-card-title">Windows</div>
      <p>For Windows machines.</p>
      <a
        className="install-download-link"
        href="https://apps.sovara-labs.com/api/update/download?platform=win32&arch=x64"
      >
        Windows (.exe)
      </a>
    </section>

    <section className="install-download-card">
      <div className="install-os-mark">
        <img
          className="install-os-logo install-os-logo-light"
          src="/assets/icons/linux-logo-light.svg"
          alt=""
        />
        <img
          className="install-os-logo install-os-logo-dark"
          src="/assets/icons/linux-logo-dark.svg"
          alt=""
        />
      </div>
      <div className="install-card-title">Linux</div>
      <p>For Debian/Ubuntu and Fedora/Red Hat-based distributions.</p>
      <a
        className="install-download-link"
        href="https://apps.sovara-labs.com/api/update/download?platform=linux&arch=x64&format=deb"
      >
        Debian / Ubuntu Intel/AMD (.deb)
      </a>
      <a
        className="install-download-link"
        href="https://apps.sovara-labs.com/api/update/download?platform=linux&arch=arm64&format=deb"
      >
        Debian / Ubuntu arm64 (.deb)
      </a>
      <a
        className="install-download-link"
        href="https://apps.sovara-labs.com/api/update/download?platform=linux&arch=x64&format=rpm"
      >
        Fedora / Red Hat Intel/AMD (.rpm)
      </a>
      <a
        className="install-download-link"
        href="https://apps.sovara-labs.com/api/update/download?platform=linux&arch=arm64&format=rpm"
      >
        Fedora / Red Hat arm64 (.rpm)
      </a>
    </section>
  </div>
</div>

After the installer finishes, open Sovara, leave **Local** selected, and verify
the connection:

```bash
sovara status
```

Keep the desktop app running while using the local workspace. Switching the
desktop app-server connection changes the app server used by the UI and CLI app
commands; it does not change an SDK's execution-server URL or agent token.

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

Install `@sovara/runner` in the Node.js project where your agent runs.

<Tabs>
  <Tab title="npm">
    ```bash
    npm install @sovara/runner
    ```
  </Tab>

  <Tab title="pnpm">
    ```bash
    pnpm add @sovara/runner
    ```
  </Tab>

  <Tab title="yarn">
    ```bash
    yarn add @sovara/runner
    ```
  </Tab>
</Tabs>
