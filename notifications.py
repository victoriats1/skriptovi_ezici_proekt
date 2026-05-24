import firebase_admin
from firebase_admin import firestore
import datetime

db = firestore.client()


def notify_users(event_id: str, changed_by: str, message: str, user_ids: list[str]):
    for user_id in user_ids:
        if user_id == changed_by:
            continue
        db.collection("notifications").add({
            "to_user": user_id,
            "from_user": changed_by,
            "event_id": event_id,
            "message": message,
            "read": False,
            "created_at": datetime.datetime.now()
        })


def get_notifications(user_id: str) -> list[dict]:
    docs = (
        db.collection("notifications")
        .where("to_user", "==", user_id)
        .where("read", "==", False)
        .stream()
    )
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


def mark_as_read(notification_id: str):
    db.collection("notifications").document(notification_id).update({"read": True})