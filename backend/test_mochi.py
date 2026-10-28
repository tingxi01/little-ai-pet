
"""
Run from project root:

python3 -m unittest discover -s backend -p "test_mochi.py" -v
"""

import importlib.util
import os
import tempfile
import unittest

from pathlib import Path
from unittest.mock import patch

# Use a disposable database.
TMP = tempfile.TemporaryDirectory()

os.environ["MOCHI_DB_PATH"] = str(
    Path(TMP.name) / "test_memory.db"
)

spec = importlib.util.spec_from_file_location(
    "mochi_backend_for_test",
    Path(__file__).with_name("main.py"),
)

mochi = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mochi)


class MochiTests(unittest.TestCase):

    def setUp(self):
        with mochi.get_connection() as conn:
            conn.execute(
                "DELETE FROM interactions"
            )
            conn.execute(
                "DELETE FROM autonomous_events"
            )

        self.stats = mochi.Stats(
            hunger=70,
            happiness=80,
            energy=65,
            wellness=90,
        )

    def test_memory_and_personality(self):
        request = mochi.MochiRequest(
            action="pet",
            temperament="gentle",
            stats=self.stats,
        )

        mochi.save_interaction(
            request,
            "Hehe! ♡",
        )

        memory = mochi.memory_summary()

        self.assertEqual(
            memory["favorite"],
            "pet",
        )

        self.assertEqual(
            memory["counts"]["pet"],
            1,
        )

        self.assertGreater(
            memory["personality"]["affection"],
            0,
        )

    def test_dialogue_and_memory(self):
        request = mochi.MochiRequest(
            action="feed",
            temperament="gentle",
            stats=self.stats,
        )

        with patch.object(
            mochi,
            "ollama",
            return_value="Yummy, thank you! ♡",
        ):
            result = mochi.respond(request)

        self.assertEqual(
            result.message,
            "Yummy, thank you! ♡",
        )

        self.assertEqual(
            mochi.memory_summary()["counts"]["feed"],
            1,
        )

    def test_safety_overrides_llm(self):
        low_stats = mochi.Stats(
            hunger=10,
            happiness=90,
            energy=90,
            wellness=90,
        )

        self.assertEqual(
            mochi.validate_decision(
                "play",
                low_stats,
            ),
            "ask_food",
        )

    def test_invalid_json_falls_back(self):
        request = mochi.AutonomousRequest(
            temperament="gentle",
            stats=self.stats,
        )

        with patch.object(
            mochi,
            "ollama",
            return_value="not json",
        ):
            result = mochi.decide(request)

        self.assertEqual(
            result.action,
            "idle",
        )

        self.assertEqual(
            mochi.memory_summary()["counts"]["greet"],
            0,
        )

    def test_valid_decision(self):
        request = mochi.AutonomousRequest(
            temperament="playful",
            stats=self.stats,
        )

        with patch.object(
            mochi,
            "ollama",
            return_value=(
                '{"action":"play",'
                '"message":"Can we play together? ♡"}'
            ),
        ):
            result = mochi.decide(request)

        self.assertEqual(
            result.action,
            "play",
        )

        self.assertEqual(
            result.message,
            "Can we play together? ♡",
        )

    def test_long_or_reasoning_response_is_rejected(self):
        result = mochi.clean_message(
            "As an AI, I should respond",
            "pet",
        )

        self.assertEqual(
            result,
            mochi.FALLBACK["pet"],
        )


if __name__ == "__main__":
    unittest.main()
