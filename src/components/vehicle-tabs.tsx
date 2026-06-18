"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Fuel,
  Gauge,
  Wrench,
  Sparkles,
  Images,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function VehicleTabs({ vehicleId }: { vehicleId: string }) {
  const pathname = usePathname();
  const base = `/vehicles/${vehicleId}`;

  const tabs = [
    { href: base, label: "Dashboard", short: "Start", icon: LayoutDashboard },
    { href: `${base}/fuel`, label: "Tankbuch", short: "Tanken", icon: Fuel },
    { href: `${base}/mileage`, label: "Kilometer", short: "km", icon: Gauge },
    { href: `${base}/repairs`, label: "Reparaturen", short: "Reparatur", icon: Wrench },
    { href: `${base}/cleaning`, label: "Pflege", short: "Pflege", icon: Sparkles },
    { href: `${base}/gallery`, label: "Galerie", short: "Bilder", icon: Images },
    { href: `${base}/settings`, label: "Einstellungen", short: "Mehr", icon: Settings },
  ];

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

      {/* Mobile: fixed bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        {tabs.map((t) => {
          const active = pathname === t.href;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
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
      </nav>
    </>
  );
}
