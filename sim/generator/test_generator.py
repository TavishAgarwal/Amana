from generator import generate_couples, load_panel


def test_rate_within_tolerance_and_reproducible():
    genes = load_panel("packs/abu-dhabi/panel.csv")
    assert len(genes) == 111
    c1, _ = generate_couples(20000, genes, seed=7)
    rate = sum(bool(c.shared) for c in c1) / len(c1)
    assert abs(rate - 0.048) < 0.015
    c2, _ = generate_couples(200, genes, seed=7)
    assert [x.a.carrier_genes for x in c2] == [x.a.carrier_genes for x in c1[:200]]
