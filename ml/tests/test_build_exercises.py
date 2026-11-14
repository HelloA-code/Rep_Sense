"""The exercise selection is valid and matches the committed library files (no download needed)."""

import json

from src import build_exercises as b


def test_selection_is_valid():
    b.validate()  # raises SystemExit on duplicate ids, unknown groups/equipment, bad modes


def test_committed_details_match_the_selection():
    details = json.loads(b.OUT_DETAILS.read_text(encoding="utf-8"))
    expected = {id_: src for id_, src in b.CAMERA} | {o[0]: o[2] for o in b.OTHER}
    assert set(details) == set(expected)
    for id_, src in expected.items():
        assert details[id_]["source"] == src, id_
        # Unsourced exercises carry no instructions: nothing is written by hand. (A few
        # dataset entries have empty instructions too, e.g. "One-Arm Kettlebell Swings".)
        if not src:
            assert details[id_]["instructions"] == [], id_


def test_text_fix_undoes_mojibake():
    assert b.fix_text("only Â¾ of the way") == "only ¾ of the way"
    assert b.fix_text("plain text") == "plain text"
