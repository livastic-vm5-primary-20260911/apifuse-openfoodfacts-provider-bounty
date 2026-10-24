# APIFuse Open Food Facts provider

The public @apifuse/provider-sdk 2.0.0-beta.1 scaffold has been
completed with three functional upstream-backed operations:

- get-product-by-barcode: exact public API v2, no credentials;
- search-food-products: public Search-a-licious free-text search;
- get-product-summary: compact nutrition and metadata by barcode.

Each operation has Zod schemas, a type-safe normalized response,
and healthCheckUnsupported:true because the current SDK has no
operation-level healthCheck interface to implement. API availability
and search-result sizes vary; fixture tests are offline and live smoke
tests were verified on 2026-10-25.

From this directory after root dependency installation:

    ../../node_modules/.bin/bun run check
    ../../node_modules/.bin/bun run test

No bounties have been awarded for this repository as of 2026-10-25.
