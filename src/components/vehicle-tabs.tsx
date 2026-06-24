"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Fuel,
  Gauge,
  Wrench,
  Sparkles,
  Images,
  BellRing,
  Settings,
  CircleDot,
  Route,
  Zap,
  FolderOpen,
  Receipt,
  Menu,
  X,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Per-vehicle optional features that, when enabled, add an extra tab.
export type VehicleFeatures = {
  tires?: boolean;
  trips?: boolean;
  charging?: boolean;
  // Whether the fuel ("Tankbuch") tab is shown. Hidden for pure EVs (charging
  // on, not a hybrid); defaults to shown when omitted.
  fuel?: boolean;
};

type Tab = { href: string; label: string; short: string; icon: LucideIcon };

export function VehicleTabs({
  vehicleId,
  showSettings = true,
  features = {},
}: {
  vehicleId: string;
  showSettings?: boolean;
  features?: VehicleFeatures;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const base = `/vehicles/${vehicleId}`;

  const showFuel = features.fuel ?? true;

  const tabs: Tab[] = [
    { href: base, label: "Dashboard", short: "Start", icon: LayoutDashboard },
    // Fuel and charging sit side by side right after the dashboard so the most
    // relevant "filling up" tab stays among the mobile primaries per powertrain.
    ...(showFuel
      ? [{ href: `${base}/fuel`, label: "Tankbuch", short: "Tanken", icon: Fuel }]
      : []),
    ...(features.charging
      ? [{ href: `${base}/charging`, label: "Laden", short: "Laden", icon: Zap }]
      : []),
    { href: `${base}/mileage`, label: "Kilometer", short: "km", icon: Gauge },
    { href: `${base}/repairs`, label: "Reparaturen", short: "Reparatur", icon: Wrench },
    { href: `${base}/cleaning`, label: "Pflege", short: "Pflege", icon: Sparkles },
    // Optional, per-vehicle tabs.
    ...(features.tires
      ? [{ href: `${base}/tires`, label: "Reifen", short: "Reifen", icon: CircleDot }]
      : []),
    ...(features.trips
      ? [{ href: `${base}/trips`, label: "Fahrtenbuch", short: "Fahrten", icon: Route }]
      : []),
    { href: `${base}/costs`, label: "Kosten", short: "Kosten", icon: Receipt },
    { href: `${base}/documents`, label: "Dokumente", short: "Doku", icon: FolderOpen },
    { href: `${base}/gallery`, label: "Galerie", short: "Bilder", icon: Images },
    { href: `${base}/reminders`, label: "Termine", short: "Termine", icon: BellRing },
    // Settings (incl. sharing, export, delete) are owner-only.
    ...(showSettings
      ? [{ href: `${base}/settings`, label: "Einstellungen", short: "Mehr", icon: Settings }]
      : []),
  ];

  // Mobile: keep the bottom bar uncluttered — only the three most-used tabs,
  // everything else lives behind a "Mehr" menu.
  const primary = tabs.slice(0, 3);
  const more = tabs.slice(3);
  const moreActive = more.some((t) => pathname === t.href);

  return (
    <>
      {/* Desktop / tablet: single-row tab bar that collapses overflow into a
          "Mehr" dropdown instead of scrolling sideways or wrapping. */}
      <DesktopTabs tabs={tabs} pathname={pathname} />

      {/* Mobile: backdrop + "Mehr" menu panel */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      {menuOpen && (
        <div className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 grid grid-cols-2 gap-1 rounded-xl border border-border bg-background/95 p-2 shadow-lg backdrop-blur-md sm:hidden">
          {more.map((t) => {
            const active = pathname === t.href;
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span className="truncate">{t.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Mobile: fixed bottom navigation (3 primary tabs + "Mehr") */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        {primary.map((t) => {
          const active = pathname === t.href;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" />
              <span className="max-w-full truncate">{t.short}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
            menuOpen || moreActive ? "text-primary" : "text-muted-foreground"
          )}
          aria-label="Weitere Tabs"
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          <span>Mehr</span>
        </button>
      </nav>
    </>
  );
}

const tabClass = (active: boolean) =>
  cn(
    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-primary/15 text-primary"
      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
  );

/**
 * Desktop tab bar. Renders as many tabs inline as fit on one row and tucks the
 * rest into a right-aligned "Mehr" dropdown. The fit is measured with a hidden
 * mirror of all tabs and recomputed on resize, so it adapts to any width and
 * to the per-vehicle set of optional tabs without ever scrolling or wrapping.
 */
function DesktopTabs({ tabs, pathname }: { tabs: Tab[]; pathname: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(tabs.length);
  const [open, setOpen] = useState(false);

  // A stable key for the current tab set so the measure effect re-runs when the
  // optional tabs change (e.g. toggling a feature).
  const tabsKey = tabs.map((t) => t.href).join("|");

  useLayoutEffect(() => {
    const compute = () => {
      const container = containerRef.current;
      const measure = measureRef.current;
      if (!container || !measure) return;

      const children = Array.from(measure.children) as HTMLElement[];
      // Last measured child is the "Mehr" button; the rest mirror the tabs.
      const moreWidth = children[children.length - 1]?.offsetWidth ?? 0;
      const itemWidths = children.slice(0, tabs.length).map((c) => c.offsetWidth);
      const gap = 4; // matches gap-1
      const available = container.clientWidth;

      // How many fit if we show all of them (no "Mehr" needed)?
      let widthAll = 0;
      for (let i = 0; i < itemWidths.length; i++) {
        widthAll += itemWidths[i] + (i > 0 ? gap : 0);
      }
      if (widthAll <= available) {
        setVisibleCount(tabs.length);
        return;
      }

      // Otherwise reserve room for the "Mehr" button and fit what we can.
      let used = moreWidth + gap;
      let count = 0;
      for (let i = 0; i < itemWidths.length; i++) {
        const next = itemWidths[i] + (count > 0 ? gap : 0);
        if (used + next <= available) {
          used += next;
          count++;
        } else break;
      }
      setVisibleCount(Math.max(1, count));
    };

    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsKey]);

  // Close the dropdown after navigating.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const visible = tabs.slice(0, visibleCount);
  const overflow = tabs.slice(visibleCount);
  const overflowActive = overflow.some((t) => pathname === t.href);

  return (
    <div className="relative hidden sm:block">
      <nav
        ref={containerRef}
        className="flex items-center gap-1 rounded-xl border border-border bg-card/50 p-1"
      >
        {visible.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} className={tabClass(pathname === t.href)}>
              <Icon className="size-4" />
              <span>{t.label}</span>
            </Link>
          );
        })}

        {overflow.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={cn(tabClass(overflowActive || open), "ml-auto")}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <Menu className="size-4" />
            <span>Mehr</span>
            <ChevronDown
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
            />
          </button>
        )}
      </nav>

      {open && overflow.length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 flex min-w-44 flex-col gap-1 rounded-xl border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur-md">
            {overflow.map((t) => {
              const Icon = t.icon;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  onClick={() => setOpen(false)}
                  className={tabClass(pathname === t.href)}
                >
                  <Icon className="size-4" />
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Hidden mirror used only to measure intrinsic tab widths. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 flex gap-1"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <span key={t.href} className={tabClass(false)}>
              <Icon className="size-4" />
              <span>{t.label}</span>
            </span>
          );
        })}
        <span className={tabClass(false)}>
          <Menu className="size-4" />
          <span>Mehr</span>
          <ChevronDown className="size-3.5" />
        </span>
      </div>
    </div>
  );
}
