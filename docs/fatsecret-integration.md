# FatSecret integration and dashboard plan

Researched against FatSecret's official documentation on November 7, 2026.

## Initial application-authentication phase (historical)

Application credentials are read from server-only `FATSECRET_CLIENT_ID` and
`FATSECRET_CLIENT_SECRET`. Actual values belong in ignored `.env.local` or the
private deployment's environment, never in this document or Git. The supplied
credentials passed an OAuth 2.0 token request with `basic` scope.

`src/lib/fatsecret/client.ts` authenticates against the fixed HTTPS token
endpoint. It keeps the token only in server memory, refreshes a minute before
expiry, shares concurrent requests, times out, refuses redirects, and backs off
failed requests for one minute. It never logs credentials, tokens or upstream
response bodies. Forced mock mode disables network access.

`/api/health/fatsecret` is a same-origin, no-store connection check. It returns
application authentication status, never a bearer token. This is NOT a food
lookup test or a personal diary connection. `/api/status` exposes configuration
booleans only. Health's Sources explains that diary authorization is pending.
No nutrition totals, meals or user access tokens are fetched yet.

## The key access distinction

[Authentication](https://platform.fatsecret.com/docs/guides/authentication):
OAuth 2.0 client credentials support shared food/recipe resources. Personal
profile methods require OAuth 1.0 consumer credentials plus a delegated user
token. The two credential pairs are not interchangeable.

For an existing account, use [three-legged OAuth](https://platform.fatsecret.com/docs/guides/authentication/oauth1/three-legged):
request token → user signs in and approves on FatSecret → exchange the verifier
for an access token and token secret. Creating a new API profile would create a
separate profile, not import the existing app's food diary; do not use that as a
substitute.

FatSecret's [official setup guide](https://github.com/fatsecret-group/postman-fatsecret-apis/blob/main/readme.md)
points to “Generate / View API Keys” and distinguishes Consumer Key/Secret from
Client ID/Secret. This account currently only shows the latter. Check for the
OAuth 1.0 credentials there; if unavailable, ask FatSecret to confirm access to
three-legged OAuth for this application. Do not assume that buying a higher
tier alone resolves it. Future variable names are reserved in `.env.example`,
but no code currently consumes those OAuth 1.0 variables. Authorization UI and
token storage still need implementation once that access is available.

## Capability map

The [API index](https://platform.fatsecret.com/docs/guides) lists these families.
Availability varies by method, edition, country and granted scope; having a basic
token does not establish entitlement to every feature.

| Capability | What it provides | Dashboard use |
| --- | --- | --- |
| Food search and food details | Generic/branded foods, servings and nutrient amounts | Optional food lookup; not a personal intake history |
| Brands, categories, classification, nutrient tags, dietary/allergen information | Organizing and filtering food records; some fields/methods restricted | Useful later for a food explorer, secondary to actual diary data |
| Barcode and autocomplete | Product lookup and faster searches | Optional logging shortcuts; edition-dependent |
| Recipe search, recipe details and types | Ingredients, servings, preparation and nutrition | Meal planning later |
| Natural-language and image recognition | Parse food descriptions or identify foods from photos | Optional paid/entitled add-ons; require review before saving guessed portions |
| User food diary | Read entries by date, monthly daily summaries; create/edit/delete/copy entries | Core source for meals and daily/weekly nutrition |
| User foods and recipes | Custom food creation, favorite foods/recipes, recent/most-eaten foods | Later repeat-meal shortcuts; profiles need authorization |
| Saved meals | Read/create/edit/delete reusable meals and their constituent foods | Later meal planning; profile access required |
| Weight diary and profile | Weight history, latest weight, goal weight, height and display units | Optional weight trend alongside training |
| Exercise diary | Daily/monthly records, expenditure summaries and templates; write methods | Keep Hevy as the training source to avoid double-counting |
| Localization and feedback | Country/language datasets and food-data issue feedback | Configure country explicitly if adding lookup; don't confuse language with diary identity |

[Food details](https://platform.fatsecret.com/docs/v6/food.get) and
[recipes](https://platform.fatsecret.com/docs/v2/recipe.get) provide serving-based
nutrition; fields can be absent. [Barcode lookup](https://platform.fatsecret.com/docs/v2/food.find_id_for_barcode),
[text recognition](https://platform.fatsecret.com/docs/v1/natural.language.processing)
and [image recognition](https://platform.fatsecret.com/docs/v2/image.recognition)
are separate capabilities, not evidence the user's diary is connected.

## Nutrition data we can display after diary authorization

[Entries by date](https://platform.fatsecret.com/docs/v2/food_entries.get)
include meal category, food/serving descriptions, quantities, kcal, protein,
carbohydrate and fat. They can also include fiber, sugar, saturated fat, sodium,
potassium and selected vitamins/minerals. Optional nutrients must stay unknown
when absent. Entry nutrient values describe the recorded entry; do not multiply
those values again by its serving quantity.

[Monthly summaries](https://platform.fatsecret.com/docs/v2/food_entries.get_month)
contain daily calories and macros. Dates without entries are omitted; this does
not mean zero consumption or fasting. Fetch detailed entries separately for
micronutrients. API dates are calendar days expressed as days since 1970-01-01;
convert the intended local calendar date rather than rounding a current UTC
timestamp.

[Profile status](https://platform.fatsecret.com/docs/v1/profile.get) includes a
goal weight but does not document calorie/protein targets. Don't claim to import
those targets from this endpoint. [Monthly weights](https://platform.fatsecret.com/docs/v2/weights.get_month)
can support an optional trend, with actual logged dates and explicit units.

## Proposed dashboard, in priority order

These are product proposals, not features already live:

1. **Today's fuel:** visual protein, calories, carbohydrate and fat totals.
   Let the user choose targets rather than generate a diet prescription. Label
   amounts “logged so far”; a partial diary is not a completed day's intake.
2. **Meals:** breakfast/lunch/dinner/other rows, expandable for food and serving
   details; protein distribution per meal is visible at a glance.
3. **Weekly rhythm:** seven-day macro/protein charts and logging coverage.
   Show missing days as gaps and today's bar as in progress. “Days with entries”
   is logging consistency, not proof of complete reporting.
4. **Training context:** align nutrition dates with Hevy workout dates. Compare
   logged intake on training/rest days only with coverage shown; do not assert
   that a macro pattern caused strength, sleep or energy changes.
5. **Optional detail:** fiber/sodium and weight trends where records exist.
   Recipe/food search and diary writes can wait because the FatSecret app is
   already the user's logging tool. Initial integration should remain read-only.

Keep daily energy/sleep manual, hydration in the existing bottle logger and
training in Hevy. Do not count FatSecret's exercise entries again. Do not show
sample nutrition as if it were the user's records.

## Storage, deployment and access limits

The [OAuth 2.0 guide](https://platform.fatsecret.com/docs/guides/authentication/oauth2)
describes server-side credentials and source-IP restrictions. Local token
creation succeeded, but hosted food requests still need the deployment's allowed
outbound IP/access configured. Keep these keys off public/demo deployments.

The [editions page](https://platform.fatsecret.com/api-editions) distinguishes
basic food access from Premier features, localization and recognition add-ons;
check actual permissions before implementing them. Attribution is required for
Basic/Premier Free, so include the required attribution before displaying food
or diary-derived data. No FatSecret nutrition data is displayed in this phase.

The [storage rules](https://platform.fatsecret.com/docs/guides/storable-data)
limit user-data caching to 24 hours except listed indefinitely storable fields
such as IDs and auth credentials. Proposed implementation: fetch diary data
server-side with no-store, cache briefly in memory, never write nutrition history
to localStorage/Redis/files, and re-fetch historical periods. Read-only auth
tokens need protected server-side storage when the user connection is added.
Do not copy the full diary into an unbounded dashboard database or send it to
an AI service by default.

## Shared dashboard presentation

The shared weekly timeline and selected-day fuel/context panels now live in
`ConnectedHealth.tsx`. They join normalized training, browser check-ins and a
provider-independent nutrition view model by local calendar date. Protein and
calorie targets are optional user inputs stored locally; no values are generated.
Dates can be selected across twelve rolling weeks, with all same-day Hevy
sessions available to open. Connected-record rendering is covered with synthetic
test fixtures, never seeded into the user's real page.

`lib/fatsecret/data.ts` currently returns only explicit not-configured,
authorization-required or disabled states. It makes no diary requests. This is
an intentional pending boundary: OAuth 1.0 user consent, delegated token storage,
validated diary normalization, attribution, and real diary end-to-end verification
remain prerequisites for personal nutrition sync. No nutrition values are
fabricated while those are missing.

## Live diagnostic update

A subsequent read-only food search returned FatSecret error 21 (IP restriction),
even though the token request succeeded. Treat these as separate checks:
application authentication does not by itself verify food endpoint access. Add
the current requesting server's public outbound IP under the application's IP
Restrictions and repeat the lookup. A localhost/private LAN address does not
identify that outbound address, and the hosted deployment may use a different
one. Passing this check still does not delegate access to a member's diary.

After the user added the source IP to the allowlist, a repeat food search
succeeded and returned a nutrition description. Food database access is now
verified from this environment; personal diary authorization remains separate.

## Current delegated diary implementation

The connection UI now lives at `/health/connect/fatsecret`. Consumer credentials
are read only from `FATSECRET_CONSUMER_KEY` / `FATSECRET_CONSUMER_SECRET`. The
user approves an existing account on FatSecret's website; no empty API profile
is created. Request tokens are paired with an opaque HttpOnly SameSite=Lax
browser cookie and encrypted server-side pending records with ten-minute expiry.
Callbacks match request tokens and consume pending state atomically before
exchange, preventing cross-browser substitution and replay. Errors and redirect
status messages are sanitized. Callback URLs are excluded from local Next dev
request logs; deployment log policy should likewise protect verification query
parameters. FatSecret’s authorization service requires signed form/query parameters: request tokens use a POST form, and the documented temporary access-token exchange uses a GET query. Permanent account tokens are sent in POST bodies to fixed read-only diary methods; token secrets are never transmitted.

Saved access tokens are encrypted with AES-256-GCM using a key derived from the
consumer credentials. Private Redis is used when configured; otherwise local
owner-only encrypted files under ignored `.data/fatsecret` are used. Vercel fails
closed without private Redis. Disconnect removes saved authorization. Rotating
consumer credentials requires reconnecting.

Once approved, the read-only adapter fetches current-day entries and at most
four monthly summaries to cover twelve weeks. Historical details load on date
selection. API numeric strings and dates are validated; entry nutrients are
already totals and are not multiplied again by serving count. Empty diary days
are omitted from summaries rather than treated as zero intake. RAM caches expire
after five minutes and are tied to the saved account token; authentication errors
clear authorization and disconnects cannot reuse cached records. No nutrition
records are persisted in browser storage, Redis or files. Required FatSecret
attribution accompanies displayed data. Live user-data validation still requires
the user to save consumer credentials and complete their account consent.

Live consumer-credential validation succeeded after matching FatSecret's signed
form transport. The application now receives a confirmed temporary request token
and an authorization redirect. Actual diary access still requires the user to
complete FatSecret's account-consent page.
