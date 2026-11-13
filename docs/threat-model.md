# AMANA: Threat model

**Assumption:** honest-but-curious relay and national token service (they follow the protocol but may read what they see). Not covered: a malicious national authority, compromised phones, side channels.

| Threat | Control | Test |
|---|---|---|
| Attacker claims every gene on the panel (111 in the prototype, 570 in the real programme) to probe a victim | Tokens only for genes in a lab-signed credential; partner sets must carry the national signature | `test_attack_rejected...`, `test_gene_not_in_credential_refused`, `test_forged_all_panel_genes_rejected` |
| Replay of a victim's signed token set | Set bound to device key; each side signs the session id | `test_replayed_set_and_expired_session` |
| Dictionary attack on hashed gene names | Keyed HMAC tokens (national key, rotated per period); PSI, not hash comparison | attack demo (plain hashing leaks, AMANA does not) |
| Set-size leakage | Both sides pad to 128 items | `PAD_TO` in `sim/eval/protocol.py` |
| Relay reads data | Relay sees only PSI messages and event names; logs scrubbed; nothing stored | `test_relay_log_scan_clean...`, relay `node --test` |
| Stale or expired QR / token sets | 5-minute one-time sessions; tokens expire each period | session and period tests |
| Unauthorised access to a case | Default deny; signed, expiring, revocable permissions; every attempt audited | `test_ledger.py` |
| Log tampering | Hash-chained audit; Postgres trigger blocks UPDATE/DELETE | chain and Postgres tests |
| Unsupported or directive AI output | Cards only; fact-checker; fallback to original card | red-team set, `test_explainer.py` |
| Partner reads tokens from the hello and matches them directly, skipping the count-only step and consent (found and fixed 9 Nov) | Hello carries only the national attestation (period + device key) and a session signature; tokens never leave the phone | `test_hello_carries_no_tokens`; wallet `check.test.mjs` scans everything sent through the relay |
| Partner lies about the yes/no result | Each phone runs PSI as client once and computes its own result | `test_each_side_computes_its_own_result`; `check.test.mjs` |
| Partner re-asks with single genes to learn which of its genes match | One count and one reveal request answered per session; new session needs a new in-person QR | `check.test.mjs` "second count request refused" |
| Someone consents, revokes or reads a log on another person's behalf | Every consent, revoke and log read is signed by the holder's device key (non-extractable, on the phone) | `test_consent_must_be_signed_by_the_holder`, `test_share_case_signoff_revoke_withdraw`, `sign-interop.test.mjs` |
| Counsellor (or a polling console) reads a case silently | Every case read is consent-checked and written to the person's log; the queue returns no personal data and is not logged; a second counsellor gets 403 | `test_other_counsellor_cannot_open_the_case_and_opening_is_logged` |
| Counsellor sees more than the person chose | Case holds only the ticked scope (result type, condition if ticked, question, slot); the queue never shows question or condition | `test_question_goes_to_tier_2_and_queue_rows_hide_it` |
| Family invite reveals the sender or the gene | Invite page returns only `valid`; random 128-bit id; sender can revoke it | `test_family_invite_shows_nothing_about_the_sender_and_can_be_revoked` |
| Prompt injection in a question makes the AI write advice | The AI returns sentence numbers only; anything else is dropped; decision questions never reach it | `test_explainer.py` fake-model tests; red-team with the live model |
| A person's questions reveal their condition or worries to a server | Questions are answered on the phone from the card index; the Ask box makes no network request with the question | Browser check (only `index.json` and model files fetched); `apps/wallet/tests/ask.test.mjs` |
| Tampered or damaged model file on the phone | Files are same-origin and checked against SHA-256 sums in `model.json` before use or caching; the model can only rank reviewed sentences, never write text | `ask.test.mjs` (sums match the shipped files) |
| Study answers re-identify someone | No name or device id; random per-quiz id; groups under 5 hidden on the dashboard; synthetic data kept apart | `test_study_hides_small_groups_and_keeps_synthetic_apart` |
| One address floods the relay, or everyone is rate-limited together behind the load balancer | Per-address limit counts the address the trusted proxy reports (`TRUST_PROXY=1`), not the proxy's own; messages capped at 256 KB; idle limits and abandoned sessions swept each minute | relay `clientIp` and health tests |
| Token service copies disagree, or a restart breaks every token in use | National keys load from Key Vault (or a 0600 key file locally); production refuses to start without them; lab API keys stored only as hashes | `test_copies_built_from_the_same_keys_issue_the_same_tokens`, `test_production_refuses_to_start_without_national_keys` |
| Audit log grows until writing slows to a stop | Each write reads only the last row; the primary key on `seq` stops two writers taking the same number | `test_audit_append_reads_only_the_last_row` |

**Known gaps:**
- Count-only PSI lets the client choose its own input, so within one session a partner could submit only one of the genes it carries and learn whether that one is shared. One request per session and in-person pairing limit this; a malicious-secure protocol would close it.
- The national key loads from Key Vault in the deploy template (`infra/azure/main.bicep`), but no Azure deploy has run; locally it is a key file.
- Each token-service copy counts its own per-lab rate limit, so N copies allow N × the limit.
- Mock sign-in lets anyone pick any demo persona (a real national-ID provider replaces it). The console's counsellor selector is also a mock.
- The demo API trusts the person's statement of their programme result when they share it with a counsellor (it is lab-signed on the phone, but the phone does not send the signed credential, to avoid sending genes). The counsellor confirms it in the session.
- Device keys and the encrypted wallet live in browser storage: protected from other sites and casual access, not from someone who copies the whole browser profile.
