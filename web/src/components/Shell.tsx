import {
  ArrowLeftRight,
  BadgeCheck,
  Bell,
  Bot,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Plug,
  Rocket,
  ScrollText,
  Search,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import { useNearWallet } from "near-connect-hooks";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GITHUB_URL, NETWORK_LABEL } from "../config";
import { KIND, overallStatus, severityOf, type Tone } from "../lib/derive";
import { ago, near } from "../lib/format";
import { go, type Page, type Route } from "../lib/route";
import { useVaults } from "../lib/store";
import { Button, TONE_DOT, agentName, cx } from "./ui";

const NAV: Array<{ page: Page; label: string; icon: typeof LayoutDashboard }> = [
  { page: "overview", label: "Overview", icon: LayoutDashboard },
  { page: "agents", label: "AI Agents", icon: Bot },
  { page: "wallet", label: "Wallet Security", icon: Wallet },
  { page: "spending", label: "Spending Controls", icon: SlidersHorizontal },
  { page: "threats", label: "Threat Detection", icon: ShieldAlert },
  { page: "reputation", label: "Trust & Reputation", icon: BadgeCheck },
  { page: "transactions", label: "Transaction Monitor", icon: ArrowLeftRight },
  { page: "audit", label: "Security Audit", icon: ScrollText },
  { page: "integrations", label: "Integrations", icon: Plug },
  { page: "settings", label: "Settings", icon: Settings },
];

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <path
        d="M10 5h12M8.5 7.5C4.6 10 3 13.6 3 17.5 3 24.4 8.8 29 16 29s13-4.6 13-11.5c0-3.9-1.6-7.5-5.5-10"
        fill="none"
        stroke="#eaf0f7"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M5.4 19.6c2.6-1.5 5.1-1.5 7.6 0s5.2 1.5 7.8 0 4.6-1.4 6-.5c-.6 4.8-5.2 8-10.8 8S5.9 23.9 5.4 19.6z" fill="#3cc4bc" />
    </svg>
  );
}

function usePersistentFlag(key: string, initial: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(key) === "1" ? true : initial;
    } catch {
      return initial;
    }
  });
  const update = (next: boolean) => {
    setValue(next);
    try {
      window.localStorage.setItem(key, next ? "1" : "0");
    } catch {
      // Not fatal.
    }
  };
  return [value, update];
}

function NavLinks({ route, collapsed, onNavigate }: { route: Route; collapsed: boolean; onNavigate?: () => void }) {
  const current = route.page === "agent" ? "agents" : route.page;
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Main">
      {NAV.map(({ page, label, icon: Icon }) => {
        const active = current === page;
        return (
          <a
            key={page}
            href={`#/${page}`}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors",
              collapsed && "justify-center px-0",
              active ? "bg-white/[0.07] text-snow" : "text-fog hover:bg-white/[0.03] hover:text-snow",
            )}
          >
            <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-water" : undefined} />
            {!collapsed && <span className="truncate">{label}</span>}
          </a>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <a href="#/overview" className={cx("flex h-16 items-center gap-2.5 border-b border-edge px-4", collapsed && "justify-center px-0")}>
      <Logo />
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block text-[16px] font-extrabold tracking-tight">Phishbowl</span>
          <span className="block truncate text-[11px] text-fog">Your AI. Your Money. Your Rules.</span>
        </span>
      )}
    </a>
  );
}

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { firstLoad } = useVaults();
  const [collapsed, setCollapsed] = usePersistentFlag("phishbowl.sidebar.collapsed", false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside
        className={cx(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-edge bg-panel/70 lg:flex",
          collapsed ? "w-[68px]" : "w-[252px]",
        )}
      >
        <Brand collapsed={collapsed} />
        <NavLinks route={route} collapsed={collapsed} />
        <div className="space-y-0.5 border-t border-edge p-2">
          <a
            href="#/start"
            title={collapsed ? "Get started" : undefined}
            className={cx(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] text-fog hover:bg-white/[0.03] hover:text-snow",
              collapsed && "justify-center px-0",
              route.page === "start" && "bg-white/[0.07] text-snow",
            )}
          >
            <Rocket size={18} />
            {!collapsed && "Get started"}
          </a>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className={cx(
              "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-[14px] text-fog hover:bg-white/[0.03] hover:text-snow",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 lg:hidden" onMouseDown={() => setMobileOpen(false)}>
          <aside className="flex h-full w-[272px] flex-col border-r border-edge bg-panel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pr-2">
              <Brand collapsed={false} />
              <button className="rounded p-2 text-fog hover:text-snow" aria-label="Close menu" onClick={() => setMobileOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <NavLinks route={route} collapsed={false} onNavigate={() => setMobileOpen(false)} />
            <a href="#/start" onClick={() => setMobileOpen(false)} className="m-2 flex h-10 items-center gap-3 rounded-lg px-3 text-fog hover:text-snow">
              <Rocket size={18} /> Get started
            </a>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main
          data-ready={firstLoad ? "false" : "true"}
          className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
        <footer className="border-t border-edge px-4 py-4 text-[12px] text-fog sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1320px] flex-wrap justify-between gap-2">
            <span>
              Built for NEAR HACKATHON 2026. Live data from {NETWORK_LABEL}; the bakery and its suppliers are sample data.
            </span>
            <a className="underline hover:text-snow" href={GITHUB_URL}>
              Source code (MIT)
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ top bar

function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-edge bg-night/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button className="rounded p-1.5 text-fog hover:text-snow lg:hidden" aria-label="Open menu" onClick={onMenu}>
        <Menu size={20} />
      </button>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-2">
        <StatusPill />
        <span className="hidden items-center gap-1.5 rounded-full border border-edge px-2.5 py-1 text-[12px] text-mist md:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-water" />
          {NETWORK_LABEL}
        </span>
        <Notifications />
        <AccountMenu />
      </div>
    </header>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  protected: "secure",
  attention: "caution",
  paused: "ice",
  unknown: "neutral",
};

function StatusPill() {
  const { snapshots } = useVaults();
  const status = overallStatus(snapshots);
  return (
    <a
      href="#/threats"
      title={status.detail}
      className="hidden items-center gap-1.5 rounded-full border border-edge px-2.5 py-1 text-[12px] text-mist hover:text-snow sm:inline-flex"
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", TONE_DOT[STATUS_TONE[status.level] ?? "neutral"])} />
      {status.label}
    </a>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

interface SearchHit {
  key: string;
  label: string;
  detail: string;
  href: string;
}

function GlobalSearch() {
  const { snapshots } = useVaults();
  const [text, setText] = useState("");
  const { open, setOpen, ref } = usePopover();

  const hits = useMemo<SearchHit[]>(() => {
    const q = text.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: SearchHit[] = [];
    const accounts = new Set<string>();
    for (const snap of snapshots) {
      const name = agentName(snap.id);
      if (snap.id.includes(q) || name.toLowerCase().includes(q) || snap.data?.status.agent_id.includes(q)) {
        out.push({ key: `agent:${snap.id}`, label: name, detail: "AI agent", href: `#/agents/${encodeURIComponent(snap.id)}` });
      }
      const data = snap.data;
      if (!data) continue;
      for (const id of [...data.lists.allowlist, ...data.lists.blocklist, ...data.lists.reported]) accounts.add(id);
      for (const entry of data.activity) {
        if (entry.receiver_id) accounts.add(entry.receiver_id);
      }
      for (const entry of data.activity) {
        if (out.length > 12) break;
        if (entry.message.toLowerCase().includes(q)) {
          out.push({
            key: `event:${snap.id}:${entry.id}`,
            label: entry.message,
            detail: `${KIND[entry.kind].label}, ${ago(entry.at_ms)}`,
            href: `#/audit?q=${encodeURIComponent(text.trim())}`,
          });
        }
      }
    }
    for (const account of accounts) {
      if (account.includes(q)) {
        out.unshift({
          key: `account:${account}`,
          label: account,
          detail: "Account: see its transactions",
          href: `#/transactions?q=${encodeURIComponent(account)}`,
        });
      }
    }
    return out.slice(0, 8);
  }, [text, snapshots]);

  return (
    <div ref={ref} className="relative w-full max-w-[420px]">
      <label className="relative block">
        <span className="sr-only">Search agents, accounts and events</span>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog" />
        <input
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && text.trim()) {
              go(`transactions?q=${encodeURIComponent(text.trim())}`);
              setOpen(false);
            }
          }}
          placeholder="Search agents, accounts, events"
          className="h-9 w-full rounded-lg border border-edge bg-raised pl-9 pr-3 text-sm text-snow placeholder:text-fog/80 focus:border-water/60 focus:outline-none"
        />
      </label>
      {open && text.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-lg border border-edge bg-raised shadow-2xl shadow-black/50">
          {hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-fog">Nothing matches "{text.trim()}" in the watched vaults.</p>
          ) : (
            <ul>
              {hits.map((hit) => (
                <li key={hit.key}>
                  <a
                    href={hit.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-edge px-4 py-2.5 last:border-0 hover:bg-white/[0.04]"
                  >
                    <span className="block truncate text-sm text-snow">{hit.label}</span>
                    <span className="block text-[12px] text-fog">{hit.detail}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const SEEN_KEY = "phishbowl.seen";

function loadSeen(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function Notifications() {
  const { snapshots } = useVaults();
  const { open, setOpen, ref } = usePopover();
  const [seen, setSeen] = useState<Record<string, number>>(loadSeen);

  const items = useMemo(() => {
    const list: Array<{ key: string; tone: Tone; text: string; detail: string; href: string; fresh: boolean; at: number }> = [];
    for (const snap of snapshots) {
      const data = snap.data;
      if (!data) continue;
      for (const payment of data.pending) {
        list.push({
          key: `${snap.id}:p:${payment.id}`,
          tone: "caution",
          text: `${near(payment.amount)} to ${payment.receiver_id} needs your approval`,
          detail: agentName(snap.id),
          href: "#/transactions?state=Pending",
          fresh: true,
          at: payment.created_at_ms,
        });
      }
      for (const entry of data.activity) {
        const severity = severityOf(entry);
        if (severity !== "critical" && severity !== "high" && entry.kind !== "Frozen") continue;
        list.push({
          key: `${snap.id}:e:${entry.id}`,
          tone: KIND[entry.kind].tone,
          text: entry.message,
          detail: `${agentName(snap.id)}, ${ago(entry.at_ms)}`,
          href: "#/threats",
          fresh: entry.id > (seen[snap.id] ?? -1),
          at: entry.at_ms,
        });
      }
    }
    return list.sort((a, b) => b.at - a.at).slice(0, 12);
  }, [snapshots, seen]);

  const unread = items.filter((item) => item.fresh).length;

  function markRead() {
    const next: Record<string, number> = { ...seen };
    for (const snap of snapshots) {
      const latest = snap.data?.activity[0]?.id;
      if (latest !== undefined) next[snap.id] = latest;
    }
    setSeen(next);
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      // Not fatal.
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-fog hover:bg-white/5 hover:text-snow"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-night">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-edge bg-raised shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button className="text-[12px] text-fog underline hover:text-snow" onClick={markRead}>
                Mark all as read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-fog">Nothing needs you right now.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {items.map((item) => (
                <li key={item.key}>
                  <a href={item.href} onClick={() => setOpen(false)} className="flex gap-3 border-b border-edge px-4 py-3 last:border-0 hover:bg-white/[0.04]">
                    <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", item.fresh ? TONE_DOT[item.tone] : "bg-edge")} />
                    <span className="min-w-0">
                      <span className="line-clamp-2 block text-[13px] text-snow">{item.text}</span>
                      <span className="block text-[12px] text-fog">{item.detail}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { signedAccountId, signIn, signOut, loading } = useNearWallet();
  const { snapshots } = useVaults();
  const { open, setOpen, ref } = usePopover();
  if (!signedAccountId) {
    return (
      <Button variant="primary" size="sm" disabled={loading} onClick={() => void signIn()}>
        <Wallet size={15} />
        <span className="hidden sm:inline">Connect wallet</span>
      </Button>
    );
  }
  const owned = snapshots.filter((s) => s.data?.status.owner_id === signedAccountId).length;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex h-9 max-w-[11rem] items-center gap-2 rounded-lg border border-edge bg-raised px-2.5 text-sm hover:border-fog/60"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-water/20 text-[11px] font-bold text-water">
          {signedAccountId.slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate">{signedAccountId}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-64 rounded-lg border border-edge bg-raised p-2 shadow-2xl shadow-black/50">
          <div className="px-2 py-2">
            <p className="text-[12px] text-fog">Signed in with NEAR wallet</p>
            <p className="truncate text-sm font-semibold">{signedAccountId}</p>
            <p className="mt-1 text-[12px] text-fog">
              {owned ? `Owner of ${owned} watched vault${owned === 1 ? "" : "s"}.` : "Not the owner of any watched vault."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-mist hover:bg-white/5 hover:text-snow"
          >
            <LogOut size={15} /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
