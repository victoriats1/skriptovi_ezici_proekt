from flask import Blueprint, jsonify, request, session
from backend.calendar import get_events, get_busy_intervals, create_event


calendar_bp = Blueprint("calendar", __name__, url_prefix="/calendar")


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Не си влязъл"}), 401
        return f(*args, **kwargs)
    return decorated


@calendar_bp.route("/events")
@login_required
def events():
    access_token = session.get("access_token")
    try:
        data = get_events(access_token, days_ahead=7)
        return jsonify({"events": data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@calendar_bp.route("/events", methods=["POST"])
@login_required
def add_event():
    access_token = session.get("access_token")
    data  = request.get_json()
    title = data.get("title")
    start = data.get("start")
    end   = data.get("end")
    notes = data.get("notes", "")

    if not title or not start or not end:
        return jsonify({"error": "Липсват задължителни полета"}), 400

    try:
        event = create_event(access_token, title, start, end, notes)
        return jsonify({"status": "ok", "id": event.get("id")})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@calendar_bp.route("/busy")
@login_required
def busy():
    access_token = session.get("access_token")
    try:
        intervals = get_busy_intervals(access_token, days_ahead=7)
        result = [
            {"start": i["start"].isoformat(), "end": i["end"].isoformat()}
            for i in intervals
        ]
        return jsonify({"busy": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
