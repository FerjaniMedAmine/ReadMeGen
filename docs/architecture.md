# Architecture and tradeoffs

ReadMeGen is a local developer tool. CLI and HTTP are adapters over `service.generate`, which owns model construction, source preparation, filtering, generation timeout, and temporary-file cleanup. Imports raise application errors; FastAPI translates them at the boundary.

## Boundaries

- `config` stores validated preferences; importing it creates no directories.
- `auth` owns secrets and OAuth. Browser responses contain public connection metadata, never tokens. The OS store is optional; session credentials remain in memory.
- `sources` reads local input without copying or executing it. ZIP and Git inputs are isolated in temporary workspaces.
- `generation` owns prompts and scoped tools. Models are injected rather than constructed inside agents.
- `web` owns persistent job status and the loopback server, using the same generation service as the CLI.

SQLite preserves job metadata and completed results across restart. Interrupted jobs become failed jobs and are not rerun or charged automatically. One generation is accepted at a time rather than accumulating an unbounded queue. Preferences are snapshotted at submission; connection changes are blocked during generation.

## Resource and trust controls

ZIP entries are validated before extraction. Dependency/credential files are excluded, duplicates rejected, and bytes counted during extraction. Git runs without shell interpolation, hooks, redirects, credential helpers, or submodules. Download checks are periodic: transient disk use can exceed the threshold before termination. This is not a hardened multi-tenant importer.

Traversal prunes dependencies and does not follow symlinks. Readers check containment at access and bound file size and output chunks. Source and model reports remain untrusted; prompt wording and filename filtering cannot eliminate prompt injection or embedded secrets. Review the generated document before use.

Provider timeouts, retries, graph recursion, specialist/file limits, and an overall generation timeout bound work; there is no exact spending cap. Cancelled filesystem threads are joined before temporary-file cleanup. Git subprocesses are terminated and awaited.

## Local HTTP interface

The launcher binds to `127.0.0.1`, uses one worker, rejects untrusted Host headers and cross-site API requests, and disables proxy-header trust. Validation errors omit submitted values. Frontend and API share an origin. The content security policy restricts scripts/network access and framing. Access logs are disabled to avoid recording sensitive authorization material.

Hosted user isolation, team permissions, internet-facing authentication, durable job scheduling, and billing would require separate architecture.

## Provider compatibility

API-key providers use their LangChain integrations and require tool-capable models. A catalog is useful for selection, not proof of access or compatibility. Reasoning-model defaults are preserved where generic sampling settings are rejected.

The ChatGPT-plan adapter is separate because the preview Responses contract differs from API-key requests. It groups tools into a namespace, uses streaming with `store=false`, replays original reasoning/tool items, serializes refreshes with a cross-process lock, and rejects incomplete streams. Identity verification checks signature, issuer, audience, expiry, and nonce. Client/workspace registrations remain distinct; email is a display label.

Live account eligibility, access, rotation, and usage-limit behavior must be verified before a stable release claim. Automated tests use controlled provider responses.
