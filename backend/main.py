
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal
from pathlib import Path
from datetime import datetime
from collections import Counter
from contextlib import contextmanager

import sqlite3
import urllib.request
import json
import re
import os
import random


# ==========================================
# MOCHI AI 2.6
#
# Long-Term Memory
# Emotion Engine
# Needs-Aware Dialogue
# Autonomous Decisions
# Emoji Cleanup (Preserve ♡)
# Dynamic Personality Development
# Personality-Driven Autonomous Behavior
# Backend Play Validation
# ==========================================

app = FastAPI(title="Mochi AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5180",
        "http://localhost:5181",
        "http://127.0.0.1:5180",
        "http://127.0.0.1:5181",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL = os.getenv("MOCHI_MODEL", "qwen2.5:3b")

OLLAMA_URL = os.getenv(
    "MOCHI_OLLAMA_URL",
    "http://127.0.0.1:11434/api/chat",
)

DB_PATH = Path(
    os.getenv(
        "MOCHI_DB_PATH",
        str(
            Path(__file__).resolve().parent
            / "mochi_memory.db"
        ),
    )
)

CARE_ACTIONS = ("feed", "pet", "play", "sleep")
ACTIONS = CARE_ACTIONS + ("greet",)

DECISIONS = (
    "ask_food",
    "rest",
    "seek_attention",
    "play",
    "idle",
)


# ==========================================
# DATABASE
# ==========================================

@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row

    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init_database():
    DB_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                temperament TEXT NOT NULL,
                hunger REAL NOT NULL,
                happiness REAL NOT NULL,
                energy REAL NOT NULL,
                wellness REAL NOT NULL,
                ai_message TEXT,
                created_at TEXT NOT NULL
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS autonomous_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                decision TEXT NOT NULL,
                ai_message TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)


init_database()


# ==========================================
# DATA MODELS
# ==========================================

class Stats(BaseModel):
    hunger: float = Field(ge=0, le=100)
    happiness: float = Field(ge=0, le=100)
    energy: float = Field(ge=0, le=100)
    wellness: float = Field(ge=0, le=100)


class MochiRequest(BaseModel):
    action: Literal[
        "feed", "pet", "play", "sleep", "greet"
    ]
    temperament: Literal[
        "gentle", "playful", "sleepy"
    ]
    stats: Stats


class AutonomousRequest(BaseModel):
    temperament: Literal[
        "gentle", "playful", "sleepy"
    ]
    stats: Stats


class MochiResponse(BaseModel):
    message: str


class AutonomousResponse(BaseModel):
    action: Literal[
        "ask_food",
        "rest",
        "seek_attention",
        "play",
        "idle",
    ]
    message: str


# ==========================================
# MOCHI SYSTEM PERSONALITY
# ==========================================

SYSTEM = """
You are Mochi, a tiny cream-colored bunny
living in a warm, cozy room.

You are a living virtual pet character,
NOT a narrator, assistant, or storyteller.

CORE PERSONALITY:
- Sweet, affectionate, curious, and slightly shy.
- Sometimes playful, mischievous, or sleepy.
- You enjoy snacks, cuddles, naps, and games.
- Your personality develops through care and bonding.

DYNAMIC PERSONALITY:
- Your personality evolves through the owner's care.
- Follow dynamic_personality_guidance in CURRENT MOCHI STATE.
- Your evolving personality takes precedence over legacy temperament.
- Do not abruptly change personality after one interaction.
- Never announce personality scores, categories, or development stages.
- Physical needs always take priority over personality.
- Being playful does not mean always wanting to play.
- Being calm does not mean always wanting to sleep.
- Being affectionate does not mean always asking for cuddles.
- Keep your personality subtle, believable, and natural.

AUTONOMOUS BEHAVIOR:
- Your behavior may be selected by a personality-driven engine.
- When a behavior is provided, express that behavior naturally.
- Do not choose a different action in your dialogue.
- Do not imply that the owner performed an action
  when the action was autonomous.
- Quiet moments are normal and healthy.
- Never encourage play while tired, hungry, or unwell.

STRICT SPEAKING RULES:
- Speak directly as Mochi, in first person.
- Use I, I'm, my, me, we, or you naturally.
- Never describe yourself in third person.
- Never narrate physical actions.
- Never use stage directions.
- Never say "Mochi does..." or "The bunny..."
- Never write dialogue as a story.
- Never describe what the owner is thinking.
- Use natural, conversational English.
- Aim for 5-10 words, maximum 12.
- Only one short sentence or utterance.
- No role labels, quotes, markdown, or explanations.
- Never mention stats, numbers, AI, or code.
- You may occasionally use ♡.
- Do not use pictographic emojis.
- Express feelings through natural words instead.
- Avoid repetitive expressions.
- Never invent specific past experiences.
- Refer to past care only when supported by LONG-TERM MEMORY facts.
- If there is no evidence of a past action, do not claim it happened.
- Do not say the owner was away unless memory confirms a long gap.
- As your bond grows, become gently more affectionate.
- Mention memories sparingly, not in every reply.

IMPORTANT:
Physical needs take priority over personality.

If exhausted, do not ask to play.
If very hungry, do not suggest another game.
If both hungry and exhausted, acknowledge
the need for food or rest.

You may still sound happy and affectionate
while feeling tired or hungry.

Return ONLY what Mochi says.
"""


# ==========================================
# FALLBACK DIALOGUE
# ==========================================

FALLBACK_VARIANTS = {
    "feed": [
        "Yummy! Thank you for my snack ♡",
        "Mmm! I love little treats!",
        "That was delicious! Thank you!",
    ],
    "pet": [
        "Your cuddles make me feel safe ♡",
        "Hehe! I love your gentle pets!",
        "Can we cuddle a little longer?",
    ],
    "play": [
        "Whee! That was fun!",
        "I'm having so much fun!",
        "Hehe! I love playing with you!",
    ],
    "sleep": [
        "I'm ready for a cozy nap ♡",
        "My eyes are getting sleepy...",
        "I think I'll dream of fluffy clouds.",
    ],
    "greet": [
        "You're here! I'm happy to see you ♡",
        "Oh! I'm so happy to see you!",
        "Come sit with me for a while!",
    ],
    "ask_food": [
        "My tummy is rumbling... ♡",
        "Could I have a little snack?",
        "I'm feeling a bit hungry...",
    ],
    "rest": [
        "Can I have a tiny nap?",
        "I'm feeling a little sleepy...",
        "I want to rest my fluffy paws.",
    ],
    "seek_attention": [
        "Could we cuddle a little? ♡",
        "Can you stay with me?",
        "I'd love some gentle cuddles!",
    ],
    "idle": [
        "I love our cozy little room ♡",
        "I'm feeling peaceful right now.",
        "It's nice being here with you.",
    ],
}

FALLBACK = {
    key: messages[0]
    for key, messages in FALLBACK_VARIANTS.items()
}

EVENTS = {
    "feed": "The owner just fed you.",
    "pet": "The owner just gently petted you.",
    "play": "The owner just played with you.",
    "sleep": "The owner just helped you take a nap.",
    "greet": "The owner just entered the room.",
}

AUTONOMOUS_EVENTS = {
    "ask_food": "You want to ask for food.",
    "rest": "You want to rest.",
    "seek_attention": "You want affection.",
    "play": "You want to play together.",
    "idle": "You are peacefully relaxing.",
}


# ==========================================
# LONG-TERM MEMORY
# ==========================================

def memory_summary():
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT action, COUNT(*) AS n
            FROM interactions
            GROUP BY action
        """).fetchall()

        recent = conn.execute("""
            SELECT action, ai_message, created_at
            FROM interactions
            ORDER BY id DESC
            LIMIT 5
        """).fetchall()

        hours = conn.execute("""
            SELECT action, created_at
            FROM interactions
            WHERE action IN ('feed', 'pet', 'play', 'sleep')
            ORDER BY id DESC
            LIMIT 500
        """).fetchall()

        first_and_last = conn.execute("""
            SELECT
                MIN(created_at) AS first_seen,
                MAX(created_at) AS last_seen
            FROM interactions
        """).fetchone()

        last_care = conn.execute("""
            SELECT action, created_at
            FROM interactions
            WHERE action IN ('feed', 'pet', 'play', 'sleep')
            ORDER BY id DESC
            LIMIT 1
        """).fetchone()

    counts = {
        action: 0
        for action in ACTIONS
    }

    for row in rows:
        if row["action"] in counts:
            counts[row["action"]] = row["n"]

    total = sum(
        counts[action]
        for action in CARE_ACTIONS
    )

    highest = max(
        (counts[action] for action in CARE_ACTIONS),
        default=0,
    )

    leaders = [
        action
        for action in CARE_ACTIONS
        if counts[action] == highest
    ]

    favorite = (
        leaders[0]
        if total > 0 and len(leaders) == 1
        else None
    )

    preferences = {
        action: round(
            counts[action] / total,
            3,
        ) if total else 0.0
        for action in CARE_ACTIONS
    }

    hour_buckets = Counter()

    for row in hours:
        try:
            hour = datetime.fromisoformat(
                row["created_at"]
            ).hour

            if 6 <= hour < 12:
                bucket = "morning"
            elif 12 <= hour < 18:
                bucket = "afternoon"
            elif 18 <= hour < 22:
                bucket = "evening"
            else:
                bucket = "night"

            hour_buckets[bucket] += 1

        except (ValueError, TypeError):
            continue

    usual_time = (
        hour_buckets.most_common(1)[0][0]
        if sum(hour_buckets.values()) >= 5
        else None
    )

    # Preserve original AI 2.4 memory scores.
    affection = min(
        100,
        counts["pet"] * 4
        + counts["feed"] * 2,
    )

    playfulness = min(
        100,
        counts["play"] * 6,
    )

    bond = min(
        100,
        total * 2,
    )

    return {
        "counts": counts,
        "favorite": favorite,
        "preferences": preferences,
        "usual_interaction_time": usual_time,
        "personality": {
            "affection": affection,
            "playfulness": playfulness,
            "bond": bond,
        },
        "recent": [
            {
                "action": row["action"],
                "message": row["ai_message"],
            }
            for row in recent
        ],
        "first_interaction_at": (
            first_and_last["first_seen"]
        ),
        "last_interaction_at": (
            first_and_last["last_seen"]
        ),
        "last_care_action": (
            last_care["action"]
            if last_care else None
        ),
        "last_care_at": (
            last_care["created_at"]
            if last_care else None
        ),
        "total_care_interactions": total,
    }


# ==========================================
# AI 2.5 - DYNAMIC PERSONALITY
# ==========================================

PERSONALITY_WINDOW = 80
PERSONALITY_MIN_HISTORY = 8

PERSONALITY_TRAITS = {
    "playfulness": "play",
    "affection": "pet",
    "calmness": "sleep",
    "trust": "feed",
}


def dynamic_personality_profile():
    """
    Derive Mochi's evolving personality
    from recent recorded care interactions.

    Newer interactions receive more weight.
    Existing SQLite memories remain unchanged.

    These traits are behavioral estimates,
    not permanent labels.
    """

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT action
            FROM interactions
            WHERE action IN (
                'feed', 'pet', 'play', 'sleep'
            )
            ORDER BY id DESC
            LIMIT ?
            """,
            (PERSONALITY_WINDOW,),
        ).fetchall()

    actions = [
        row["action"]
        for row in rows
        if row["action"] in CARE_ACTIONS
    ]

    count = len(actions)

    if count == 0:
        return {
            "traits": {
                trait: 50
                for trait in PERSONALITY_TRAITS
            },
            "dominant_trait": "balanced",
            "personality_label": "Gentle and curious",
            "development_stage": "new",
            "interactions_considered": 0,
            "confidence": 0.0,
            "description": (
                "Mochi is still discovering "
                "her personality."
            ),
        }

    weights = [
        0.985 ** index
        for index in range(count)
    ]

    total_weight = sum(weights)

    weighted_actions = {
        action: 0.0
        for action in CARE_ACTIONS
    }

    for action, weight in zip(
        actions,
        weights,
    ):
        weighted_actions[action] += weight

    confidence = min(
        1.0,
        count / PERSONALITY_MIN_HISTORY,
    )

    scores = {}

    for trait, action in PERSONALITY_TRAITS.items():
        share = (
            weighted_actions[action]
            / total_weight
        )

        score = (
            50
            + (share - 0.25)
            * 60
            * confidence
        )

        scores[trait] = round(
            max(20, min(95, score))
        )

    highest = max(scores.values())

    leaders = [
        trait
        for trait, value in scores.items()
        if value == highest
    ]

    if (
        count < PERSONALITY_MIN_HISTORY
        or len(leaders) != 1
        or highest < 55
    ):
        dominant = "balanced"
    else:
        dominant = leaders[0]

    labels = {
        "playfulness": "Playful and curious",
        "affection": "Affectionate and cuddly",
        "calmness": "Peaceful and cozy",
        "trust": "Trusting and comfort-loving",
        "balanced": "Gentle and curious",
    }

    descriptions = {
        "playfulness": (
            "Mochi has recently experienced "
            "more play and may express extra "
            "curiosity when comfortable."
        ),
        "affection": (
            "Mochi has recently received "
            "more affection and may respond "
            "more warmly to attention."
        ),
        "calmness": (
            "Mochi has recently experienced "
            "more rest and may prefer "
            "a peaceful tone."
        ),
        "trust": (
            "Mochi has recently received "
            "more feeding care and may "
            "express comfort and safety."
        ),
        "balanced": (
            "Mochi has a balanced or "
            "developing care history."
        ),
    }

    if count < PERSONALITY_MIN_HISTORY:
        stage = "new"
    elif count < 30:
        stage = "developing"
    else:
        stage = "established"

    return {
        "traits": scores,
        "dominant_trait": dominant,
        "personality_label": labels[dominant],
        "development_stage": stage,
        "interactions_considered": count,
        "confidence": round(confidence, 3),
        "description": descriptions[dominant],
    }


def personality_guidance(profile):
    dominant = profile["dominant_trait"]

    guidance = {
        "playfulness": (
            "Mochi has a playful, curious side. "
            "Use a light and cheerful tone "
            "when physically comfortable. "
            "Never encourage play when "
            "tired, hungry, or unwell."
        ),
        "affection": (
            "Mochi has an affectionate side. "
            "Use gentle, warm expressions "
            "and occasionally appreciate "
            "care and cuddles."
        ),
        "calmness": (
            "Mochi has a peaceful side. "
            "Use soft, cozy language. "
            "Enjoy quiet moments and rest."
        ),
        "trust": (
            "Mochi feels comfortable and "
            "cared for. Use a trusting, "
            "content tone without inventing "
            "past experiences."
        ),
        "balanced": (
            "Mochi is gentle, curious, "
            "affectionate, and sometimes "
            "playful. Keep her personality "
            "naturally balanced."
        ),
    }

    return (
        guidance[dominant]
        + " This is a gradual personality "
        + "tendency, not a fixed identity. "
        + "Physical needs always take priority. "
        + "Do not mention personality scores "
        + "or categories in dialogue."
    )


# ==========================================
# MEMORY FACTS
# ==========================================

def parse_record_time(value):
    if not value:
        return None

    try:
        parsed = datetime.fromisoformat(value)

        if parsed.tzinfo is None:
            parsed = parsed.astimezone()

        return parsed

    except (TypeError, ValueError):
        return None


def elapsed_since(value, now=None):
    when = parse_record_time(value)

    if when is None:
        return None

    now = now or datetime.now().astimezone()

    return max(
        0,
        (now - when).total_seconds(),
    )


def memory_facts(memory, action=None, now=None):
    """
    Return evidence-backed facts for
    Mochi's dialogue prompts.
    """

    now = now or datetime.now().astimezone()

    counts = memory["counts"]
    total = memory["total_care_interactions"]

    facts = []

    if total == 0:
        facts.append(
            "No recorded care history yet; "
            "do not claim memories."
        )
    else:
        facts.append(
            f"Recorded care interactions: {total}."
        )

        for care in CARE_ACTIONS:
            if counts[care] > 0:
                facts.append(
                    f"Owner has used {care} "
                    f"{counts[care]} time(s)."
                )

        if memory["favorite"]:
            facts.append(
                "Most frequent care action: "
                f"{memory['favorite']}."
            )
        else:
            facts.append(
                "No reliable favorite care "
                "action established."
            )

    last_action = memory.get(
        "last_care_action"
    )

    if last_action:
        facts.append(
            "Most recent recorded care action: "
            f"{last_action}."
        )

    seconds = elapsed_since(
        memory.get("last_interaction_at"),
        now,
    )

    if (
        seconds is not None
        and seconds >= 24 * 3600
    ):
        days = int(seconds // 86400)

        facts.append(
            "Last recorded interaction was "
            f"at least {days} day(s) ago."
        )

        facts.append(
            "May gently mention that "
            "it has been a while."
        )
    else:
        facts.append(
            "Do not claim the owner was "
            "away or missed for days."
        )

    bond = memory["personality"]["bond"]

    if bond >= 60:
        facts.append(
            "Relationship: close companion; "
            "warmly affectionate."
        )
    elif bond >= 20:
        facts.append(
            "Relationship: trusted friend; "
            "comfortable and affectionate."
        )
    else:
        facts.append(
            "Relationship: new friend; "
            "sweet but slightly shy."
        )

    facts.append(
        "Never claim a specific event unless "
        "it is in these facts."
    )

    facts.append(
        "Mention memories only occasionally, "
        "not every response."
    )

    return facts


def memory_guidance(memory, action=None):
    return "\n".join(
        f"- {fact}"
        for fact in memory_facts(
            memory,
            action,
        )
    )


def recent_dialogue(limit=8):
    with get_connection() as conn:
        manual = conn.execute(
            """
            SELECT
                ai_message AS message,
                created_at
            FROM interactions
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

        autonomous = conn.execute(
            """
            SELECT
                ai_message AS message,
                created_at
            FROM autonomous_events
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    combined = [
        (row["message"], row["created_at"])
        for row in list(manual) + list(autonomous)
        if row["message"]
    ]

    combined.sort(
        key=lambda item: item[1],
        reverse=True,
    )

    return [
        item[0]
        for item in combined[:limit]
    ]


# ==========================================
# SAVE MEMORY
# ==========================================

def save_interaction(request, message):
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO interactions (
                action,
                temperament,
                hunger,
                happiness,
                energy,
                wellness,
                ai_message,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request.action,
                request.temperament,
                request.stats.hunger,
                request.stats.happiness,
                request.stats.energy,
                request.stats.wellness,
                message,
                datetime.now()
                .astimezone()
                .isoformat(),
            ),
        )


def save_autonomous(action, message):
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO autonomous_events (
                decision,
                ai_message,
                created_at
            )
            VALUES (?, ?, ?)
            """,
            (
                action,
                message,
                datetime.now()
                .astimezone()
                .isoformat(),
            ),
        )


# ==========================================
# EMOTION ENGINE
# ==========================================

def get_emotion(
    stats: Stats,
    temperament: str,
):
    if stats.wellness < 30:
        return "unwell"

    if stats.hunger < 30:
        return "hungry"

    if stats.energy < 30:
        return "sleepy"

    if stats.happiness < 35:
        return "lonely"

    if (
        stats.happiness > 75
        and stats.energy > 65
        and temperament == "playful"
    ):
        return "excited"

    if stats.happiness > 75:
        return "content"

    if temperament == "sleepy":
        return "relaxed"

    return "calm"


EMOTION_GUIDANCE = {
    "unwell": (
        "Speak softly and seek gentle comfort."
    ),
    "hungry": (
        "You want a snack and feel a little needy."
    ),
    "sleepy": (
        "You feel drowsy and speak gently."
    ),
    "lonely": (
        "You want affection and companionship."
    ),
    "excited": (
        "You feel energetic and playful."
    ),
    "content": (
        "You feel safe, loved, and comfortable."
    ),
    "relaxed": (
        "You are peaceful and slightly sleepy."
    ),
    "calm": (
        "You are curious, gentle, and comfortable."
    ),
}


def get_relationship(memory):
    bond = memory["personality"]["bond"]

    if bond < 20:
        return "new_friend"

    if bond < 60:
        return "trusted_friend"

    return "close_companion"


# ==========================================
# PHYSICAL NEEDS ENGINE
# ==========================================

def get_play_refusal(stats: Stats):
    """
    Return a needs-aware refusal when Mochi
    cannot play.

    None means playing is allowed.
    """

    if stats.wellness < 30:
        return (
            "I'm not feeling well enough "
            "to play right now... ♡"
        )

    if stats.energy < 40:
        return (
            "I'm too sleepy to play "
            "right now... ♡"
        )

    if stats.hunger < 40:
        return (
            "Could I have a little "
            "snack before we play? ♡"
        )

    return None


def get_needs(stats: Stats):
    """
    hunger represents fullness.
    Lower values mean Mochi needs food.
    """

    needs = []

    if stats.wellness < 30:
        needs.append("unwell")

    if stats.energy < 25:
        needs.append("exhausted")
    elif stats.energy < 40:
        needs.append("tired")

    if stats.hunger < 30:
        needs.append("very_hungry")
    elif stats.hunger < 40:
        needs.append("hungry")

    return needs


NEEDS_FALLBACK_VARIANTS = {
    "exhausted": [
        "I'm so sleepy... can we rest? ♡",
        "My little paws need a break...",
        "I'm happy, but I need a nap!",
    ],
    "very_hungry": [
        "My tummy is so empty...",
        "Could I have a little snack first?",
        "I'm hungry... can we eat soon?",
    ],
    "tired": [
        "Can we take a little break?",
        "I'm getting sleepy after all that fun.",
        "I'd love to rest beside you ♡",
    ],
    "hungry": [
        "Could we have a snack soon?",
        "My tummy is getting rumbly...",
        "I'd love a little carrot!",
    ],
    "unwell": [
        "I'm not feeling my best today...",
        "Can we have a quiet cuddle?",
        "I need some gentle care ♡",
    ],
}


PLAY_REQUEST = re.compile(
    r"\b("
    r"play|playing|game|games|"
    r"run|running|jump|jumping|"
    r"race|racing|hop|hopping|"
    r"chase|chasing|adventure"
    r")\b",
    re.IGNORECASE,
)

PLAY_INVITATION = re.compile(
    r"\b("
    r"can we|could we|let's|"
    r"wanna|want to|shall we|"
    r"one more|again|ready to"
    r")\b",
    re.IGNORECASE,
)


def conflicts_with_needs(message, stats):
    needs = get_needs(stats)

    if not needs:
        return False

    critical = (
        "exhausted" in needs
        or "very_hungry" in needs
        or "unwell" in needs
    )

    if (
        critical
        and PLAY_REQUEST.search(message)
    ):
        return True

    if (
        "tired" in needs
        or "hungry" in needs
    ):
        if (
            PLAY_REQUEST.search(message)
            and PLAY_INVITATION.search(message)
        ):
            return True

    return False


def needs_fallback_key(stats):
    needs = get_needs(stats)

    for need in (
        "unwell",
        "exhausted",
        "very_hungry",
        "tired",
        "hungry",
    ):
        if need in needs:
            return need

    return None


def needs_guidance(stats):
    needs = get_needs(stats)

    if not needs:
        return (
            "Mochi is physically comfortable. "
            "Respond naturally to the interaction."
        )

    if "unwell" in needs:
        return (
            "Mochi feels unwell. Prefer quiet comfort. "
            "Do not invite energetic play."
        )

    if "exhausted" in needs:
        return (
            "Mochi is exhausted. Express a need "
            "for rest. Do not ask to play another game."
        )

    if "very_hungry" in needs:
        return (
            "Mochi is very hungry. Ask for food "
            "gently. Do not suggest more games."
        )

    if "tired" in needs:
        return (
            "Mochi feels tired. Prefer gentle "
            "activities and avoid requesting "
            "energetic play."
        )

    return (
        "Mochi is hungry. It may ask for "
        "a snack before energetic activities."
    )


# ==========================================
# AI CONTEXT BUILDER
# ==========================================

def state_context(request, memory):
    profile = dynamic_personality_profile()

    emotion = get_emotion(
        request.stats,
        request.temperament,
    )

    return json.dumps(
        {
            "temperament": request.temperament,

            "dynamic_personality": profile,

            "dynamic_personality_guidance": (
                personality_guidance(profile)
            ),

            "stats": request.stats.model_dump(),

            "emotion": emotion,

            "emotion_guidance": (
                EMOTION_GUIDANCE[emotion]
            ),

            "physical_needs": get_needs(
                request.stats
            ),

            "needs_guidance": needs_guidance(
                request.stats
            ),

            "relationship": get_relationship(
                memory
            ),

            "care_counts": {
                action: memory["counts"][action]
                for action in CARE_ACTIONS
            },

            "favorite_care": memory["favorite"],

            "personality": memory["personality"],

            "long_term_memory": memory_facts(
                memory,
                getattr(request, "action", None),
            ),

            "usual_interaction_time": memory[
                "usual_interaction_time"
            ],
        },
        ensure_ascii=False,
    )


# ==========================================
# OLLAMA
# ==========================================

def ollama(messages, json_mode=False):
    payload = {
        "model": MODEL,
        "stream": False,
        "messages": messages,
        "options": {
            "temperature": (
                0.4 if json_mode else 0.75
            ),
            "num_predict": 120,
        },
    }

    if json_mode:
        payload["format"] = "json"

    request = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(
            payload
        ).encode("utf-8"),
        headers={
            "Content-Type": "application/json"
        },
        method="POST",
    )

    with urllib.request.urlopen(
        request,
        timeout=45,
    ) as response:
        result = json.load(response)

    return (
        result.get("message", {})
        .get("content", "")
    )


# ==========================================
# DIALOGUE VALIDATION
# ==========================================

FIRST_PERSON = re.compile(
    r"\b(i|i'm|i've|i'll|i'd|me|my|mine|"
    r"we|we're|we'll|us|our)\b",
    re.IGNORECASE,
)

DIRECT_ADDRESS = re.compile(
    r"\b(you|your|you're|you've|"
    r"let's|can we)\b",
    re.IGNORECASE,
)

NARRATION = re.compile(
    r"\b(mochi|the bunny|the rabbit|"
    r"the owner|its own|his own|her own|"
    r"he|she|they|it)\b",
    re.IGNORECASE,
)

FORBIDDEN = (
    "as an ai",
    "the user",
    "the prompt",
    "let me think",
    "final answer",
    "i should respond",
    "the response should",
    "system message",
)


# ==========================================
# EMOJI CLEANUP
# ==========================================

def remove_unnecessary_emojis(text: str) -> str:
    heart_placeholder = "__MOCHI_HEART__"

    text = text.replace(
        "♡",
        heart_placeholder,
    )

    text = re.sub(
        r"[\U0001F000-\U0001FAFF"
        r"\u2600-\u27BF"
        r"\uFE0F\u200D]",
        "",
        text,
    )

    text = text.replace(
        heart_placeholder,
        "♡",
    )

    return re.sub(
        r"\s+",
        " ",
        text,
    ).strip()


def normalize_message(text):
    return re.sub(
        r"[^a-z0-9]+",
        "",
        text.lower(),
    )


def choose_fallback(
    action,
    recent=None,
    stats=None,
):
    recent = recent or []

    if stats is not None:
        need = needs_fallback_key(stats)

        if need is not None:
            choices = NEEDS_FALLBACK_VARIANTS[
                need
            ]
        else:
            choices = FALLBACK_VARIANTS[action]
    else:
        choices = FALLBACK_VARIANTS[action]

    previous = {
        normalize_message(message)
        for message in recent
    }

    available = [
        message
        for message in choices
        if normalize_message(message)
        not in previous
    ]

    if not available:
        available = choices

    return remove_unnecessary_emojis(
        random.choice(available)
    )


def is_valid_dialogue(
    text,
    recent=None,
    stats=None,
):
    if not text:
        return False

    if len(text.split()) > 12:
        return False

    if any(
        phrase in text.lower()
        for phrase in FORBIDDEN
    ):
        return False

    if NARRATION.search(text):
        return False

    if not (
        FIRST_PERSON.search(text)
        or DIRECT_ADDRESS.search(text)
    ):
        return False

    if re.search(r"\d", text):
        return False

    if "{" in text or "}" in text:
        return False

    if stats is not None:
        if conflicts_with_needs(
            text,
            stats,
        ):
            return False

    if recent:
        normalized = normalize_message(text)

        if any(
            normalized
            == normalize_message(old)
            for old in recent
        ):
            return False

    return True


def clean_message(
    raw: str,
    fallback_key: str,
    recent=None,
    stats=None,
):
    raw = re.sub(
        r"<think>.*?</think>|<think>.*",
        "",
        raw or "",
        flags=re.I | re.S,
    )

    raw = re.sub(
        r"[\r\n]+",
        " ",
        raw,
    )

    raw = raw.replace(
        '"',
        "",
    ).replace(
        "*",
        "",
    )

    raw = re.sub(
        r"\s+",
        " ",
        raw,
    ).strip(" -: ")

    raw = remove_unnecessary_emojis(raw)

    if not is_valid_dialogue(
        raw,
        recent,
        stats,
    ):
        return choose_fallback(
            fallback_key,
            recent,
            stats,
        )

    return raw


# ==========================================
# AI DIALOGUE GENERATION
# ==========================================

def generate_dialogue(
    action,
    context,
    event,
    recent=None,
    stats=None,
):
    recent = recent or []

    physical_guidance = (
        needs_guidance(stats)
        if stats is not None
        else "Respond naturally."
    )

    prompt = f"""
CURRENT MOCHI STATE:
{context}

CURRENT EVENT:
{event}

PHYSICAL NEEDS RULE:
{physical_guidance}

DYNAMIC PERSONALITY RULE:
Use the dynamic_personality_guidance
from CURRENT MOCHI STATE.
Let personality subtly affect word choice
and tone, not physical needs or safety.

LONG-TERM MEMORY POLICY:
Use only facts in CURRENT MOCHI STATE.
Do not invent events.
Mention remembered care occasionally,
only when it fits the moment.
Physical needs always take priority
over memories and personality.

RECENT SENTENCES TO AVOID REPEATING:
{json.dumps(recent[-6:], ensure_ascii=False)}

Respond as Mochi speaking directly
to the owner.

Use first person or directly address
the owner.

Never narrate actions.
One short, natural sentence.

You may use ♡ occasionally,
but no pictographic emojis.

If Mochi is exhausted,
do not invite another game.

If Mochi is hungry,
do not ignore her hunger.
"""

    raw = ollama([
        {
            "role": "system",
            "content": SYSTEM,
        },
        {
            "role": "user",
            "content": prompt,
        },
    ])

    return clean_message(
        raw,
        action,
        recent,
        stats,
    )


# ==========================================
# AI 2.6 - PERSONALITY-DRIVEN AUTONOMY
# ==========================================

AUTONOMOUS_BASE_WEIGHTS = {
    "ask_food": 4.0,
    "rest": 12.0,
    "seek_attention": 18.0,
    "play": 16.0,
    "idle": 50.0,
}


def personality_action_weights(
    stats: Stats,
    profile: dict,
):
    """
    Calculate autonomous behavior weights.

    Personality influences preferences,
    but physical needs override them.

    Does not modify memory or stats.
    """

    traits = profile["traits"]

    playfulness = traits["playfulness"]
    affection = traits["affection"]
    calmness = traits["calmness"]
    trust = traits["trust"]

    weights = AUTONOMOUS_BASE_WEIGHTS.copy()

    # Playful Mochi prefers more games.
    weights["play"] *= max(
        0.35,
        1.0 + (playfulness - 50) / 35,
    )

    # Affectionate Mochi seeks more cuddles.
    weights["seek_attention"] *= max(
        0.35,
        1.0 + (affection - 50) / 35,
    )

    # Calm Mochi prefers quiet moments.
    weights["rest"] *= max(
        0.35,
        1.0 + (calmness - 50) / 40,
    )

    weights["idle"] *= max(
        0.50,
        1.0 + (calmness - 50) / 65,
    )

    # Trust increases comfortable companionship.
    weights["seek_attention"] *= max(
        0.70,
        1.0 + (trust - 50) / 100,
    )

    # Moderate needs influence preferences.
    if stats.energy < 55:
        weights["rest"] *= 2.0
        weights["play"] *= 0.25

    if stats.hunger < 55:
        weights["ask_food"] *= 4.0
        weights["play"] *= 0.30

    if stats.happiness < 55:
        weights["seek_attention"] *= 2.5

    # Play must respect the same safety
    # thresholds as manual Play.
    if get_play_refusal(stats) is not None:
        weights["play"] = 0.0

    return weights


def personality_driven_decision(
    stats: Stats,
    profile: dict,
):
    """
    Choose Mochi's autonomous behavior.

    Priority:
    1. Urgent physical needs
    2. Safety restrictions
    3. Dynamic personality
    4. Natural randomness
    """

    # Urgent physical needs override personality.
    if stats.wellness < 30:
        return "rest"

    if stats.energy < 25:
        return "rest"

    if stats.hunger < 30:
        return "ask_food"

    if stats.energy < 40:
        return "rest"

    if stats.hunger < 40:
        return "ask_food"

    if stats.happiness < 25:
        return "seek_attention"

    weights = personality_action_weights(
        stats,
        profile,
    )

    actions = list(weights.keys())

    probabilities = [
        weights[action]
        for action in actions
    ]

    return random.choices(
        population=actions,
        weights=probabilities,
        k=1,
    )[0]


# ==========================================
# AUTONOMOUS DECISION VALIDATION
# ==========================================

def fallback_decision(stats: Stats):
    if stats.wellness < 30:
        return "rest"

    if stats.energy < 25:
        return "rest"

    if stats.hunger < 35:
        return "ask_food"

    if stats.energy < 40:
        return "rest"

    if stats.happiness < 40:
        return "seek_attention"

    return "idle"


def validate_decision(
    action: str,
    stats: Stats,
):
    if action not in DECISIONS:
        return fallback_decision(stats)

    if stats.wellness < 30:
        return "rest"

    if stats.energy < 25:
        return "rest"

    if stats.hunger < 30:
        return "ask_food"

    if stats.energy < 40:
        return "rest"

    if stats.hunger < 40:
        return "ask_food"

    if stats.happiness < 25:
        return "seek_attention"

    if (
        action == "play"
        and get_play_refusal(stats) is not None
    ):
        return "rest"

    return action


# ==========================================
# AI 2.6 - AUTONOMOUS DIALOGUE
# ==========================================

def generate_autonomous_dialogue(
    action,
    request,
    memory,
    recent,
):
    """
    Python has already selected the action.

    Ollama generates dialogue only.
    It cannot override the chosen behavior.
    """

    context = state_context(
        request,
        memory,
    )

    event = AUTONOMOUS_EVENTS[action]

    prompt = f"""
CURRENT MOCHI STATE:
{context}

SELECTED AUTONOMOUS BEHAVIOR:
{action}

WHAT MOCHI WANTS:
{event}

IMPORTANT:
The autonomous behavior has already been
selected by Mochi's personality and needs engine.

Do not choose a new action.

Express the selected behavior naturally,
as Mochi speaking directly to the owner.

This is an autonomous event.
The owner has not just performed a care action.

PERSONALITY:
Follow the dynamic personality guidance
from CURRENT MOCHI STATE.

Let personality influence the tone,
but do not ignore physical needs.

LONG-TERM MEMORY:
Only refer to documented care.
Do not invent visits, events, or absences.

RECENT DIALOGUE TO AVOID:
{json.dumps(recent[-6:], ensure_ascii=False)}

STRICT RULES:
- Speak in first person.
- One short utterance.
- Maximum 12 words.
- No narration or stage directions.
- No personality scores.
- No technical explanations.
- No pictographic emojis.
- You may occasionally use ♡.
- Do not invite play when tired or hungry.
- Do not claim the owner just fed,
  petted, or played with you.

Return ONLY Mochi's spoken message.
"""

    raw = ollama([
        {
            "role": "system",
            "content": SYSTEM,
        },
        {
            "role": "user",
            "content": prompt,
        },
    ])

    return clean_message(
        raw,
        action,
        recent,
        request.stats,
    )


# ==========================================
# API ENDPOINTS
# ==========================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL,
        "memory": "sqlite",
        "adaptive": True,
        "emotion_engine": True,
        "dialogue_validation": True,
        "needs_aware_dialogue": True,
        "emoji_cleanup": True,
        "long_term_memory": True,
        "dynamic_personality": True,
        "personality_driven_autonomy": True,
        "backend_play_validation": True,
        "version": "2.6",
    }


@app.get("/mochi/memory")
def view_memory():
    return memory_summary()


@app.get("/mochi/personality")
def view_personality():
    return dynamic_personality_profile()


# ==========================================
# MANUAL INTERACTIONS
# ==========================================

@app.post(
    "/mochi/respond",
    response_model=MochiResponse,
)
def respond(request: MochiRequest):

    # Reject invalid Play actions before
    # generating dialogue or saving memory.
    if request.action == "play":
        refusal = get_play_refusal(request.stats)

        if refusal is not None:
            print(
                "[MOCHI PLAY REFUSED] "
                f"Energy={request.stats.energy}, "
                f"Fullness={request.stats.hunger}, "
                f"Wellness={request.stats.wellness}"
            )

            return MochiResponse(
                message=refusal
            )

    memory = memory_summary()
    recent = recent_dialogue()

    try:
        message = generate_dialogue(
            action=request.action,
            context=state_context(
                request,
                memory,
            ),
            event=EVENTS[request.action],
            recent=recent,
            stats=request.stats,
        )

    except Exception as error:
        print(
            "[MOCHI AI] Dialogue fallback:",
            error,
        )

        message = choose_fallback(
            request.action,
            recent,
            request.stats,
        )

    save_interaction(
        request,
        message,
    )

    print(
        f"[MOCHI] {request.action}: {message}"
    )

    return MochiResponse(
        message=message
    )


# ==========================================
# AI 2.6 - AUTONOMOUS DECISIONS
# ==========================================

@app.post(
    "/mochi/decide",
    response_model=AutonomousResponse,
)
def decide(request: AutonomousRequest):

    memory = memory_summary()
    recent = recent_dialogue()

    # Read personality from existing
    # care interaction history.
    profile = dynamic_personality_profile()

    # Python selects the behavior.
    proposed_action = personality_driven_decision(
        request.stats,
        profile,
    )

    # Apply final physical-needs validation.
    action = validate_decision(
        proposed_action,
        request.stats,
    )

    # Ollama only generates Mochi's words.
    try:
        message = generate_autonomous_dialogue(
            action,
            request,
            memory,
            recent,
        )

    except Exception as error:
        print(
            "[MOCHI AI 2.6] Dialogue fallback:",
            error,
        )

        message = choose_fallback(
            action,
            recent,
            request.stats,
        )

    # Save to autonomous_events, not interactions.
    # Autonomous events do not change
    # the manual care interaction count.
    save_autonomous(
        action,
        message,
    )

    print(
        "[MOCHI AI 2.6] "
        f"Personality={profile['dominant_trait']} | "
        f"Action={action} | "
        f"Message={message}"
    )

    return AutonomousResponse(
        action=action,
        message=message,
    )
