// Accessibility check of every wallet and console screen with axe-core, in a real Chrome.
// English and Arabic, light and dark mode, phone width for the wallet. Also checks that wallet
// screens don't scroll sideways at 200% text, and lists controls smaller than 44 x 44 px (rules.md §9).
// Needs the app running, e.g. docker compose -f docker-compose.stack.yml up
// Usage: node scripts/a11y.mjs [wallet url] [console url]   (defaults: localhost:3030, localhost:3031)
// Writes docs/review/a11y-results.json and exits 1 if axe finds any WCAG violation.
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";

const [WALLET = "http://localhost:3030", CONSOLE = "http://localhost:3031"] = process.argv.slice(2);
const AXE = new URL("../apps/wallet/node_modules/axe-core/axe.min.js", import.meta.url).pathname;
const en = JSON.parse(readFileSync(new URL("../apps/wallet/messages/en.json", import.meta.url)));
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];

async function scan(page, app, path, scheme) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.waitForTimeout(300);
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(async (tags) => {
    const out = await window.axe.run(document, { runOnly: { type: "tag", values: [...tags, "best-practice"] } });
    const pick = (v) => ({ id: v.id, impact: v.impact, wcag: v.tags.some((t) => t.startsWith("wcag")), help: v.help,
      nodes: v.nodes.slice(0, 5).map((n) => n.target.join(" ")) });
    return out.violations.map(pick);
  }, WCAG);
  // A radio or checkbox inside a label is tapped through the whole label, so measure the label.
  const small = await page.evaluate(() => [...document.querySelectorAll("button, a.btn, input:not([type=hidden]), select, summary")]
    .filter((e) => {
      const viaLabel = e.matches("input[type=radio], input[type=checkbox]") && e.closest("label");
      const b = (viaLabel || e).getBoundingClientRect();
      return b.width > 0 && (b.width < 44 || b.height < 44);
    })
    .map((e) => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""} "${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30)}"`));
  results.push({ app, path, scheme, violations: r, small_targets: [...new Set(small)] });
}

async function textZoom(page, path) {
  const over = await page.evaluate(async () => {
    document.documentElement.style.fontSize = "200%";
    await new Promise((r) => setTimeout(r, 200));
    const o = document.scrollingElement.scrollWidth > window.innerWidth + 1;
    document.documentElement.style.fontSize = "";
    return o;
  });
  results.push({ app: "wallet", path, check: "text_200", sideways_scroll: over });
}

// Wallet, phone size.
const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
const w = await phone.newPage();
for (const loc of ["en", "ar"]) {
  await w.goto(`${WALLET}/${loc}/welcome`);
  await w.waitForLoadState("networkidle");
  for (const s of ["light", "dark"]) await scan(w, "wallet", `/${loc}/welcome (step 1)`, s);
}
await w.goto(`${WALLET}/en/welcome`);
await w.waitForLoadState("networkidle"); // a click before the page is interactive does nothing
await w.getByRole("button", { name: en.continue }).click();
for (const s of ["light", "dark"]) await scan(w, "wallet", "/en/welcome (sign in)", s);
await w.getByRole("button", { name: en.signin }).click();
await w.waitForURL(/\/result/);
// A Tier 2 question, so the console has a case to show.
await w.goto(`${WALLET}/en/help`);
await w.fill("#q", "Can I still have healthy children?");
await w.getByRole("button", { name: en.send_question }).click();
await w.getByRole("button", { name: en.agree, exact: true }).click();
await w.waitForTimeout(500);

const walletPages = ["result", "card/beta-thalassaemia", "card/carrier-basics", "help", "help/invite", "pair", "settings", "sharing", "study"];
for (const loc of ["en", "ar"]) {
  for (const p of walletPages) {
    await w.goto(`${WALLET}/${loc}/${p}`);
    await w.waitForLoadState("networkidle");
    for (const s of ["light", "dark"]) await scan(w, "wallet", `/${loc}/${p}`, s);
    await textZoom(w, `/${loc}/${p}`);
  }
}

// Console, desktop size.
const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const c = await desk.newPage();
await c.goto(`${CONSOLE}/en/queue`);
await c.waitForLoadState("networkidle");
const caseHref = await c.locator("a[href*='/case/']").first().getAttribute("href").catch(() => null);
const consolePages = ["queue", "dashboard", "attack-demo", ...(caseHref ? [caseHref.replace(/^\/en\//, "")] : [])];
for (const loc of ["en", "ar"]) {
  for (const p of consolePages) {
    await c.goto(`${CONSOLE}/${loc}/${p}`);
    await c.waitForLoadState("networkidle");
    for (const s of ["light", "dark"]) await scan(c, "console", `/${loc}/${p}`, s);
    if (p === "queue" && await c.locator(".queue-row").count()) {  // open the first case beside the queue
      await c.locator(".queue-row").first().click();
      await c.waitForLoadState("networkidle");
      for (const s of ["light", "dark"]) await scan(c, "console", `/${loc}/queue (case open)`, s);
    }
  }
}
await browser.close();

const scans = results.filter((r) => r.violations);
const wcag = scans.flatMap((r) => r.violations.filter((v) => v.wcag).map((v) => ({ ...v, where: `${r.app} ${r.path} ${r.scheme}` })));
const other = scans.flatMap((r) => r.violations.filter((v) => !v.wcag).map((v) => ({ ...v, where: `${r.app} ${r.path} ${r.scheme}` })));
const zoom = results.filter((r) => r.check === "text_200");
const summary = {
  date: new Date().toLocaleDateString("sv"), axe: JSON.parse(readFileSync(AXE.replace("axe.min.js", "package.json"))).version,
  screens_scanned: scans.length, wcag_violations: wcag.length, best_practice_issues: other.length,
  text_200_sideways_scroll: zoom.filter((z) => z.sideways_scroll).map((z) => z.path),
  screens_with_small_targets: scans.filter((r) => r.small_targets.length).length,
};
writeFileSync(new URL("../docs/review/a11y-results.json", import.meta.url), JSON.stringify({ summary, wcag, other, results }, null, 1) + "\n");
console.log(JSON.stringify(summary, null, 1));
for (const v of wcag) console.log("WCAG", v.id, v.impact, v.where, v.nodes.join(" | "));
process.exit(wcag.length ? 1 : 0);
