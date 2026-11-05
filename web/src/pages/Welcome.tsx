import { Eye, Wallet } from "lucide-react";
import { useNearWallet } from "near-connect-hooks";
import { Bowl } from "../components/Bowl";
import { Logo } from "../components/Shell";
import { Button } from "../components/ui";
import { GITHUB_URL, NETWORK_LABEL } from "../config";
import { useVaults } from "../lib/store";

const STEPS = [
  {
    title: "The agent can only ask",
    text: "Your money sits in a vault on NEAR. The agent's key can ask for a payment, report a scam or freeze the vault. The vault decides: send, hold for you, or block.",
  },
  {
    title: "We send it fake scams",
    text: "Surprise drills: a supplier's \"new bank details\", an urgent request from \"the boss\", a hidden instruction in an invoice. The vault only knows a fingerprint of the fake account, so the agent can't look it up.",
  },
  {
    title: "Results become spending power",
    text: "Reporting a drill earns points. Paying one sends nothing, freezes the vault and costs points. The agent's score decides how much it may spend without asking you.",
  },
];

export function Welcome() {
  const { signIn, loading } = useNearWallet();
  const { enterDemo } = useVaults();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-5 py-5 sm:px-8">
        <span className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[17px] font-extrabold tracking-tight">Phishbowl</span>
        </span>
        <span className="hidden items-center gap-1.5 rounded-full border border-edge px-2.5 py-1 text-[12px] text-mist sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-water" />
          {NETWORK_LABEL}
        </span>
      </header>

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pb-12 sm:px-8">
        <section className="grid items-center gap-10 py-8 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:py-14">
          <div>
            <p className="text-[14px] font-semibold text-water">Your AI. Your Money. Your Rules.</p>
            <h1 className="mt-3 text-[34px] font-extrabold leading-[1.08] tracking-tight sm:text-[46px]">
              We scam your AI agent before real scammers do.
            </h1>
            <p className="mt-5 max-w-[56ch] text-[16px] leading-relaxed text-mist">
              Phishbowl is a vault on NEAR for AI agents that pay bills. It runs surprise scam drills on your agent, and
              the results decide how much it may spend without asking you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="primary" disabled={loading} onClick={() => void signIn()}>
                <Wallet size={16} /> Connect wallet
              </Button>
              <Button onClick={enterDemo}>
                <Eye size={16} /> See the live demo
              </Button>
            </div>
            <p className="mt-4 max-w-[56ch] text-[13px] text-fog">
              Free on NEAR testnet, and your first vault is on us. You'll need a testnet wallet, such as Meteor or Intear.
              The demo needs nothing: it shows a sample bakery's agent paying suppliers and facing scam drills.
            </p>
          </div>
          <div className="flex justify-center">
            <Bowl score={70} frozen={false} activeDrills={1} size={300} />
          </div>
        </section>

        <section aria-labelledby="how" className="mt-4">
          <h2 id="how" className="text-[15px] font-semibold text-snow">
            How it works
          </h2>
          <ol className="mt-4 grid gap-px overflow-hidden rounded-xl border border-edge bg-edge md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="bg-panel p-5">
                <span className="tabular text-[13px] font-semibold text-water">{index + 1}</span>
                <h3 className="mt-1 text-[15px] font-semibold text-snow">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-fog">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-edge px-5 py-4 text-[12px] text-fog sm:px-8">
        <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-2">
          <span>Built for NEAR HACKATHON 2026. Everything here runs on {NETWORK_LABEL}; nothing moves real money.</span>
          <a className="underline hover:text-snow" href={GITHUB_URL}>
            Source code (MIT)
          </a>
        </div>
      </footer>
    </div>
  );
}
