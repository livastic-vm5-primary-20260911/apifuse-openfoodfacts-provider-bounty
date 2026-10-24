import { defineProvider } from "@apifuse/provider-sdk";
import { z } from "zod";

// API v2 for barcode reads, public Search-a-licious for free text.
// The legacy and /api/v2/search upstream URLs returned HTTP 503 in October 2026.
const PRODUCT_API = "https://world.openfoodfacts.org";
const SEARCH_API = "https://search.openfoodfacts.org";
const AGENT =
  "VM5-OpenFoodFacts-Provider/1.0 (+https://github.com/livastic-vm5-primary-20260911)";
const FIELDS =
  "code,product_name,brands,categories_tags,nutriments,nutriscore_grade,nova_group";

const Barcode = z.string().regex(/^\d{8,14}$/, "An 8-14 digit barcode is required");
export const BarcodeInput = z.object({ barcode: Barcode });
export const SearchInput = z.object({
  query: z.string().trim().min(2).max(120),
  page: z.number().int().min(1).max(100).default(1),
  limit: z.number().int().min(1).max(10).default(5),
});

export const ProductSchema = z.object({
  code: z.string(),
  product_name: z.string().nullable(),
  brands: z.array(z.string()),
  categories: z.array(z.string()),
  nutriments: z.record(z.string(), z.number()),
  nutriscore_grade: z.string().nullable(),
  nova_group: z.number().int().nullable(),
  source_url: z.string().url(),
});
export const ProductResponse = z.object({
  found: z.boolean(),
  product: ProductSchema.nullable(),
});
export const SearchResponse = z.object({
  query: z.string(),
  page: z.number().int(),
  returned_count: z.number().int().nonnegative(),
  reported_total: z.number().int().nonnegative().nullable(),
  count_exact: z.boolean().nullable(),
  products: z.array(ProductSchema),
});
export const SummaryResponse = z.object({
  found: z.boolean(),
  code: z.string(),
  product_name: z.string().nullable(),
  brands: z.array(z.string()),
  nutriscore_grade: z.string().nullable(),
  nova_group: z.number().int().nullable(),
  energy_kcal_100g: z.number().nullable(),
  proteins_100g: z.number().nullable(),
  source_url: z.string().url(),
});

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeProduct(candidate: unknown, backupCode?: string):
  z.infer<typeof ProductSchema> | null {
  const p = objectOrNull(candidate);
  if (!p) return null;
  const code = stringOrNull(p.code) ?? backupCode;
  if (!code) return null;
  const brands = Array.isArray(p.brands)
    ? p.brands.filter((v): v is string => typeof v === "string")
      .map((v) => v.trim()).filter(Boolean)
    : (stringOrNull(p.brands) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const categories = Array.isArray(p.categories_tags)
    ? p.categories_tags.filter((v): v is string => typeof v === "string")
    : [];
  const nutriments: Record<string, number> = {};
  for (const [key, value] of Object.entries(objectOrNull(p.nutriments) ?? {})) {
    if (typeof value === "number" && Number.isFinite(value)) nutriments[key] = value;
  }
  const nova = numberOrNull(p.nova_group);
  return ProductSchema.parse({
    code,
    product_name: stringOrNull(p.product_name) ?? stringOrNull(p.product_name_en),
    brands, categories, nutriments,
    nutriscore_grade: stringOrNull(p.nutriscore_grade),
    nova_group: nova !== null && Number.isInteger(nova) ? nova : null,
    source_url: PRODUCT_API + "/product/" + encodeURIComponent(code),
  });
}
async function getPublicJson(url: string): Promise<Record<string, unknown>> {
  const parsed = new URL(url);
  if (!["world.openfoodfacts.org", "search.openfoodfacts.org"].includes(parsed.hostname)
      || parsed.protocol !== "https:") {
    throw new Error("Refusing a non-Open Food Facts upstream URL");
  }
  const res = await fetch(url, {
    method: "GET",
    headers: { "User-Agent": AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error("Open Food Facts upstream responded HTTP " + res.status);
  const data: unknown = await res.json();
  const obj = objectOrNull(data);
  if (!obj) throw new Error("Open Food Facts returned non-object JSON");
  return obj;
}
export async function getProductByBarcode(barcode: string) {
  const input = Barcode.parse(barcode);
  const url = PRODUCT_API + "/api/v2/product/" + encodeURIComponent(input)
      + ".json?fields=" + encodeURIComponent(FIELDS);
  const data = await getPublicJson(url);
  const found = data.status === 1 || data.status === "1";
  if (!found) return ProductResponse.parse({ found: false, product: null });
  const product = normalizeProduct(data.product, String(data.code ?? input));
  if (!product) throw new Error("Open Food Facts indicated a product without data");
  return ProductResponse.parse({ found: true, product });
}
export async function searchFoodProducts(input: z.infer<typeof SearchInput>) {
  const parsed = SearchInput.parse(input);
  const url = SEARCH_API + "/search?q=" + encodeURIComponent(parsed.query)
      + "&page=" + parsed.page + "&page_size=" + parsed.limit;
  const data = await getPublicJson(url);
  if (!Array.isArray(data.hits)) throw new Error("Open Food Facts search omitted hits[]");
  const products = data.hits.slice(0, parsed.limit)
    .map((v) => normalizeProduct(v))
    .filter((v): v is NonNullable<typeof v> => v !== null);
  const count = numberOrNull(data.count);
  return SearchResponse.parse({
    query: parsed.query,
    page: parsed.page,
    returned_count: products.length,
    reported_total: count !== null && Number.isInteger(count) && count >= 0 ? count : null,
    count_exact: typeof data.is_count_exact === "boolean" ? data.is_count_exact : null,
    products,
  });
}
export async function getProductSummary(barcode: string) {
  const input = Barcode.parse(barcode);
  const r = await getProductByBarcode(input);
  const p = r.product;
  if (!p) return SummaryResponse.parse({
    found: false, code: input, product_name: null, brands: [],
    nutriscore_grade: null, nova_group: null, energy_kcal_100g: null,
    proteins_100g: null, source_url: PRODUCT_API + "/product/" + input,
  });
  return SummaryResponse.parse({
    found: true,
    code: p.code, product_name: p.product_name, brands: p.brands,
    nutriscore_grade: p.nutriscore_grade, nova_group: p.nova_group,
    energy_kcal_100g: p.nutriments["energy-kcal_100g"] ?? null,
    proteins_100g: p.nutriments.proteins_100g ?? null,
    source_url: p.source_url,
  });
}
const provider = defineProvider({
  id: "open-food-facts", version: "1.0.0", runtime: "standard",
  auth: { mode: "none" },
  meta: {
    displayName: "Open Food Facts",
    description: "Public food barcodes, text search and normalized nutrition data",
    category: "data",
    tags: ["open-food-facts", "barcode", "food", "public-api"],
  },
  operations: {
    "get-product-by-barcode": {
      description: "Read an exact barcode using Open Food Facts API v2",
      input: BarcodeInput,
      output: ProductResponse,
      healthCheckUnsupported: true,
      handler: async (_ctx, input) => getProductByBarcode(BarcodeInput.parse(input).barcode),
      fixtures: {
        request: {barcode: "737628064502"},
        response: {found:false,product:null},
      },
    },
    "search-food-products": {
      description: "Text search via public Search-a-licious",
      input: SearchInput,
      output: SearchResponse,
      healthCheckUnsupported: true,
      handler: async (_ctx, input) => searchFoodProducts(SearchInput.parse(input)),
      fixtures: {
        request: {query:"peanut butter",page:1,limit:2},
        response: {query:"peanut butter",page:1,returned_count:0,
          reported_total:null,count_exact:null,products:[]},
      },
    },
    "get-product-summary": {
      description: "Get selected nutrients, Nutri-Score and NOVA for a barcode",
      input: BarcodeInput,
      output: SummaryResponse,
      healthCheckUnsupported: true,
      handler: async (_ctx, input) => getProductSummary(BarcodeInput.parse(input).barcode),
      fixtures: {
        request: {barcode:"737628064502"},
        response: {found:false, code:"737628064502",product_name:null,
          brands:[],nutriscore_grade:null,nova_group:null,
          energy_kcal_100g:null,proteins_100g:null,
          source_url:PRODUCT_API + "/product/737628064502"},
      },
    },
  },
});
export default provider;
