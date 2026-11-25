from app.api.routes.tournaments import _round_name, first_round_pairs


def test_power_of_two_has_no_byes():
    pairs = first_round_pairs(["a", "b", "c", "d"])
    assert pairs == [("a", "d"), ("b", "c")]


def test_byes_never_pair_two_empty_slots():
    for n in range(2, 33):
        teams = [f"t{i}" for i in range(n)]
        pairs = first_round_pairs(teams)
        # Todas as equipes aparecem exatamente uma vez.
        flat = [t for pair in pairs for t in pair if t]
        assert sorted(flat) == sorted(teams)
        # Nenhum confronto "vazio x vazio".
        assert all(home or away for home, away in pairs)


def test_three_teams_one_bye():
    pairs = first_round_pairs(["a", "b", "c"])
    assert pairs == [("a", None), ("b", "c")]


def test_round_names():
    assert _round_name(3, 3) == "Final"
    assert _round_name(3, 2) == "Semifinal"
    assert _round_name(3, 1) == "Quartas de final"
    assert _round_name(5, 1) == "Rodada 1"
