from datetime import datetime, timedelta, timezone


def merge_busy_intervals(intervals):
    if not intervals:
        return []

    sorted_intervals = sorted(intervals, key=lambda x: x["start"])
    merged = [sorted_intervals[0]]

    for current in sorted_intervals[1:]:
        last = merged[-1]
        if current["start"] <= last["end"]:
            merged[-1]["end"] = max(last["end"], current["end"])
        else:
            merged.append(current)

    return merged


def find_free_slots(busy_intervals_list, days_ahead=7, min_duration_minutes=30,
                    work_start_hour=9, work_end_hour=21):
    # Нормализирай всички интервали към UTC
    all_busy = []
    for user_busy in busy_intervals_list:
        for interval in user_busy:
            start = interval["start"]
            end   = interval["end"]
            # Ако няма часова зона, добави UTC
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            if end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
            all_busy.append({
                "start": start.astimezone(timezone.utc),
                "end":   end.astimezone(timezone.utc),
            })

    merged_busy = merge_busy_intervals(all_busy)

    now = datetime.now(timezone.utc)
    free_slots = []

    for day_offset in range(days_ahead):
        day = now + timedelta(days=day_offset)

        day_start = day.replace(
            hour=work_start_hour, minute=0, second=0, microsecond=0
        )
        day_end = day.replace(
            hour=work_end_hour, minute=0, second=0, microsecond=0
        )

        if day_offset == 0 and now > day_start:
            day_start = now.replace(second=0, microsecond=0)

        day_busy = [
            b for b in merged_busy
            if b["start"] < day_end and b["end"] > day_start
        ]

        current = day_start
        for busy in day_busy:
            busy_start = max(busy["start"], day_start)
            busy_end   = min(busy["end"],   day_end)

            if current < busy_start:
                duration = int((busy_start - current).total_seconds() / 60)
                if duration >= min_duration_minutes:
                    free_slots.append({
                        "start": current,
                        "end": busy_start,
                        "duration_minutes": duration,
                    })
            current = max(current, busy_end)

        if current < day_end:
            duration = int((day_end - current).total_seconds() / 60)
            if duration >= min_duration_minutes:
                free_slots.append({
                    "start": current,
                    "end": day_end,
                    "duration_minutes": duration,
                })

    return free_slots


def format_free_slots(free_slots):
    return [
        {
            "start": slot["start"].isoformat(),
            "end":   slot["end"].isoformat(),
            "duration_minutes": slot["duration_minutes"],
        }
        for slot in free_slots
    ]