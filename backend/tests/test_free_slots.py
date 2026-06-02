from datetime import datetime, timezone
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.free_slots import merge_busy_intervals, find_free_slots, format_free_slots


def make_dt(hour, minute=0):
    """Помощна функция - създава datetime за днес."""
    now = datetime.now(timezone.utc)
    return now.replace(hour=hour, minute=minute, second=0, microsecond=0)


def test_merge_busy_intervals():
    intervals = [
        {"start": make_dt(10), "end": make_dt(11)},
        {"start": make_dt(10, 30), "end": make_dt(12)},  # припокрива се
        {"start": make_dt(14), "end": make_dt(15)},
    ]
    merged = merge_busy_intervals(intervals)
    assert len(merged) == 2
    assert merged[0]["end"] == make_dt(12)
    print("✓ merge_busy_intervals работи")


def test_find_free_slots_no_busy():
    """Без заети часове - целият ден е свободен."""
    free = find_free_slots([[]], days_ahead=1)
    assert len(free) > 0
    print("✓ find_free_slots без заети часове работи")


def test_find_free_slots_two_users():
    """Двама потребители с различни заети часове."""
    user1_busy = [{"start": make_dt(10), "end": make_dt(11)}]
    user2_busy = [{"start": make_dt(14), "end": make_dt(15)}]

    free = find_free_slots([user1_busy, user2_busy], days_ahead=1)
    assert len(free) > 0
    print(f"✓ find_free_slots с двама потребители работи — {len(free)} свободни слота")


if __name__ == "__main__":
    test_merge_busy_intervals()
    test_find_free_slots_no_busy()
    test_find_free_slots_two_users()
    print("\nВсички тестове минаха!")