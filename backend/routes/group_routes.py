from flask import Blueprint, jsonify, session, request
from backend.firebase_config import get_db
from backend.calendar import get_busy_intervals, create_event
from backend.free_slots import find_free_slots, format_free_slots

group_bp = Blueprint("group", __name__, url_prefix="/group")


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Ne si vlyal"}), 401
        return f(*args, **kwargs)
    return decorated


@group_bp.route("/create", methods=["POST"])
@login_required
def create_group():
    data   = request.get_json()
    name   = data.get("name")
    emoji  = data.get("emoji", "🎉")
    emails = data.get("emails", [])

    if not name:
        return jsonify({"error": "Lipva ime na grupata"}), 400

    db      = get_db()
    user_id = session["user_id"]

    group_ref = db.collection("groups").add({
        "name":     name,
        "emoji":    emoji,
        "ownerUid": user_id,
        "members":  [user_id],
        "emails":   [session.get("user_email", "")],
    })

    group_id = group_ref[1].id

    for email in emails:
        db.collection("invites").add({
            "from_id":    user_id,
            "from_email": session.get("user_email", ""),
            "group_id":   group_id,
            "to_email":   email,
            "status":     "pending",
        })

    return jsonify({"status": "ok", "group_id": group_id})


@group_bp.route("/invite", methods=["POST"])
@login_required
def invite():
    data     = request.get_json()
    email    = data.get("email")
    group_id = data.get("group_id", "")
    if not email:
        return jsonify({"error": "Lipva email"}), 400

    db      = get_db()
    user_id = session["user_id"]

    db.collection("invites").add({
        "from_id":    user_id,
        "from_email": session.get("user_email", ""),
        "group_id":   group_id,
        "to_email":   email,
        "status":     "pending",
    })

    return jsonify({"message": "Pokana izpratena do " + email})


@group_bp.route("/invites", methods=["GET"])
@login_required
def get_invites():
    db         = get_db()
    user_email = session.get("user_email", "")

    invites = db.collection("invites")\
        .where("to_email", "==", user_email)\
        .where("status", "==", "pending")\
        .get()

    result = []
    for invite in invites:
        data = invite.to_dict()
        result.append({
            "invite_id":  invite.id,
            "from_email": data.get("from_email"),
            "from_id":    data.get("from_id"),
            "group_id":   data.get("group_id", ""),
        })

    return jsonify({"invites": result})


@group_bp.route("/invite/<invite_id>/accept", methods=["POST"])
@login_required
def accept_invite(invite_id):
    db         = get_db()
    user_id    = session["user_id"]
    user_email = session.get("user_email", "")

    invite_ref = db.collection("invites").document(invite_id)
    invite     = invite_ref.get()

    if not invite.exists:
        return jsonify({"error": "Pokanata ne sushtestvuva"}), 404

    invite_data = invite.to_dict()
    invite_ref.update({"status": "accepted"})

    group_id = invite_data.get("group_id")

    if group_id:
        group_ref = db.collection("groups").document(group_id)
        group     = group_ref.get()
        if group.exists:
            group_data = group.to_dict()
            members    = group_data.get("members", [])
            emails     = group_data.get("emails", [])
            if user_id not in members:
                members.append(user_id)
                emails.append(user_email)
                group_ref.update({"members": members, "emails": emails})
    else:
        db.collection("groups").add({
            "members": [invite_data["from_id"], user_id],
            "emails":  [invite_data["from_email"], user_email],
        })

    return jsonify({"message": "Pokanata e prieta"})


@group_bp.route("/list", methods=["GET"])
@login_required
def list_groups():
    db      = get_db()
    user_id = session["user_id"]

    groups = db.collection("groups")\
        .where("members", "array_contains", user_id)\
        .get()

    result = []
    for g in groups:
        data = g.to_dict()
        result.append({
            "id":       g.id,
            "name":     data.get("name", ""),
            "emoji":    data.get("emoji", "🎉"),
            "members":  data.get("members", []),
            "emails":   data.get("emails", []),
            "ownerUid": data.get("ownerUid", ""),
        })

    return jsonify({"groups": result})


@group_bp.route("/hangouts", methods=["GET"])
@login_required
def list_hangouts():
    group_id = request.args.get("group_id")
    if not group_id:
        return jsonify({"error": "Lipva group_id"}), 400

    db = get_db()
    hangouts = db.collection("hangouts")\
        .where("group_id", "==", group_id)\
        .get()

    result = []
    for h in hangouts:
        data = h.to_dict()
        result.append({
            "id":       h.id,
            "title":    data.get("title", ""),
            "start":    data.get("start", ""),
            "end":      data.get("end", ""),
            "location": data.get("location", ""),
            "notes":    data.get("notes", ""),
        })

    return jsonify({"hangouts": result})


@group_bp.route("/hangouts", methods=["POST"])
@login_required
def create_hangout():
    db      = get_db()
    user_id = session["user_id"]
    data    = request.get_json()

    group_id = data.get("group_id")
    title    = data.get("title")
    start    = data.get("start")
    end      = data.get("end")
    location = data.get("location", "")
    notes    = data.get("notes", "")

    if not group_id or not title or not start:
        return jsonify({"error": "Lipvat zadaljitelni poleta"}), 400

    # Запази срещата в Firestore
    db.collection("hangouts").add({
        "group_id":   group_id,
        "title":      title,
        "start":      start,
        "end":        end,
        "location":   location,
        "notes":      notes,
        "created_by": user_id,
    })

    # Добави събитието в Google Calendar на всички членове
    group = db.collection("groups").document(group_id).get()
    if group.exists:
        group_data = group.to_dict()
        members    = group_data.get("members", [])

        event_notes = notes + (" | Място: " + location if location else "")

        for member_id in members:
            # Пропусни създателя — той вече го добавя от frontend-а
            if member_id == user_id:
                continue
            member = db.collection("users").document(member_id).get()
            if member.exists:
                member_data   = member.to_dict()
                access_token  = member_data.get("access_token")
                refresh_token = member_data.get("refresh_token", "")
                if access_token:
                    try:
                        create_event(
                            access_token,
                            title,
                            start,
                            end,
                            event_notes,
                            refresh_token
                        )
                    except Exception as e:
                        print("Greshka pri dobaviane v kalendara na " + member_id + ": " + str(e))

    return jsonify({"status": "ok"})


@group_bp.route("/free-slots", methods=["GET"])
@login_required
def group_free_slots():
    group_id = request.args.get("group_id")
    if not group_id:
        return jsonify({"error": "Lipva group_id"}), 400

    db      = get_db()
    user_id = session["user_id"]

    group = db.collection("groups").document(group_id).get()
    if not group.exists:
        return jsonify({"error": "Grupata ne sushtestvuva"}), 404

    group_data = group.to_dict()
    if user_id not in group_data["members"]:
        return jsonify({"error": "Ne si chlen na tazi grupa"}), 403

    busy_list = []
    for member_id in group_data["members"]:
        member = db.collection("users").document(member_id).get()
        if member.exists:
            member_data   = member.to_dict()
            token         = member_data.get("access_token")
            refresh_token = member_data.get("refresh_token", "")
            if token:
                try:
                    busy = get_busy_intervals(token, days_ahead=7, refresh_token=refresh_token)
                    busy_list.append(busy)
                except Exception:
                    busy_list.append([])

    free = find_free_slots(busy_list, days_ahead=7)
    return jsonify({"free_slots": format_free_slots(free)})