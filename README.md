# Sovara plugins

Bring your company’s tacit knowledge to AI agents. Retrieve relevant lessons, inspect recorded agent runs, and propose improvements for review.

- **[Sovara](sovara)** connects to your organization through OAuth.

The plugin includes the Sovara skill, remote MCP connection, and optional automatic Claude Code lesson delivery and tracing. See the [setup guide](sovara/README.md).

```sh
claude plugin marketplace add SovaraLabs/sovara-plugins
claude plugin install sovara@sovara-labs
```

[Contributing and local validation](CONTRIBUTING.md).

[Documentation](https://docs.sovara-labs.com/mcp/overview) · [Privacy](https://sovara-labs.com/legal/privacy-policy) · [Support](mailto:hello@sovara-labs.com)

## License

Plugin source is MIT licensed. The bundled Sovara SDK is Apache-2.0; its license and third-party notices are included in `sovara/runtime/`. Sovara products retain their own licensing terms. No trademark rights are granted.
