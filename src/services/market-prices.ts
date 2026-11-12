export type PriceReport = {
  pricePerQuintal: number;
  createdAt: string;
};

export type OfficialMarketPrice = {
  pricePerQuintal: number;
  date: string;
};

export type AggregatedPrice = {
  pricePerQuintal: number;
  reportCount: number;
  lastUpdated: string;
};

export type MarketPrice = AggregatedPrice & {
  source: "community reports" | "official data";
  officialDate?: string;
};

export type D1Result<T> = { results?: T[] };

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export type PriceRuntime = {
  db: D1Database;
  dataGovInApiKey?: string;
  agmarknetResourceId?: string;
  priceAdminSecret?: string;
};

export type JsonBodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isD1Database(value: unknown): value is D1Database {
  return isRecord(value) && typeof value["prepare"] === "function";
}

export function getPriceRuntime(context: unknown): PriceRuntime | null {
  if (!isRecord(context)) return null;
  const bindings = isRecord(context["env"]) ? context["env"] : context;
  const db = bindings["DB"];
  if (!isD1Database(db)) return null;

  return {
    db,
    ...(typeof bindings["DATA_GOV_IN_API_KEY"] === "string"
      ? { dataGovInApiKey: bindings["DATA_GOV_IN_API_KEY"] }
      : {}),
    ...(typeof bindings["AGMARKNET_RESOURCE_ID"] === "string"
      ? { agmarknetResourceId: bindings["AGMARKNET_RESOURCE_ID"] }
      : {}),
    ...(typeof bindings["PRICE_ADMIN_SECRET"] === "string"
      ? { priceAdminSecret: bindings["PRICE_ADMIN_SECRET"] }
      : {}),
  };
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError("Cannot calculate the median of an empty list.");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  if (sorted.length % 2 === 1) return upper!;
  return (lower! + upper!) / 2;
}

export function aggregateReports(
  reports: readonly PriceReport[],
  minimumCount = 3,
): AggregatedPrice | null {
  if (reports.length < minimumCount) return null;

  const center = median(reports.map((report) => report.pricePerQuintal));
  const deviations = reports.map((report) => Math.abs(report.pricePerQuintal - center));
  const mad = median(deviations);
  const retained = reports.filter(
    (report) => Math.abs(report.pricePerQuintal - center) <= 2.5 * mad,
  );
  if (retained.length < minimumCount) return null;

  return {
    pricePerQuintal: median(retained.map((report) => report.pricePerQuintal)),
    reportCount: retained.length,
    lastUpdated: retained.reduce(
      (latest, report) => (report.createdAt > latest ? report.createdAt : latest),
      retained[0]!.createdAt,
    ),
  };
}

export function buildMarketPrice(
  reports: readonly PriceReport[],
  official: OfficialMarketPrice | null,
): MarketPrice | null {
  const community = aggregateReports(reports);
  if (community) return { ...community, source: "community reports" };
  if (!official) return null;

  return {
    pricePerQuintal: official.pricePerQuintal,
    reportCount: 0,
    lastUpdated: official.date,
    officialDate: official.date,
    source: "official data",
  };
}

export function aggregateHistory(
  reports: readonly PriceReport[],
): Array<{ date: string; pricePerQuintal: number; reportCount: number }> {
  const byDay = new Map<string, PriceReport[]>();
  for (const report of reports) {
    const date = report.createdAt.slice(0, 10);
    const dayReports = byDay.get(date) ?? [];
    dayReports.push(report);
    byDay.set(date, dayReports);
  }

  return [...byDay.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .flatMap(([date, dayReports]) => {
      const aggregate = aggregateReports(dayReports, 1);
      return aggregate
        ? [
            {
              date,
              pricePerQuintal: aggregate.pricePerQuintal,
              reportCount: aggregate.reportCount,
            },
          ]
        : [];
    });
}

export function getBearerToken(authorization: string | null): string | null {
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/i);
  return match?.[1] ?? null;
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createReporterToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function matchesSecret(candidate: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const candidateBytes = encoder.encode(candidate);
  const expectedBytes = encoder.encode(expected);
  let difference = candidateBytes.length ^ expectedBytes.length;
  const length = Math.max(candidateBytes.length, expectedBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (candidateBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }
  return difference === 0;
}

export async function readJsonBody(request: Request, maximumBytes = 4096): Promise<JsonBodyResult> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maximumBytes) return { ok: false, status: 413 };
  if (!request.body) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    return { ok: false, status: 400 };
  }
}

function readRecordField(record: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function officialDate(value: string): string | null {
  const indianDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (indianDate) return `${indianDate[3]}-${indianDate[2]}-${indianDate[1]}`;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString().slice(0, 10);
}

export async function fetchOfficialPrices(
  runtime: PriceRuntime,
  cropName: string,
  district: string,
): Promise<Map<string, OfficialMarketPrice>> {
  if (!runtime.dataGovInApiKey) {
    throw new Error("The official price API key is not configured.");
  }

  const resourceId = runtime.agmarknetResourceId ?? "9ef84268-d588-465a-a308-a864a43d0070";
  const url = new URL(`https://api.data.gov.in/resource/${encodeURIComponent(resourceId)}`);
  url.searchParams.set("api-key", runtime.dataGovInApiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("filters[commodity]", cropName);
  url.searchParams.set("filters[district]", district);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error("The official price service rejected the request.");

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload["records"])) {
    throw new Error("The official price service returned invalid data.");
  }

  const prices = new Map<string, OfficialMarketPrice>();
  for (const item of payload["records"]) {
    if (!isRecord(item)) continue;
    const market = readRecordField(item, "market", "Market");
    const price = Number(readRecordField(item, "modal_price", "Modal_Price"));
    const dateValue = readRecordField(item, "arrival_date", "Arrival_Date");
    const date = dateValue ? officialDate(dateValue) : null;
    if (!market || !Number.isFinite(price) || price <= 0 || !date) continue;

    const key = market.toLocaleLowerCase("en-IN");
    const existing = prices.get(key);
    if (!existing || date > existing.date) prices.set(key, { pricePerQuintal: price, date });
  }
  return prices;
}
