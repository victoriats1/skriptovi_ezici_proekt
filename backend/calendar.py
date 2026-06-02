from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from datetime import datetime, timezone, timedelta


def get_calendar_service(access_token):
    creds = Credentials(token=access_token)
    service = build("calendar", "v3", credentials=creds)
    return service


def get_events(access_token, days_ahead=7):
    service = get_calendar_service(access_token)
    now = datetime.now(timezone.utc)
    time_min = now.isoformat()
    time_max = (now + timedelta(days=days_ahead)).isoformat()

    events_result = service.events().list(
        calendarId="primary",
        timeMin=time_min,
        timeMax=time_max,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = events_result.get("items", [])
    result = []
    for event in events:
        start = event["start"].get("dateTime", event["start"].get("date"))
        end = event["end"].get("dateTime", event["end"].get("date"))
        result.append({
            "id": event["id"],
            "title": event.get("summary", "Без заглавие"),
            "start": start,
            "end": end,
        })
    return result


def get_busy_intervals(access_token, days_ahead=7):
    events = get_events(access_token, days_ahead)
    busy = []
    for event in events:
        start = event["start"]
        end = event["end"]
        if "T" in start:
            busy.append({
                "start": datetime.fromisoformat(start),
                "end": datetime.fromisoformat(end),
            })
    return busy


def create_event(access_token, title, start, end, notes=""):
    service = get_calendar_service(access_token)
    event = {
        "summary": title,
        "description": notes,
        "start": {"dateTime": start, "timeZone": "Europe/Sofia"},
        "end":   {"dateTime": end,   "timeZone": "Europe/Sofia"},
    }
    created = service.events().insert(calendarId="primary", body=event).execute()
    return created
