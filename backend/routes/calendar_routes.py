from flask import Blueprint, jsonify, request, session
from backend.calendar import get_events, get_busy_intervals, create_event, get_calendar_service
from backend.firebase_config import get_db
from datetime import datetime, timezone

calendar_bp = Blueprint("calendar", __name__, url_prefix="/calendar")


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Ne si vlyal"}), 401
        return f(*args, **kwargs)
    return decorated


@calendar_bp.route("/events")
@login_required
def events():
    access_token  = session.get("access_token")
    refresh_token = session.get("refresh_token")
    try:
        data = get_events(access_token, days_ahead=7, refresh_token=refresh_token)
        return jsonify({"events": data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@calendar_bp.route("/events", methods=["POST"])
@login_required
def add_event():
    access_token  = session.get("access_token")
    refresh_token = session.get("refresh_token")
    user_id       = session["user_id"]
    user_name     = session.get("user_name", "")

    data  = request.get_json()
    title = data.get("title")
    start = data.get("start")
    end   = data.get("end")
    notes = data.get("notes", "")

    if not title or not start or not end:
        return jsonify({"error": "Lipsvat zadaljitelni poleta"}), 400

    try:
        event = create_event(access_token, title, start, end, notes, refresh_token)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # Провери за конфликти с групови срещи
    try:
        new_start = datetime.fromisoformat(start.replace('Z', '+00:00'))
        new_end   = datetime.fromisoformat(end.replace('Z', '+00:00'))

        db     = get_db()
        groups = db.collection("groups")\
            .where("members", "array_contains", user_id).get()

        for group in groups:
            group_data = group.to_dict()
            group_id   = group.id
            group_name = group_data.get("name", "")
            members    = group_data.get("members", [])

            hangouts = db.collection("hangouts")\
                .where("group_id", "==", group_id).get()

            for hangout in hangouts:
                h          = hangout.to_dict()
                hangout_id = hangout.id

                if not h.get("start") or not h.get("end"):
                    continue

                try:
                    h_start = datetime.fromisoformat(h["start"].replace('Z', '+00:00'))
                    h_end   = datetime.fromisoformat(h["end"].replace('Z', '+00:00'))
                except Exception:
                    continue

                # Препокриване
                if new_start < h_end and new_end > h_start:
                    hangout_title = h.get("title", "sreshta")
                    message = user_name + " si dobavi nov angajiment koito se prepokriva s " + hangout_title + " v grupa " + group_name + ". Sreshtata e otmenena."

                    # Изпрати известие до всички членове
                    for member_id in members:
                        if member_id != user_id:
                            db.collection("notifications").add({
                                "to_id":      member_id,
                                "from_id":    user_id,
                                "group_id":   group_id,
                                "message":    message,
                                "read":       False,
                                "created_at": datetime.now(timezone.utc).isoformat(),
                            })

                    # Изтрий срещата от Firestore
                    db.collection("hangouts").document(hangout_id).delete()

                    # Изтрий срещата от Google Calendar на всички членове
                    for member_id in members:
                        member = db.collection("users").document(member_id).get()
                        if member.exists:
                            member_data   = member.to_dict()
                            m_token       = member_data.get("access_token")
                            m_refresh     = member_data.get("refresh_token", "")
                            if m_token:
                                try:
                                    service = get_calendar_service(m_token, m_refresh)
                                    # Търси събитието по заглавие и час
                                    cal_events = service.events().list(
                                        calendarId="primary",
                                        timeMin=h_start.isoformat(),
                                        timeMax=h_end.isoformat(),
                                        q=hangout_title,
                                        singleEvents=True
                                    ).execute()
                                    for cal_event in cal_events.get("items", []):
                                        if hangout_title.lower() in cal_event.get("summary", "").lower():
                                            service.events().delete(
                                                calendarId="primary",
                                                eventId=cal_event["id"]
                                            ).execute()
                                except Exception as e:
                                    print("Greshka pri iztrivane ot kalendar: " + str(e))

    except Exception as e:
        print("Greshka pri proverka za konflikti: " + str(e))

    return jsonify({"status": "ok", "id": event.get("id")})


@calendar_bp.route("/busy")
@login_required
def busy():
    access_token  = session.get("access_token")
    refresh_token = session.get("refresh_token")
    try:
        intervals = get_busy_intervals(access_token, days_ahead=7, refresh_token=refresh_token)
        result = [
            {"start": i["start"].isoformat(), "end": i["end"].isoformat()}
            for i in intervals
        ]
        return jsonify({"busy": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500