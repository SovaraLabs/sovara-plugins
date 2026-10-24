# Contributing

Automatic Claude Code integration is implemented with public mod events and a local Node helper. The helper uses the public Sovara SDK; it does not proxy Claude's provider traffic. Claude owns execution and conversation persistence.

## Build and test

Use Node.js 24.22.1 or later. Clone this repository and `https://github.com/SovaraLabs/typescript-sdk` into adjacent directories, then run:

```sh
npm ci
git -C ../typescript-sdk checkout "$(cat SDK_REVISION)"
npm --prefix ../typescript-sdk ci
SOVARA_SDK_SOURCE=../typescript-sdk npm run build
npm test
claude plugin validate ./sovara
claude plugin validate .
```

`SDK_REVISION` pins the exact public SDK source. The build verifies that revision and a clean SDK source tree, rebuilds the SDK, bundles the helper, and writes its provenance and dependency licenses. Commit the generated `sovara/runtime/` files with source changes so users can install without a package build.

Load the local plugin with `claude --plugin-dir ./sovara`. Set `SOVARA_PROJECT_NAME` and your normal Sovara connection variables to test automatic behavior. Do not commit credentials, local session state, or private trace payloads.

## Verification

Tests cover delivery confirmation, compaction generations, independent child state, resume, lifecycle cleanup, private state ownership, bridge authentication and event deduplication. Changes to host behavior also require live Claude runs: first-call and post-tool lessons, parallel/nested children, child resume in a new process, compaction, MCP success/error, and interruption followed by another prompt. Verify persisted Sovara records as well as model answers. Test API and subscription authentication separately.

For an opt-in paid failure-isolation check, run `npm run test:live` with your normal Claude authentication. It runs one real read/answer while the local test bridge rejects every recording attempt, and checks that execution is preserved and errors do not disclose their contents. Set `SOVARA_TEST_CLAUDE_MODEL` to select another supported model. This check does not assert successful persistence.

Host observations are partial captures. Do not label the visible conversation as the native provider request or infer a child's parent from its name. Selection alone must never suppress a lesson: confirm its full delivered block in that conversation. After a committed compaction, start a new generation even if the summary mentions an earlier lesson.

Submit changes through pull requests. Public CI has no provider credentials and runs no paid model calls. Package publication and marketplace releases are separate maintainer actions.
