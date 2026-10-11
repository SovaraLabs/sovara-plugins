---
title: "Organization models"
description: "Configure models and credentials shared by every project."
---

`sovara org models` uses your active connection; no project or repository is
required. The five tiers are `primary`, `helper`, `ultra_helper`, `embedding`,
and `reranker`. Commands return JSON identifying the deployment.

## Inspect

```bash
sovara org models get
sovara org models get helper
sovara org models catalog --tier embedding
sovara org models discover --local-provider ollama --base-url http://localhost:11434
```

`get` reports the organization, revision, permissions, credential presence, and
saved readiness—not live health. Secrets are never returned. `catalog` lists
models, provider requirements, and presets.

Discovery runs from the **Sovara server**: `localhost` on a remote deployment
means the remote server. Use manual model names when discovery is unsupported.

## Configure

```bash
sovara org models set --file /secure/path/model-settings.json
sovara org models set --file -  # Read JSON from stdin
```

This example configures two tiers and their shared key atomically:

```json
{
  "tiers": {
    "primary": {"connection_type": "third_party_api", "model_name": "openai/gpt-5.6-sol"},
    "helper": {"connection_type": "third_party_api", "model_name": "openai/gpt-5.6-terra"}
  },
  "provider_api_keys": {"openai": "YOUR_KEY"}
}
```

Supply complete configurations for selected tiers; omitted tiers stay unchanged.
Each needs `connection_type` and `model_name`. Model prefixes identify third-party
vendors; local models also need `local_provider` and `base_url`. Check `catalog`
for provider-specific fields; Vertex credentials are a JSON string.

Omitted/null tier secrets retain saved credentials only for the same provider;
other fields are replaced. Saves and key rotations verify affected models and can
incur provider charges. If verification fails, nothing is saved.

- Set or rotate shared keys with `provider_api_keys`; `{"provider_api_keys":{"openai":null}}` deletes one.
- `{"delete_credentials":["primary"]}` removes that tier's AWS/Vertex credentials. Do not also configure the tier in the same update.
- Deleting credentials marks dependent tiers unverified. Shared keys also serve [recorded-step reruns](/cli/replay-keys).

Keep credential files outside version control.

## Verify and reindex

```bash
sovara org models verify helper
sovara org models verify --all
```

Verification can incur provider charges; `--all` includes incomplete tiers.
Failures return per-tier results and a nonzero exit status without revoking saved
readiness. Success enables unverified tiers; unchanged retests do not advance the
revision or reload runtimes.

Embedding model/endpoint changes require `--confirm-embedding-reindex` (or
`confirm_embedding_reindex: true` in JSON). Indexing runs in the background;
retrieval uses no vector search until it finishes. `get` reports queued, running,
or failed work in `embedding_reindex`; a null status does not prove every project
is indexed.

## Permissions and concurrent edits

Hosted management requires an organization admin. Local users manage their own
models; other self-hosted deployments require project-admin access. `get` returns
`can_manage` and `manage_requirement`.

Use `--expected-org-id` and `--expected-revision` to guard scripted writes
(or `expected_org_id` / `expected_revision` in JSON). Without a revision, the CLI
fetches the current organization and revision. Supply both guards when editing an
earlier snapshot. A stale write returns `revision_conflict`; read and reconcile
before retrying. After a connection failure, check whether the write committed
before retrying. `unsupported_feature` means the server needs an upgrade.
