# Open Food Facts — public-data provider for APIFuse

Independent, read-only TypeScript integration with three named APIs in the
APIFuse Open Food Facts public-data bounty.

**Status (2026-10-25):** Code implemented and tested locally; bounty has not
been claimed or approved. No compensation received. This repository is not
an official Open Food Facts or APIFuse project.

## Three implemented APIs

| ID | Input | Output | Health check declaration |
| --- | --- | --- | --- |
| get-product-by-barcode | barcode (8–14 digits) | found, code, name, brands, categories, nutriments, Nutri-Score, NOVA | healthCheckUnsupported: true |
| search-food-products | query, page 1–100, limit 1–10 | products, reported total and exactness | healthCheckUnsupported: true |
| get-product-summary | barcode | compact barcode, brand, Nutri-Score, NOVA and energy/protein fields | healthCheckUnsupported: true |

All operations use Zod input/output and no authentication, tokens or secrets.
This public SDK release does not define an executable operation healthCheck
field, so unsupported health checks are explicitly marked once per operation.

## Installation and verification

The official CLI scaffold command used was:

    bun node_modules/@apifuse/provider-sdk/bin/apifuse.ts init open-food-facts

Installed pinned SDK version 2.0.0-beta.1. The published SDK CLI requires
the developer dependency @clack/prompts which was not installed by the
published runtime dependency tree, so it was explicitly installed in the
independent development root.

From the root directory:

    npm install --include=dev --ignore-scripts
    ./node_modules/.bin/bun run check
    ./node_modules/.bin/bun run test

From providers/open-food-facts (after root install), alternatively:

    ../../node_modules/.bin/bun run check
    ../../node_modules/.bin/bun run test

The root TypeScript config maps the SDK type-check import to the official
package's smaller public define.ts source to avoid seven *pre-existing*
incompatible internal TLS interface casts in the published SDK's unrelated
runtime/tls.ts. The runtime still imports the actual unmodified SDK.
The SDK's generated dev.ts is excluded from consumer typecheck because it
imports an SDK export not present on that narrow check-only source path.
No vendor source, payment logic or official SDK package is patched.

Fixture JSON files in providers/open-food-facts/__tests__/fixtures were
captured from genuine public API calls on 2026-10-25. These files preserve
actual response fields; the search fixture limits the corpus to the two
first observed hits without changing their contents. The unit tests also
cover bounded results, malformed inputs, 503 failure handling, and
single-request product summaries.

## Exact public upstream endpoints

- Barcode: GET https://world.openfoodfacts.org/api/v2/product/:barcode.json
- Search: GET https://search.openfoodfacts.org/search?q=...
- Attribution: Open Food Facts contributors and the Open Food Facts database.

The legacy CGI search endpoint and the structured /api/v2/search endpoint
returned HTTP 503 during the original development observations. The
dedicated public Search-a-licious endpoint served HTTP 200 and live data.
All calls use a descriptive User-Agent, fixed allowlisted hosts,
URL-encoded arguments, a 12-second request timeout and no wallet signing.

Review applicable Open Food Facts terms, rate limits, attribution and
ODbL/share-alike obligations before commercial redistribution.

## Bounty submission

Original offer: https://bounty.apifuse.com/en/bounties/open-food-facts
Advertised ₩50,000, subject to claim approval, maintainer review and
acceptance. The documented GitHub OAuth flow repeatedly redirected to
platform.apifuse.com/docs instead of authenticating the bounty dashboard;
no authorized claim could be completed. This code alone is not evidence of
acceptance or of actual revenue.
