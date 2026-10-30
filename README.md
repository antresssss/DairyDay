# DairyDay

Single-farmer milk collection and ledger app (v1). Log morning and evening litres locally, see a monthly dashboard, and share a PDF ledger with the buyer. Offline-only — SQLite on the device, no account.

## Run on your phone (Expo Go)

1. On this computer, in the project folder:

```bash
npm start
```

2. On your phone, install **Expo Go**:
   - [Android (Play Store)](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iPhone (App Store)](https://apps.apple.com/app/expo-go/id982107779)

3. Phone and computer must be on the **same Wi‑Fi**.
4. Scan the QR code from the terminal:
   - **Android:** Expo Go → Scan QR code
   - **iPhone:** Camera app → tap the banner that opens Expo Go

The app stays local on the phone. Reloading Expo Go after a code change picks up updates automatically.

### If the QR code will not connect

Same network but still failing (common on guest/campus Wi‑Fi):

```bash
npx expo start --tunnel
```

First time this may install `@expo/ngrok`. The tunnel is slower but works across networks.

### USB Android (optional)

Enable USB debugging, plug in the phone, then:

```bash
npx expo start --android
```

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server + QR code |
| `npm run android` | Open on an Android emulator/device |
| `npm run ios` | Open on iOS Simulator (macOS only) |

SQLite does not run fully on web; use a phone or emulator for this MVP.

## What is in v1

- Home: month running total, log buttons, today’s morning/evening status
- Log entry: date, litres, rate (last used rate prefilled), upsert per date/shift
- Dashboard: month totals, missed days, daily bar list
- Settings: farmer name and address for the ledger header; JSON data export
- Ledger: date range, on-screen table, PDF export + share sheet (WhatsApp)

Not in v1: multi-farmer, fat%/SNF, payments, UPI, cloud sync, login.

## Local data (SQLite)

Database file: `dairyday.db`. Schema version is stored in SQLite `PRAGMA user_version` (currently **1**). Existing installs keep all rows; new columns are added with a one-time migration.

### `collection_entries`

| Column | Notes |
|---|---|
| `id` | Integer primary key |
| `date` | Local calendar date `YYYY-MM-DD` (unique). Not converted to UTC. |
| `morning_litres` / `afternoon_litres` | `NULL` if that session was never logged (not stored as 0) |
| `rate` | Rs. per litre |
| `created_at` / `updated_at` | UTC ISO 8601 (`…Z`) |
| `is_deleted` | `0` or `1`. Reads and the ledger PDF ignore deleted rows. There is no physical `DELETE`. |
| `synced_at` | Reserved; stays `NULL` for now |

### `profile`

Key/value table. Keys include `farmer_name`, `farmer_address`, and `farmer_id` (UUID v4, generated once on first launch and never regenerated).

### JSON export

Settings → **Export data (JSON)** writes a cache file named `dairyday-export-YYYY-MM-DD.json` and opens the share sheet. Shape:

```json
{
  "schema_version": 1,
  "exported_at": "<UTC ISO>",
  "farmer": { "farmer_id": "", "farmer_name": "", "farmer_address": "" },
  "entries": [
    {
      "farmer_id": "",
      "date": "YYYY-MM-DD",
      "morning_litres": null,
      "afternoon_litres": 12.5,
      "rate": 60,
      "created_at": "",
      "updated_at": "",
      "is_deleted": 0
    }
  ]
}
```

The JSON export includes soft-deleted rows. Unlogged sessions stay `null`, not `0`.
