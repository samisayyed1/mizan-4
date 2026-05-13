I analysed both uploaded docs. They agree on the same core direction: **Mizan should not become another broker-sync tracker. It should become a closed-source, local-first private wealth OS with document-backed accounting, universal assets, tax packs, private investments, optional Islamic finance, and a much simpler boomer-friendly UI.** The first doc frames the moat as **local document intelligence \+ deterministic financial math \+ CPA/private wealth workflows**  . The second doc sharpens it into **citation-backed ledger, Explain This Number, Wealth Inbox, universal asset model, and premium desktop licensing**  .

Below is the build order I would use. It is deliberately sequential. Each prompt layers on top of the previous one and avoids breaking Mizan.

---

# **Mizan Build Sequence for Claude Code**

## **Global instruction to paste at the top of every Claude Code session**

Read AGENTS.md and the full codebase first.

This is the Mizan production repo. Preserve all existing functionality. Do not remove working routes, database fields, services, tests, or UI flows unless explicitly instructed.

Hard rules:  
\- No fake rows.  
\- No placeholder code.  
\- No invented data.  
\- No paid API dependency.  
\- No weakening validation.  
\- No direct AI mutation of financial truth.  
\- Human review is required before extracted document facts enter the ledger.  
\- Use rust\_decimal or the existing Decimal strategy for money.  
\- Do not introduce f32/f64 into financial calculations.  
\- Keep TypeScript strict.  
\- No \`any\`.  
\- Add migrations for schema changes.  
\- Add Rust and frontend tests for every feature.  
\- Keep existing tests passing.  
\- Run validation before committing.  
\- Commit only after green validation.

Validation commands:  
\- pnpm typecheck  
\- pnpm lint  
\- pnpm test  
\- pnpm build  
\- cargo fmt  
\- cargo clippy \-- \-D warnings  
\- cargo test

If a command name differs in this repo, inspect package.json/Cargo workspace and use the correct existing command.  
---

## **Prompt 1 — Stabilize current app before major expansion**

Read AGENTS.md and the full codebase first.

Goal: create a stable baseline before large product expansion.

Tasks:  
1\. Inspect current Git status and identify uncommitted changes.  
2\. Run the full validation suite:  
   \- pnpm typecheck  
   \- pnpm lint  
   \- pnpm test  
   \- pnpm build  
   \- cargo fmt  
   \- cargo clippy \-- \-D warnings  
   \- cargo test  
3\. Fix only real validation failures. Do not refactor unrelated code.  
4\. Add or update a short internal note documenting current validation commands if missing.  
5\. Commit the stable baseline with a clear message.

Do not add new features in this prompt.  
Do not weaken tests.  
Do not skip failing checks.  
---

## **Prompt 2 — Product cleanup and boomer-friendly navigation**

Read AGENTS.md and the full codebase first.

Goal: simplify Mizan’s UI without removing functionality.

Implement a progressive-disclosure navigation structure for older/HNW users.

Required top-level navigation:  
\- Home  
\- Portfolio  
\- Documents  
\- Reports  
\- Settings

Move existing advanced pages under appropriate sections instead of deleting them:  
\- Goals under Reports or Settings, depending on current structure.  
\- Health/Data Quality under Home or Settings.  
\- Taxonomies under Settings.  
\- AI/Assistant, Addons, Connect, and other advanced screens should remain accessible but not visually dominate the primary navigation.

UI rules:  
1\. Increase default app readability. Base UI text should be at least 16px where practical.  
2\. Replace icon-only primary actions with icon \+ plain-English label.  
3\. Remove purely decorative gradients/motion where they increase visual noise.  
4\. Use calm premium styling, high contrast, and clear hierarchy.  
5\. Keep all old routes working through redirects or hidden advanced links.  
6\. Do not remove backend commands or existing pages.

Add tests:  
\- route rendering still works  
\- main nav renders exactly the simplified top-level sections  
\- hidden advanced pages remain accessible

Run validation and commit only when green.  
---

## **Prompt 3 — Home dashboard rebuild: useful command center**

Read AGENTS.md and the full codebase first.

Goal: rebuild the dashboard into a useful Home command center.

Create these dashboard modules using real existing data only:

1\. Net Worth Summary  
   \- total net worth  
   \- change since last available period  
   \- currency-aware formatting  
   \- loading and empty states

2\. Wealth Inbox Preview  
   \- active alerts  
   \- pending document reviews once available  
   \- stale manual valuations once available  
   \- upcoming events once available  
   \- for now, use existing health checks/alerts if available and show empty state if not

3\. Income This Month  
   \- dividends  
   \- interest  
   \- coupons if already represented  
   \- use activities/ledger data only

4\. Portfolio Attention  
   \- missing FX  
   \- stale quote  
   \- unclassified assets  
   \- unavailable data warnings

5\. Quick Actions  
   \- Add Asset  
   \- Update Values  
   \- Upload Document  
   \- Generate Report  
   \- Review Issues

Do not invent data.  
Do not show fake metrics.  
If data is missing, show a useful empty state.

Use TanStack Query hooks where the app already uses them.  
Add frontend tests for loading, empty, and populated states.  
Run validation and commit only when green.  
---

## **Prompt 4 — Universal asset model foundation**

Read AGENTS.md and the full codebase first.

Goal: prepare Mizan to track serious multi-asset wealth.

Implement a clean universal asset model using base asset \+ typed extension tables. Avoid a messy generic EAV design.

Add/extend support for these asset classes:  
\- public\_equity  
\- etf  
\- mutual\_fund  
\- fixed\_income  
\- sukuk  
\- fixed\_deposit  
\- cash  
\- real\_estate  
\- private\_equity  
\- private\_credit  
\- crypto  
\- commodity  
\- insurance  
\- ulip  
\- pension  
\- business\_ownership  
\- collectible  
\- liability  
\- custom

Schema approach:  
1\. Keep existing assets table and preserve compatibility.  
2\. Add typed extension tables only where needed:  
   \- asset\_public\_equity  
   \- asset\_fixed\_income  
   \- asset\_real\_estate  
   \- asset\_private\_investment  
   \- asset\_insurance  
   \- asset\_commodity  
   \- asset\_collectible  
   \- asset\_liability  
3\. Add a valuations table if one does not already exist:  
   \- id  
   \- asset\_id  
   \- valuation\_date  
   \- value\_native  
   \- currency  
   \- source\_type: manual/document/import/market/calculated  
   \- source\_id nullable  
   \- notes nullable  
   \- created\_at  
   \- updated\_at

Rules:  
\- Preserve existing portfolio calculations.  
\- New asset types may start as manually valued until deeper engines are added.  
\- No fake pricing.  
\- No paid APIs.  
\- Use Decimal for all monetary fields.  
\- Add FK constraints and indexes.

Add Rust tests:  
\- create each asset subtype  
\- invalid subtype data is rejected  
\- valuations are append-only or update according to current app convention  
\- existing public equity assets still work

Run validation and commit only when green.  
---

## **Prompt 5 — Universal Add Asset redesign**

Read AGENTS.md and the full codebase first.

Goal: replace complex asset creation with a simple universal Add Asset flow.

Build a one-page or short wizard Add Asset flow:

Step 1: “What are you adding?”  
Asset picker:  
\- Stock / ETF / Fund  
\- Bond / Sukuk  
\- Fixed Deposit / Cash  
\- Property  
\- Private Investment  
\- Gold / Commodity  
\- Crypto  
\- Insurance / ULIP  
\- Business / Other  
\- Liability

Step 2: simple required fields only.  
Step 3: optional advanced fields.  
Step 4: save.

Rules:  
\- Use React Hook Form and Zod.  
\- No \`any\`.  
\- Dynamic form based on asset type.  
\- Keep existing Add Asset route working.  
\- Redirect or replace old wizard with this simpler version.  
\- Do not remove existing API commands unless they are fully replaced.  
\- Do not add fake lookup results.  
\- If lookup fails, allow manual entry.

Add tests:  
\- each asset type renders correct fields  
\- validation blocks invalid data  
\- save calls existing/new backend command correctly  
\- success redirects to Portfolio

Run validation and commit only when green.  
---

## **Prompt 6 — Manual valuation and bulk update grid**

Read AGENTS.md and the full codebase first.

Goal: make it easy for Feroz/older users to update all assets.

Build a Bulk Update Values screen.

Features:  
1\. Show all manually valued assets.  
2\. Editable columns:  
   \- current value  
   \- valuation date  
   \- notes  
3\. One-click “mark unchanged” for assets where value is still current.  
4\. Batch save in one transaction.  
5\. Stale-data indicator:  
   \- warning if manual valuation older than 45 days  
   \- critical if older than 90 days  
6\. Link to Upload Document if the user has a valuation statement.

Backend:  
\- Add or reuse valuation table/service.  
\- Implement Tauri command \`bulk\_update\_valuations\`.  
\- Use one SQLite transaction.  
\- Use Decimal.  
\- Validate all rows before writing.  
\- If any row fails, return structured error and do not partially write unless repo convention supports row-level partials.

Frontend:  
\- TanStack Table  
\- large readable cells  
\- plain-English labels  
\- save summary

Tests:  
\- valid batch writes all  
\- invalid batch rolls back  
\- stale indicator works  
\- Decimal parsing is strict

Run validation and commit only when green.  
---

## **Prompt 7 — Data Quality Score foundation**

Read AGENTS.md and the full codebase first.

Goal: add a professional data health score that supports the trust moat.

Implement \`calculate\_data\_quality\`.

Score components:  
\- manual valuation freshness  
\- stale market quotes  
\- missing FX  
\- unclassified assets  
\- pending health issues  
\- missing source documents once document vault exists  
\- pending extracted facts once document vault exists

Return:  
\- score out of 100  
\- breakdown of deductions  
\- severity  
\- click target for each issue  
\- plain-English explanation

Rules:  
\- Do not gamify.  
\- Use calm professional wording.  
\- No fake score if data unavailable.  
\- Missing modules should contribute neutral/empty states until implemented.

Add UI:  
\- dashboard Data Quality card  
\- click-through to issue list

Tests:  
\- perfect data \= high score  
\- stale manual assets reduce score  
\- missing FX reduces score  
\- empty portfolio has neutral onboarding state

Run validation and commit only when green.  
---

## **Prompt 8 — Smart alert engine foundation**

Read AGENTS.md and the full codebase first.

Goal: implement deterministic smart alerts.

Add alerts table:  
\- id  
\- rule\_name  
\- fingerprint unique  
\- severity: info/warning/critical  
\- title  
\- message  
\- status: active/snoozed/dismissed/resolved  
\- related\_entity\_type nullable  
\- related\_entity\_id nullable  
\- action\_route nullable  
\- created\_at  
\- updated\_at  
\- snoozed\_until nullable  
\- dismissed\_at nullable

Implement rules:  
1\. StaleManualValuationRule  
2\. StaleMarketQuoteRule  
3\. MissingFXRule  
4\. UnclassifiedAssetRule  
5\. HighConcentrationRule  
6\. PendingDocumentReviewRule placeholder only if table exists; otherwise inactive

Backend:  
\- deterministic Rust rules module  
\- Tauri command to run rules manually  
\- Tauri command to list/update alert status  
\- ON CONFLICT fingerprint to avoid spam

Frontend:  
\- alert list  
\- snooze  
\- dismiss  
\- fix action

Tests:  
\- each rule triggers correctly  
\- duplicate alerts are not created  
\- snooze/dismiss works  
\- dismissed alerts do not reappear unless fingerprint changes

Run validation and commit only when green.  
---

## **Prompt 9 — Wealth Inbox**

Read AGENTS.md and the full codebase first.

Goal: create the central Wealth Inbox.

Wealth Inbox should consolidate:  
\- active alerts  
\- stale valuation tasks  
\- missing FX tasks  
\- unclassified asset tasks  
\- upcoming fixed income cashflows once implemented  
\- upcoming capital calls once implemented  
\- pending document reviews once implemented  
\- tax pack missing items once implemented

Build:  
1\. \`/inbox\` or equivalent route.  
2\. Inbox item model or view-model layer.  
3\. Sorting:  
   \- critical first  
   \- due soon  
   \- newest  
4\. Filters:  
   \- Documents  
   \- Valuations  
   \- Tax  
   \- Income  
   \- Private Investments  
   \- Security  
5\. Each item must have:  
   \- title  
   \- plain-English description  
   \- severity  
   \- action route  
   \- source object if available  
   \- status

Do not create fake inbox rows.  
Use real alerts and available app data.

Tests:  
\- inbox aggregates alerts  
\- sorting works  
\- clicking routes correctly  
\- empty state is useful

Run validation and commit only when green.  
---

## **Prompt 10 — Document Vault foundation**

Read AGENTS.md and the full codebase first.

Goal: create secure local Document Vault storage.

Add schema:  
\- documents  
  \- id  
  \- file\_hash unique  
  \- original\_name  
  \- mime\_type  
  \- file\_size  
  \- encrypted\_storage\_path  
  \- status: ingested/processing/processed/reviewed/error  
  \- source\_type nullable  
  \- created\_at  
  \- updated\_at  
  \- error\_message nullable

\- document\_pages  
  \- id  
  \- document\_id FK  
  \- page\_number  
  \- width nullable  
  \- height nullable  
  \- text\_status  
  \- created\_at

\- document\_links  
  \- id  
  \- document\_id FK  
  \- linked\_entity\_type  
  \- linked\_entity\_id  
  \- created\_at

Implement:  
1\. \`upload\_document\` Tauri command.  
2\. SHA-256 duplicate detection.  
3\. Encrypt file at rest using existing crypto patterns if available, otherwise implement ChaCha20Poly1305 with key stored/derived safely through existing secret store.  
4\. Store encrypted file in app data dir.  
5\. List documents command.  
6\. Delete document command should remove file and DB row safely, respecting FK constraints.

Rules:  
\- No cloud upload.  
\- No fake documents.  
\- No unencrypted storage unless explicitly impossible; if impossible, fail loudly and document why in code comments.  
\- Do not block UI thread.

Tests:  
\- duplicate rejected  
\- encrypted file exists  
\- decrypt round trip works  
\- metadata stored  
\- delete cleans up

Run validation and commit only when green.  
---

## **Prompt 11 — Document parsing job system**

Read AGENTS.md and the full codebase first.

Goal: create a local document processing job system before adding heavy OCR/VLM.

Add tables:  
\- document\_processing\_jobs  
  \- id  
  \- document\_id FK  
  \- job\_type: parse\_text/extract\_tables/ocr/vlm\_extract/embed  
  \- status: queued/running/succeeded/failed  
  \- attempts  
  \- error\_message nullable  
  \- started\_at nullable  
  \- completed\_at nullable  
  \- created\_at

Implement:  
1\. enqueue job after upload.  
2\. background worker that safely picks queued jobs.  
3\. job timeout handling.  
4\. retry limit.  
5\. status updates.  
6\. UI status display on Documents screen.

For now implement a simple text extraction stub only if a real parser already exists. Do not create fake extracted facts. If parser not available, job should fail with clear unsupported error, not pretend success.

Tests:  
\- upload enqueues job  
\- worker updates status  
\- failure stores error  
\- retry limit works

Run validation and commit only when green.  
---

## **Prompt 12 — PDF layout/text extraction sidecar**

Read AGENTS.md and the full codebase first.

Goal: integrate real local PDF text/layout extraction.

Use the best practical local option available in this repo/environment:  
\- prefer a Rust/local sidecar parser if available  
\- if using an external binary such as MinerU/Ferrules/Marker, wrap it as a configurable sidecar  
\- no cloud API

Implement:  
1\. Sidecar config and invocation.  
2\. Input: encrypted document decrypted into a secure temp file.  
3\. Output: structured JSON:  
   \- pages  
   \- text blocks  
   \- tables if available  
   \- bounding boxes  
   \- confidence if available  
4\. Store results in:  
   \- document\_text\_blocks  
   \- document\_tables  
   \- document\_pages  
5\. Clean temp files after processing.  
6\. Never block main Tauri thread.

Add schema:  
\- document\_text\_blocks  
\- document\_tables  
\- document\_table\_cells

Tests:  
\- fixture PDF parses into page/text rows  
\- bad PDF fails cleanly  
\- temp files are removed  
\- parser timeout handled

Run validation and commit only when green.  
---

## **Prompt 13 — Extracted facts and citation schema**

Read AGENTS.md and the full codebase first.

Goal: create citation-backed extracted facts.

Add schema:  
\- extracted\_facts  
  \- id  
  \- document\_id FK  
  \- page\_number nullable  
  \- fact\_type  
  \- raw\_value  
  \- normalized\_value nullable  
  \- currency nullable  
  \- confidence\_score nullable  
  \- bounding\_box\_json nullable  
  \- extraction\_method  
  \- extraction\_version  
  \- status: pending/approved/rejected/superseded  
  \- created\_at  
  \- reviewed\_at nullable  
  \- review\_notes nullable

\- source\_citations  
  \- id  
  \- source\_type: document/manual/import/calculated  
  \- source\_id  
  \- document\_id nullable  
  \- extracted\_fact\_id nullable  
  \- page\_number nullable  
  \- bounding\_box\_json nullable  
  \- created\_at

Add nullable citation links where appropriate:  
\- activities/transactions  
\- valuations  
\- tax pack lines later  
\- private investment cashflows later

Rules:  
\- extracted facts never write to ledger automatically.  
\- only approved facts can become citations for ledger writes.  
\- rejected facts remain auditable.  
\- no fake facts.

Tests:  
\- FK constraints  
\- approved/rejected lifecycle  
\- cannot approve missing document  
\- citation join works

Run validation and commit only when green.  
---

## **Prompt 14 — Document review queue UI**

Read AGENTS.md and the full codebase first.

Goal: build human-in-the-loop document review.

Create Documents \> Review Queue.

UI:  
\- left side: document/page viewer  
\- right side: pending extracted facts/proposed rows  
\- show:  
  \- fact type  
  \- raw value  
  \- normalized value  
  \- confidence  
  \- page number  
  \- source highlight if bounding box exists  
\- actions:  
  \- approve  
  \- edit and approve  
  \- reject  
  \- link to asset/account  
  \- defer

Backend:  
\- commands:  
  \- list\_pending\_extracted\_facts  
  \- approve\_extracted\_fact  
  \- reject\_extracted\_fact  
  \- update\_extracted\_fact\_before\_approval  
\- approvals must occur in transaction.  
\- approval may create a valuation/activity only when the user explicitly confirms target mapping.

Rules:  
\- no silent ledger writes.  
\- no auto-approval.  
\- no fake PDF canvas data.

Tests:  
\- pending fact renders  
\- approve changes status  
\- reject changes status  
\- edit requires valid normalized value  
\- ledger write only happens on approve flow

Run validation and commit only when green.  
---

## **Prompt 15 — Explain This Number foundation**

Read AGENTS.md and the full codebase first.

Goal: add lineage for major financial numbers.

Implement backend service:  
\`get\_data\_lineage(entity\_type, entity\_id, metric\_type)\`

Support first:  
\- net worth  
\- asset valuation  
\- income this month  
\- data quality score  
\- alert explanation

Lineage response:  
\- displayed value  
\- formula name  
\- formula description  
\- input rows  
\- source citations if available  
\- FX rates used if applicable  
\- valuation dates  
\- warnings  
\- confidence/data freshness  
\- last updated

Frontend:  
\- \`\<ExplainableNumber /\>\`  
\- opens modal  
\- shows formula, inputs, citations, warnings  
\- plain English summary

Rules:  
\- never invent lineage.  
\- if citation missing, say “No source document linked yet.”  
\- do not use AI here.

Tests:  
\- net worth lineage includes assets/valuations  
\- missing citations shown honestly  
\- stale valuation warning appears

Run validation and commit only when green.  
---

## **Prompt 16 — Reconciliation Center foundation**

Read AGENTS.md and the full codebase first.

Goal: prove Mizan numbers against imported/document statement totals.

Add reconciliation tables:  
\- reconciliation\_runs  
\- reconciliation\_items  
\- reconciliation\_matches

Implement deterministic reconcile engine:  
Input:  
\- account\_id or asset\_id  
\- imported/document rows  
\- existing ledger rows

Classify:  
\- matched  
\- possible\_match  
\- missing\_in\_mizan  
\- missing\_in\_statement  
\- duplicate  
\- mismatch

Matching rules:  
\- exact amount  
\- same currency  
\- date exact or \+/- configurable tolerance  
\- description similarity only as secondary helper, not truth  
\- Decimal comparisons only

UI:  
\- Reconciliation Center screen  
\- side-by-side rows  
\- approve missing row  
\- ignore with reason  
\- mark matched manually

Rules:  
\- no auto-write.  
\- user approval required.  
\- all accepted adjustments get audit/citation where available.

Tests:  
\- exact match  
\- date tolerance  
\- duplicate detection  
\- mismatch  
\- approve adjustment writes one row only

Run validation and commit only when green.  
---

## **Prompt 17 — Private investments foundation**

Read AGENTS.md and the full codebase first.

Goal: add first-class private investment tracking.

Add schema:  
\- private\_investments  
  \- asset\_id FK  
  \- manager  
  \- strategy  
  \- vintage\_year  
  \- commitment\_amount  
  \- commitment\_currency  
  \- inception\_date nullable  
  \- notes nullable

\- private\_investment\_valuations  
  \- id  
  \- asset\_id FK  
  \- valuation\_date  
  \- nav  
  \- currency  
  \- citation\_id nullable

\- capital\_calls  
  \- id  
  \- asset\_id FK  
  \- notice\_date  
  \- due\_date  
  \- amount  
  \- currency  
  \- status: expected/due/paid/cancelled  
  \- citation\_id nullable

\- private\_distributions  
  \- id  
  \- asset\_id FK  
  \- distribution\_date  
  \- amount  
  \- currency  
  \- recallable boolean  
  \- citation\_id nullable

Implement CRUD commands.  
Implement metrics:  
\- paid-in capital  
\- unfunded commitment  
\- total distributions  
\- current NAV  
\- DPI  
\- RVPI  
\- TVPI  
\- MOIC

Use Decimal.  
No f64.

Tests:  
\- commitment math invariant  
\- paid-in \+ unfunded \= commitment, adjusted for recallable rules if implemented  
\- DPI/RVPI/TVPI known examples  
\- invalid distributions flagged

Run validation and commit only when green.  
---

## **Prompt 18 — Private investment UI and J-curve**

Read AGENTS.md and the full codebase first.

Goal: make private investments usable and impressive.

Frontend:  
1\. Private Investment detail page.  
2\. Show:  
   \- commitment  
   \- paid-in  
   \- unfunded  
   \- NAV  
   \- distributions  
   \- DPI/RVPI/TVPI/MOIC  
   \- upcoming capital calls  
   \- linked documents  
3\. Add capital call form.  
4\. Add distribution form.  
5\. Add NAV update form.  
6\. Add J-curve chart using Recharts.

Rules:  
\- no fake chart data.  
\- empty states must guide user.  
\- all numbers use backend metrics or deterministic frontend formatting only.  
\- citations shown if present.

Tests:  
\- renders empty private fund  
\- renders populated metrics  
\- adding capital call updates UI  
\- chart handles no data

Run validation and commit only when green.  
---

## **Prompt 19 — Fixed income, sukuk, and fixed deposit engine**

Read AGENTS.md and the full codebase first.

Goal: add serious fixed-income support.

Add schema:  
\- asset\_fixed\_income  
  \- asset\_id FK  
  \- instrument\_type: bond/sukuk/t\_bill/fixed\_deposit/cd/other  
  \- issuer  
  \- isin nullable  
  \- face\_value  
  \- currency  
  \- purchase\_date nullable  
  \- maturity\_date  
  \- coupon\_or\_profit\_rate nullable  
  \- payment\_frequency nullable  
  \- day\_count\_convention: ACT\_360/ACT\_365/ACT\_ACT/THIRTY\_360  
  \- is\_sukuk boolean  
  \- citation\_id nullable

\- fixed\_income\_cashflows  
  \- id  
  \- asset\_id FK  
  \- expected\_date  
  \- cashflow\_type: coupon/profit/principal/maturity/interest  
  \- expected\_amount  
  \- actual\_amount nullable  
  \- currency  
  \- status: expected/received/missed/cancelled  
  \- citation\_id nullable

Implement:  
\- day count functions  
\- accrued income calculation  
\- projected cashflow schedule generation  
\- maturity alert integration

Rules:  
\- use Decimal.  
\- no paid price feed.  
\- if insufficient terms, show incomplete setup.  
\- Sukuk terminology should show “profit” instead of “interest” when is\_sukuk true.

Tests:  
\- ACT/360  
\- ACT/365  
\- 30/360  
\- ACT/ACT if practical  
\- coupon schedule  
\- maturity principal cashflow

Run validation and commit only when green.  
---

## **Prompt 20 — Liquidity Ladder**

Read AGENTS.md and the full codebase first.

Goal: give older investors clear near-term cash visibility.

Build Liquidity Ladder using real data:  
\- cash balances  
\- fixed income cashflows  
\- sukuk profit payments  
\- fixed deposit maturities  
\- dividends/interest if scheduled or historical estimate exists  
\- capital calls  
\- private distributions  
\- known tax/report obligations once available

Views:  
\- next 30 days  
\- next 90 days  
\- next 12 months  
\- grouped by currency

Rules:  
\- separate expected from confirmed.  
\- never invent future dividends unless existing expected\_cashflows exist.  
\- show missing data clearly.

Frontend:  
\- dashboard card  
\- detail page/table  
\- simple timeline

Tests:  
\- fixed income cashflows appear  
\- capital calls appear  
\- empty state works  
\- currency grouping works

Run validation and commit only when green.  
---

## **Prompt 21 — Smart alerts expansion for private/fixed-income workflows**

Read AGENTS.md and the full codebase first.

Goal: expand alerts after private investments and fixed income exist.

Add rules:  
\- CapitalCallDueRule  
\- CapitalCallOverdueRule  
\- FixedIncomeCouponDueRule  
\- FixedIncomeMaturityDueRule  
\- FixedDepositMaturityDueRule  
\- ManualNavStaleRule  
\- MissingFixedIncomeTermsRule  
\- MissingPrivateFundNavRule

Integrate with Wealth Inbox.

Rules:  
\- deterministic only.  
\- no duplicated alerts.  
\- user can snooze/dismiss.  
\- each alert has direct action route.

Tests:  
\- each rule with fixture data  
\- snoozed alert hidden until snooze date  
\- due date severity escalates correctly

Run validation and commit only when green.  
---

## **Prompt 22 — Optional Islamic mode foundation**

Read AGENTS.md and the full codebase first.

Goal: add Islamic/Shariah capability as an optional overlay.

Add setting:  
\- shariah\_mode\_enabled default false

Add schema:  
\- shariah\_screening\_profiles  
  \- id  
  \- name  
  \- debt\_threshold  
  \- liquid\_assets\_threshold  
  \- impure\_income\_threshold  
  \- is\_default  
  \- created\_at

\- asset\_shariah\_screening  
  \- id  
  \- asset\_id FK  
  \- profile\_id FK  
  \- status: compliant/non\_compliant/questionable/unknown/needs\_review  
  \- debt\_ratio nullable  
  \- liquid\_assets\_ratio nullable  
  \- impure\_income\_ratio nullable  
  \- source\_citation\_id nullable  
  \- manual\_override\_reason nullable  
  \- reviewed\_at nullable

Default profile:  
\- debt \< 30%  
\- liquid assets \< 30%  
\- impure income \< 5%

Frontend:  
\- Islamic mode toggle in Settings  
\- when disabled, no halal/zakat/purification UI appears  
\- when enabled, asset views show status badges

Rules:  
\- no forced Islamic identity.  
\- no paid compliance API.  
\- ratios can be manual/imported/document-backed.  
\- status unknown if insufficient data.

Tests:  
\- disabled mode hides UI  
\- enabled mode shows UI  
\- threshold evaluation works  
\- missing ratios \=\> unknown/needs\_review

Run validation and commit only when green.  
---

## **Prompt 23 — Shariah screening profiles and review workflow**

Read AGENTS.md and the full codebase first.

Goal: make Shariah screening usable and auditable.

Implement:  
1\. Settings screen for screening profile thresholds.  
2\. Asset-level Shariah review form:  
   \- debt ratio  
   \- liquid assets ratio  
   \- impure income ratio  
   \- source citation  
   \- notes  
3\. Backend function \`evaluate\_shariah\_compliance\`.  
4\. Manual override with required reason.  
5\. Audit trail for changes.

Rules:  
\- do not fetch paid screening data.  
\- do not claim official certification.  
\- label outputs as screening support, not a fatwa.  
\- if data is user-provided, show that clearly.

Tests:  
\- pass case  
\- fail debt case  
\- fail liquid assets case  
\- fail impure income case  
\- manual override requires reason

Run validation and commit only when green.  
---

## **Prompt 24 — Zakat calculator**

Read AGENTS.md and the full codebase first.

Goal: implement optional Zakat calculation when Islamic mode is enabled.

Add schema:  
\- zakat\_snapshots  
  \- id  
  \- snapshot\_date  
  \- base\_currency  
  \- total\_zakatable\_assets  
  \- deductible\_liabilities  
  \- net\_zakatable\_wealth  
  \- nisab\_value  
  \- zakat\_due  
  \- notes  
  \- created\_at

\- zakat\_lines  
  \- id  
  \- snapshot\_id FK  
  \- asset\_id nullable  
  \- category  
  \- amount  
  \- included boolean  
  \- explanation  
  \- citation\_id nullable

Backend:  
\- calculate zakat snapshot from selected assets/categories.  
\- use Decimal.  
\- support manual nisab input first.  
\- optional future gold price source can be added later but not required.  
\- show calculation lineage.

Frontend:  
\- guided wizard  
\- asset inclusion review  
\- final report  
\- export basic CSV/PDF if report infrastructure exists

Rules:  
\- Islamic mode only.  
\- no tax/religious advice language.  
\- user can edit/inclusion decisions.  
\- no fake nisab value.

Tests:  
\- short-term asset included at market value  
\- liability deduction  
\- manual nisab  
\- disabled mode blocks access

Run validation and commit only when green.  
---

## **Prompt 25 — Dividend purification calculator**

Read AGENTS.md and the full codebase first.

Goal: implement optional purification tracking.

Add schema:  
\- purification\_entries  
  \- id  
  \- asset\_id FK  
  \- period\_start  
  \- period\_end  
  \- total\_impure\_income nullable  
  \- outstanding\_shares nullable  
  \- user\_shares nullable  
  \- dividend\_received nullable  
  \- purification\_amount  
  \- status: calculated/paid/waived  
  \- citation\_id nullable  
  \- notes nullable

Backend:  
\- support formula:  
  \- if impure income per share data exists: (total\_impure\_income / outstanding\_shares) \* user\_shares  
  \- if impure income ratio exists: dividend\_received \* impure\_income\_ratio  
\- show which method was used.  
\- use Decimal.

Frontend:  
\- purification table  
\- mark as paid  
\- export summary

Rules:  
\- Islamic mode only.  
\- no fake ratios.  
\- if insufficient data, show needs review.

Tests:  
\- both calculation methods  
\- missing data path  
\- mark paid  
\- report total

Run validation and commit only when green.  
---

## **Prompt 26 — Tax pack foundation**

Read AGENTS.md and the full codebase first.

Goal: create CPA-ready data preparation foundation.

Add schema:  
\- tax\_packs  
  \- id  
  \- tax\_year  
  \- jurisdiction: US/UK/Singapore/GCC/General  
  \- base\_currency  
  \- status: draft/finalized/exported  
  \- created\_at  
  \- finalized\_at nullable

\- tax\_pack\_lines  
  \- id  
  \- tax\_pack\_id FK  
  \- category: realized\_gain/dividend/interest/coupon/fx/private\_distribution/other  
  \- asset\_id nullable  
  \- activity\_id nullable  
  \- amount  
  \- currency  
  \- taxable\_date  
  \- source\_citation\_id nullable  
  \- notes nullable

Backend:  
\- \`generate\_tax\_pack(tax\_year, jurisdiction)\`  
\- include realized gains from existing FIFO logic  
\- include dividends/interest/coupons  
\- include private distributions if available  
\- include FX conversion notes where existing FX data supports it  
\- produce missing-data checklist

Rules:  
\- this is a data preparation pack, not tax advice.  
\- every line must trace to ledger/citation/manual source if available.  
\- no fake tax categories.  
\- no jurisdiction-specific filing claims beyond structured summaries.

Tests:  
\- tax year filtering  
\- realized gain line creation  
\- dividend line creation  
\- missing citation warning  
\- no data creates empty draft with checklist

Run validation and commit only when green.  
---

## **Prompt 27 — CPA-ready export bundle**

Read AGENTS.md and the full codebase first.

Goal: export tax packs for accountants.

Implement export:  
\- ZIP bundle  
\- summary PDF or HTML/PDF if existing export infrastructure supports it  
\- CSV/XLSX ledger summary  
\- source document manifest  
\- source documents folder for linked document citations where available  
\- disclaimers

Rules:  
\- decrypted source documents must not leak to temp disk after export.  
\- if source document unavailable, manifest flags missing.  
\- do not provide tax advice.  
\- preserve Decimal precision.  
\- export is deterministic.

Tests:  
\- ZIP contains expected files  
\- CSV values exact  
\- missing source document flagged  
\- disclaimer present  
\- no temp file leak if testable

Run validation and commit only when green.  
---

## **Prompt 28 — Report Builder foundation**

Read AGENTS.md and the full codebase first.

Goal: create reusable report infrastructure.

Support first reports:  
\- Net Worth Report  
\- Portfolio Summary Report  
\- Income Report  
\- Data Quality Report  
\- Tax Pack Report if implemented

Report architecture:  
\- report\_runs  
\- report\_sections  
\- report\_lines  
\- source citations on report lines  
\- generated\_at  
\- base\_currency  
\- disclaimer text

Frontend:  
\- Reports page  
\- choose report type  
\- preview  
\- export

Backend:  
\- deterministic report generation  
\- no AI commentary yet  
\- no fake lines

Tests:  
\- report run created  
\- lines cite sources when available  
\- export generates bytes  
\- empty state works

Run validation and commit only when green.  
---

## **Prompt 29 — Monthly Wealth Letter deterministic version**

Read AGENTS.md and the full codebase first.

Goal: create a premium monthly summary without LLM dependency.

Generate deterministic monthly wealth letter:  
\- opening summary  
\- net worth change  
\- income received  
\- largest contributors if available  
\- fees if available  
\- stale data warnings  
\- pending document reviews  
\- upcoming capital calls/coupons/maturities  
\- tax/zakat readiness if enabled  
\- data quality score

Use templates, not AI.  
Every number comes from deterministic data.

Frontend:  
\- Reports \> Monthly Wealth Letter  
\- preview  
\- export

Tests:  
\- template contains exact source values  
\- no unsupported section appears  
\- empty month handles gracefully

Run validation and commit only when green.  
---

## **Prompt 30 — Corporate actions engine**

Read AGENTS.md and the full codebase first.

Goal: harden public market accounting.

Add schema:  
\- corporate\_actions  
  \- id  
  \- asset\_id FK  
  \- action\_type: split/reverse\_split/merger/spinoff/symbol\_change/return\_of\_capital/stock\_dividend  
  \- effective\_date  
  \- ratio\_numerator nullable  
  \- ratio\_denominator nullable  
  \- metadata\_json nullable  
  \- citation\_id nullable  
  \- created\_at

Implement first:  
\- split  
\- reverse split  
\- symbol change

Rules:  
\- actions applied in a SQLite transaction.  
\- tax lots adjusted deterministically.  
\- cost basis total preserved for splits.  
\- immutable audit event written.  
\- no automatic corporate action from web.  
\- user enters/reviews.

Tests:  
\- 2:1 split  
\- reverse split  
\- cost basis preservation  
\- symbol change  
\- invalid ratio rejected

Run validation and commit only when green.  
---

## **Prompt 31 — Accuracy invariant hardening**

Read AGENTS.md and the full codebase first.

Goal: make Mizan’s financial core trustworthy.

Audit financial calculations:  
\- no f32/f64 in money paths  
\- use Decimal/rust\_decimal consistently  
\- strict rounding at display/export boundary  
\- full precision internally

Add invariant tests:  
1\. Sum of open lots equals holding quantity.  
2\. Sum of lot cost basis equals holding cost basis.  
3\. Cash ledger equals cash balance.  
4\. Realized gains equal proceeds minus cost basis minus fees.  
5\. Split preserves total cost basis.  
6\. FX conversion fails explicitly when rate missing.  
7\. Report totals equal line sums.

Use proptest where practical.  
Use golden-file tests for known scenarios.

Do not rewrite large architecture unnecessarily.  
Prioritize invariants around existing engine.

Run validation and commit only when green.  
---

## **Prompt 32 — Golden import templates**

Read AGENTS.md and the full codebase first.

Goal: make imports deterministic and reliable.

Create deterministic import templates for:  
\- Yahoo Finance holdings CSV  
\- Yahoo Finance transaction CSV if applicable  
\- IBKR activity CSV  
\- Fidelity CSV  
\- Schwab CSV  
\- generic bank CSV  
\- fixed deposit CSV template  
\- private investment capital call CSV template

Rules:  
\- strict header matching.  
\- no AI mapping for golden templates.  
\- clear error for unknown columns.  
\- dry-run preview required.  
\- no fake valid rows.  
\- duplicate detection preserved.  
\- append/update behavior must match existing import rules.

Tests:  
\- fixture for each template  
\- bad header rejected  
\- duplicate row detected  
\- missing required field rejected  
\- no partial invalid import

Run validation and commit only when green.  
---

## **Prompt 33 — Web Evidence Engine foundation**

Read AGENTS.md and the full codebase first.

Goal: add safe public evidence support without paid APIs.

This is not live market data. This is evidence collection for manually valued assets.

Add schema:  
\- web\_search\_jobs  
\- web\_search\_queries  
\- web\_search\_results  
\- web\_fetched\_pages  
\- web\_extracted\_facts  
\- web\_evidence\_packs  
\- web\_evidence\_reviews  
\- asset\_web\_watchlists  
\- source\_allowlist  
\- source\_blocklist  
\- web\_rate\_limits

Rules:  
\- web evidence never directly updates asset values.  
\- user approval required.  
\- no paid API dependency.  
\- no paywall/login bypass.  
\- obey rate limits.  
\- store source URL, fetched\_at, content hash.  
\- show source class and confidence.  
\- support user-pasted URL first.  
\- SearXNG/configurable search provider can come later.

Implement first:  
\- user pastes URL for an asset.  
\- Mizan fetches static page using reqwest.  
\- extracts title/text/metadata.  
\- stores evidence candidate.  
\- user can approve as valuation evidence or reject.  
\- approved evidence can create a valuation with source citation.

Tests:  
\- fetch allowed URL mocked  
\- blocked domain rejected  
\- evidence cannot auto-update valuation  
\- approval writes valuation and provenance

Run validation and commit only when green.  
---

## **Prompt 34 — Web price evidence for property/car/watch/gold**

Read AGENTS.md and the full codebase first.

Goal: add asset-specific web evidence workflows.

Support:  
\- property comparable evidence  
\- car comparable evidence  
\- watch/collectible comparable evidence  
\- gold/silver reference evidence

Rules:  
\- property/car/watch output must be a range, not exact truth.  
\- asking price is not sale price; show warning.  
\- gold/silver must show unit/purity/date/source.  
\- no paid APIs.  
\- no auto-update.  
\- user approves final value.

Implement:  
\- deterministic parser/normalizer for price, currency, date, title, source URL.  
\- outlier detection where multiple sources exist.  
\- source confidence scoring.  
\- UI evidence review cards.

Tests:  
\- currency parsing  
\- unit parsing  
\- outlier removal  
\- approval flow  
\- rejected evidence retained

Run validation and commit only when green.  
---

## **Prompt 35 — Local AI model registry only**

Read AGENTS.md and the full codebase first.

Goal: prepare for local AI without using cloud AI or mutating financial truth.

Add local model registry:  
\- local\_ai\_models  
\- local\_ai\_model\_files  
\- local\_ai\_model\_capabilities  
\- local\_ai\_settings  
\- local\_ai\_inference\_runs

Implement:  
\- register model manifest  
\- verify checksum  
\- enable/disable model  
\- list installed models  
\- remove model  
\- settings UI

Rules:  
\- no model bundled unless already present.  
\- no paid API.  
\- no inference yet unless repo already supports local runtime.  
\- no AI output can update ledger.  
\- model files must be checksum verified.

Tests:  
\- valid manifest accepted  
\- invalid checksum rejected  
\- enable/disable works  
\- remove works

Run validation and commit only when green.  
---

## **Prompt 36 — Semantic search with SQLite FTS and vector-ready abstraction**

Read AGENTS.md and the full codebase first.

Goal: create semantic/exact search infrastructure.

Implement:  
\- semantic\_index\_items  
\- semantic\_links  
\- FTS5 exact search for:  
  \- documents text blocks  
  \- assets  
  \- activities  
  \- reports  
  \- alerts  
\- vector-ready abstraction for sqlite-vec if extension is available.

Rules:  
\- app must work even if vector extension is unavailable.  
\- exact search works first.  
\- vector search can be gated behind capability detection.  
\- no cloud embeddings.  
\- no fake embeddings.

Frontend:  
\- Ask/Search Mizan privately search shell.  
\- Results must cite source objects.

Tests:  
\- index asset  
\- index document text  
\- search exact text  
\- delete removes index  
\- permission/entity filter respected if entity model exists

Run validation and commit only when green.  
---

## **Prompt 37 — Local memory layer**

Read AGENTS.md and the full codebase first.

Goal: add safe local personalization memory.

Add schema:  
\- ai\_memory\_items  
\- ai\_memory\_candidates  
\- ai\_memory\_feedback  
\- ai\_behavior\_events  
\- ai\_user\_preferences

Features:  
\- Memory Center UI  
\- view memories  
\- approve candidate  
\- reject candidate  
\- delete memory  
\- export memory JSON  
\- disable memory  
\- “why remembered?” field

Rules:  
\- local only.  
\- no sensitive memory without explicit approval.  
\- memory cannot create financial facts.  
\- memory cannot update ledger.  
\- memory only affects UI preferences, alert preferences, report preferences, dashboard ordering, and similar product behavior.

Tests:  
\- create candidate  
\- approve memory  
\- reject memory  
\- delete memory  
\- disabled memory prevents candidate creation

Run validation and commit only when green.  
---

## **Prompt 38 — Daily Wealth Briefing deterministic \+ optional AI wording hook**

Read AGENTS.md and the full codebase first.

Goal: create daily briefing from deterministic data.

Briefing sections:  
\- greeting  
\- what changed  
\- needs attention  
\- income received  
\- upcoming events  
\- document reviews  
\- stale valuations  
\- tax readiness  
\- zakat readiness if enabled  
\- one next best action

Backend:  
\- briefing\_service builds structured deterministic facts.  
\- Store briefings and sections if useful.  
\- No LLM required.  
\- Optional AI wording hook can be added but must not change numbers.

Frontend:  
\- dashboard briefing card  
\- refresh briefing  
\- click sources

Rules:  
\- every number has source.  
\- if data missing, say missing.  
\- no investment advice.

Tests:  
\- briefing with empty portfolio  
\- briefing with stale valuation  
\- briefing with capital call  
\- Islamic mode off/on behavior

Run validation and commit only when green.  
---

## **Prompt 39 — Next Best Action engine**

Read AGENTS.md and the full codebase first.

Goal: tell users the one thing to do next.

Add schema:  
\- next\_best\_actions  
  \- id  
  \- action\_type  
  \- title  
  \- explanation  
  \- priority\_score  
  \- source\_entity\_type  
  \- source\_entity\_id  
  \- status  
  \- action\_route  
  \- created\_at  
  \- updated\_at

Ranking inputs:  
\- alert severity  
\- due dates  
\- stale valuation age  
\- pending document reviews  
\- tax pack missing data  
\- asset importance  
\- private capital calls  
\- user memory preferences if implemented

Rules:  
\- deterministic ranking.  
\- AI may only rewrite explanation later.  
\- action must route to real screen.  
\- no fake action.

Tests:  
\- critical due action ranks first  
\- stale valuation lower than capital call  
\- dismissed action removed  
\- action route exists

Run validation and commit only when green.  
---

## **Prompt 40 — Senior Mode explanation simplifier**

Read AGENTS.md and the full codebase first.

Goal: make Mizan easier for older users.

Add setting:  
\- explanation\_style: simple/standard/professional/accountant

Implement copy variations for:  
\- dashboard warnings  
\- Explain This Number  
\- alerts  
\- data quality deductions  
\- tax pack disclaimers  
\- document review labels

Rules:  
\- do not change calculations.  
\- do not hide warnings.  
\- simple mode uses plain English.  
\- accountant mode shows more technical detail.

Tests:  
\- setting persists  
\- simple copy renders  
\- professional copy renders  
\- numbers/citations unchanged across modes

Run validation and commit only when green.  
---

## **Prompt 41 — Report source citations everywhere**

Read AGENTS.md and the full codebase first.

Goal: make reports traceable.

For every report line where possible, attach:  
\- ledger source  
\- valuation source  
\- document citation  
\- manual entry source  
\- calculation formula

Add missing citation wiring to:  
\- Net Worth Report  
\- Tax Pack  
\- Monthly Wealth Letter  
\- Private Investment Report  
\- Zakat Report  
\- Data Quality Report

Rules:  
\- if no citation exists, show “Manual/no source document linked.”  
\- do not fabricate citations.  
\- exports must include citation manifest.

Tests:  
\- report line with document citation  
\- report line with manual source  
\- export manifest includes references  
\- missing citation warning

Run validation and commit only when green.  
---

## **Prompt 42 — Entity and household model**

Read AGENTS.md and the full codebase first.

Goal: support family-office style ownership.

Add schema:  
\- households  
\- household\_entities  
  \- type: individual/joint/trust/company/foundation/other  
\- entity\_ownership  
\- entity\_members

Add entity\_id to assets if not already done.

Backend:  
\- all portfolio/net worth queries can optionally filter by entity.  
\- default view remains household/consolidated.  
\- existing assets without entity get assigned to default personal entity through migration.

Frontend:  
\- Settings \> Household & Entities  
\- entity filter on Portfolio/Home/Reports

Rules:  
\- do not break existing single-user flow.  
\- default setup should be invisible/simple.  
\- no complicated RBAC yet.

Tests:  
\- migration assigns default entity  
\- entity-scoped net worth  
\- consolidated net worth  
\- asset entity reassignment

Run validation and commit only when green.  
---

## **Prompt 43 — RBAC and accountant/advisor export permissions**

Read AGENTS.md and the full codebase first.

Goal: add permissioned export foundation without overbuilding cloud auth.

Add schema:  
\- role\_assignments  
\- permission\_grants  
\- audit\_events

Roles:  
\- principal  
\- spouse  
\- advisor\_readonly  
\- accountant\_export  
\- trustee  
\- viewer

Implement first:  
\- local role metadata  
\- export scoping  
\- UI permission labels  
\- audit events for exports

Backend:  
\- export\_entity\_data(entity\_id, role\_scope)  
\- ensure only scoped entity data exported  
\- masked/private fields excluded where configured

Rules:  
\- no cloud account registration.  
\- no Stripe.  
\- no sync sharing unless existing sync architecture supports it.  
\- security tests required.

Tests:  
\- accountant export contains only selected entity  
\- personal assets excluded  
\- audit event written  
\- read-only role cannot mutate

Run validation and commit only when green.  
---

## **Prompt 44 — Estate / Legacy Binder**

Read AGENTS.md and the full codebase first.

Goal: create premium older-user value without legal advice.

Build Estate/Legacy Binder report/export.

Includes:  
\- accounts list  
\- assets list  
\- liabilities  
\- property  
\- insurance/ULIP  
\- pensions  
\- private investments  
\- key contacts notes  
\- document manifest  
\- entity ownership summary  
\- optional zakat/waqf/charity notes if Islamic mode enabled

Rules:  
\- explicitly not legal advice.  
\- no will/trust generation.  
\- export encrypted archive if existing encryption export exists.  
\- user chooses included sections.  
\- source citations where available.

Tests:  
\- report generation  
\- encrypted archive round trip if supported  
\- excluded sections omitted  
\- disclaimer present

Run validation and commit only when green.  
---

## **Prompt 45 — Fee Intelligence**

Read AGENTS.md and the full codebase first.

Goal: help users understand fees.

Add fee categorization:  
\- broker fees  
\- platform fees  
\- advisory fees  
\- fund fees/manual expense ratio  
\- insurance/ULIP charges  
\- FX fees  
\- private fund fees  
\- other

Backend:  
\- classify existing activities where fee fields exist.  
\- allow manual fee entries.  
\- aggregate fees by period, account, asset, category.

Frontend:  
\- Reports \> Fee Report  
\- dashboard warning if fees spike unusually  
\- Explain This Number support

Rules:  
\- no advice.  
\- no hidden fee claims without source.  
\- extracted fees require citation/review if from docs.

Tests:  
\- fee aggregation  
\- period filtering  
\- fee spike alert  
\- report export

Run validation and commit only when green.  
---

## **Prompt 46 — Concentration and fragility radar**

Read AGENTS.md and the full codebase first.

Goal: show risk concentration plainly.

Compute concentrations:  
\- asset  
\- account/custodian  
\- currency  
\- sector/taxonomy if available  
\- country/taxonomy if available  
\- asset class  
\- income source  
\- manual/stale valuation exposure  
\- private/illiquid exposure  
\- Shariah unknown exposure if enabled

Frontend:  
\- dashboard card  
\- report section  
\- plain-English messages:  
  \- “42% of income comes from two assets.”  
  \- “28% of wealth is valued manually and older than 90 days.”

Rules:  
\- no investment advice.  
\- no buy/sell suggestions.  
\- deterministic thresholds configurable.

Tests:  
\- single asset concentration  
\- currency concentration  
\- stale valuation exposure  
\- empty taxonomy behavior

Run validation and commit only when green.  
---

## **Prompt 47 — Paid entitlement abstraction only, no billing**

Read AGENTS.md and the full codebase first.

Goal: prepare closed-source paid app gating without implementing Stripe, registration, checkout, or server billing.

Do not add:  
\- Stripe  
\- checkout  
\- registration  
\- subscription backend  
\- cloud account management

Implement only local abstraction:  
\- FeatureEntitlement enum  
\- EntitlementProvider trait/service  
\- LocalEntitlementSnapshot  
\- EntitlementGate component/hook  
\- feature usage limits

Default behavior:  
\- development build can enable all features via config.  
\- production/free mode gates premium features gracefully.  
\- gated screens show upgrade placeholder copy, but no payment flow.

Premium feature gates:  
\- Document Vault advanced extraction  
\- Tax Packs  
\- Private Investments  
\- Fixed Income/Sukuk advanced engine  
\- Shariah/Zakat  
\- Report Builder  
\- Estate Binder  
\- Web Evidence background checks  
\- Semantic Search  
\- Memory/AI features

Tests:  
\- free user blocked from premium command  
\- dev override works  
\- gated UI renders  
\- existing free functionality still works

Run validation and commit only when green.  
---

## **Prompt 48 — Offline signed license validation later-ready**

Read AGENTS.md and the full codebase first.

Goal: implement local license verification without billing.

Add:  
\- license\_entitlements table  
\- license verification module using ed25519-dalek  
\- hardcoded public key placeholder must be a real generated test/dev public key with clear config separation, not empty placeholder  
\- import license string command  
\- verify signature  
\- cache entitlement snapshot locally  
\- expiry handling  
\- invalid license handling

Rules:  
\- no Stripe.  
\- no registration.  
\- no online activation.  
\- no hostile DRM.  
\- app data must remain accessible even if license expires; only premium actions are gated.  
\- tests must use generated test keys.

Tests:  
\- valid signed license accepted  
\- invalid signature rejected  
\- expired license rejected  
\- free tier remains usable

Run validation and commit only when green.  
---

## **Prompt 49 — Final end-to-end validation and polish**

Read AGENTS.md and the full codebase first.

Goal: harden everything added so far.

Perform a full audit:  
1\. Run cargo fmt.  
2\. Run cargo clippy \-- \-D warnings.  
3\. Run cargo test.  
4\. Run pnpm typecheck.  
5\. Run pnpm lint.  
6\. Run pnpm test.  
7\. Run pnpm build.  
8\. Fix all failures properly.  
9\. Remove dead code.  
10\. Remove unused dependencies.  
11\. Confirm no \`any\` was introduced.  
12\. Confirm no fake data or placeholder rows.  
13\. Confirm no paid API dependency.  
14\. Confirm no AI path directly mutates financial truth.  
15\. Confirm document-extracted facts require review.  
16\. Confirm all new tables are covered by backup/export/encryption behavior where applicable.  
17\. Confirm app still launches.  
18\. Commit final stable milestone.

Do not add new features in this prompt.  
Only harden and stabilize.  
---

# **Correct Build Order**

Use this order exactly:

1. Stabilize current app  
2. Boomer navigation cleanup  
3. Home dashboard rebuild  
4. Universal asset model  
5. Universal Add Asset  
6. Bulk manual valuation update  
7. Data Quality Score  
8. Smart alerts  
9. Wealth Inbox  
10. Document Vault storage  
11. Document job system  
12. PDF extraction sidecar  
13. Extracted facts/citations  
14. Review Queue  
15. Explain This Number  
16. Reconciliation Center  
17. Private investments schema  
18. Private investments UI/J-curve  
19. Fixed income/Sukuk/FD engine  
20. Liquidity Ladder  
21. Fixed income/private alerts  
22. Islamic mode foundation  
23. Shariah screening  
24. Zakat  
25. Purification  
26. Tax pack foundation  
27. CPA export bundle  
28. Report Builder  
29. Monthly Wealth Letter  
30. Corporate actions  
31. Accuracy invariants  
32. Golden import templates  
33. Web Evidence foundation  
34. Web price evidence  
35. Local AI model registry  
36. Semantic search  
37. Local memory  
38. Daily briefing  
39. Next Best Action  
40. Senior Mode explanations  
41. Report citations  
42. Household/entity model  
43. RBAC/export permissions  
44. Estate Binder  
45. Fee Intelligence  
46. Concentration Radar  
47. Entitlement abstraction  
48. Offline license validation  
49. Final polish

# **What I would cut or delay**

Do **not** build these early:

\- Full Stripe/payment integration  
\- Registration/login rebuild  
\- Cloud AI chat  
\- Aggressive broker sync expansion  
\- Mobile polish  
\- Addon marketplace expansion  
\- Complex decentralized RBAC crypto  
\- Full Keyhive-style permissions  
\- Autonomous AI ledger updates  
\- Any paid API dependency

Build the **working wealth OS first**. Billing and registration can come once the product is genuinely worth paying for.

