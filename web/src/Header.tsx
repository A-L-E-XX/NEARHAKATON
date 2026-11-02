import { useNearWallet } from "near-connect-hooks";
import { GITHUB_URL } from "./config";

export function BrandMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M10 5h12M8.5 7.5C4.6 10 3 13.6 3 17.5 3 24.4 8.8 29 16 29s13-4.6 13-11.5c0-3.9-1.6-7.5-5.5-10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M5.4 19.6c2.6-1.5 5.1-1.5 7.6 0s5.2 1.5 7.8 0 4.6-1.4 6-.5c-.6 4.8-5.2 8-10.8 8S5.9 23.9 5.4 19.6z" fill="#23A6A0" />
    </svg>
  );
}

export function Header({ page }: { page: "home" | "vault" }) {
  const { signedAccountId, signIn, signOut, loading } = useNearWallet();
  return (
    <header className="topbar">
      <a className="brand" href="#/">
        <BrandMark />
        Phishbowl
      </a>
      <nav className="topnav" aria-label="Main">
        <a href="#/vault" aria-current={page === "vault" ? "page" : undefined}>
          Live vault
        </a>
        <a href={GITHUB_URL}>Code</a>
        {signedAccountId ? (
          <span className="wallet">
            <span className="wallet__id" title={signedAccountId}>
              {signedAccountId}
            </span>
            <button className="btn btn--quiet" type="button" onClick={() => void signOut()}>
              Disconnect
            </button>
          </span>
        ) : (
          <button className="btn btn--small" type="button" onClick={() => void signIn()} disabled={loading}>
            Connect wallet
          </button>
        )}
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <p>
          Built for NEAR HACKATHON 2026, AI Security &amp; Defense track. Runs on NEAR testnet. The bakery, its
          suppliers, invoices and amounts are sample data.
        </p>
        <p>
          <a href={GITHUB_URL}>Source code (MIT)</a>
        </p>
      </div>
    </footer>
  );
}
