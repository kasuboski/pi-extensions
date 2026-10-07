# Real Collector validation evidence

These are synthetic fixture outputs, not private session content. They were captured from an actual official OpenTelemetry Collector container using the file and debug exporters. Collector log timestamps reflect the validation host clock.

## Reproduction and versions

Run from the repository root:

```sh
docker info
mise exec node@24.20.0 -- node --version    # v24.20.0
KEEP_COLLECTOR_EVIDENCE=1 bash extensions/telemetry/test/collector.integration.sh
mise exec node@24.20.0 -- npm test --prefix extensions/telemetry
mise exec node@24.20.0 -- npm run typecheck --prefix extensions/telemetry
bash -n extensions/telemetry/test/collector.integration.sh
```

- Pi SDK dependency: `@earendil-works/pi-coding-agent` 1.0.2.
- The checked-in collector artifacts were captured by an earlier Bun 1.3.11 run. The current reproduction commands use Node 24.20.0.
- Collector: `otelcol-contrib version 0.123.0`.
- Official image: `otel/opentelemetry-collector-contrib:0.123.0`.
- Pinned digest: `sha256:e39311df1f3d941923c00da79ac7ba6269124a870ee87e3c3ad24d60f8aee4d2`.
- Captured run: auth-free `http://127.0.0.1:32859/v1/traces`, container-local receiver `0.0.0.0:4318`. Ports change on each run.

## Result

The collector harness passed three times after correcting fixture tool activation (two retained runs and one default-cleanup run). In that earlier Bun run, the suite passed **40 tests, 0 failures, 171 assertions**; typecheck and shell syntax check passed. Re-run the updated Node commands to validate this migrated checkout.

Raw evidence:

- [`traces.jsonl`](traces.jsonl): Collector **file exporter output**, not the extension's outbound HTTP body.
- [`debug.log`](debug.log): Collector startup/version and detailed **debug exporter output**, including `"spans": 3`.
- [`report.json`](report.json): SDK/file-output assertions and structural IDs.

All three spans share trace `4140f71130ed69026391c548b7b06568` and session `01a112dd-2fdb-7298-8b6a-06f9da6143ff`:

| Span | Span ID | Parent ID |
| --- | --- | --- |
| `pi.interaction` | `842347520cd0b804` | absent/root |
| `pi.tool` (`outer`) | `63a3f9d3176e120d` | `842347520cd0b804` |
| `pi.tool` (`inner`) | `dea9bcf3c90c2d0f` | `63a3f9d3176e120d` |

The two enabled model requests carried `00-4140f71130ed69026391c548b7b06568-842347520cd0b804-01` and both session baggage identities. Each span carried the exact session attribute. The interaction outcome was `completed`, status `Ok`; successful tools had status `Unset`. Resource attributes were exactly `service.name=pi-real-collector-test`, scope `pi-telemetry`/`1.0.0`. No events or links, raw errors, content canaries, model identifier, credentials, or workspace path appeared in exported spans. Debug logs contain Collector startup metadata (including NumCPU); that is not a Pi-exported resource field.

A second SDK session configured with `protocol: "grpc"` completed its two model requests and nested tools, emitted the expected value-free unsupported-protocol warning, carried no traceparent/baggage, and added **zero spans**. Total model requests: 4; final Collector spans: 3.

## Initial failure and limits

The first harness run reached the real Collector and exported two spans but timed out waiting for three. Its fixture had supplied an empty built-in tool list without explicitly activating both custom tools; the outer tool failed without calling the inner tool. The harness was corrected to explicitly activate `outer` and `inner`. No extension implementation change was needed. Two subsequent retained runs passed, including debug-count assertions. A third, default-cleanup run also passed after adding explicit assertions that both tools execute exactly once in each enabled/unsupported-protocol session; its ephemeral endpoint was `http://127.0.0.1:32860/v1/traces`. Typecheck passed again.

Docker daemon access and official image download succeeded; no infrastructure blocker. The discovery search tool was unavailable (`MORPH_API_KEY` unset), so targeted local reads were used. No external model request, deployment, Pig or STATUS access, system configuration changes, or telemetry implementation edits were performed. Containers/model listeners and temporary SDK directories were removed. Captured files were copied here and temporary retained directories removed; the downloaded image remains in Docker's cache.

This evidence is local HTTP/JSON compatibility with one Collector version and a deterministic Chat Completions fixture, not a production backend, authenticated collector, real LLM, or exhaustive lifecycle/error/load test.
