# Feature-Roadmap (Kilomondo)

Fortschritt der am 2026-06-23 beauftragten Features. Reihenfolge nach Nutzerpriorität.
Status: ⬜ offen · 🟨 in Arbeit · ✅ fertig

> Migrationen werden **nicht lokal angewandt** (Port 5432 ist von einem anderen
> Projekt belegt, carlog-DB läuft nicht). Migrationsdateien werden angelegt und
> greifen beim Deploy via `prisma migrate deploy`. Korrektheit wird über
> `npx prisma generate` + `npx tsc --noEmit` geprüft.

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

**Stand 2026-06-24:** Alle Features (1, 1b, 2, 3, 3b, 4, 5, 6, 7, 8) umgesetzt;
`npx tsc --noEmit` und `npx next build` fehlerfrei. Der PDF-Report enthält jetzt
auch Ausgaben, Reifen, Fahrtenbuch, Laden, Dokumente und Leasing.

### Offen / Folgeschritte
- **Migrationen anwenden:** beim Hochfahren des Stacks prüfen, dass
  `prisma migrate deploy` die **7** neuen Migrationen (`20260623115000`–
  `20260624100000`) einspielt.
- Funktionaler End-to-End-Test gegen eine laufende DB steht noch aus (lokal lief
  die carlog-DB nicht; verifiziert via generate/tsc/build).
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
