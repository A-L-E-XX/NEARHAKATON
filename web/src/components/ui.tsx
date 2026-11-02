import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import type { Tone } from "../lib/derive";
import { useVaults } from "../lib/store";
import { AGENT_NAMES } from "../config";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const TONE_PILL: Record<Tone, string> = {
  secure: "bg-secure/10 text-secure ring-secure/25",
  caution: "bg-caution/10 text-caution ring-caution/25",
  danger: "bg-danger/10 text-danger ring-danger/30",
  ice: "bg-ice/10 text-ice ring-ice/30",
  neutral: "bg-white/5 text-mist ring-white/10",
  brand: "bg-water/10 text-water ring-water/25",
};

export const TONE_TEXT: Record<Tone, string> = {
  secure: "text-secure",
  caution: "text-caution",
  danger: "text-danger",
  ice: "text-ice",
  neutral: "text-mist",
  brand: "text-water",
};

export const TONE_DOT: Record<Tone, string> = {
  secure: "bg-secure",
  caution: "bg-caution",
  danger: "bg-danger",
  ice: "bg-ice",
  neutral: "bg-fog",
  brand: "bg-water",
};

export function Badge({ tone, children, icon }: { tone: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        TONE_PILL[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost" | "ice";

const VARIANT: Record<Variant, string> = {
  primary: "bg-snow text-night hover:bg-white",
  secondary: "border border-edge bg-raised text-snow hover:border-fog/60",
  danger: "bg-danger/15 text-danger ring-1 ring-inset ring-danger/40 hover:bg-danger/25",
  ghost: "text-mist hover:bg-white/5 hover:text-snow",
  ice: "bg-ice/15 text-ice ring-1 ring-inset ring-ice/40 hover:bg-ice/25",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("min-w-0 rounded-xl border border-edge bg-panel", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-edge px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-snow">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-fog">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClassName ?? "p-5"}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-snow sm:text-[22px]">{title}</h1>
        {description && <p className="mt-1 max-w-[70ch] text-sm text-fog">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Progress({ value, max, tone = "brand" }: { value: number; max: number; tone?: Tone }) {
  const share = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]" role="presentation">
      <div className={cx("h-full rounded-full", TONE_DOT[tone])} style={{ width: `${share}%` }} />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-edge px-4 py-8 text-center">
      <p className="text-sm font-semibold text-mist">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-[52ch] text-[13px] text-fog">{children}</div>}
    </div>
  );
}

export function Loading({ label = "Reading from NEAR testnet" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-6 text-sm text-fog" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-edge border-t-water" />
      {label}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
      {children}
    </div>
  );
}

export function agentName(vaultId: string): string {
  return AGENT_NAMES[vaultId]?.name ?? vaultId;
}

/** Lets pages that work on one vault pick which one, when more than one is watched. */
export function VaultPicker() {
  const { watched, selectedId, select } = useVaults();
  if (watched.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-[13px] text-fog">
      Agent
      <select
        className="h-9 rounded-lg border border-edge bg-raised px-2 text-sm text-snow"
        value={selectedId}
        onChange={(event) => select(event.target.value)}
      >
        {watched.map((id) => (
          <option key={id} value={id}>
            {agentName(id)}
          </option>
        ))}
      </select>
    </label>
  );
}

// ------------------------------------------------------------------ dialogs

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx("w-full rounded-xl border border-edge bg-panel shadow-2xl shadow-black/50", wide ? "max-w-2xl" : "max-w-lg")}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-edge px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button ref={closeRef} className="rounded p-1 text-fog hover:text-snow" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 text-sm text-mist">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-edge px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full max-w-md flex-col border-l border-edge bg-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-edge px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="rounded p-1 text-fog hover:text-snow" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">{children}</div>
      </aside>
    </div>
  );
}

export function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-b border-edge py-2.5 text-[13px] last:border-0">
      <dt className="text-fog">{label}</dt>
      <dd className={cx("min-w-0 break-words text-snow", mono && "tabular")}>{value}</dd>
    </div>
  );
}

// ------------------------------------------------------------------- toasts

interface Toast {
  id: number;
  tone: Tone;
  text: string;
}

const ToastContext = createContext<(toast: Omit<Toast, "id">) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 6000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-lg border border-edge bg-raised px-4 py-3 text-sm text-snow shadow-xl shadow-black/40"
          >
            <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE_DOT[toast.tone])} />
            <span className="min-w-0 flex-1">{toast.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
