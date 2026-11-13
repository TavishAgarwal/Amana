// End-to-end test of the couple check in two separate browsers (two "phones" with their own storage):
// sign in as Mariam and as Khalid, pair with the text code, run the private check, then the
// two-step reveal. Both must see "shared" and, only after both agree, the gene HBB.
// Also checks that no request carried a gene name, and that /api/ask was never called.
// Needs the app running. Usage: node scripts/e2e.mjs [wallet url]   (default http://localhost:3030)
// For a LAN https:// wallet with a self-signed certificate, certificate errors are ignored.
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const WALLET = process.argv[2] ?? "http://localhost:3030";
const en = JSON.parse(readFileSync(new URL("../apps/wallet/messages/en.json", import.meta.url)));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const GENES = /\b(HBB|GJB2|PAH)\b/;
const leaks = [], asks = [];

async function phone(persona) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on("request", (r) => {
    if (r.url().includes("/api/ask")) asks.push(r.url());
    const body = r.postData() ?? "";
    if (r.url().includes("/api/") && !r.url().includes("/api/enroll") && GENES.test(body)) leaks.push(`${persona}: ${r.url()}`);
  });
  await page.goto(`${WALLET}/en/welcome`);
  await page.getByRole("button", { name: en.continue }).click();
  await page.selectOption("#persona", persona);
  await page.getByRole("button", { name: en.signin }).click();
  await page.waitForURL(/\/result/, { timeout: 30_000 });
  await page.goto(`${WALLET}/en/pair`);
  return page;
}

const t0 = Date.now();
const a = await phone("mariam"), b = await phone("khalid");
await a.getByRole("button", { name: en.show_code }).click();
await a.getByRole("button", { name: en.agree, exact: true }).click();
await a.getByText(en.manual_code).click();
const sid = (await a.locator("details p.ltr").textContent()).trim();
await b.fill("#code", sid);
await b.getByRole("button", { name: en.join }).click();
await b.getByRole("button", { name: en.agree, exact: true }).click();
for (const p of [a, b]) await p.getByText(en.shared_yes).waitFor({ timeout: 30_000 });
const tCheck = Date.now() - t0;
for (const p of [a, b]) {
  await p.getByRole("button", { name: en.show_cond }).click();
  await p.getByRole("button", { name: en.agree, exact: true }).click();
}
for (const p of [a, b]) await p.getByText(en.revealed).waitFor({ timeout: 30_000 });
const shownA = await a.locator("main").innerText(), shownB = await b.locator("main").innerText();
await browser.close();

const ok = shownA.includes("HBB") && shownB.includes("HBB") && !shownA.includes("GJB2") && !shownB.includes("PAH")
  && leaks.length === 0 && asks.length === 0;
console.log(JSON.stringify({ wallet: WALLET, shared_on_both: true, revealed_HBB_only: shownA.includes("HBB") && !shownA.includes("GJB2") && !shownB.includes("PAH"),
  ms_to_shared: tCheck, gene_names_sent_to_api: leaks, api_ask_calls: asks.length, ok }));
process.exit(ok ? 0 : 1);
