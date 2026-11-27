# Sovara cloud plugin

Connect agents to Sovara knowledge, run inspection, evaluations and lesson
proposals through the hosted MCP endpoint. Authenticate with the existing
Sovara account; project permissions and proposal revisions remain enforced.

The shared endpoint `https://platform.sovara-labs.com/mcp` routes to the server
registered for your organization after sign-in.

Use `list_projects` to discover accessible projects. Retrieve relevant lessons,
inspect recorded traces, and save changes as proposals. Applying a proposal changes
production and needs the user's authorization. Supported hosts display MCP Apps;
other hosts receive text and structured results.

Resource links use the origin and canonical IDs returned by Sovara. Do not guess
IDs or put tokens in URLs. Machine setup, credentials, recording local processes
and lifecycle operations remain in the CLI.

[Setup and configuration](https://docs.sovara-labs.com/mcp/configuration) ·
[Tools](https://docs.sovara-labs.com/mcp/tools)

## License

This plugin's configuration, docs and branding package is MIT licensed. Sovara's
servers and CLI retain their own terms; no trademark rights are granted.
