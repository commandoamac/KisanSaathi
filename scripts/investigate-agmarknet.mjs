const RESOURCE_ID = "35985678-0d79-46b4-9ed6-6f13308a1d24";
const BASE_URL = `https://api.data.gov.in/resource/${RESOURCE_ID}`;
const API_KEY = process.env.DATA_GOV_IN_API_KEY;
const LIMIT = 5;
const REQUEST_DELAY_MS = 1_000;

if (!API_KEY) {
  console.error("DATA_GOV_IN_API_KEY is not set in the process environment.");
  process.exit(1);
}

function formatApiDate(date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getUTCFullYear()}`;
}

function recordSummary(record) {
  return {
    Arrival_Date: record.Arrival_Date ?? null,
    Commodity: record.Commodity ?? null,
    District: record.District ?? null,
    Market: record.Market ?? null,
  };
}

function parseDate(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  return new Date(
    Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])),
  );
}

async function requestRecords(label, arrivalDate, filters = {}, offset = 0) {
  const url = new URL(BASE_URL);
  url.searchParams.set("api-key", API_KEY);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("offset", String(offset));
  const params = {
    "filters[State]": "West Bengal",
    "filters[Commodity]": "Potato",
    "filters[Arrival_Date]": arrivalDate,
    ...filters,
  };
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      console.log(`${label}: HTTP ${response.status}`);
      return null;
    }

    const payload = await response.json();
    if (!Array.isArray(payload.records)) {
      console.log(`${label}: API response has no records array`);
      return null;
    }
    console.log(
      `${label}: ${payload.records.length} record(s)`,
      JSON.stringify(payload.records.slice(0, 3).map(recordSummary)),
    );
    return payload.records;
  } catch {
    console.log(`${label}: request failed or timed out`);
    return null;
  }
}

async function main() {
  const indiaDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce((parts, part) => {
      if (part.type !== "literal") parts[part.type] = part.value;
      return parts;
    }, {});
  const indiaToday = new Date(
    Date.UTC(Number(indiaDate.year), Number(indiaDate.month) - 1, Number(indiaDate.day)),
  );
  const recentDates = Array.from({ length: 14 }, (_, daysAgo) => {
    const date = new Date(indiaToday);
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return formatApiDate(date);
  });

  console.log("Bounded Agmarknet probe: max five records/request; filters always include State, Commodity, and a recent Arrival_Date.");
  console.log("Probe location/crop: West Bengal / Potato; date search is limited to the last 14 days.");

  let matchedDate = null;
  let dateRecords = null;
  for (const date of recentDates) {
    const records = await requestRecords(`Exact date filter ${date}`, date);
    if (records?.length) {
      matchedDate = date;
      dateRecords = records;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  if (!matchedDate) {
    console.log("No matching records found for this crop/state in the last 14 days; recent ordering could not be observed.");
    return;
  }
  if (
    dateRecords.some((record) => {
      const parsed = parseDate(record.Arrival_Date);
      return !parsed || formatApiDate(parsed) !== matchedDate;
    })
  ) {
    console.log("Exact date filter check: returned rows do not all match the requested dd-MM-yyyy date.");
  } else {
    console.log("Exact date filter check: returned rows match the requested dd-MM-yyyy date.");
  }

  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  const stateProbe = await requestRecords("State filter variation", matchedDate, {
    "filters[State]": "Bihar",
  });
  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  const commodityProbe = await requestRecords("Commodity filter variation", matchedDate, {
    "filters[Commodity]": "Tomato",
  });
  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  const descendingRecords = await requestRecords(
    "Explicit descending date sort",
    matchedDate,
    { "sort[Arrival_Date]": "desc" },
  );
  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  const nextPage = await requestRecords("Pagination next page", matchedDate, {}, LIMIT);

  const orderedDates = (records) =>
    records
      .map((record) => parseDate(record.Arrival_Date))
      .filter(Boolean)
      .map((date) => date.getTime());
  const defaultOrder = orderedDates(dateRecords);
  const sortedOrder = orderedDates(descendingRecords ?? []);
  console.log(
    "Default ordering within the matching date:",
    defaultOrder.length < 2
      ? "not enough rows to compare"
      : "all Arrival_Date values are identical, so date ordering is inconclusive",
  );
  console.log(
    "Descending sort ordering:",
    sortedOrder.length < 2
      ? "not enough rows to compare"
      : "all Arrival_Date values are identical, so date ordering is inconclusive",
  );

  const firstPageKeys = new Set(
    dateRecords.map((record) =>
      [record.Arrival_Date, record.Market, record.Commodity, record.Variety].join("|"),
    ),
  );
  const overlaps = (nextPage ?? []).filter((record) =>
    firstPageKeys.has(
      [record.Arrival_Date, record.Market, record.Commodity, record.Variety].join("|"),
    ),
  ).length;
  console.log(`Pagination overlap between offsets 0 and ${LIMIT}: ${overlaps} record(s).`);
  console.log(`State and Commodity filter variations completed: ${Array.isArray(stateProbe) && Array.isArray(commodityProbe) ? "yes" : "one or more failed"}.`);
  console.log("Note: because the date filter is exact, record order across different dates cannot be established from one response.");
}

main().catch(() => {
  console.error("Agmarknet investigation failed.");
  process.exitCode = 1;
});
