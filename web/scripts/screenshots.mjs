// Takes screenshots of the built site against live testnet data, for review.
// Used by the Web workflow, which pushes them to the "screenshots" branch.
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.SITE_URL ?? "http://localhost:4173/";
const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };
const vault = "phishbowl-ci-41456407509-1.testnet";

const shots = [
  { name: "01-overview", hash: "#/overview", ...desktop },
  { name: "02-agents", hash: "#/agents", ...desktop },
  { name: "03-agent-detail", hash: `#/agents/${vault}`, ...desktop },
  { name: "04-wallet", hash: "#/wallet", ...desktop },
  { name: "05-spending", hash: "#/spending", ...desktop },
  { name: "06-threats", hash: "#/threats", ...desktop },
  { name: "07-reputation", hash: "#/reputation", ...desktop },
  { name: "08-transactions", hash: "#/transactions", ...desktop },
  { name: "09-transaction-drawer", hash: "#/transactions", ...desktop, click: "main ul li button" },
  { name: "10-audit", hash: "#/audit", ...desktop },
  { name: "11-integrations", hash: "#/integrations", ...desktop },
  { name: "12-settings", hash: "#/settings", ...desktop },
  { name: "13-start", hash: "#/start", ...desktop },
  { name: "14-overview-mobile", hash: "#/overview", ...mobile },
  { name: "15-threats-mobile", hash: "#/threats", ...mobile },
  { name: "16-audit-mobile", hash: "#/audit", ...mobile },
];

await mkdir("screenshots", { recursive: true });
const browser = await chromium.launch();

for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`[${shot.name}] console error: ${message.text()}`);
  });
  page.on("pageerror", (error) => console.log(`[${shot.name}] page error: ${error.message}`));

  await page.goto(base + shot.hash, { waitUntil: "load", timeout: 30_000 });
  await page
    .waitForSelector('main[data-ready="true"]', { timeout: 25_000 })
    .catch(() => console.log(`[${shot.name}] the vault data did not load within 25 seconds`));
  await page.waitForTimeout(2_500); // let the water finish rising and the charts draw
  if (shot.click) {
    await page
      .click(shot.click, { timeout: 5_000 })
      .then(() => page.waitForTimeout(600))
      .catch(() => console.log(`[${shot.name}] nothing to click at ${shot.click}`));
  }
  await page.screenshot({ path: `screenshots/${shot.name}.png`, fullPage: !shot.click });
  console.log(`saved screenshots/${shot.name}.png`);
  await page.close();
}

await browser.close();
