# Regimen — production app

Expo (React Native + React Native Web) + Supabase build of the Regimen prototype in [`../prototype`](../prototype). One TypeScript codebase ships to **web, iOS and Android**. The spec it follows is [`../README.md`](../README.md).

## What's where

| Path | What it is |
|---|---|
| `src/domain/` | The calculation engine ported from `prototype/store.js`: scheduling, progressive overload, PRs, meal distribution, portion solver, alternatives, meal prep, grocery list, safety floor. Pure TypeScript, no UI. |
| `src/domain/__tests__/` | Unit tests. `golden.json` was produced by running the **original** `store.js`, so the tests prove the port gives identical results. |
| `src/store/` | App state (`store.ts`), the `RG` API the screens use (`rg.ts`), the state ⇄ database mapping (`mapping.ts`) and the diff-based cloud sync (`sync.ts`). |
| `src/screens/` | One file per screen (ports of `prototype/Fit*.dc.html`), plus the shell (sidebar / drawer) and sign-in. |
| `src/ui/` | Nocturne design tokens (`theme.ts`), component kit (`kit.tsx`), Phosphor icons. |
| `src/lib/` | Supabase client, private photo storage (signed URLs), reminders → notifications, calendar sync, file export, USDA / Open Food Facts lookup. |
| `supabase/migrations/` | Database schema, Row-Level Security, private photo bucket, exercise and food library. Already applied to the **Regimen** Supabase project. |

## Run it

```bash
cd regimen
npm install
npm run web        # opens in the browser
npm test           # domain + mapping tests
npm run typecheck
```

- `.env` holds the Supabase URL and the **publishable** key (safe to ship; RLS protects the data). Never put the secret / service-role key in this app.
- **Demo mode** (no sign-in, sample data, stored only in this browser): `EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_DEMO=1 npm run web`
- **Live food search**: the USDA FoodData Central key is kept **server-side** as the `USDA_API_KEY` secret in Supabase (Dashboard → Edge Functions → Secrets). The app calls the `usda-search` Edge Function (`supabase/functions/usda-search`), which adds the key — never put it in `.env` or the code, as USDA deactivates keys found in public code. Barcodes use Open Food Facts (no key).

## Web address

The web app is published to **https://melissa-erion.github.io/Nocturne/** by `.github/workflows/deploy-web.yml` on every push to `main` that changes `regimen/` (or run it by hand from the Actions tab). The workflow typechecks, runs the tests, builds with the `/Nocturne` base path, and adds `404.html` so deep links work.

## Phones

Notifications, calendar sync and the camera need a development build (not Expo Go):

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform ios     # or android
npx expo start --dev-client
```

Store builds: `npx eas-cli@latest build --profile production` then `npx eas-cli@latest submit`.

## How data is stored

- Every table has `user_id` and a Row-Level Security policy `user_id = auth.uid()`: a signed-in user can only read or write their own rows. The exercise and food libraries are shared, read-only.
- Progress photos go to the **private** `progress-photos` bucket under `<user_id>/…` and are shown only through 30-minute signed URLs.
- The app keeps a local copy for fast start-up and offline use, and syncs only the rows that changed.
