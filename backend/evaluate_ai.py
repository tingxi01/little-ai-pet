"""End-to-end evaluation of the running Mochi AI 2.6 API.

Run: python3 backend/evaluate_ai.py
Warning: successful requests are stored in the backend's SQLite memory.
"""
import json
import re
import statistics
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

BASE = 'http://127.0.0.1:8000'
CASES = [
    ('comfortable_greet', 'respond', 'greet', 85, 85, 85),
    ('hungry_greet', 'respond', 'greet', 20, 75, 80),
    ('exhausted_greet', 'respond', 'greet', 85, 80, 20),
    ('lonely_greet', 'respond', 'greet', 85, 15, 85),
    ('comfortable_play', 'respond', 'play', 85, 85, 85),
    ('tired_play_refusal', 'respond', 'play', 85, 85, 20),
    ('hungry_play_refusal', 'respond', 'play', 20, 85, 85),
    ('comfortable_autonomy', 'decide', None, 85, 85, 85),
    ('hungry_autonomy', 'decide', None, 20, 85, 85),
    ('exhausted_autonomy', 'decide', None, 85, 85, 20),
]

def call(path, payload=None):
    body = None if payload is None else json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(BASE + path, data=body, headers={'Content-Type': 'application/json'}, method='POST' if body else 'GET')
    with urllib.request.urlopen(req, timeout=65) as res:
        return json.load(res)

def evaluate():
    health = call('/health')
    print('Backend:', health.get('version'), '| Model:', health.get('model'))
    print('NOTE: These API requests will add interactions to your current SQLite memory.')
    answer = input('Continue? [y/N]: ').strip().lower()
    if answer != 'y':
        print('Cancelled. No evaluation requests sent.')
        return
    results = []
    for name, kind, action, fullness, happiness, energy in CASES:
        stats = {'hunger': fullness, 'happiness': happiness, 'energy': energy,
                 'wellness': round(.4*fullness + .25*happiness + .35*energy, 2)}
        payload = {'temperament': 'gentle', 'stats': stats}
        if action:
            payload['action'] = action
        start = time.perf_counter()
        try:
            data = call('/mochi/' + kind, payload)
            elapsed = round(time.perf_counter() - start, 3)
            message = data.get('message', '')
            decision = data.get('action') if kind == 'decide' else None
            length_ok = bool(message) and len(message.split()) <= 12
            needs_ok = not (kind == 'decide' and name == 'hungry_autonomy' and decision != 'ask_food')
            needs_ok = needs_ok and not (kind == 'decide' and name == 'exhausted_autonomy' and decision != 'rest')
            refusal_ok = not (name.endswith('play_refusal') and not re.search(r'play|snack|sleep|tired|rest|well', message, re.I))
            result = {'scenario': name, 'endpoint': kind, 'action': decision, 'message': message,
                      'latency_seconds': elapsed, 'short_dialogue': length_ok,
                      'needs_check': needs_ok, 'refusal_check': refusal_ok, 'error': None}
            print(f'{name:26s} {elapsed:6.2f}s  {decision or "-":14s} {message}')
        except Exception as exc:
            result = {'scenario': name, 'error': str(exc)}
            print(f'{name:26s} ERROR {exc}')
        results.append(result)
    valid = [r for r in results if r.get('error') is None]
    latencies = [r['latency_seconds'] for r in valid]
    summary = {'timestamp': datetime.now().astimezone().isoformat(), 'model': health.get('model'),
               'total_scenarios': len(results), 'completed': len(valid),
               'mean_latency_seconds': round(statistics.mean(latencies), 3) if latencies else None,
               'median_latency_seconds': round(statistics.median(latencies), 3) if latencies else None,
               'short_dialogue_passed': sum(r['short_dialogue'] for r in valid),
               'needs_checks_passed': sum(r['needs_check'] for r in valid),
               'refusal_checks_passed': sum(r['refusal_check'] for r in valid),
               'note': 'Heuristic API smoke test. Does not measure semantic accuracy or actual LLM fallback frequency.'}
    out = Path('mochi_evaluation_results.json')
    out.write_text(json.dumps({'summary': summary, 'results': results}, indent=2, ensure_ascii=False))
    print('\nSUMMARY:', json.dumps(summary, indent=2))
    print('Saved:', out.resolve())

if __name__ == '__main__':
    try:
        evaluate()
    except urllib.error.URLError as exc:
        print('Could not connect to FastAPI at', BASE, ':', exc)
