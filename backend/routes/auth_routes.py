from flask import Blueprint, redirect, request, session, jsonify
from backend.auth import (
    get_google_auth_url,
    exchange_code_for_tokens,
    get_user_info,
    save_user_to_firestore,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

@auth_bp.route("/login")
def login():
    return redirect(get_google_auth_url())

@auth_bp.route("/callback")
def callback():
    code = request.args.get("code")
    if not code:
        return jsonify({"error": "Няма код от Google"}), 400
    tokens = exchange_code_for_tokens(code)
    user_info = get_user_info(tokens["access_token"])
    user_id = save_user_to_firestore(user_info, tokens)
    session["user_id"] = user_id
    session["user_name"] = user_info["name"]
    session["access_token"] = tokens["access_token"]
    return redirect("/dashboard")

@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect("/")

@auth_bp.route("/me")
def me():
    if "user_id" not in session:
        return jsonify({"error": "Не си влязъл"}), 401
    return jsonify({
        "user_id": session["user_id"],
        "name": session["user_name"],
    })
