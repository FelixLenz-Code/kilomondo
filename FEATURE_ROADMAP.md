# Feature-Roadmap (Kilomondo)

Fortschritt der am 2026-06-23 beauftragten Features. Reihenfolge nach Nutzerpriorität.
Status: ⬜ offen · 🟨 in Arbeit · ✅ fertig

> Erledigt (2026-06-24): carlog-DB lief, die 7 Migrationen wurden via
> `prisma migrate deploy` angewandt, Features durchgeklickt und in v0.18.0
> released. Lokaler Dev braucht Port 5432 frei (kollidierte zeitweise mit
> `finance_tracker-db-1`) und einen `docker-compose.override.yml`, der den
> db-Port veröffentlicht (gitignored).

| # | Feature | Optional? | Status |
|---|---------|-----------|--------|
| 1 | Kosten-Cockpit (TCO) ausbauen | nein | ✅ |
| 1b | Steuer/Versicherung als echte Kosten | nein | ✅ |
| 2 | Reifen-/Räderverwaltung | ja (`tireTracking`) | ✅ |
| 3 | Daten-Export (CSV) & Backup/Import | nein | ✅ |
| 3b | CSV-Import (Spritmonitor/Fuelio) | nein | ✅ |
| 4 | Dokumente / Handschuhfach | nein | ✅ |
| 5 | Fahrtenbuch | ja (`tripLogging`) | ✅ |
| 6 | Leasing-/Finanzierungs-Tracking | ja (`leasingTracking`) | ✅ |
| 7 | Beleg-Scan / OCR | — (bereits vorhanden) | ✅ |
| 8 | EV-Lade-Tracking | ja (`evTracking`) | ✅ |

**Released in v0.18.0 (2026-06-24):** Alle Features (1, 1b, 2, 3, 3b, 4, 5, 6, 7, 8)
umgesetzt, committet, getaggt und veröffentlicht. `npx tsc --noEmit` und
`npx next build` fehlerfrei; die 7 Migrationen wurden lokal via
`prisma migrate deploy` angewandt. Der PDF-Report enthält Ausgaben, Reifen,
Fahrtenbuch, Laden, Dokumente und Leasing und richtet die Kennzahlen am Antrieb
aus. GitHub-Release + GHCR-Image stehen.

Nach dem ursprünglichen Auftrag noch ergänzt:
- **Antriebsabhängige Tabs:** reiner EV blendet das Tankbuch aus, Hybrid zeigt
  Tanken + Laden (Logik aus `vehicle.fuelType` + `evTracking`).
- **Neue Desktop-Nav-Bar:** überzählige Tabs klappen in ein „Mehr"-Dropdown
  (gemessen per ResizeObserver) statt seitwärts zu scrollen.
- **Vollständiges ZIP-Backup (Version 4):** jetzt auch Datei-Anhänge
  (`Attachment`: Dokument-Scans + Reparatur-Rechnungen) im Export/Import;
  Round-Trip verifiziert (sha256-Byte-Gleichheit).

**Released in v0.19.0 (2026-06-24): Profiltiefe-Verlauf bei Reifen.**
- Neues Modell `TireMeasurement` (Datum, `treadDepthMm`, optional `odometer`,
  Notiz; Relation zu Vehicle + TireSet, beide `onDelete: Cascade`).
  Migration `20260624110000_add_tire_measurements`.
- `lib/tires.ts` `tireWearSeries` baut Chart-Daten (eine Linie je Radsatz auf
  gemeinsamer Zeitachse). Chart `components/charts/tire-wear-chart.tsx`
  (recharts, 1,6-mm-`ReferenceLine`).
- Validation `tireMeasurementSchema`; Actions `create/deleteTireMeasurementAction`
  mit `syncSetTreadDepth` (hält `TireSet.treadDepthMm` = neueste Messung).
- Form `TireMeasurementForm` + zwei neue Karten auf der Reifen-Seite
  („Profiltiefe messen", „Profil-Verlauf" mit Chart + Mess-Liste).
- Export: ZIP (Round-Trip verifiziert) + CSV `reifenprofil.csv`. PDF unverändert
  (zeigt weiterhin die – jetzt synchronisierte – aktuelle Profiltiefe).

**Released in v0.20.0 (2026-06-24): Reifen-Verschleiß-Reminder + Dashboard-Graph.**
- Pro Radsatz `wearAlertMm`-Schwelle → verknüpfter `Reminder` (`source: "TIRE"`),
  den der Scheduler über die Profiltiefe-Messungen (`latestMinTread`) feuert.

**Released in v0.21.0 (2026-06-24): Reifen-Reminder sauber in den Terminen.**
- Der Verschleiß-Reminder erscheint jetzt im Termine-Tab mit eigenem Badge
  „Reifen" und sinnvollem Text (aktuelle Profiltiefe + Warnschwelle in mm) statt
  der irreführenden „28 Tage Vorlauf"-Zeile (er hat kein Fälligkeitsdatum).
- In der Liste read-only: kein generisches Bearbeiten/Löschen/Pausieren (würde
  den vom Radsatz verwalteten Eintrag zerschießen), stattdessen ein „Reifen"-Link
  zum Reifen-Tab. `reminders/page.tsx` lädt dazu die per `reminderId` verknüpften
  Radsätze + Messungen.

### Offen / Folgeschritte
- Nicht beauftragt, aber denkbar: CSV-Import auch für Reparaturen/Pflege;
  wiederkehrende Fixkosten automatisch fortschreiben.

---

## Konventionen (aus bestehendem Code abgeleitet)

- **Optional-Toggles** wie `adblueTracking`: Boolean auf `Vehicle`, im `vehicleSchema`
  (`src/lib/validation.ts`), in `parseVehicle` (`src/actions/vehicles.ts`) und als
  Checkbox in `src/components/forms/vehicle-form.tsx`.
- **Neue Entry-Typen** folgen dem Muster Fuel/Repair: Prisma-Model →
  Zod-Schema → Server-Actions (`create/update/delete`, `assertCanEdit`,
  `notifyActivity`, `revalidatePath`) → Tab-Route unter
  `src/app/(app)/vehicles/[id]/<name>/page.tsx` → Form in `entry-forms.tsx` →
  Eintrag im Tab-Array von `src/components/vehicle-tabs.tsx`.
- Optionale Tabs nur zeigen, wenn der jeweilige Toggle aktiv ist (Tabs-Komponente
  muss die Flags vom Server bekommen).
- Export (`src/lib/vehicle-transfer.ts`) und PDF (`src/lib/vehicle-pdf.ts`) bei
  neuen Models mitziehen, damit Backups vollständig bleiben.

---

## Detailstatus & Notizen

### 1 — Kosten-Cockpit (TCO)
Status: ✅ (Kern-Analytik)
- Neu in `src/lib/stats.ts`: `fuelPriceSeries`, `fuelExtremes`, `yearlyCostSeries`.
- Neu: `src/components/charts/price-chart.tsx` (Spritpreis-Verlauf).
- Dashboard (`vehicles/[id]/page.tsx`) erweitert: StatCards „günstigste/teuerste
  Tankung", Spritpreis-Chart, Jahresübersicht-Tabelle (Sprit/Werkstatt/Pflege/
  Gesamt/Strecke/€-pro-km, neuestes Jahr oben).
- Verifiziert: `prisma generate` + `tsc --noEmit` fehlerfrei.

### 1b — Steuer/Versicherung/Fixkosten als echte Kosten
Status: ✅
- Schema: Enum `ExpenseCategory` (TAX/INSURANCE/FEE/OTHER), Model `Expense`.
- Migration: `20260624100000_add_expenses`.
- `lib/stats.ts`: `VehicleData.expenses?` (optional → alte Aufrufer brechen nicht);
  fließt in `computeStats.totalExpenseCost`/`totalCost`, `monthlyCostSeries.other`,
  `yearlyCostSeries.other` ein. `lib/expenses.ts` (`summariseExpenses`, Label).
- CostChart um „Sonstiges"-Balken erweitert; Dashboard: Fixkosten-StatCard +
  Spalte „Sonstiges" in der Jahresübersicht.
- Validation `expenseSchema`, Actions `src/actions/expenses.ts`, Form
  `expense-form.tsx`, Seite + immer-sichtbarer Tab `vehicles/[id]/costs`.
- Export/Import + CSV (`kosten.csv`) + PDF-Report ergänzt.

### 2 — Reifen-/Räderverwaltung
Status: ✅  · Toggle: `tireTracking`
- Schema: Enum `TireSeason`, Models `TireSet` + `TireChange`, plus alle 4 Toggles
  (`tireTracking`/`tripLogging`/`leasingTracking`/`evTracking`) auf `Vehicle`.
- Migrationen: `20260623115000_add_feature_toggles`, `20260623120000_add_tires`.
- Logik: `src/lib/tires.ts` (`summariseTireSets` → km pro Satz aus Wechsel-Log).
- Validation: `tireSetSchema`, `tireChangeSchema`.
- Actions: `src/actions/tires.ts` (Set + Change CRUD).
- Forms: `src/components/forms/tire-forms.tsx`.
- Seite: `src/app/(app)/vehicles/[id]/tires/page.tsx` (redirectet wenn Toggle aus).
- Tab: in `vehicle-tabs.tsx` via `features.tires`; Layout reicht Flags durch.
- Toggles als Checkboxen in `vehicle-form.tsx` (Block „Zusatzfunktionen").
- Export/Import (`vehicle-transfer.ts`) auf Version 3 erweitert: Toggles +
  TireSets + TireChanges werden mitgesichert/wiederhergestellt.
- **v0.19.0:** zusätzlich `TireMeasurement` (Profiltiefe-Verlauf, eigenes
  Diagramm) — Details im v0.19.0-Block oben.

**Hinweis für Folge-Features (3–8):** Bei jedem neuen Model auch
`vehicle-transfer.ts` (Export+Import) und ggf. `vehicle-pdf.ts` mitziehen.

### 3 — Daten-Export (CSV) & Backup
Status: ✅ (Export)
- Vorhanden war: PDF-Report (`/report`), ZIP-Export (`/export`), ZIP-Import.
- Neu: `src/lib/vehicle-csv.ts` + Route `vehicles/[id]/csv` → ZIP mit je einer CSV
  pro Bereich (Tankungen, Kilometer, Reparaturen, Pflege, Radsätze, Radwechsel),
  `;`-getrennt, Komma-Dezimal, UTF-8-BOM (deutsches Excel). Button in Settings.
  Funktioniert auch für geteilte Fahrzeuge (Lesezugriff genügt).

### 3b — CSV-Import (Spritmonitor/Fuelio)
Status: ✅
- `lib/fuel-csv-import.ts`: heuristischer Parser (Delimiter `;`/`,`/Tab, Dezimal
  Komma/Punkt, Datumsformate ISO/DD.MM.YYYY/Slash; Spaltenerkennung per Fuzzy-Match;
  fehlende Spalten → Zeile übersprungen statt Abbruch).
- Action `importFuelCsvAction` in `src/actions/entries.ts` (createMany).
- UI `components/forms/fuel-csv-import.tsx`, Karte im Tankbuch (nur Bearbeiter).
- Bekannte Grenze: Slash-Datumsformat MM/DD vs DD/MM mehrdeutig (Default DD/MM,
  außer Tag>12); Tausenderpunkt ohne Dezimal-Komma kann fehlinterpretiert werden.

### 4 — Dokumente / Handschuhfach
Status: ✅
- Schema: Enum `DocumentCategory`, Model `Document` (Metadaten + `expiresAt` +
  `reminderId`), `Attachment.documentId` für Datei-Anhänge (wie `repairId`).
- Migration: `20260623130000_add_documents`.
- Dateien: bestehendes `Attachment`-Model wiederverwendet; Funktionen in
  `lib/attachments.ts` generalisiert (`saveDocumentAttachments` etc.); Serving-
  Route `api/attachments/[id]` autorisiert jetzt auch über `documentId`.
- Ablauf-Erinnerung: `lib/documents.ts` `applyDocumentReminder` erzeugt/aktualisiert/
  löscht einen verknüpften `Reminder` (type CUSTOM, source DOCUMENT) → nutzt den
  bestehenden Scheduler/Push. `documentExpiryStatus` für Badges (abgelaufen/bald).
- Validation: `documentSchema`. Actions: `src/actions/documents.ts`.
- Form: `components/forms/document-form.tsx` (MultiFilePicker für Dateien).
- Seite + Tab (immer sichtbar): `vehicles/[id]/documents`, Tab in `vehicle-tabs`.
- Export/Import (Metadaten, keine Datei-Bytes — analog Reparatur-Anhängen) und
  CSV (`dokumente.csv`) ergänzt. `deleteVehicleAction` räumt Dokument-Anhänge mit auf.

### 5 — Fahrtenbuch
Status: ✅  · Toggle: `tripLogging`
- Schema: Enum `TripPurpose`, Model `Trip` (Start/End-km, Zweck, Von/Nach, Notiz).
- Migration: `20260623140000_add_trips`.
- Logik: `lib/trips.ts` (`summariseTrips` → km gesamt + Aufteilung geschäftlich/
  privat/Arbeitsweg, `tripPurposeLabel`).
- Validation `tripSchema` (refine End-km ≥ Start-km). Actions `src/actions/trips.ts`.
- Form `components/forms/trip-form.tsx` (Start-km wird mit letzter End-km vorbelegt).
- Seite `vehicles/[id]/trips` mit StatCards (km-Split) + Liste; Tab via `features.trips`.
- Export/Import + CSV (`fahrtenbuch.csv`) ergänzt.

### 6 — Leasing-/Finanzierungs-Tracking
Status: ✅  · Toggle: `leasingTracking`
- Schema: Model `LeasingContract` (1:1 zu Vehicle, `@unique vehicleId`).
- Migration: `20260623160000_add_leasing`.
- Logik: `lib/leasing.ts` `leasingStatus` → Laufzeit, km-Budget, lineare
  Hochrechnung bis Vertragsende, erwartete Mehrkilometer + Mehrkosten, Warnflag.
- Validation `leasingSchema` (refine Ende > Beginn). Actions `src/actions/leasing.ts`
  (upsert, da 1:1).
- Form `components/forms/leasing-form.tsx`.
- UI: Abschnitt in den Einstellungen (`settings/page.tsx`), nur wenn Toggle aktiv —
  inkl. km-Budget-Fortschrittsbalken + Prognose-Warnung.
- Export/Import ergänzt (Leasing-Objekt). CSV bewusst nicht (Einzeldatensatz, keine
  Liste).

### 7 — Beleg-Scan / OCR
Status: ✅ (bereits vorhanden)
- `src/components/forms/fuel-pump-capture.tsx` nutzt `tesseract.js` und ist im
  Tankformular integriert ("Zapfsäule abfotografieren" → Menge + Preis/L).

### 8 — EV-Lade-Tracking
Status: ✅  · Toggle: `evTracking`
- Schema: Enum `ChargingLocation`, Model `ChargingSession` (kWh, Preis/kWh,
  Gesamtkosten, Ort, Anbieter). Bewusst getrennt vom Tankbuch → fließt NICHT in
  computeStats ein (kein Doppelzählen).
- Migration: `20260623150000_add_charging`.
- Logik: `lib/charging.ts` (`summariseCharging`, `resolveChargingCost` rechnet
  Preis↔Gesamt aus, `chargingLocationLabel`).
- Validation `chargingSchema`. Actions `src/actions/charging.ts`.
- Form `components/forms/charging-form.tsx` (OdometerCapture; Preis ODER Gesamt).
- Seite `vehicles/[id]/charging` mit StatCards (kWh/Kosten/Heim/öffentlich) + Liste;
  Tab via `features.charging`.
- Export/Import + CSV (`ladevorgaenge.csv`) ergänzt.
</content>
</invoke>
