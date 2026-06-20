"use client";

import { useState } from "react";
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
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function VehicleTabs({
  vehicleId,
  showSettings = true,
}: {
  vehicleId: string;
  showSettings?: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const base = `/vehicles/${vehicleId}`;

  const tabs = [
    { href: base, label: "Dashboard", short: "Start", icon: LayoutDashboard },
    { href: `${base}/fuel`, label: "Tankbuch", short: "Tanken", icon: Fuel },
    { href: `${base}/mileage`, label: "Kilometer", short: "km", icon: Gauge },
    { href: `${base}/repairs`, label: "Reparaturen", short: "Reparatur", icon: Wrench },
    { href: `${base}/cleaning`, label: "Pflege", short: "Pflege", icon: Sparkles },
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
      {/* Desktop / tablet: inline tab bar */}
      <nav className="hidden gap-1 overflow-x-auto rounded-xl border border-border bg-card/50 p-1 sm:flex">
        {tabs.map((t) => {
          const active = pathname === t.href;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile: backdrop + "Mehr" menu panel */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      {menuOpen && (
        <div className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 flex flex-col gap-1 rounded-xl border border-border bg-background/95 p-2 shadow-lg backdrop-blur-md sm:hidden">
          {more.map((t) => {
            const active = pathname === t.href;
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3.5 text-base font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon className="size-5" />
                <span>{t.label}</span>
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
