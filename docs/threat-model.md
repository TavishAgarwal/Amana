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

**Known gaps:**
- Count-only PSI lets the client choose its own input, so within one session a partner could submit only one of the genes it carries and learn whether that one is shared. One request per session and in-person pairing limit this; a malicious-secure protocol would close it.
- The national key is a local value in dev, not yet in Key Vault.
- Mock sign-in lets anyone pick any demo persona (a real national-ID provider replaces it).
- Device keys and the encrypted wallet live in browser storage: protected from other sites and casual access, not from someone who copies the whole browser profile.
