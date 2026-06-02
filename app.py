import os
from flask import Flask, render_template, session, redirect
from dotenv import load_dotenv
from backend.firebase_config import init_firebase
from backend.routes.auth_routes import auth_bp

load_dotenv()

app = Flask(
    __name__,
    template_folder="frontend/templates",
    static_folder="frontend/static",
)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-key-smeni-tova")

init_firebase()
app.register_blueprint(auth_bp)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect("/auth/login")
    return render_template("dashboard.html", name=session["user_name"])


if __name__ == "__main__":
    app.run(debug=True)
