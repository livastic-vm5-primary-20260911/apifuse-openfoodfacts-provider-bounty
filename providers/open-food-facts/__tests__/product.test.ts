import { describe, expect, it } from "bun:test";
import productFixture from "./fixtures/product-737628064502-response.json";
import searchFixture from "./fixtures/search-peanut-butter-response.json";
import provider, {
  BarcodeInput,
  SearchInput,
  getProductByBarcode,
  getProductSummary,
  normalizeProduct,
  searchFoodProducts,
} from "../index";

function jsonReply(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { "Content-Type": "application/json" },
  });
}

const originalFetch = globalThis.fetch;
function setMockFetch(handler: (url: RequestInfo | URL) => Promise<Response>) {
  globalThis.fetch = Object.assign(handler, { preconnect: originalFetch.preconnect });
}

describe("real public upstream fixture normalization", () => {
  it("preserves UPC leading zero, nutrition and brands", () => {
    const parsed = normalizeProduct(productFixture.product, String(productFixture.code));
    expect(parsed?.code).toBe("0737628064502");
    expect(parsed?.brands.length).toBeGreaterThan(0);
    expect(Object.keys(parsed?.nutriments ?? {}).length).toBeGreaterThan(0);
    expect(parsed?.categories.length).toBeGreaterThan(0);
  });

  it("supports two independent real Search-a-licious product hits", () => {
    expect(searchFixture.hits.length).toBe(2);
    for (const hit of searchFixture.hits) {
      const product = normalizeProduct(hit);
      expect(product?.code).toMatch(/^\d+$/);
      expect(product?.product_name).toBeTruthy();
    }
  });

  it("rejects malformed barcode, short search and oversized result limit", () => {
    expect(BarcodeInput.safeParse({ barcode: "1/../../etc/passwd" }).success).toBe(false);
    expect(SearchInput.safeParse({ query: "x" }).success).toBe(false);
    expect(SearchInput.safeParse({ query: "food", limit: 100 }).success).toBe(false);
  });
});

describe("three operations with isolated mocked HTTP", () => {
  it("reads a product using canonical API v2 without credentials", async () => {
    setMockFetch(async (url) => {
      expect(String(url)).toContain("/api/v2/product/");
      return jsonReply(productFixture);
    });
    try {
      const p = await getProductByBarcode("737628064502");
      expect(p.found).toBe(true);
      expect(p.product?.code).toBe("0737628064502");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("maps explicit no-product response to found false", async () => {
    setMockFetch(async () => jsonReply({ status: 0, code: "12345678" }));
    try {
      const p = await getProductByBarcode("12345678");
      expect(p).toEqual({ found: false, product: null });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("searches Search-a-licious and bounds output", async () => {
    setMockFetch(async (url) => {
      expect(String(url)).toContain("search.openfoodfacts.org");
      return jsonReply(searchFixture);
    });
    try {
      const r = await searchFoodProducts({query: "peanut butter", page: 1, limit: 2});
      expect(r.returned_count).toBe(2);
      expect(r.products).toHaveLength(2);
      expect(r.query).toBe("peanut butter");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("gets a summary from a single upstream product request", async () => {
    let calls = 0;
    setMockFetch(async () => {
      calls++;
      return jsonReply(productFixture);
    });
    try {
      const summary = await getProductSummary("737628064502");
      expect(summary.found).toBe(true);
      expect(summary.brands.length).toBeGreaterThan(0);
      expect(calls).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fails closed on upstream HTTP 503 rather than inventing product data", async () => {
    setMockFetch(async () => jsonReply({error: "unavailable"},503));
    try {
      await expect(getProductByBarcode("737628064502")).rejects.toThrow("HTTP 503");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("declares exactly one health-check mode on each of three operations", () => {
    expect(Object.keys(provider.operations)).toHaveLength(3);
    for (const op of Object.values(provider.operations)) {
      expect(Number("healthCheck" in op) + Number("healthCheckUnsupported" in op)).toBe(1);
    }
  });
});
