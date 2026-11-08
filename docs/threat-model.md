# AMANA: Threat model

**Assumption:** honest-but-curious relay and national token service (they follow the protocol but may read what they see). Not covered: a malicious national authority, compromised phones, side channels.

| Threat | Control | Test |
|---|---|---|
| Attacker claims all 570 genes to probe a victim | Tokens only for genes in a lab-signed credential; partner sets must carry the national signature | `test_attack_rejected...`, `test_gene_not_in_credential_refused`, `test_forged_all_570_rejected` |
| Replay of a victim's signed token set | Set bound to device key; each side signs the session id | `test_replayed_set_and_expired_session` |
| Dictionary attack on hashed gene names | Keyed HMAC tokens (national key, rotated per period); PSI, not hash comparison | attack demo (plain hashing leaks, AMANA does not) |
| Set-size leakage | Both sides pad to 128 items | `PAD_TO` in `sim/eval/protocol.py` |
| Relay reads data | Relay sees only PSI messages and event names; logs scrubbed; nothing stored | `test_relay_log_scan_clean...`, relay `node --test` |
| Stale or expired QR / token sets | 5-minute one-time sessions; tokens expire each period | session and period tests |
| Unauthorised access to a case | Default deny; signed, expiring, revocable permissions; every attempt audited | `test_ledger.py` |
| Log tampering | Hash-chained audit; Postgres trigger blocks UPDATE/DELETE | chain and Postgres tests |
| Unsupported or directive AI output | Cards only; fact-checker; fallback to original card | red-team set, `test_explainer.py` |

**Known gaps:** step 1 result is relayed by the PSI client to the server, so a malicious client could lie about yes/no; the Python reference wallet is not the browser wallet; the national key is a local value in dev, not yet in Key Vault.
