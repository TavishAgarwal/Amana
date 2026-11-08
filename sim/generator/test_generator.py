import tempfile

from generator import generate_couples, load_panel, load_weights


def test_rate_within_tolerance_and_reproducible():
    genes = load_panel("packs/abu-dhabi/panel.csv")
    assert len(genes) == 111
    c1, _ = generate_couples(20000, genes, seed=7)
    rate = sum(bool(c.shared) for c in c1) / len(c1)
    assert abs(rate - 0.048) < 0.015
    c2, _ = generate_couples(200, genes, seed=7)
    assert [x.a.carrier_genes for x in c2] == [x.a.carrier_genes for x in c1[:200]]


def test_real_weights_keep_target_rate_and_shape():
    with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False) as f:
        f.write("gene,q_mid,q_global\nA,0.01,0.02\nB,0,0.001\nC,0,0\n")
    w = load_weights(f.name)
    assert w["A"] == 0.01 and w["B"] == 0.001 and w["C"] == 1e-5  # mid, then global, then floor
    genes = [f"G{i}" for i in range(60)] + ["A", "B", "C"]
    couples, freqs = generate_couples(20000, genes, seed=3, weights=w)
    assert abs(sum(bool(c.shared) for c in couples) / len(couples) - 0.048) < 0.015
    assert freqs["A"] > freqs["B"] > freqs["C"]  # relative order of real frequencies is kept
