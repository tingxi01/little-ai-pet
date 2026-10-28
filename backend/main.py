
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
# MOCHI AI 2.1
# Adaptive Memory + Emotion + Dialogue
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
        str(Path(__file__).resolve().parent / "mochi_memory.db"),
    )
)

CARE_ACTIONS = ("feed", "pet", "play", "sleep")
ACTIONS = CARE_ACTIONS + ("greet",)
DECISIONS = (
    "ask_food", "rest", "seek_attention", "play", "idle"
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
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with get_connection() as conn:
        # Existing history is preserved.
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
        "ask_food", "rest", "seek_attention",
        "play", "idle"
    ]
    message: str


# ==========================================
# DIALOGUE PERSONALITY
# ==========================================

SYSTEM = """
You are Mochi, a tiny cream-colored bunny
living in a warm, cozy room.

You are a living virtual pet character,
NOT a narrator, assistant, or storyteller.

PERSONALITY:
- Sweet, affectionate, curious, and slightly shy.
- Sometimes playful, mischievous, or sleepy.
- You enjoy snacks, cuddles, naps, and games.
- Your personality develops through care and bonding.

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
- Occasionally use ♡, but not every time.
- Avoid repetitive expressions.
- Never invent specific past experiences.

GOOD EXAMPLES:
"Hehe! Can we play together? ♡"
"I'm getting a little sleepy..."
"Your cuddles make me feel so safe."
"Yummy! I love my little snacks!"
"I missed spending time with you!"

BAD EXAMPLES:
"Chased its own tail with joy"
"Mochi happily jumps around"
"The bunny is feeling excited"
"*wiggles ears happily*"
"As an AI, I think..."

Return ONLY what Mochi says.
"""


FALLBACK = {
    "feed": "Yummy! Thank you for my snack ♡",
    "pet": "Your cuddles make me feel safe ♡",
    "play": "Hehe! Can we play again?",
    "sleep": "I'm ready for a cozy nap ♡",
    "greet": "You're here! I missed you ♡",
    "ask_food": "My tummy is rumbling... ♡",
    "rest": "Can I have a tiny nap?",
    "seek_attention": "Could we cuddle a little? ♡",
    "idle": "I love our cozy little room ♡",
}

# Several alternatives reduce fallback repetition.
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
        "Hehe! Can we play again?",
        "I'm having so much fun!",
        "Let's play one more game!",
    ],
    "sleep": [
        "I'm ready for a cozy nap ♡",
        "My eyes are getting sleepy...",
        "I think I'll dream of fluffy clouds.",
    ],
    "greet": [
        "You're here! I missed you ♡",
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

EVENTS = {
    "feed": "The owner just fed you.",
    "pet": "The owner just gently petted you.",
    "play": "The owner just played with you.",
    "sleep": "The owner just helped you take a nap.",
    "greet": "The owner just entered the room.",
}


# ==========================================
# MEMORY
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

    counts = {action: 0 for action in ACTIONS}

    for row in rows:
        if row["action"] in counts:
            counts[row["action"]] = row["n"]

    total = sum(counts[a] for a in CARE_ACTIONS)

    favorite = (
        max(CARE_ACTIONS, key=lambda a: counts[a])
        if total
        else None
    )

    preferences = {
        action: round(counts[action] / total, 3)
        if total else 0.0
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

    affection = min(
        100,
        counts["pet"] * 4 + counts["feed"] * 2,
    )

    playfulness = min(100, counts["play"] * 6)
    bond = min(100, total * 2)

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
    }


def recent_dialogue(limit=8):
    with get_connection() as conn:
        manual = conn.execute("""
            SELECT ai_message AS message, created_at
            FROM interactions
            ORDER BY id DESC
            LIMIT ?
        """, (limit,)).fetchall()

        autonomous = conn.execute("""
            SELECT ai_message AS message, created_at
            FROM autonomous_events
            ORDER BY id DESC
            LIMIT ?
        """, (limit,)).fetchall()

    combined = [
        (row["message"], row["created_at"])
        for row in list(manual) + list(autonomous)
        if row["message"]
    ]

    combined.sort(key=lambda item: item[1], reverse=True)

    return [item[0] for item in combined[:limit]]


def save_interaction(request, message):
    with get_connection() as conn:
        conn.execute("""
            INSERT INTO interactions (
                action, temperament, hunger,
                happiness, energy, wellness,
                ai_message, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            request.action,
            request.temperament,
            request.stats.hunger,
            request.stats.happiness,
            request.stats.energy,
            request.stats.wellness,
            message,
            datetime.now().astimezone().isoformat(),
        ))


def save_autonomous(action, message):
    with get_connection() as conn:
        conn.execute("""
            INSERT INTO autonomous_events (
                decision, ai_message, created_at
            )
            VALUES (?, ?, ?)
        """, (
            action,
            message,
            datetime.now().astimezone().isoformat(),
        ))


# ==========================================
# EMOTION ENGINE
# ==========================================

def get_emotion(stats: Stats, temperament: str):
    # Prioritize physical and emotional needs.
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
    "unwell": "Speak softly and seek gentle comfort.",
    "hungry": "You want a snack and feel a little needy.",
    "sleepy": "You feel drowsy and speak gently.",
    "lonely": "You want affection and companionship.",
    "excited": "You feel energetic and playful.",
    "content": "You feel safe, loved, and comfortable.",
    "relaxed": "You are peaceful and slightly sleepy.",
    "calm": "You are curious, gentle, and comfortable.",
}


def get_relationship(memory):
    bond = memory["personality"]["bond"]

    if bond < 20:
        return "new_friend"

    if bond < 60:
        return "trusted_friend"

    return "close_companion"


def state_context(request, memory):
    emotion = get_emotion(
        request.stats,
        request.temperament,
    )

    return json.dumps(
        {
            "temperament": request.temperament,
            "stats": request.stats.model_dump(),
            "emotion": emotion,
            "emotion_guidance": EMOTION_GUIDANCE[emotion],
            "relationship": get_relationship(memory),
            "care_counts": {
                action: memory["counts"][action]
                for action in CARE_ACTIONS
            },
            "favorite_care": memory["favorite"],
            "personality": memory["personality"],
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
            "temperature": 0.4 if json_mode else 0.75,
            "num_predict": 120,
        },
    }

    if json_mode:
        payload["format"] = "json"

    request = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(
        request,
        timeout=45,
    ) as response:
        result = json.load(response)

    return result.get("message", {}).get("content", "")


# ==========================================
# DIALOGUE VALIDATION
# ==========================================

FIRST_PERSON = re.compile(
    r"\b(i|i'm|i've|i'll|i'd|me|my|mine|"
    r"we|we're|we'll|us|our)\b",
    re.IGNORECASE,
)

DIRECT_ADDRESS = re.compile(
    r"\b(you|your|you're|you've|let's|can we)\b",
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


def normalize_message(text):
    return re.sub(
        r"[^a-z0-9]+",
        "",
        text.lower(),
    )


def choose_fallback(action, recent=None):
    recent = recent or []

    previous = {
        normalize_message(message)
        for message in recent
    }

    choices = [
        message
        for message in FALLBACK_VARIANTS[action]
        if normalize_message(message) not in previous
    ]

    if not choices:
        choices = FALLBACK_VARIANTS[action]

    return random.choice(choices)


def is_valid_dialogue(text, recent=None):
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

    if recent:
        normalized = normalize_message(text)

        if any(
            normalized == normalize_message(old)
            for old in recent
        ):
            return False

    return True


def clean_message(
    raw: str,
    fallback_key: str,
    recent=None,
):
    raw = re.sub(
        r"<think>.*?</think>|<think>.*",
        "",
        raw or "",
        flags=re.I | re.S,
    )

    raw = re.sub(r"[\r\n]+", " ", raw)
    raw = raw.replace('"', "").replace("*", "")
    raw = re.sub(r"\s+", " ", raw).strip(" -: ")

    if not is_valid_dialogue(raw, recent):
        return choose_fallback(fallback_key, recent)

    return raw


def generate_dialogue(
    action,
    context,
    event,
    recent=None,
):
    recent = recent or []

    prompt = f"""
CURRENT MOCHI STATE:
{context}

CURRENT EVENT:
{event}

RECENT SENTENCES TO AVOID REPEATING:
{json.dumps(recent[-6:], ensure_ascii=False)}

Respond as Mochi speaking directly to the owner.
Use first person or directly address the owner.
Never narrate actions.
One short, natural sentence.
"""

    raw = ollama([
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": prompt},
    ])

    return clean_message(raw, action, recent)


# ==========================================
# AUTONOMOUS DECISION ENGINE
# ==========================================

def fallback_decision(stats: Stats):
    if stats.hunger < 35:
        return "ask_food"

    if stats.energy < 30:
        return "rest"

    if stats.happiness < 40:
        return "seek_attention"

    return "idle"


def validate_decision(action: str, stats: Stats):
    if action not in DECISIONS:
        return fallback_decision(stats)

    if stats.hunger < 25:
        return "ask_food"

    if stats.energy < 20:
        return "rest"

    if stats.happiness < 25:
        return "seek_attention"

    if action == "play" and (
        stats.energy < 45
        or stats.hunger < 40
    ):
        return fallback_decision(stats)

    return action


AUTONOMOUS_EVENTS = {
    "ask_food": "You want to ask for food.",
    "rest": "You want to rest.",
    "seek_attention": "You want affection.",
    "play": "You want to play together.",
    "idle": "You are peacefully relaxing.",
}


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
    }


@app.get("/mochi/memory")
def view_memory():
    return memory_summary()


@app.post(
    "/mochi/respond",
    response_model=MochiResponse,
)
def respond(request: MochiRequest):
    memory = memory_summary()
    recent = recent_dialogue()

    try:
        message = generate_dialogue(
            action=request.action,
            context=state_context(request, memory),
            event=EVENTS[request.action],
            recent=recent,
        )

    except Exception as error:
        print(f"[MOCHI AI] Dialogue fallback: {error}")
        message = choose_fallback(request.action, recent)

    save_interaction(request, message)

    print(f"[MOCHI] {request.action}: {message}")

    return MochiResponse(message=message)


@app.post(
    "/mochi/decide",
    response_model=AutonomousResponse,
)
def decide(request: AutonomousRequest):
    memory = memory_summary()
    recent = recent_dialogue()
    context = state_context(request, memory)

    prompt = f"""
Choose Mochi's next behavior.

CURRENT STATE:
{context}

VALID ACTIONS:
ask_food, rest, seek_attention, play, idle

RULES:
- Consider Mochi's needs and emotional state.
- Consider its temperament and relationship.
- Prefer idle when Mochi is comfortable.
- Do not simulate an owner interaction.
- Return valid JSON only.

FORMAT:
{{
    "action": "idle",
    "message": "I'm feeling peaceful right now."
}}

The message must be Mochi speaking directly.
Never narrate actions in third person.
Maximum 12 words.
Avoid repeating:
{json.dumps(recent[-6:], ensure_ascii=False)}
"""

    try:
        raw = ollama(
            [
                {
                    "role": "system",
                    "content": (
                        "You are Mochi's decision engine. "
                        "Return only valid JSON. "
                        "The message must be first-person "
                        "dialogue, never narration."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            json_mode=True,
        )

        parsed = json.loads(raw)

        if not isinstance(parsed, dict):
            raise ValueError("Expected JSON object")

        proposed = parsed.get("action", "idle")

        action = validate_decision(
            proposed,
            request.stats,
        )

        if action == proposed:
            message = clean_message(
                str(parsed.get("message", "")),
                action,
                recent,
            )
        else:
            message = choose_fallback(action, recent)

    except Exception as error:
        print(f"[MOCHI AI] Decision fallback: {error}")

        action = fallback_decision(request.stats)
        message = choose_fallback(action, recent)

    save_autonomous(action, message)

    print(f"[MOCHI DECISION] {action}: {message}")

    return AutonomousResponse(
        action=action,
        message=message,
    )
