import { useEffect, useState } from "react";
import { ONE_YOCTO, OwnerAction } from "../components/OwnerAction";
import { VaultGate } from "../components/VaultGate";
import { Badge, Field, PageHeader, Panel, Progress, VaultPicker } from "../components/ui";
import { near, nearFloat, nearNumber, toYocto } from "../lib/format";
import type { VaultData } from "../lib/vault";

export function SpendingControls() {
  return (
    <>
      <PageHeader
        title="Spending Controls"
        description="You set the most the agent could ever spend. Its score from scam drills decides how much of that it gets today."
        actions={<VaultPicker />}
      />
      <VaultGate>{(vaultId, data) => <Body vaultId={vaultId} data={data} />}</VaultGate>
    </>
  );
}

function Body({ vaultId, data }: { vaultId: string; data: VaultData }) {
  const { status } = data;
  const { policy } = status;
  const probation = status.tier === "Probation";

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Today's budget" description="Resets at midnight UTC">
          <div className="space-y-5">
            <Budget
              label="Sent today"
              value={`${near(status.spent_today)} of ${near(status.agent_daily_limit)}`}
              used={nearFloat(status.spent_today)}
              max={nearFloat(status.agent_daily_limit)}
            />
            <Budget
              label="Payment requests today"
              value={`${status.requests_today} of ${policy.max_requests_per_day}`}
              used={status.requests_today}
              max={policy.max_requests_per_day}
            />
          </div>
          {status.frozen && (
            <p className="mt-5 rounded-lg border border-ice/25 bg-ice/10 px-3 py-2 text-[13px] text-ice">
              Frozen: the agent can't send anything. These limits apply again once the owner unfreezes the vault.
            </p>
          )}
          <dl className="mt-5">
            <Field label={status.frozen ? "Per payment" : "Per payment now"} value={near(status.agent_max_per_payment)} mono />
            <Field label={status.frozen ? "Per day" : "Per day now"} value={near(status.agent_daily_limit)} mono />
            <Field label="Score" value={`${status.score} of 100 (${status.tier})`} />
          </dl>
        </Panel>

        <Panel title="How approvals work" description="The vault applies these rules to every request, in this order">
          <ol className="space-y-3 text-[13px]">
            <Rule n={1} tone="danger" title="Refused" text="Payments to a scam-drill decoy or a blocked account are refused. Paying a decoy also freezes the vault." />
            <Rule
              n={2}
              tone="caution"
              title="Held for you"
              text={
                probation
                  ? "The agent is on probation (score under 20), so every payment waits for your approval."
                  : `Anything above ${near(status.agent_max_per_payment)} per payment or ${near(status.agent_daily_limit)} per day waits for your approval${policy.allowlist_only ? ", and so does any account that isn't on your allowlist" : ""}.`
              }
            />
            <Rule n={3} tone="secure" title="Sent automatically" text="Everything else goes through straight away, inside the limits." />
            <Rule
              n={4}
              tone="ice"
              title="Frozen"
              text={`More than ${policy.max_requests_per_day} requests in a day freezes the vault, in case the agent is stuck in a loop or under attack.`}
            />
          </ol>
          <p className="mt-4 text-[13px] text-fog">
            Example with your settings: at score {status.score} the agent gets {status.score}% of your maximums, so{" "}
            {nearNumber(policy.max_per_payment)} NEAR becomes {near(status.agent_max_per_payment)} per payment. Passing a drill
            adds 10 points; failing one removes 30.
          </p>
        </Panel>
      </div>

      <PolicyEditor vaultId={vaultId} data={data} />

      <p className="text-[13px] text-fog">
        Not in the contract yet: weekly and monthly limits, tokens other than NEAR, and payment delays. They aren't shown as
        options until the vault can enforce them.
      </p>
    </div>
  );
}

function Budget({ label, value, used, max }: { label: string; value: string; used: number; max: number }) {
  const share = max > 0 ? used / max : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
        <span className="text-mist">{label}</span>
        <span className="tabular text-snow">{value}</span>
      </div>
      <Progress value={used} max={max} tone={share >= 1 ? "danger" : share >= 0.75 ? "caution" : "brand"} />
    </div>
  );
}

function Rule({ n, tone, title, text }: { n: number; tone: "danger" | "caution" | "secure" | "ice"; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="tabular mt-0.5 w-4 shrink-0 text-fog">{n}</span>
      <span>
        <Badge tone={tone}>{title}</Badge>
        <span className="mt-1 block text-mist">{text}</span>
      </span>
    </li>
  );
}

function PolicyEditor({ vaultId, data }: { vaultId: string; data: VaultData }) {
  const { policy } = data.status;
  const [perPayment, setPerPayment] = useState(nearNumber(policy.max_per_payment, 6));
  const [daily, setDaily] = useState(nearNumber(policy.daily_limit, 6));
  const [requests, setRequests] = useState(String(policy.max_requests_per_day));
  const [allowlistOnly, setAllowlistOnly] = useState(policy.allowlist_only);

  useEffect(() => {
    setPerPayment(nearNumber(policy.max_per_payment, 6));
    setDaily(nearNumber(policy.daily_limit, 6));
    setRequests(String(policy.max_requests_per_day));
    setAllowlistOnly(policy.allowlist_only);
  }, [vaultId, policy.max_per_payment, policy.daily_limit, policy.max_requests_per_day, policy.allowlist_only]);

  const perYocto = toYocto(perPayment.replace(/,/g, ""));
  const dailyYocto = toYocto(daily.replace(/,/g, ""));
  const requestCount = /^\d+$/.test(requests.trim()) ? Number(requests.trim()) : NaN;
  const problems: string[] = [];
  if (!perYocto || perYocto === "0") problems.push("Enter a per-payment maximum above zero.");
  if (!dailyYocto || dailyYocto === "0") problems.push("Enter a daily maximum above zero.");
  if (perYocto && dailyYocto && BigInt(perYocto) > BigInt(dailyYocto)) problems.push("The per-payment maximum can't be more than the daily maximum.");
  if (!(requestCount >= 1 && requestCount <= 10_000)) problems.push("Requests per day must be a whole number from 1 to 10,000.");
  const unchanged =
    perYocto === policy.max_per_payment &&
    dailyYocto === policy.daily_limit &&
    requestCount === policy.max_requests_per_day &&
    allowlistOnly === policy.allowlist_only;

  const input =
    "h-10 w-full rounded-lg border border-edge bg-raised px-3 text-sm text-snow focus:border-water/60 focus:outline-none";

  return (
    <Panel title="Edit the maximums" description="Only the vault's owner can save changes, and the wallet has to confirm them">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-[13px]">
          <span className="mb-1.5 block text-mist">Most per payment (NEAR)</span>
          <input className={input} value={perPayment} onChange={(e) => setPerPayment(e.target.value)} inputMode="decimal" />
        </label>
        <label className="block text-[13px]">
          <span className="mb-1.5 block text-mist">Most per day (NEAR)</span>
          <input className={input} value={daily} onChange={(e) => setDaily(e.target.value)} inputMode="decimal" />
        </label>
        <label className="block text-[13px]">
          <span className="mb-1.5 block text-mist">Requests per day before freezing</span>
          <input className={input} value={requests} onChange={(e) => setRequests(e.target.value)} inputMode="numeric" />
        </label>
        <label className="flex items-center gap-3 self-end rounded-lg border border-edge bg-raised px-3 py-2.5 text-[13px]">
          <input
            type="checkbox"
            checked={allowlistOnly}
            onChange={(e) => setAllowlistOnly(e.target.checked)}
            className="h-4 w-4 accent-[#3cc4bc]"
          />
          <span className="text-mist">Only pay approved recipients without asking</span>
        </label>
      </div>
      {problems.length > 0 && (
        <ul className="mt-3 space-y-1 text-[13px] text-caution">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <OwnerAction
          vaultId={vaultId}
          ownerId={data.status.owner_id}
          method="set_policy"
          args={{
            policy: {
              max_per_payment: perYocto ?? "0",
              daily_limit: dailyYocto ?? "0",
              max_requests_per_day: Number.isFinite(requestCount) ? requestCount : 0,
              allowlist_only: allowlistOnly,
            },
          }}
          deposit={ONE_YOCTO}
          variant="primary"
          disabled={problems.length > 0 || unchanged}
          label="Save and activate"
          confirmTitle="Save the new maximums"
          confirmText={`From now on the agent can be given up to ${perPayment} NEAR per payment and ${daily} NEAR per day, scaled by its score. ${
            allowlistOnly ? "Payments to accounts outside your allowlist will wait for you." : ""
          }`}
          confirmLabel="Save"
          done="New limits saved on the vault."
        />
        {unchanged && <span className="text-[13px] text-fog">These are the current settings.</span>}
      </div>
    </Panel>
  );
}
