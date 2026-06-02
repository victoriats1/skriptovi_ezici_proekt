from flask import Blueprint, jsonify, session, request
from backend.firebase_config import get_db
from backend.calendar import get_busy_intervals
from backend.free_slots import find_free_slots, format_free_slots

group_bp = Blueprint("group", __name__, url_prefix="/group")


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Не си влязъл"}), 401
        return f(*args, **kwargs)
    return decorated


@group_bp.route("/invite", methods=["POST"])
@login_required
def invite():
    data = request.get_json()
    email = data.get("email")
    if not email:
        return jsonify({"error": "Липсва имейл"}), 400

    db = get_db()
    user_id = session["user_id"]

    users = db.collection("users").where("email", "==", email).get()
    if not users:
        return jsonify({"error": "Потребителят не е намерен"}), 404

    invited_user = users[0]
    invited_id = invited_user.id

    if invited_id == user_id:
        return jsonify({"error": "Не можеш да поканиш себе си"}), 400

    db.collection("invites").add({
        "from_id": user_id,
        "from_email": session.get("user_email", ""),
        "to_id": invited_id,
        "to_email": email,
        "status": "pending",
    })

    return jsonify({"message": f"Покана изпратена до {email}"})


@group_bp.route("/invites", methods=["GET"])
@login_required
def get_invites():
    db = get_db()
    user_id = session["user_id"]

    invites = db.collection("invites")\
        .where("to_id", "==", user_id)\
        .where("status", "==", "pending")\
        .get()

    result = []
    for invite in invites:
        data = invite.to_dict()
        result.append({
            "invite_id": invite.id,
            "from_email": data.get("from_email"),
            "from_id": data.get("from_id"),
        })

    return jsonify({"invites": result})


@group_bp.route("/invite/<invite_id>/accept", methods=["POST"])
@login_required
def accept_invite(invite_id):
    db = get_db()
    user_id = session["user_id"]

    invite_ref = db.collection("invites").document(invite_id)
    invite = invite_ref.get()

    if not invite.exists:
        return jsonify({"error": "Поканата не съществува"}), 404

    invite_data = invite.to_dict()

    if invite_data["to_id"] != user_id:
        return jsonify({"error": "Нямаш право"}), 403

    invite_ref.update({"status": "accepted"})

    db.collection("groups").add({
        "members": [invite_data["from_id"], user_id],
        "emails": [invite_data["from_email"], invite_data["to_email"]],
    })

    return jsonify({"message": "Поканата е приета, групата е създадена"})


@group_bp.route("/free-slots", methods=["GET"])
@login_required
def group_free_slots():
    group_id = request.args.get("group_id")
    if not group_id:
        return jsonify({"error": "Липсва group_id"}), 400

    db = get_db()
    user_id = session["user_id"]

    group = db.collection("groups").document(group_id).get()
    if not group.exists:
        return jsonify({"error": "Групата не съществува"}), 404

    group_data = group.to_dict()
    if user_id not in group_data["members"]:
        return jsonify({"error": "Не си член на тази група"}), 403

    busy_list = []
    for member_id in group_data["members"]:
        member = db.collection("users").document(member_id).get()
        if member.exists:
            token = member.to_dict().get("access_token")
            if token:
                try:
                    busy = get_busy_intervals(token, days_ahead=7)
                    busy_list.append(busy)
                except Exception:
                    busy_list.append([])

    free = find_free_slots(busy_list, days_ahead=7)
    return jsonify({"free_slots": format_free_slots(free)})
