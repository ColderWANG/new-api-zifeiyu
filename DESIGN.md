# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-10-23
- Primary product surfaces: dashboard overview, administrator user drawer and table, model/group settings.
- Evidence reviewed: `assets/screenshots/custom/overview.webp` (observed monochrome overview); `web/src/styles/theme.css`; `web/src/styles/index.css`; `web/components.json`; `web/AGENTS.md`; dashboard `summary-cards.tsx`; user `users-mutate-drawer.tsx` and `user-quota-cell.tsx`; `quota-details-popover.tsx`; model `ratio-settings-card.tsx` and group forms.
- No earlier root design document or dedicated Workmate mockup was found. The following extends the observed existing UI and the approved daily-wallet requirements.

## Brand
- Personality: warm, precise, operational, with the restored pink bow theme.
- Trust signals: explicit monetary amounts, visible source and timezone, honest negative balances, predictable save and error states.
- Avoid: decoration that obscures balances or controls, and language that promises unlimited or capped daily spending.

## Product goals
- Goals: show Workmate wallet balance and daily reset behavior clearly; let Root manage the group amount and administrators manage personal inheritance/overrides.
- Non-goals: change subscription ownership or create a second wallet, enforce a hard daily spending cap, accumulate unused daily balance.
- Success signals: users can identify their reset amount, current balance, spent and pending amounts, and next reset; operators understand the immediate effect before saving.

## Personas and jobs
- Primary personas: Workmate member; account administrator; Root operator.
- User jobs: inspect available funds and pending costs; choose group inheritance or a personal amount; adjust the shared daily amount.
- Key contexts of use: desktop operations, mobile account checks, long translated labels, accounts with zero or negative balances.

## Information architecture
- Primary navigation: retain the existing dashboard, Users, Wallet, and System Settings routes.
- Core routes/screens: dashboard overview displays the daily wallet within the balance area; Users exposes source/details within the existing quota cell and edit drawer; group settings exposes a separate daily reset editor.
- Content hierarchy: current balance first, reset amount and source next, today's consumption and pending amounts, then the next reset and explanatory rules.

## Design principles
- Reveal financial consequences before save: show the difference between old and new reset amounts and expected wallet balance when current daily-wallet data is available.
- Distinguish reset amount from spending: the amount is a wallet reset policy, not a hard cap; balances may become negative after policy changes or settlement.
- Tradeoffs: keep detailed rules beside the edit and in quota details instead of adding a new navigation surface. Display the fixed business timezone even when browser timezone differs.

## Visual language
- Color: reuse the restored pink palette (`#e8519d` primary, `#fffafc` background, `#563844` foreground) and semantic theme tokens; error indicators use existing destructive styling.
- Typography: reuse body tokens, `mm-label`, and monospace tabular monetary values.
- Spacing/layout rhythm: existing gap/padding scales, stacked controls in drawers, compact two-column definition lists for wallet details.
- Shape/radius/elevation: use the restored `0.875rem` base radius and existing border conventions; no new shadow system.
- Motion: landing-page bows use a slow floating animation and stop when reduced motion is requested; functional controls retain existing motion behavior.
- Imagery/iconography: the landing page may use the decorative bow SVG; functional icons still convey actions.

## Components
- Existing components to reuse: `SideDrawerSection`, existing Sheet/Form/Select/Input/Button wrappers, `QuotaDetailsPopover`, `ErrorState`, `LoadingState`, and the existing group settings workspace.
- New/changed components: business-specific `GroupDailyQuota`, `DailyQuotaFields`, and `DailyWalletCard`; each composes existing primitives because no existing component carries daily policy data, nullable personal inheritance, or the reset/spent/pending business model.
- Variants and states: root editable group policy; admin read-only group policy; inherited vs personal amount; zero override; negative balance; load/save/error/retry.
- Token/component ownership: shared UI remains under `web/src/components`; feature behavior stays in its existing feature; common API data schema lives in `web/src/lib/daily-quota.ts`.

## Accessibility
- Target standard: WCAG 2.1 AA, following `web/AGENTS.md`.
- Keyboard/focus behavior: reuse accessible Select and Popover keyboard handling; Escape closes quota details and returns focus to its trigger; disabled states reflect request/permission state.
- Contrast/readability: use neutral foreground/muted tokens and readable wrapping; never truncate monetary balances or reset time.
- Screen-reader semantics: named wallet sections, associated form labels, invalid state on amount inputs, definition lists, semantic reset `time`, and polite announcements of immediate balance changes.
- Reduced motion and sensory considerations: inherit existing reduced-motion settings; do not encode source or policy state using color alone.

## Responsive behavior
- Supported breakpoints/devices: existing mobile-first application breakpoints and desktop layouts.
- Layout adaptations: settings and drawer controls stack; overview keeps the current narrow balance column and stacks below the metrics on mobile; amounts and translated descriptions wrap within minimum-width-zero containers.
- Touch/hover differences: details open on explicit button activation rather than requiring hover; reuse touch-sized project controls.

## Interaction states
- Loading: show the shared loading state for group policy retrieval; keep persisted overview data during refresh.
- Empty: explicitly report absence of a daily policy; ordinary users retain the existing overview behavior when daily data is absent.
- Error: shared retry control for group fetch failure; normal Query/Mutation error handling for failed saves; never report business failure as saved.
- Success: existing success toast, query invalidation, refreshed group baseline.
- Disabled: group editing only for Root; disable pending save controls and user amount editing during submission.
- Offline/slow network: preserve the last successful overview snapshot; offer retry for policy retrieval; a failed fetch must not imply a zero group amount.

## Content voice
- Tone: short, factual, explicit about financial consequences.
- Terminology: daily reset amount, available balance, spent today, pending charges, inherit group amount, personal override.
- Microcopy rules: every new string has seven locale entries. Show `00:00 Asia/Shanghai`; explain that unused balance does not accumulate and the amount is not a spending cap. First entry overwrites the wallet; same-day rejoin does not regrant. Workmate requests use wallet funding while subscriptions remain preserved.

## Implementation constraints
- Framework/styling system: React 19, TypeScript, TanStack Query, React Hook Form/Zod, project Base UI wrappers and Tailwind 4; no new dependencies.
- Design-token constraints: retain the restored pink bow palette and currency helpers; display amounts follow the configured currency or token mode, while API payloads carry integer internal quota units.
- Performance constraints: share policy query keys; refresh Workmate self-wallet data every 30 seconds and on normal query refocus, without a bespoke timer system.
- Compatibility constraints: nullable personal override means inherit; explicit zero is valid; absent override preserves the stored value. Group policy changes immediately apply only the amount difference to inherited wallets. Backend is authoritative for entry history, timezone resets, settlement, and permissions.
- Test/screenshot expectations: focused behavior tests cover inheritance/zero conversion, preview/overwrite copy, negative balances, keyboard details, root/admin permissions, save/retry, and narrow wrapping. Typecheck and touched-file lint are required. Browser screenshot validation remains an integration responsibility; the existing overview screenshot is design evidence, not a measured pixel target.

## Open questions
- [x] Chromium verified the API-backed group editor, user override drawer, and Workmate dashboard at 1440×1000 and 390×844 on 2026-10-20. On 2026-10-23 the restored pink bow homepage was checked at 1365×900 and 390×844 after the Workmate-capable release was deployed. The palette and bow decoration are visual changes; wallet rules remain as above.

## Codex channel weekly estimate
- The existing channel account-and-usage dialog shows a compact estimate card immediately below the base rate-limit windows. Amounts use explicit USD formatting regardless of the site's display currency.
- First query, too-small changes, and unavailable billing data have distinct explanations. A numerical estimate appears only after meaningful observations in the same upstream weekly window.
- The card shows estimated total and remaining USD equivalents alongside the observed channel spend and upstream percentage change. Copy explicitly says the result is an estimate: other account activity, model mix, and local prices can change it. The card never presents the number as an official subscription limit.
