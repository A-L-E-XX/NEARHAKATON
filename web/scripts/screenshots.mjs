// Takes screenshots of the built site for review. Used by the Web workflow.
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.SITE_URL ?? "http://localhost:4173/";
const shots = [
  { name: "home-desktop", hash: "#/", width: 1280, height: 900 },
  { name: "home-mobile", hash: "#/", width: 390, height: 844 },
  { name: "vault-desktop", hash: "#/vault", width: 1280, height: 900 },
  { name: "vault-mobile", hash: "#/vault", width: 390, height: 844 },
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
    .waitForSelector('[data-ready="true"]', { timeout: 25_000 })
    .catch(() => console.log(`[${shot.name}] the vault data did not load within 25 seconds`));
  await page.waitForTimeout(2_500); // let the water finish rising
  await page.screenshot({ path: `screenshots/${shot.name}.png`, fullPage: true });
  console.log(`saved screenshots/${shot.name}.png`);
  await page.close();
}

await browser.close();
