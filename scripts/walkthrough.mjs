// End-to-end test of the path from result to an informed decision, as the reviewer walkthrough describes it:
// Layla signs in, reads "What this means" and the options, answers the check of understanding, books a
// counsellor; the counsellor opens the case, reviews and signs off; the signed note reaches Layla's phone.
// Needs the app running. Usage: node scripts/walkthrough.mjs [wallet url] [console url] [screenshot dir]
// (defaults http://localhost:3030 and the wallet port + 1). With a screenshot dir, saves one picture per step.
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";

const WALLET = process.argv[2] ?? "http://localhost:3030";
const CONSOLE = process.argv[3] ?? WALLET.replace(/:(\d+)$/, (_, p) => `:${Number(p) + 1}`);
const SHOTS = process.argv[4];
const en = JSON.parse(readFileSync(new URL("../apps/wallet/messages/en.json", import.meta.url)));
const ar = JSON.parse(readFileSync(new URL("../apps/wallet/messages/ar.json", import.meta.url)));
const cen = JSON.parse(readFileSync(new URL("../apps/console/messages/en.json", import.meta.url)));
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = {};
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
// Steps marked done. The next steps fill in after the page asks the server for the person's cases,
// so wait up to 15 s for the expected count before reading it (a hosted server can be slow).
const done = async (page, want) => {
  if (want !== undefined) await page.waitForFunction((n) => document.querySelectorAll(".journey li.done").length >= n, want, { timeout: 15_000 }).catch(() => {});
  return page.locator(".journey li.done").count();
};

// 1. Layla signs in. The programme found that she and Yousef share a change in GJB2.
const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" })).newPage();
await phone.goto(`${WALLET}/en/welcome?as=layla`);
await phone.getByRole("button", { name: en.signin }).click();
await phone.waitForURL(/\/result/, { timeout: 30_000 });

// 2. What this means, the options, and the next steps are on the result screen itself.
await phone.locator("#meaning").waitFor();
const result = await phone.locator("main").innerText();
checks.explains_each_pregnancy = [en.wm_affected, en.wm_carrier, en.wm_neither, en.wm_same_every].every((s) => result.includes(s));
checks.options_equal_and_unranked = (await phone.locator("#options .options li").count()) === 4 && result.includes(en.opt_1_t);
checks.next_steps_start_at_understanding = (await done(phone)) === 1;
await shot(phone, "01-result");

// 3. The two-question check of understanding.
await phone.getByText(en.wm_check).click();
await phone.getByRole("button", { name: en.wm_q1_b }).click();
await phone.getByRole("button", { name: en.next }).click();
await phone.getByRole("button", { name: en.wm_q2_a }).click();
await phone.getByRole("button", { name: en.finish }).click();
await phone.getByText(en.tb_done).waitFor();
await shot(phone, "02-understood");

// 4. Book a counsellor (priority, within 48 hours), agreeing to exactly what is shared.
await phone.goto(`${WALLET}/en/help?book=1&from=programme`);
await phone.locator("#book .slots button").first().click();
await phone.getByRole("button", { name: en.book, exact: true }).click();
await shot(phone, "03-consent");
await phone.getByRole("button", { name: en.agree, exact: true }).click();
await phone.getByText(en.booked).waitFor();
checks.next_steps_after_booking = (await done(phone, 3)) === 3;
await shot(phone, "04-booked");

// 5. The counsellor opens the case, reviews the draft and signs off.
const desk = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" })).newPage();
const cases = await (await desk.request.get(`${CONSOLE}/api/cases?counsellor=c-001`)).json();
const open = cases.filter((c) => !c.signed_off && c.source === "programme").sort((a, b) => b.created_at - a.created_at)[0];
await desk.goto(`${CONSOLE}/en/case/${open.id}`);
await desk.getByText(cen.options_title).waitFor();
checks.counsellor_sees_options = true;
await shot(desk, "05-console-case");
await desk.locator("#note").fill(`${await desk.locator("#note").inputValue()}\n\nWe talked through each option. The choice is yours, in your own time.`);
await desk.getByText(cen.reviewed_box).click();
await desk.getByRole("button", { name: cen.signoff_send }).click();
await desk.getByText(cen.signed_by).waitFor();
await shot(desk, "06-console-signed");

// 6. The signed note reaches Layla; the next steps move on to her own decision.
await phone.goto(`${WALLET}/en/help`);
await phone.getByText(en.label_advice).waitFor({ timeout: 15_000 });
checks.signed_note_on_phone = true;
checks.next_steps_at_decision = (await done(phone, 4)) === 4;
await shot(phone, "07-signed-note");

// 7. The same in Arabic.
await phone.goto(`${WALLET}/ar/result`);
await phone.locator("#meaning").waitFor();
checks.arabic = (await phone.locator("main").innerText()).includes(ar.wm_title);
await shot(phone, "08-result-ar");

await browser.close();
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ wallet: WALLET, console: CONSOLE, ...checks, ok }));
process.exit(ok ? 0 : 1);
