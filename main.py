import firebase_admin
from firebase_admin import credentials, firestore
import datetime

cred = credentials.Certificate("firebase_key.json")
firebase_admin.initialize_app(cred)
db = firestore.client()


def create_user(user_id: str, name: str, email: str):
    db.collection("users").document(user_id).set({
        "name": name,
        "email": email,
        "created_at": datetime.datetime.now()
    })


def get_user(user_id: str) -> dict | None:
    doc = db.collection("users").document(user_id).get()
    return doc.to_dict() if doc.exists else None


def add_event(user_id: str, title: str, date: str, start_time: str, end_time: str):
    db.collection("events").add({
        "user_id": user_id,
        "title": title,
        "date": date,
        "start_time": start_time,
        "end_time": end_time,
        "created_at": datetime.datetime.now()
    })


def get_events_for_user(user_id: str) -> list[dict]:
    docs = (
        db.collection("events")
        .where("user_id", "==", user_id)
        .stream()
    )
    events = [{"id": doc.id, **doc.to_dict()} for doc in docs]
    events.sort(key=lambda e: (e["date"], e["start_time"]))
    return events


def delete_event(event_id: str):
    db.collection("events").document(event_id).delete()


def _time_to_minutes(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m

def _minutes_to_time(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def find_free_slots(
    user_ids: list[str],
    date: str,
    day_start: str = "08:00",
    day_end: str = "22:00",
    min_duration_minutes: int = 60
) -> list[dict]:
    busy_intervals = []

    for user_id in user_ids:
        docs = (
            db.collection("events")
            .where("user_id", "==", user_id)
            .where("date", "==", date)
            .stream()
        )
        for doc in docs:
            data = doc.to_dict()
            busy_intervals.append((
                _time_to_minutes(data["start_time"]),
                _time_to_minutes(data["end_time"])
            ))

    busy_intervals.sort()
    merged = []
    for start, end in busy_intervals:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append([start, end])

    free_slots = []
    cursor = _time_to_minutes(day_start)
    day_end_min = _time_to_minutes(day_end)

    for busy_start, busy_end in merged:
        if cursor < busy_start:
            duration = busy_start - cursor
            if duration >= min_duration_minutes:
                free_slots.append({
                    "start": _minutes_to_time(cursor),
                    "end": _minutes_to_time(busy_start)
                })
        cursor = max(cursor, busy_end)

    if cursor < day_end_min:
        duration = day_end_min - cursor
        if duration >= min_duration_minutes:
            free_slots.append({
                "start": _minutes_to_time(cursor),
                "end": _minutes_to_time(day_end_min)
            })

    return free_slots


if __name__ == "__main__":
    create_user("alex", "Alex", "alex@example.com")
    create_user("maria", "Maria", "maria@example.com")

    add_event("alex",  "Gym",     "2025-06-01", "08:00", "10:00")
    add_event("alex",  "Lecture", "2025-06-01", "13:00", "15:00")
    add_event("maria", "Work",    "2025-06-01", "09:00", "14:00")

    slots = find_free_slots(["alex", "maria"], "2025-06-01")
    for slot in slots:
        print(f"{slot['start']} – {slot['end']}")