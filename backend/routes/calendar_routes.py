from flask import Blueprint, jsonify, session
from backend.calendar import get_events, get_busy_intervals

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
