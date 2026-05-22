import flet as ft
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import datetime

# 1. Initialize Firebase
cred = credentials.Certificate("firebase_key.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

def main(page: ft.Page):
    page.title = "Hangout Planner - Prototype"
    page.vertical_alignment = ft.MainAxisAlignment.START
    page.horizontal_alignment = ft.CrossAxisAlignment.CENTER
    page.padding = 20

    # UI Components
    user_dropdown = ft.Dropdown(
        label="Select User",
        width=300,
        options=[
            ft.dropdown.Option("Ivan"),
            ft.dropdown.Option("Yana"),
        ],
        value="Ivan" # Default value
    )
    
    title_input = ft.TextField(label="Event Title (e.g., Gym, Movie)", width=300)
    hour_input = ft.TextField(label="Time (e.g., 14:00 or 18:30)", width=150)
    status_text = ft.Text("", size=16)

    # Database sync logic
    def save_to_firebase(e):
        if not title_input.value or not hour_input.value:
            status_text.value = "Please fill in all fields!"
            status_text.color = "red"
            page.update()
            return

        try:
            # Create a unique document inside the "events" collection
            doc_ref = db.collection("events").document()
            doc_ref.set({
                "user": user_dropdown.value,
                "title": title_input.value,
                "time": hour_input.value,
                "created_at": datetime.datetime.now()
            })

            status_text.value = f"✓ Saved for {user_dropdown.value}: {title_input.value} at {hour_input.value}!"
            status_text.color = "green"
            
            # Clear text fields for the next entry
            title_input.value = ""
            hour_input.value = ""
            
        except Exception as ex:
            status_text.value = f"Connection error: {ex}"
            status_text.color = "red"
            
        page.update()

    # Layout structuring
    page.add(
        ft.Text("Hangout Planner - Add Event", size=22, weight=ft.FontWeight.BOLD),
        ft.Divider(),
        user_dropdown,
        title_input,
        hour_input,
        ft.ElevatedButton("Save Event to Cloud", on_click=save_to_firebase, bgcolor="blue", color="white"),
        status_text
    )

ft.app(target=main)