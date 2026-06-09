import os
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()


def get_calendar_service(access_token, refresh_token=None):
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET")
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    service = build("calendar", "v3", credentials=creds)
    return service


def get_events(access_token, days_ahead=7, refresh_token=None):
    service = get_calendar_service(access_token, refresh_token)
    now      = datetime.now(timezone.utc)
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
        end   = event["end"].get("dateTime", event["end"].get("date"))
        result.append({
            "id":    event["id"],
            "title": event.get("summary", "Без заглавие"),
            "start": start,
            "end":   end,
        })
    return result


def get_busy_intervals(access_token, days_ahead=7, refresh_token=None):
    events = get_events(access_token, days_ahead, refresh_token)
    busy   = []
    for event in events:
        start = event["start"]
        end   = event["end"]
        if "T" in start:
            start_dt = datetime.fromisoformat(start).astimezone(timezone.utc)
            end_dt   = datetime.fromisoformat(end).astimezone(timezone.utc)
            busy.append({"start": start_dt, "end": end_dt})
    return busy


def create_event(access_token, title, start, end, notes="", refresh_token=None):
    service = get_calendar_service(access_token, refresh_token)

    if start.endswith('Z'):
        start = start.replace('Z', '+00:00')
    if end.endswith('Z'):
        end = end.replace('Z', '+00:00')

    event = {
        "summary":     title,
        "description": notes,
        "start": {"dateTime": start, "timeZone": "Europe/Sofia"},
        "end":   {"dateTime": end,   "timeZone": "Europe/Sofia"},
    }
    created = service.events().insert(calendarId="primary", body=event).execute()
    return created