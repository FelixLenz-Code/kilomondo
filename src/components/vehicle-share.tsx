"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, UserPlus, X, Search } from "lucide-react";
import {
  searchUsersAction,
  shareVehicleAction,
  updateShareRoleAction,
  unshareVehicleAction,
  type ShareUser,
  type VehicleShareView,
} from "@/actions/shares";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Role = "VIEWER" | "EDITOR";

const roleLabel: Record<Role, string> = {
  EDITOR: "Bearbeiter",
  VIEWER: "Betrachter",
};

export function VehicleShare({
  vehicleId,
  initialShares,
}: {
  vehicleId: string;
  initialShares: VehicleShareView[];
}) {
  const [shares, setShares] = useState<VehicleShareView[]>(initialShares);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ShareUser[]>([]);
  const [newRole, setNewRole] = useState<Role>("EDITOR");
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [pending, startMutate] = useTransition();
  const reqId = useRef(0);

  // Debounced user search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(() => {
      startSearch(async () => {
        const found = await searchUsersAction(vehicleId, q);
        // Ignore out-of-order responses.
        if (id === reqId.current) setResults(found);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query, vehicleId]);

  function add(user: ShareUser) {
    setError(null);
    startMutate(async () => {
      const res = await shareVehicleAction(vehicleId, user.id, newRole);
      if (res.error) {
        setError(res.error);
        return;
      }
      setShares((prev) => [
        ...prev.filter((s) => s.id !== user.id),
        { ...user, role: newRole },
      ]);
      setQuery("");
      setResults([]);
    });
  }

  function changeRole(userId: string, role: Role) {
    setShares((prev) => prev.map((s) => (s.id === userId ? { ...s, role } : s)));
    startMutate(async () => {
      await updateShareRoleAction(vehicleId, userId, role);
    });
  }

  function remove(userId: string) {
    setShares((prev) => prev.filter((s) => s.id !== userId));
    startMutate(async () => {
      await unshareVehicleAction(vehicleId, userId);
    });
  }

  return (
    <div className="space-y-5">
      {/* Search + add */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nutzer per E-Mail oder Name suchen …"
              className="pl-9"
            />
          </div>
          <Select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as Role)}
            className="w-36"
          >
            <option value="EDITOR">Bearbeiter</option>
            <option value="VIEWER">Betrachter</option>
          </Select>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {query.trim().length >= 2 && (
          <div className="rounded-lg border border-border/60 bg-background/40">
            {searching ? (
              <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Suche …
              </p>
            ) : results.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                Keine passenden Nutzer gefunden.
              </p>
            ) : (
              results.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 border-b border-border/40 p-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => add(u)}
                  >
                    <UserPlus className="size-4" /> Hinzufügen
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Current shares */}
      <div className="space-y-2">
        {shares.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch mit niemandem geteilt.
          </p>
        ) : (
          shares.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{s.name}</p>
                <p className="truncate text-sm text-muted-foreground">{s.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={s.role}
                  onChange={(e) => changeRole(s.id, e.target.value as Role)}
                  disabled={pending}
                  className="w-36"
                  aria-label={`Rolle für ${s.name}`}
                >
                  <option value="EDITOR">{roleLabel.EDITOR}</option>
                  <option value="VIEWER">{roleLabel.VIEWER}</option>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  onClick={() => remove(s.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`${s.name} entfernen`}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
