# Validation

The initial implementation was exercised with Claude Code 2.1.310 and Node 24.22.1/26.4.0 using actual API-key and Claude subscription executions. Unit tests and public CI do not require provider credentials.

| Behavior | Live check |
| --- | --- |
| Lesson delivery | First prompt, post-tool loop, two parallel children before their first model call |
| Conversation state | No duplicate confirmed lesson on resume; independent fork/child exclusions; actual manual, automatic main and automatic child compaction |
| Hierarchy | Same-name parallel children, three nested descendants, background child after parent turn ends, same child resumed in another process |
| Recording | Model usage, ordinary tools, MCP success and returned errors with original output, native interrupt followed by a successful new prompt |
| Installation | Isolated marketplace install without a source checkout, update, resume, fork and uninstall |
| Failure | Failed recording preserves the native tool/answer; original host errors propagate; killed helper releases local state ownership and next prompt resumes the same trace |

Successful runs were checked against persisted Sovara steps and completed recordings. After the final SDK dependency update, native MCP success/error output and parallel child/process-resume cases were rerun against the combined server; all five recordings in the child case completed and the original delegation edges were preserved. The bundled helper also rebuilt byte-for-byte from a separate public SDK checkout. Cache-read counters were observed, but no matched cache-efficiency or production-domain accuracy benchmark is claimed. Some tests control lesson selection to isolate delivery; others use actual retrieval with a frozen synthetic lesson. These are distinct evidence.

A forced kill can leave the earlier recording unfinished even though the next prompt recovers. Private provider requests, internal retries and compaction calls are unavailable through these host events. The guide describes these limits; successful resume is not proof of complete crash cleanup.

Run `npm test` for source checks and `npm run test:live` for the opt-in paid failure-isolation case. Follow [CONTRIBUTING.md](CONTRIBUTING.md) for builds and the broader live acceptance checklist. Independent review, CI, exact SDK/server dependencies, publication and installed-version verification are separate gates.
