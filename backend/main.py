
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
DECISIONS = ("ask_food", "rest", "seek_attention", "play", "idle")


# ==========================================
# DATABASE
# ==========================================

@contextmanager
def get_connection():
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row

    try:
        with connection:
            yield connection
    finally:
        connection.close()


def init_database():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with get_connection() as conn:
        # Preserve existing interactions and memories.
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

        # Autonomous events are stored separately.
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
# REQUEST MODELS
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
# PERSONALITY AND DIALOGUE
# ==========================================

FALLBACK = {
    "feed": "Yummy! Thank you for my snack ♡",
    "pet": "Your cuddles are my favorite ♡",
    "play": "Hehe! Let's play again!",
    "sleep": "Sweet dreams, little friend ♡",
    "greet": "You're here! I'm so happy ♡",
    "ask_food": "My tummy is rumbling... ♡",
    "rest": "Can I have a tiny nap?",
    "seek_attention": "Could we cuddle a little? ♡",
    "idle": "It's lovely being here with you ♡",
}

EVENTS = {
    "feed": "The owner just fed you.",
    "pet": "The owner just petted you.",
    "play": "The owner just played with you.",
    "sleep": "The owner just put you down for a nap.",
    "greet": "The owner just entered the room.",
}

SYSTEM = """
You are Mochi, a tiny cream bunny living in a cozy room.

Speak in first person, sweet, playful, shy and natural.

One short English sentence, ideally 5-10 words,
at most 12 words.

No role labels, quotes, numbers, markdown,
explanations or technical terms.

Use ♡ sparingly.
Never invent a specific past event.

You are a virtual pet, not an assistant.
Output only your sentence.
"""


# ==========================================
# ADAPTIVE MEMORY
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
        if total > 0
        else None
    )

    preferences = {
        action: round(counts[action] / total, 3)
        if total
        else 0.0
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

    # Adaptive scores calculated from interactions.
    # These do not retrain the LLM.
    affection = min(
        100,
        counts["pet"] * 4 + counts["feed"] * 2,
    )

    playfulness = min(
        100,
        counts["play"] * 6,
    )

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


def save_interaction(
    request: MochiRequest,
    message: str,
):
    with get_connection() as conn:
        conn.execute("""
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


def save_autonomous(action: str, message: str):
    with get_connection() as conn:
        conn.execute("""
            INSERT INTO autonomous_events (
                decision,
                ai_message,
                created_at
            )
            VALUES (?, ?, ?)
        """, (
            action,
            message,
            datetime.now().astimezone().isoformat(),
        ))


# ==========================================
# LOCAL OLLAMA INFERENCE
# ==========================================

def ollama(messages, json_mode=False):
    payload = {
        "model": MODEL,
        "stream": False,
        "messages": messages,
        "options": {
            "temperature": 0.45 if json_mode else 0.75,
            "num_predict": 120,
        },
    }

    if json_mode:
        payload["format"] = "json"

    request = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(
        request,
        timeout=45,
    ) as response:
        result = json.load(response)

    return result.get("message", {}).get("content", "")


# ==========================================
# RESPONSE VALIDATION
# ==========================================

def clean_message(raw: str, fallback_key: str) -> str:
    raw = re.sub(
        r"<think>.*?</think>|<think>.*",
        "",
        raw or "",
        flags=re.I | re.S,
    )

    raw = re.sub(r"[\r\n]+", " ", raw)
    raw = raw.replace('"', "").replace("*", "")
    raw = re.sub(r"\s+", " ", raw).strip(" -: ")

    forbidden = (
        "as an ai",
        "the user",
        "the prompt",
        "let me think",
        "final answer",
        "i should",
    )

    if (
        not raw
        or len(raw.split()) > 12
        or any(
            phrase in raw.lower()
            for phrase in forbidden
        )
    ):
        return FALLBACK[fallback_key]

    return raw


def state_context(request, memory):
    # Pass structured history rather than old AI messages.
    return json.dumps(
        {
            "temperament": request.temperament,
            "stats": request.stats.model_dump(),
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

    # Critical needs override LLM decisions.
    if stats.hunger < 25:
        return "ask_food"

    if stats.energy < 20:
        return "rest"

    if stats.happiness < 25:
        return "seek_attention"

    # Don't suggest playing when exhausted or hungry.
    if action == "play" and (
        stats.energy < 45
        or stats.hunger < 40
    ):
        return fallback_decision(stats)

    return action


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

    prompt = (
        f"State: {state_context(request, memory)}\n"
        f"Event: {EVENTS[request.action]}\n"
        "Reply as Mochi."
    )

    try:
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

        message = clean_message(
            raw,
            request.action,
        )

    except Exception as error:
        print(
            f"[MOCHI AI] Dialogue fallback: {error}"
        )

        message = FALLBACK[request.action]

    save_interaction(request, message)

    return MochiResponse(message=message)


@app.post(
    "/mochi/decide",
    response_model=AutonomousResponse,
)
def decide(request: AutonomousRequest):
    memory = memory_summary()

    prompt = f"""
Choose Mochi's next behavior using this state:
{state_context(request, memory)}

Valid actions:
ask_food, rest, seek_attention, play, idle.

Consider current needs and relationship.
Prefer idle if Mochi is content.

Return ONLY JSON:
{{
    "action": "one_valid_action",
    "message": "one short cute first-person sentence"
}}

The message must fit the action
and contain at most 12 words.

Do not claim the owner did anything just now.
"""

    try:
        raw = ollama(
            [
                {
                    "role": "system",
                    "content": (
                        "You are a virtual pet decision engine. "
                        "Return valid JSON only."
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
        proposed = parsed.get("action", "idle")

        action = validate_decision(
            proposed,
            request.stats,
        )

        # Replace inconsistent messages if
        # the safety rules override the AI.
        if action == proposed:
            message = clean_message(
                str(parsed.get("message", "")),
                action,
            )
        else:
            message = FALLBACK[action]

    except Exception as error:
        print(
            f"[MOCHI AI] Decision fallback: {error}"
        )

        action = fallback_decision(request.stats)
        message = FALLBACK[action]

    save_autonomous(action, message)

    return AutonomousResponse(
        action=action,
        message=message,
    )
