import json

import pytest
from generator import generate_couples, load_panel
from schemas.logscrub import scrub

from sim.eval.protocol import CheckError, Relay, run_check
from sim.eval.world import World

GENES = load_panel("packs/abu-dhabi/panel.csv")


class P:
    def __init__(self, i, g):
        self.id, self.carrier_genes = i, g


def test_1000_couples_every_shared_found_no_false_alarm():
    w = World()
    couples, _ = generate_couples(1000, GENES, seed=3)
    # ensure positives exist in the sample
    couples += [type(couples[0])(f"x{i}", P(f"a{i}", ["HBB", "CFTR"]), P(f"b{i}", ["CFTR"]), False)
                for i in range(30)]
    relay = Relay()
    for i, c in enumerate(couples):
        a, b = w.wallet("a", c.a, i), w.wallet("b", c.b, i + 1)  # always different labs
        assert run_check(a, b, relay, w.period)["shared_risk"] == bool(c.shared)


def test_step2_needs_both_consents_then_names_gene():
    w = World()
    a, b = w.wallet("a", P("a", ["HBB", "GJB2"])), w.wallet("b", P("b", ["HBB", "PAH"]), 1)
    with pytest.raises(CheckError, match="both_consents"):
        run_check(a, b, Relay(), w.period, reveal=True)
    a.consent_reveal = b.consent_reveal = True
    assert run_check(a, b, Relay(), w.period, reveal=True)["genes"] == ["HBB"]


def test_forged_all_panel_genes_rejected():
    w = World()
    a, b = w.wallet("a", P("a", ["HBB"])), w.wallet("b", P("b", ["PAH"]))
    b.token_set = w.forged(b, GENES)
    with pytest.raises(CheckError, match="forged_token_set"):
        run_check(a, b, Relay(), w.period)


def test_replayed_set_and_expired_session():
    w = World()
    a, b, c = (w.wallet(n, P(n, ["HBB"])) for n in "abc")
    c.token_set = b.token_set  # attacker replays victim's signed set
    with pytest.raises(CheckError, match="replayed_token_set"):
        run_check(a, c, Relay(), w.period)
    r = Relay()
    sid = r.create(now=0)
    with pytest.raises(CheckError, match="expired"):
        r.join(sid, now=301)


def test_expired_period_rejected():
    w = World()
    a, b = w.wallet("a", P("a", ["HBB"])), w.wallet("b", P("b", ["HBB"]))
    with pytest.raises(CheckError, match="expired_token_set"):
        run_check(a, b, Relay(), w.period + 1)


def test_relay_log_scan_clean_and_scrubber():
    w = World()
    a, b = w.wallet("a", P("a", ["HBB"])), w.wallet("b", P("b", ["HBB"]))
    r = Relay()
    run_check(a, b, r, w.period)
    blob = " ".join(r.log)
    assert not any(g in blob for g in GENES)
    assert not any(t in blob for t in a.token_to_gene)
    assert scrub("x HBB " + "a" * 64, {"HBB"}) == "x [gene] [token]"
    assert r.sessions == {}


def test_hello_carries_no_tokens():
    """A partner must not be able to match tokens directly and skip the count-only step."""
    w = World()
    a = w.wallet("a", P("a", ["HBB", "PAH", "CFTR"]))
    hello = json.dumps(a.hello("sid-1"))
    assert all(tok not in hello for tok in a.tokens)
    assert set(a.hello("sid-1")) == {"period", "holder_pk", "attestation", "proof"}


def test_each_side_computes_its_own_result():
    w = World()
    for a_genes, b_genes in [(["HBB", "GJB2"], ["HBB", "PAH"]), (["PAH"], []), (["CFTR"], ["HBB"])]:
        a, b = w.wallet("a", P("a", a_genes)), w.wallet("b", P("b", b_genes), 1)
        r = run_check(a, b, Relay(), w.period)
        assert r["shared_risk"] == r["b_shared_risk"] == bool(set(a_genes) & set(b_genes))
        a.consent_reveal = b.consent_reveal = True
        r = run_check(a, b, Relay(), w.period, reveal=True)
        assert r["genes"] == r["b_genes"] == sorted(set(a_genes) & set(b_genes))


def test_serving_wallet_without_consent_refuses_reveal():
    from sim.eval.protocol import _round
    w = World()
    a, b = w.wallet("a", P("a", ["HBB"])), w.wallet("b", P("b", ["HBB"]), 1)
    a.consent_reveal = True  # b has not agreed: b must not answer a's reveal request
    relay = Relay()
    sid = relay.create()
    with pytest.raises(CheckError, match="reveal_needs_both_consents"):
        _round(a, b, relay, sid, True, "a", "b")
