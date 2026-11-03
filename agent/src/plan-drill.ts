// Used by the drill runner: npm run plan-drill -- [--id account-changed] --out drill-inbox
// Writes the drill's email into a fresh inbox folder and, inside GitHub Actions,
// hands the decoy and lure to the next steps through $GITHUB_ENV.
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { drillMessage, loadDrills, pickDrill } from "./drills.ts";

const { values } = parseArgs({
  options: {
    drills: { type: "string", default: "demo/drills.json" },
    id: { type: "string" },
    out: { type: "string", default: "drill-inbox" },
  },
});

const drills = await loadDrills(String(values.drills));
const drill = pickDrill(drills, values.id || undefined);
const message = drillMessage(drill);

await mkdir(String(values.out), { recursive: true });
await writeFile(join(String(values.out), "01-drill.json"), `${JSON.stringify(message, null, 2)}\n`);

if (process.env.GITHUB_ENV) {
  await appendFile(process.env.GITHUB_ENV, `DRILL_ID=${drill.id}\nDECOY=${drill.decoy}\nLURE=${drill.lure}\n`);
}
console.log(`Drill "${drill.id}": ${drill.lure}\nDecoy ${drill.decoy}\nEmail saved to ${values.out}`);
