import { useEffect, useState } from "react";

export type Page =
  | "overview"
  | "agents"
  | "agent"
  | "wallet"
  | "spending"
  | "threats"
  | "reputation"
  | "transactions"
  | "audit"
  | "integrations"
  | "settings"
  | "start"
  | "create";

export interface Route {
  page: Page;
  param?: string;
  query: URLSearchParams;
}

const PAGES: Page[] = [
  "overview",
  "agents",
  "wallet",
  "spending",
  "threats",
  "reputation",
  "transactions",
  "audit",
  "integrations",
  "settings",
  "start",
  "create",
];

export function parseHash(hash: string): Route {
  const [path = "", search = ""] = hash.replace(/^#\/?/, "").split("?");
  const [first = "", second] = path.split("/");
  const query = new URLSearchParams(search);
  if (first === "agents" && second) return { page: "agent", param: decodeURIComponent(second), query };
  const page = (PAGES as string[]).includes(first) ? (first as Page) : "overview";
  return { page, query };
}

export function useRoute(): Route {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return parseHash(hash);
}

export function go(path: string): void {
  window.location.hash = path.startsWith("#") ? path : `#/${path.replace(/^\//, "")}`;
}
