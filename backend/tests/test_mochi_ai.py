"""Offline regression tests for Little AI Pet / Mochi AI 2.6.

Run from the project root: python -m pytest backend/tests/test_mochi_ai.py -v
No Ollama server is required. Each memory test uses an isolated temporary DB.
"""
import importlib
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

mochi = importlib.import_module("main")


def stats(fullness=80, happiness=80, energy=80, wellness=80):
    return mochi.Stats(
        hunger=fullness, happiness=happiness, energy=energy, wellness=wellness
    )


@pytest.fixture
def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setattr(mochi, "DB_PATH", tmp_path / "test_mochi.db")
    mochi.init_database()
    return tmp_path / "test_mochi.db"


def record(action, count=1):
    for _ in range(count):
        mochi.save_interaction(
            SimpleNamespace(action=action, temperament="gentle", stats=stats()),
            "I feel cozy with you ♡",
        )


@pytest.mark.parametrize("fullness,energy,wellness,expected", [
    (80, 80, 20, "rest"),
    (80, 20, 80, "rest"),
    (20, 80, 80, "ask_food"),
    (80, 35, 80, "rest"),
    (35, 80, 80, "ask_food"),
])
def test_urgent_needs_override_personality(fullness, energy, wellness, expected):
    profile = {"traits": {"playfulness": 95, "affection": 50, "calmness": 20, "trust": 50}}
    assert mochi.personality_driven_decision(
        stats(fullness=fullness, energy=energy, wellness=wellness), profile
    ) == expected


@pytest.mark.parametrize("fullness,energy,wellness", [
    (80, 39, 80), (39, 80, 80), (80, 80, 29)
])
def test_play_refused_when_needs_are_low(fullness, energy, wellness):
    assert mochi.get_play_refusal(stats(fullness, 80, energy, wellness)) is not None


def test_play_allowed_when_comfortable():
    assert mochi.get_play_refusal(stats()) is None


def test_invalid_decision_falls_back_to_idle_when_comfortable():
    assert mochi.validate_decision("fly", stats()) == "idle"


def test_invalid_play_decision_is_corrected():
    assert mochi.validate_decision("play", stats(energy=35)) == "rest"


def test_memory_persists_and_counts_actions(isolated_db):
    record("pet", 3)
    record("play", 2)
    memory = mochi.memory_summary()
    assert memory["counts"]["pet"] == 3
    assert memory["counts"]["play"] == 2
    assert memory["total_care_interactions"] == 5
    assert memory["favorite"] == "pet"
    assert isolated_db.exists()


def test_personality_develops_from_play_history(isolated_db):
    before = mochi.dynamic_personality_profile()
    record("play", 12)
    after = mochi.dynamic_personality_profile()
    assert after["traits"]["playfulness"] > before["traits"]["playfulness"]
    assert after["dominant_trait"] == "playfulness"
    assert after["interactions_considered"] == 12


def test_personality_history_window_is_bounded(isolated_db):
    record("pet", mochi.PERSONALITY_WINDOW + 5)
    profile = mochi.dynamic_personality_profile()
    assert profile["interactions_considered"] == mochi.PERSONALITY_WINDOW


def test_memory_does_not_invent_history(isolated_db):
    memory = mochi.memory_summary()
    facts = " ".join(mochi.memory_facts(memory)).lower()
    assert "no recorded care history" in facts


@pytest.mark.parametrize("text", [
    "Mochi hops across the room.",
    "As an AI, I cannot do that.",
    "I have 42 carrots!",
    "I want to play with you now because today is such a wonderful beautiful sunny day!",
    "",
])
def test_dialogue_rejects_invalid_outputs(text):
    assert mochi.is_valid_dialogue(text) is False


def test_dialogue_accepts_short_first_person_response():
    assert mochi.is_valid_dialogue("I love your cuddles ♡") is True


def test_dialogue_rejects_recent_duplicate():
    assert mochi.is_valid_dialogue("I love your cuddles ♡", recent=["I love your cuddles ♡"]) is False


def test_dialogue_rejects_play_invitation_when_exhausted():
    assert mochi.is_valid_dialogue(
        "Can we play another game?", stats=stats(energy=20)
    ) is False


def test_emoji_cleanup_preserves_heart():
    cleaned = mochi.remove_unnecessary_emojis("I love you 🐰 ♡")
    assert "♡" in cleaned
    assert "🐰" not in cleaned


def test_personality_weights_disable_play_when_tired():
    profile = {"traits": {"playfulness": 95, "affection": 50, "calmness": 50, "trust": 50}}
    weights = mochi.personality_action_weights(stats(energy=35), profile)
    assert weights["play"] == 0


def test_health_endpoint_reports_version():
    response = mochi.health()
    assert response["version"] == "2.6"
    assert response["long_term_memory"] is True
