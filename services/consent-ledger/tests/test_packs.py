from consent_ledger.cases import CaseDesk, Ledger, load_pack
from generator import load_panel


def test_switching_pack_changes_panel_language_directory_and_targets_without_code_change():
    a, b = load_pack("packs/abu-dhabi/pack.yaml"), load_pack("packs/demo-country-2/pack.yaml")
    assert len(load_panel("packs/abu-dhabi/panel.csv")) == 111
    assert len(load_panel("packs/demo-country-2/panel.csv")) == 300
    assert (a["default_language"], b["default_language"]) == ("ar", "en")
    assert a["time_targets_hours"][3] != b["time_targets_hours"][3]
    assert CaseDesk(Ledger(), b).pack["time_targets_hours"][3] == 72
