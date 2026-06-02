from flask import Blueprint, jsonify, session, request
from backend.firebase_config import get_db
from datetime import datetime, timezone

notify_bp = Blueprint("notify", __name__, url_prefix="/notify")


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Не си влязъл"}), 401
        return f(*args, **kwargs)
    return decorated


@notify_bp.route("/webhook", methods=["POST"])
def google_webhook():
    channel_id = request.headers.get("X-Goog-Channel-ID")
    resource_state = request.headers.get("X-Goog-Resource-State")

    if not channel_id or resource_state == "sync":
        return "", 200

    db = get_db()

    channels = db.collection("watch_channels")\
        .where("channel_id", "==", channel_id)\
        .get()

    if not channels:
        return "", 200

    channel_data = channels[0].to_dict()
    user_id = channel_data.get("user_id")

    groups = db.collection("groups")\
        .where("members", "array_contains", user_id)\
        .get()

    for group in groups:
        group_data = group.to_dict()
        for member_id in group_data["members"]:
            if member_id != user_id:
                db.collection("notifications").add({
                    "to_id": member_id,
                    "from_id": user_id,
                    "group_id": group.id,
                    "message": "Член на групата промени календара си. Проверете свободните часове.",
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })

    return "", 200


@notify_bp.route("/my", methods=["GET"])
@login_required
def my_notifications():
    db = get_db()
    user_id = session["user_id"]

    notifications = db.collection("notifications")\
        .where("to_id", "==", user_id)\
        .where("read", "==", False)\
        .get()

    result = []
    for notif in notifications:
        data = notif.to_dict()
        result.append({
            "id": notif.id,
            "message": data.get("message"),
            "from_id": data.get("from_id"),
            "group_id": data.get("group_id"),
            "created_at": data.get("created_at"),
        })

    return jsonify({"notifications": result})


@notify_bp.route("/<notif_id>/read", methods=["POST"])
@login_required
def mark_read(notif_id):
    db = get_db()
    db.collection("notifications").document(notif_id).update({"read": True})
    return jsonify({"message": "Маркирано като прочетено"})


@notify_bp.route("/watch", methods=["POST"])
@login_required
def watch_calendar():
    import uuid
    import requests as req
    import os
    from dotenv import load_dotenv
    load_dotenv()

    access_token = session.get("access_token")
    user_id = session["user_id"]
    channel_id = str(uuid.uuid4())
    webhook_url = os.getenv("WEBHOOK_URL", "http://localhost:5000/notify/webhook")

    response = req.post(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events/watch",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "id": channel_id,
            "type": "web_hook",
            "address": webhook_url,
        }
    )

    if response.status_code == 200:
        db = get_db()
        db.collection("watch_channels").add({
            "channel_id": channel_id,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return jsonify({"message": "Webhook регистриран успешно"})
    else:
        return jsonify({"error": response.json()}), 500
