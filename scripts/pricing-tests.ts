// Release check for the shared pricing test cases (D33, BRIEF-estimator-
// pricing-rules-stage0 §7.2). Runs in `prebuild`, so a failing case fails
// every Vercel build, preview included.
//
//   RATE_CARDS_URL          the rate-cards edge function (§8)
//   RATE_CARDS_SECRET       sent as X-GOAT-Secret
//   PRICING_TESTS_OFFLINE=1 with no secret set: skip, loudly (local dev only)
//
// Never skips silently: no secret and no offline flag is a failure.
import { runPricingCase, type PricingCaseResult } from "../src/lib/estimator/pricingCases";

const FETCH_TIMEOUT_MS = 20000;

function fail(message: string): never {
  console.error(`\npricing tests: FAILED\n${message}\n`);
  process.exit(1);
}

async function fetchCases(url: string, secret: string): Promise<unknown[]> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { "X-GOAT-Secret": secret },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    fail(`Couldn't reach ${url}: ${(err as Error).message}`);
  }

  if (res.status === 401) fail(`${url} rejected RATE_CARDS_SECRET (401).`);
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    fail(`${url} returned ${res.status}. ${body}`);
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    fail(`${url} didn't return JSON.`);
  }
  if (!Array.isArray(json?.test_cases)) fail(`${url} returned no test_cases array.`);
  return json.test_cases;
}

function printTable(results: PricingCaseResult[]) {
  const money = (n: number | null) => (n === null ? "" : n.toFixed(2));
  const rows = results.map((r) => [
    r.code,
    r.status === "pass" ? "pass" : r.status === "fail" ? "FAIL" : "skip",
    money(r.expectedCost),
    money(r.actualCost),
    r.title,
  ]);
  const head = ["Case", "Result", "Expected", "Actual", "Title"];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells: string[]) =>
    cells
      .map((c, i) => (i === 2 || i === 3 ? c.padStart(widths[i]) : i === cells.length - 1 ? c : c.padEnd(widths[i])))
      .join("  ");
  console.log(line(head));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  rows.forEach((row) => console.log(line(row)));
}

async function main() {
  const url = process.env.RATE_CARDS_URL?.trim();
  const secret = process.env.RATE_CARDS_SECRET?.trim();

  if (!secret) {
    if (process.env.PRICING_TESTS_OFFLINE === "1") {
      console.warn(
        "\n*** pricing tests SKIPPED: PRICING_TESTS_OFFLINE=1 and no RATE_CARDS_SECRET. ***\n" +
          "*** No shared case was checked. Never set this on a deploy.                  ***\n"
      );
      return;
    }
    fail(
      "RATE_CARDS_SECRET isn't set, so the shared cases can't be fetched.\n" +
        "Set RATE_CARDS_URL and RATE_CARDS_SECRET, or for local dev only set PRICING_TESTS_OFFLINE=1."
    );
  }
  if (!url) fail("RATE_CARDS_SECRET is set but RATE_CARDS_URL isn't.");

  const cases = await fetchCases(url, secret);
  const results = cases.map(runPricingCase);
  const failed = results.filter((r) => r.status === "fail");
  const passed = results.filter((r) => r.status === "pass");
  const skipped = results.filter((r) => r.status === "skipped");

  if (results.length) printTable(results);

  for (const r of failed) {
    console.error(`\n${r.code} ${r.title}`);
    r.problems.forEach((p) => console.error(`  - ${p}`));
  }

  console.log(
    `\npricing tests: ${passed.length} passed, ${failed.length} failed, ` +
      `${skipped.length} skipped (THE GOAT only), of ${results.length}.`
  );
  if (passed.length + failed.length === 0) {
    console.warn("*** WARNING: no shared cases to run (scope both). Nothing was checked. ***");
  }
  if (failed.length) fail(`${failed.map((r) => r.code).join(", ")} failed. The build is blocked.`);
}

main().catch((err) => fail((err as Error).stack ?? String(err)));
