# Sovara local MCP

Use Sovara projects, runs, lessons, proposals, and automations from a local
Cowork session or Claude Code.

1. Install Sovara Desktop and the Sovara CLI with `sovara mcp` support.
2. Open Sovara Desktop, sign in, and select the local connection.
3. Install this plugin and enable it for your local Cowork session. Cowork starts
   `sovara mcp` automatically while using the plugin.
4. Ask your assistant to do a task using your team's knowledge, such as writing
   a query for your internal database.

The assistant has the same project permissions as your desktop account and CLI.
Search covers your readable local projects. Changes made by the assistant are
saved in Sovara, including project creation and lesson proposals.

The `sovara` executable must be available to Claude. If it cannot be found, set
`command` in `.mcp.json` to its full installed path (`sovara.exe` on Windows).
Keep `args` as `["mcp"]`. Keep Sovara Desktop running while using the connection.

For a hosted organization, use the remote Sovara plugin.
See the [MCP documentation](https://docs.sovara-labs.com/mcp/overview).

## Privacy

This local connection uses your existing desktop account and permissions. Data is handled by the Sovara deployment selected in your desktop app and its configured model providers. [Privacy policy](https://sovara-labs.com/legal/privacy-policy).

## License

This plugin package is MIT licensed. It contains connection configuration,
documentation, and branding assets, not the Sovara servers or CLI. Those products
retain their own licensing terms. No trademark rights are granted.
