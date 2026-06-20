import { useState, type ReactNode } from "react";
import type { CliStatus } from "@shared/cli-status";
import type { Account } from "@shared/types";
import { OverlayScroll } from "../ui/OverlayScroll";
import { Icon } from "../ui/icons";
import type { IconName } from "../ui/icon-names";
import { Wordmark, cx } from "../ui/atoms";
import { footerView, type FooterView } from "../ui/rail-footer";

type Section = "system" | "account" | "appearance" | "about";

const NAV: { key: Section; label: string; icon: IconName }[] = [
  { key: "system", label: "System", icon: "monitor" },
  { key: "account", label: "Account", icon: "circle-user" },
  { key: "appearance", label: "Appearance", icon: "palette" },
  { key: "about", label: "About", icon: "info" },
];

// Lamp dot tone, mirroring the title-bar Sys lamp (GlobalHeader): green ok, amber warn, red error, slate
// pre-check. One source of truth would be nicer; kept local until the Sys-lamp rewire folds them together.
const DOT_CLASS: Record<FooterView["dot"], string> = {
  ok: "bg-working",
  warn: "bg-accent",
  error: "bg-danger",
  idle: "bg-ink-600",
};

/**
 * The Settings view: a full Workspace-pane view (like the Overview) reached from the title-bar gear. A left
 * sub-nav switches between System (CLI/engine health), Account (identity + limits), Appearance, and About.
 * System and Account read the live cliStatus/account already on hand; the deeper CLI detail list and the
 * rate gauges land in later slices.
 */
export function SettingsView({
  cliStatus,
  account,
  checking,
  onRecheck,
}: {
  cliStatus: CliStatus | null;
  account: Account | null;
  checking: boolean;
  onRecheck: () => void;
}) {
  const [section, setSection] = useState<Section>("system");
  const cliDot = footerView(cliStatus).dot;
  const cliTrips = cliDot === "warn" || cliDot === "error";

  return (
    <div className="flex h-full min-w-0 flex-1 bg-ink-950 text-fg">
      <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-ink-800 px-2 py-4">
        <div className="px-2.5 pb-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-faint">
          Settings
        </div>
        {NAV.map((n) => {
          const active = section === n.key;
          return (
            <button
              key={n.key}
              type="button"
              onClick={() => setSection(n.key)}
              className={cx(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
                active
                  ? "bg-ink-900 text-fg"
                  : "text-fg-muted hover:bg-ink-900/50 hover:text-fg",
              )}
            >
              <Icon
                name={n.icon}
                size={15}
                className="shrink-0 text-fg-faint"
              />
              <span className="flex-1">{n.label}</span>
              {n.key === "system" && cliTrips && (
                <span
                  className={cx(
                    "h-1.5 w-1.5 rounded-full",
                    cliDot === "error" ? "bg-danger" : "bg-accent",
                  )}
                />
              )}
            </button>
          );
        })}
      </nav>

      <OverlayScroll className="min-w-0 flex-1">
        <div className="mx-auto flex max-w-[640px] flex-col gap-5 px-8 py-7">
          {section === "system" && (
            <SystemSection
              cliStatus={cliStatus}
              checking={checking}
              onRecheck={onRecheck}
            />
          )}
          {section === "account" && <AccountSection account={account} />}
          {section === "appearance" && <AppearanceSection />}
          {section === "about" && <AboutSection />}
        </div>
      </OverlayScroll>
    </div>
  );
}

function Header({ title, lede }: { title: string; lede?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="font-display text-xl font-semibold tracking-tight text-fg">
        {title}
      </h1>
      {lede && (
        <p className="max-w-[54ch] text-[12.5px] leading-relaxed text-fg-muted">
          {lede}
        </p>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-800 bg-ink-925">
      <div className="border-b border-ink-850 px-4 py-2.5 font-display text-[11px] font-semibold uppercase tracking-[0.13em] text-fg-faint">
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink-850 px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[13px] text-fg">{label}</div>
        {desc && (
          <div className="mt-0.5 text-[11.5px] text-fg-faint">{desc}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** A muted, bordered "locked"/status pill. */
function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-ink-700 px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
      {children}
    </span>
  );
}

function SystemSection({
  cliStatus,
  checking,
  onRecheck,
}: {
  cliStatus: CliStatus | null;
  checking: boolean;
  onRecheck: () => void;
}) {
  const v = footerView(cliStatus);
  return (
    <>
      <Header
        title="System"
        lede="code-by-wire reads sessions through the Claude Code CLI and your local transcripts. This is the engine. Keep it green."
      />
      <Card title="Claude Code CLI">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className={cx("h-2.5 w-2.5 rounded-full", DOT_CLASS[v.dot])} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-fg">
              {v.version ? `Claude Code v${v.version}` : "Claude Code"}
            </div>
            <div className="mt-0.5 text-[11.5px] capitalize text-fg-faint">
              {v.statusLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={onRecheck}
            disabled={checking || cliStatus === null}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1 text-[12px] text-fg-muted transition-colors hover:border-ink-600 hover:text-fg disabled:opacity-40"
          >
            <Icon
              name="rotate-ccw"
              size={13}
              className={checking ? "animate-spin" : ""}
            />
            Recheck
          </button>
        </div>
      </Card>
    </>
  );
}

function AccountSection({ account }: { account: Account | null }) {
  const mode = account?.billingMode;
  const modeLabel =
    mode === "subscription"
      ? "Subscription"
      : mode === "api"
        ? "API"
        : "Unknown";
  return (
    <>
      <Header
        title="Account"
        lede="Who code-by-wire reads usage for. Identity comes from ~/.claude; rate limits ride the live status capture."
      />
      <Card title="Identity">
        <Row label="Signed in" desc="Read from ~/.claude">
          <span className="font-mono text-[12px] text-fg">
            {account?.email ?? "—"}
          </span>
        </Row>
        <Row label="Billing" desc="Detected from rate-limit presence">
          <span className="text-[12.5px] text-fg">{modeLabel}</span>
        </Row>
      </Card>
    </>
  );
}

function AppearanceSection() {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  return (
    <>
      <Header
        title="Appearance"
        lede="The look is fixed to the Instrument theme. The comfort settings follow your system."
      />
      <Card title="Theme">
        <Row
          label="Theme"
          desc="Dark glass-cockpit; color reserved for live state"
        >
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] text-fg">Instrument · dark</span>
            <Pill>locked</Pill>
          </div>
        </Row>
        <Row label="Reduce motion" desc="Follows your system setting">
          <span className="text-[12.5px] text-fg-muted">
            {reduceMotion ? "On" : "Off"}
          </span>
        </Row>
      </Card>
    </>
  );
}

function AboutSection() {
  return (
    <>
      <Header title="About" />
      <Card title="code-by-wire">
        <div className="flex flex-col gap-3 px-4 py-4">
          <Wordmark />
          <p className="max-w-[54ch] text-[12.5px] leading-relaxed text-fg-muted">
            A fly-by-wire cockpit for your Claude Code sessions. Observe,
            manage, and review every run from one instrument panel.
          </p>
          <div className="font-mono text-[11.5px] text-fg-faint">
            github.com/luojiahai/code-by-wire
          </div>
        </div>
      </Card>
    </>
  );
}
