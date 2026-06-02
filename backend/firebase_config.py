import os
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()

_db = None

def init_firebase():
    if not firebase_admin._apps:
        key_path = os.getenv("FIREBASE_KEY_PATH")
        if not key_path:
            raise ValueError("FIREBASE_KEY_PATH не е зададен в .env")
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)

def get_db():
    global _db
    if _db is None:
        init_firebase()
        _db = firestore.client()
    return _db
