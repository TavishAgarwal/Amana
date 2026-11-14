# AMANA: Design

> UI details for the wallet (phone), the counsellor console and the programme dashboard: principles, brand, design tokens, components, screens, copy, accessibility and the demo screen flow.
> **Related docs:** `PRD.md` · `architecture.md` · `rules.md` (§5 content rules, §9 design rules) · `phases.md`.
> Arabic text in this file is a **draft for native-speaker and clinician review**, not final copy.

---

## 1. Design principles

1. **Calm, not alarming.** Genetic results are emotional. No red alerts, no celebrations. Plain words, lots of space.
2. **Private by default, and it shows.** Every screen that shows personal data says who can see it. Sharing is always a deliberate step.
3. **The screen never judges.** "Shared risk found" and "no shared risk found" use the **same layout and colour**. Only the words and the next step change.
4. **Arabic first.** Designed right-to-left first, then mirrored for English. Not a translation added later.
5. **Understanding over information.** One idea per screen, then check that it landed (teach-back).
6. **A human is always one tap away.** Every result screen offers a counsellor.
7. **Works for everyone.** Low literacy, low vision, older phones, slow networks.

---

## 2. Brand and voice

- **Name:** AMANA (أمانة, "trust" / "something held in trust").
- **Logo idea:** two soft overlapping arcs forming a shared space, in the primary colour. No DNA helix (overused, and clinical).
- **Voice:** warm, plain, respectful, never directive. Like a kind, well-informed relative who is also a nurse.
- **Say:** "You carry…", "Carriers are healthy", "Your options include…", "Only you can see this".
- **Never say:** "You should / shouldn't marry", "safe / unsafe couple", "Warning", "Great news", "defective gene", "bad result".

---

## 3. Design tokens

### 3.1 Colour (light mode)

The look is warm paper and ink: off-white backgrounds, brown-black text, one muted brown for actions, and soft tints for cards. No bright colours. The source of truth is `packages/ui/tokens.css`.

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#F6F1E9` | App background (paper), with a faint warm glow at the top (`--bg-glow` `#F1E2D6`) |
| `--surface` | `#FFFCF7` | Cards, sheets |
| `--muted` | `#EFE8DD` | Secondary panels, badges |
| `--border` | `#E4DBCD` | Decorative dividers and card borders only |
| `--border-strong` | `#8A7E71` | Input outlines, checkboxes, outline buttons (needs 3:1) |
| `--text` | `#2A2420` | Main text |
| `--text-muted` | `#6A5F55` | Secondary text, small-caps labels |
| `--primary` | `#6B4430` | Primary buttons and links (deep brown) |
| `--primary-hover` | `#55341F` | Hover / pressed |
| `--primary-soft` | `#F0E5D9` | Selected states, "reviewed" badge |
| `--ink` / `--on-ink` | `#2A2420` / `#FFF7EC` | The floating tab bar, result panels and the "Ask" pill |
| `--dot-0` … `--dot-4` | `#E9E1D5` → `#6E3B22` | The gene dot matrix and the inheritance diagram, light to dark |
| `--tint-sand` / `-sage` / `-blue` / `-rose` | `#EFE3CF` / `#DFE4D5` / `#DCE2E7` / `#EEDDD6` | Card tints in the swipe rows, in that order |
| `--info` | `#3F5A78` | Counsellor and help elements |
| `--error` | `#9E3B2F` | **Form and system errors only. Never for genetic results** |
| `--warning` | `#8A5A00` | System warnings and "pending review" |
| `--focus` | `#2F6FB3` | Keyboard focus ring (2 px + 2 px offset) |

### 3.2 Colour (dark mode)

| Token | Hex |
|---|---|
| `--bg` | `#191613` |
| `--surface` | `#221F1B` |
| `--text` | `#EFE8DE` |
| `--text-muted` | `#B8AD9F` |
| `--primary` | `#E3B98F` (text on it: `#191613`) |
| `--ink` | `#0E0C0A` |
| `--dot-0` … `--dot-4` | `#35302A` → `#F0C9A0` |

**Contrast:** every text/background pair reaches WCAG AA (4.5:1 body, 3:1 large text and UI parts). Checked on 14 Nov 2026. Light mode: text on background 13.6:1, muted text 5.5:1, white on primary 8.4:1, tab bar text on ink 8.7:1, `--border-strong` on surface 3.9:1. Dark mode: every pair 4.4:1 or higher. `--border` is decorative only. `scripts/a11y.mjs` checks 58 screens in both modes with axe-core: 0 violations.

### 3.3 Chart colours (dashboard)
Colour-blind-safe set, used in this order: `#0072B2` · `#E69F00` · `#009E73` · `#CC79A7` · `#56B4E9`. Always add labels or patterns, so colour is never the only signal.

### 3.4 Typography

| Role | Arabic | English |
|---|---|---|
| Titles, the big result number, card titles | Noto Naskh Arabic, Al Nile or Geeza Pro (serif) | Iowan Old Style, Palatino or Georgia (serif) |
| Body, buttons, labels | The system sans-serif face | The system sans-serif face |
| Source | Fonts already on the phone. Nothing is downloaded, so text shows offline and no font request leaves the device | |

Section labels are small capitals with wide letter spacing ("ABOUT", "YOUR CARDS"); in Arabic they use the normal face with no spacing.

| Style | Size (Arabic / English) | Weight | Line height (Arabic / English) |
|---|---|---|---|
| Display | 30 / 28 px | 600 | 1.5 / 1.25 |
| Title | 24 / 22 px | 600 | 1.6 / 1.3 |
| Heading | 20 / 18 px | 600 | 1.6 / 1.35 |
| Body | 17 / 16 px | 400 | 1.75 / 1.5 |
| Small | 15 / 14 px | 400 | 1.7 / 1.45 |
| Label | 15 / 14 px | 500 | 1.5 / 1.3 |

- Arabic runs one step larger with more line height, because Arabic letterforms are smaller at the same size.
- **Numerals:** Western digits (0–9) by default; Eastern Arabic digits (٠–٩) as a setting.
- Gene symbols (HBB, CFTR) are always Latin, set in the English face, inside a left-to-right span.

### 3.5 Spacing, shape, elevation

- **Spacing scale (4 px grid):** 4 · 8 · 12 · 16 · 24 · 32 · 48.
- **Screen gutters:** 16 px on phones, 24 px on tablets and up.
- **Radius:** 8 px inputs · 12 px cards · 16 px sheets · full pill for primary buttons.
- **Elevation:** one soft shadow level for sheets and dialogs only; cards use borders, not shadows.
- **Touch targets:** minimum 44 × 44 px; 8 px minimum between targets.

### 3.6 Icons
- **Set:** Lucide (ISC licence), 24 px, 1.75 px stroke.
- **Mirror in right-to-left:** arrows, chevrons, back, forward, "send", progress direction.
- **Don't mirror:** lock, QR, check mark, clock, play, search, people.

---

## 4. Layout and navigation

### 4.1 Wallet (phone, 360–430 px wide, designed at 390 px)
- **Bottom tab bar, 4 tabs** (order follows reading direction):
  1. **My result** (home)
  2. **Check together** (pair + check)
  3. **Sharing** (permissions + audit log)
  4. **Help** (counsellor, questions)
- **Top bar:** screen title, back arrow (mirrored), language switch on onboarding screens only.
- **Settings** are reached from the top bar on "My result".
- **Primary action** sits at the bottom of the screen, within thumb reach, full width.

### 4.2 Console (desktop, designed at 1280 px, works from 1024 px)
- **Side navigation** on the start side (right in Arabic, left in English): Queue · Dashboard · Attack demo · Settings.
- **Main area:** list + detail split on the queue; full width on the dashboard.
- Arabic and English both supported; counsellor chooses at sign-in.

---

## 5. Components

| Component | Purpose | Key details |
|---|---|---|
| **Button** | Actions | Primary (filled brown) · Ink (dark pill, for the one main action on a screen) · Secondary (outline) · Tertiary (text) · Destructive (outline, error colour; used only for delete/revoke). One primary button per screen |
| **PrivacyNote** | Says who can see this screen's data | Small bar with lock icon in `primary.soft`: "Only you can see this." Appears on every screen with personal data |
| **ResultPanel** | Shows a check or programme result | Same size, colour (`ink`) and layout for every outcome. Contains: plain-language result, what it means (one line), next step button |
| **ConditionCard** | Explains one condition | Title, "What it is", "Being a carrier", "If both partners carry it", "Your options", sources, ReviewStatusBadge. Expandable sections |
| **ReviewStatusBadge** | Content trust | "Reviewed by a clinician" (soft brown) or "Pending clinical review" (warning colour, with explanation) |
| **TeachBackQuestion** | Understanding check | One question per screen, 3 large answer options, gentle feedback that explains the right answer. No scores shown as grades |
| **InheritanceDiagram** | Shows the 25% idea | Four-child grid: 1 not a carrier, 2 carriers, 1 affected. Illustrated people, not pedigree symbols. Caption: "This is the chance for **each** pregnancy" |
| **ConsentSheet** | Asks for a permission | Bottom sheet: what will be shared, with whom, for how long, how to undo it. Two buttons: "Agree" (primary) and "Not now" (secondary, equal size) |
| **PermissionRow** | One permission in Sharing | Who, what, expires, Revoke button |
| **AuditRow** | One access in the log | Who (role, e.g. "Counsellor"), what, when. Read-only |
| **QRPair** | Pairing | Large QR with countdown ring (5 min); "Scan your partner's code" toggle; camera view with frame guide |
| **StepIndicator** | Multi-step flows | Dots or "Step 2 of 3", direction follows language |
| **TierBadge** (console) | Case tier | Tier 1 / 2 / 3 with text, not colour alone |
| **SLATimer** (console) | Time left to respond | Countdown text + thin bar; turns `warning` under 20% time left |
| **StatTile** (dashboard) | One headline number | Number, label, comparison line, "n =" count, hidden-group notice |
| **OfflineBanner** | Network status | Warning colour bar: "You're offline. Your results are still here." |
| **EmptyState / ErrorState** | No data / failure | Plain text, one action, no blame ("Something went wrong on our side") |
| **LanguageSwitch** | العربية / English | Shown on onboarding and in Settings |

---

## 6. Wallet screens

**Core screens** (designed first, hi-fi by P2): W1, W3, W4, W5, W6, W7, W8, W10.

### W1 · Welcome and language
- **Purpose:** first impression; choose language.
- **Content:** logo, one-line promise ("Understand your genetic result. Share only what you choose."), language buttons (العربية first), "Continue".
- **Notes:** no sign-up form. Short privacy promise with a "How we protect you" link.

### W2 · Sign in
- **Purpose:** national-ID sign-in (mock in prototype).
- **Content:** one button "Sign in with national digital ID", short note on what AMANA receives (name reference and test result only).
- **States:** loading, failed sign-in (retry), cancelled.

### W3 · My result (home)
- **Purpose:** the person's own carrier result.
- **Content order:**
  1. PrivacyNote.
  2. Summary: "You carry 1 change in a gene" (or "No carrier changes found among the {n} genes screened", where `{n}` is the panel size from the country pack: 111 in the prototype, 570 in the real programme).
  3. One ConditionCard preview per carrier gene, each with "Learn more".
  4. "Carriers are healthy" reassurance line.
  5. Secondary actions: "Check together with a partner", "Talk to a counsellor".
- **States:** no credential yet (EmptyState: "Your result will appear here when your lab sends it"); expired credential; offline.

### W4 · Condition card + teach-back
- **Purpose:** explain one condition, then check understanding.
- **Content:** ConditionCard (expandable sections), InheritanceDiagram, "Read in simpler words" toggle (AI rewording of the reviewed card), ReviewStatusBadge, sources. Then 3 TeachBackQuestions.
- **Notes:** the "simpler words" version shows a small label "Reworded from the reviewed card". If the fact-checker blocks it, show the original card without an error.

### W5 · Programme result
- **Purpose:** the official couple result from the national programme.
- **Content:** ResultPanel with one of three messages:
  - Compatible, no carriers → short explanation.
  - Compatible, one or both carriers → "Your result is compatible. You are a carrier of… Here's what that means for you and your family."
  - Incompatible → "You both carry a change in the same gene. A counsellor can explain what this means and your options." + "Share with a counsellor" (opens ConsentSheet).
- **Notes:** same panel design for all three.

### W6 · Pair (check together)
- **Purpose:** connect two phones in person.
- **Content:** explanation ("You'll both learn only one thing: whether you share a risk in the same gene. Neither of you sees the other's results."), ConsentSheet for "check only", then QRPair with toggle "Show my code / Scan partner's code".
- **States:** camera permission denied (explain + manual code entry), code expired (new code), partner didn't consent.

### W7 · Check: progress and result
- **Purpose:** run the check and show the answer.
- **Content:** progress step ("Checking privately…", with a short line "Your results never leave your phone"), then ResultPanel:
  - "No shared-gene risk found among the {n} genes screened." Next step: "Learn about your own result".
  - "You share a change in the same gene." Next step: "Show which condition" (W8) and "Talk to a counsellor".
- **Notes:** both outcomes appear with identical layout and colour, and the same duration on screen before the next step, so the screen can't be read by a glance at the colour.

### W8 · Reveal consent
- **Purpose:** two-step reveal of the condition name.
- **Content:** "Show which condition? Both of you need to agree. You'll see only the condition you share, nothing else." ConsentSheet → waiting state "Waiting for your partner…" → ConditionCard of the shared condition + "Book a counsellor".
- **States:** partner declined ("Your partner chose not to see the condition now. You can still talk to a counsellor."); timeout.

### W9 · Book a counsellor
- **Purpose:** choose a slot and what to share.
- **Content:** tier-appropriate options (self-serve, ask a question, one-to-one), slot list from the country pack directory, ConsentSheet listing exactly what the counsellor will see.

### W10 · Sharing and audit log
- **Purpose:** full control.
- **Content:** two sections:
  - **Active permissions** (PermissionRow, each with Revoke).
  - **Activity** (AuditRow list).
  - Footer: "Revoking stops future access straight away."
- **States:** none shared ("You haven't shared anything.").

### W11 · Settings
- Language · Numerals (0–9 / ٠–٩) · App lock (device PIN / biometrics) · Text size · **Delete all my data** (destructive, with confirm screen explaining it can't be undone).

### W12 · Invite relatives (stretch)
- **Content:** preview of the exact invite text the relative will see (no sender, no gene), "Copy link" / "Share", explanation that acceptance is counted only in totals.

---

## 7. Console and dashboard screens

### C1 · Sign in
Counsellor or programme manager sign-in via the mock national-ID provider; role chosen by account.

### C2 · Queue
- **Layout:** filter bar (Tier, status, language) → list.
- **Each row:** TierBadge, SLATimer, language, case type (private check / programme result), consented scope icon. **No names or genes in the list.**
- **Sort:** Tier 3 first, then time left.

### C3 · Case detail
- **Content:** consented scope summary ("This couple shared: condition name, wish for one-to-one"), copilot summary (labelled "Draft prepared by AI. Check before use."), the shared ConditionCard, neutral options list, notes field.
- **Rule:** anything not consented is not shown; an AuditRow is written on open.

### C4 · Sign-off
- **Content:** final note preview, checkbox "I have reviewed this note", "Sign off and send" (primary).
- **Rule:** the "Clinical advice" label appears on the person's side only after this.

### C5 · Dashboard (programme manager)
- **Row 1, StatTiles:** check correctness · unauthorised disclosures · red-team result · teach-back improvement.
- **Row 2, charts:**
  - Understanding before vs after, by language (paired bars).
  - Fairness by literacy band (groups under 5 hidden, with a note).
- **Row 3, scale panel:**
  - Load-test result (checks vs time per check).
  - Cost per couple per year (AED).
  - Cross-lab test result.
  - Rollout map: Abu Dhabi → UAE → Saudi Arabia.
- Every chart shows "n =" and data source (pilot or simulation).

### C6 · Attack demo
- **Layout:** two columns:
  - **Plain matching:** the attacker claims every gene on the panel, and the victim's full list appears.
  - **AMANA:** the same attempt is rejected with the reason ("Tokens not signed by the national service").
- **Style:** clearly marked "Demonstration" banner, so it is never confused with the real app.

---

## 8. Demo screen flow (3 minutes)

Used for Gate 2 and the final video. Two phones (Mariam, Khalid) + a laptop (console) + a third phone or laptop tab (attacker).

| Time | Screen | What the audience sees |
|---|---|---|
| 0:00 | Slide | Hook: 565 couples learned at the marriage-contract stage; thousands of carriers learned nothing |
| 0:30 | Slide | Problem: late, yes/no only, fear of exposure, no Arabic help |
| 1:00 | W3 → W4 | Mariam's result in Arabic; condition card; teach-back question |
| 1:15 | W6 | Both phones: consent, QR scan |
| 1:25 | W7 | "You share a change in the same gene" |
| 1:35 | W8 | Both tap reveal → β-thalassaemia card |
| 1:45 | C2 → C3 | Console: case appears with Tier 3 timer; copilot draft; sign-off |
| 1:55 | C6 | Attack phone tries every gene on the panel → rejected |
| 2:10 | W10 | Mariam's sharing log; she revokes the counsellor permission |
| 2:20 | C5 | Dashboard: understanding result, fairness, scale panel |
| 2:45 | Slide | Ask: pilot with DoH/ADPHC + one lab; Gulf programmes next |

**Offline backup:** the same flow on the laptop hotspot; recorded video ready.

---

## 9. Copy

### 9.1 Rules
- One idea per sentence. Short sentences.
- Use "you" and, for couples in Arabic, the **dual** form (أنتما, لديكما).
- Arabic forms are **gender-aware**: keep masculine and feminine variants in the message files, chosen from the profile, with a neutral fallback.
- Numbers always with context: "1 in 4 chance for each pregnancy", never "25% risk" alone.
- Never put a gene or condition name in a notification or on the lock screen.

### 9.2 Key strings (draft; Arabic needs native and clinician review)

| Key | English | Arabic (draft) |
|---|---|---|
| privacy.onlyYou | Only you can see this. | هذه المعلومات تظهر لك فقط. |
| result.carrier.f | You carry one change in the HBB gene. Carriers are healthy. | أنتِ تحملين تغيّرًا واحدًا في جين HBB. حاملو التغيّرات الجينية أصحّاء. |
| result.carrier.m | You carry one change in the HBB gene. Carriers are healthy. | أنتَ تحمل تغيّرًا واحدًا في جين HBB. حاملو التغيّرات الجينية أصحّاء. |
| check.explain | You'll both learn only one thing: whether you share a risk in the same gene. | ستعرفان أمرًا واحدًا فقط: هل لديكما خطر مشترك في الجين نفسه. |
| check.none | No shared-gene risk found among the {n} genes screened. | لم يُعثر على خطر مشترك في الجينات الـ{n} التي فُحصت. |
| check.shared | You share a change in the same gene. A counsellor can explain what this means and your options. | لديكما تغيّر في الجين نفسه. يمكن للمستشار أن يشرح لكما ما يعنيه ذلك والخيارات المتاحة. |
| reveal.ask | Show which condition? Both of you need to agree. | هل تريدان معرفة الحالة؟ يجب أن يوافق كلاكما. |
| reveal.declined | Your partner chose not to see the condition now. You can still talk to a counsellor. | اختار شريكك عدم معرفة الحالة الآن. لا يزال بإمكانك التحدث مع مستشار. |
| sharing.revokeNote | Revoking stops future access straight away. | إلغاء الإذن يوقف أي وصول لاحق فورًا. |
| card.reworded | Reworded from the reviewed card. | أُعيدت صياغته من البطاقة المُراجَعة. |
| offline | You're offline. Your results are still here. | أنت غير متصل بالإنترنت. نتائجك ما زالت هنا. |

---

## 10. Accessibility

- **Standard:** WCAG 2.2 AA on all core screens. Checked automatically with `pnpm a11y`
  (`scripts/a11y.mjs`): 0 axe-core violations on 58 screens on 10 Nov 2026. The screen-reader line
  below is the target; it has not been tested by hand yet (`docs/limitations.md`).
- **Screen readers:** tested with VoiceOver (iOS) and TalkBack (Android) in Arabic and English. Every icon button has a label; QR has a text alternative (manual code).
- **Text size:** layouts hold at 200% text size with no cut-off text.
- **Focus:** visible focus ring on every interactive element in the console.
- **Language tags:** `lang="ar" dir="rtl"` and `lang="en" dir="ltr"` set per page; gene symbols wrapped as left-to-right.
- **Low literacy:** InheritanceDiagram on every card; short sentences; read-aloud is a later feature (cut for the prototype).
- **Reduced motion:** respect the system setting; no essential information in animation.

---

## 11. Privacy patterns in the UI

- **App lock:** device PIN or biometrics before any result is shown (on by default).
- **Background blur:** content hidden when the app is in the app switcher.
- **Discreet notifications:** "You have a new update in AMANA". Never a gene, condition or partner name.
- **Who-can-see-this:** PrivacyNote on every personal screen; ConsentSheet always lists who, what, how long, how to undo.
- **Equal choices:** "Agree" and "Not now" are the same size; "Not now" is never hidden or greyed.
- **No dark patterns:** no pre-ticked boxes, no countdowns pushing consent (the QR countdown is a security timeout, explained as such).

---

## 12. Motion

- Durations: 150 ms (small), 250 ms (sheets), 400 ms (page).
- Easing: standard ease-out.
- The check progress uses a calm, looping animation (no spinner flashing), max 3 s before showing the result.
- No confetti, shakes or pulses on results.
- Pages fade up in a short stagger as they open. The gene dots fill in from left to right once, then stay still.
- Card rows scroll sideways and snap one card at a time, with small page dots underneath. The header gains a thin line and a blur once the page scrolls.
- Every animation is turned off when the phone asks for reduced motion.

---

## 13. Design deliverables

| Deliverable | Owner | Due |
|---|---|---|
| Wireframes, 8 core wallet screens (Arabic + English) | D | Tue 10 Nov |
| Token set + components in the design file | D | Tue 10 Nov |
| Hi-fi: W6, W7, W8 (pairing, check, reveal) | D | Thu 12 Nov |
| Hi-fi: console C2, C3, C4 | D | Fri 13 Nov |
| Dashboard C5 + attack demo C6 | D (with A) | Sat 14 Nov |
| Contrast check of all colour pairs | D | Sat 14 Nov (Gate 2) |
| Arabic copy review (native speaker + clinician) | D | Mon 16 Nov |

**Design file structure:** `00 Tokens` · `01 Components` · `02 Wallet AR` · `03 Wallet EN` · `04 Console` · `05 Dashboard` · `06 Demo flow`.
