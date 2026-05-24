import flet as ft
import firebase_admin
from firebase_admin import credentials
import datetime
from main import add_event, get_events_for_user, delete_event, find_free_slots
from notifications import notify_users, get_notifications, mark_as_read

if not firebase_admin._apps:
    cred = credentials.Certificate("firebase_key.json")
    firebase_admin.initialize_app(cred)

USERS = ["Alex", "Maria"]

def main(page: ft.Page):
    page.title = "Hangout Planner"
    page.vertical_alignment = ft.MainAxisAlignment.START
    page.horizontal_alignment = ft.CrossAxisAlignment.CENTER
    page.padding = 20

    user_dropdown = ft.Dropdown(
        label="Select User",
        width=300,
        options=[ft.dropdown.Option(u) for u in USERS],
        value=USERS[0]
    )

    title_input = ft.TextField(label="Event Title (e.g., Gym, Movie)", width=300)
    date_input = ft.TextField(label="Date (YYYY-MM-DD)", width=200)
    start_input = ft.TextField(label="Start (HH:MM)", width=140)
    end_input = ft.TextField(label="End (HH:MM)", width=140)
    status_text = ft.Text("", size=15)
    events_list = ft.Column()
    free_slots_list = ft.Column()
    notif_list = ft.Column()

    def refresh_events():
        events_list.controls.clear()
        user_id = user_dropdown.value.lower()
        events = get_events_for_user(user_id)
        for ev in events:
            def make_delete(eid, etitle):
                def on_delete(e):
                    delete_event(eid)
                    other_users = [u.lower() for u in USERS if u.lower() != user_id]
                    notify_users(eid, user_id, f"{user_dropdown.value} cancelled '{etitle}'", other_users)
                    status_text.value = f"Deleted '{etitle}' and notified others."
                    status_text.color = "orange"
                    refresh_events()
                    page.update()
                return on_delete

            events_list.controls.append(
                ft.Row([
                    ft.Text(f"{ev['date']}  {ev['start_time']}–{ev['end_time']}  {ev['title']}", size=14),
                    ft.IconButton("delete", on_click=make_delete(ev["id"], ev["title"]))
                ])
            )
        page.update()

    def refresh_notifications():
        notif_list.controls.clear()
        user_id = user_dropdown.value.lower()
        notifs = get_notifications(user_id)
        if not notifs:
            notif_list.controls.append(ft.Text("No new notifications.", italic=True, color="grey"))
        for n in notifs:
            def make_read(nid):
                def on_read(e):
                    mark_as_read(nid)
                    refresh_notifications()
                    page.update()
                return on_read

            notif_list.controls.append(
                ft.Row([
                    ft.Text(f"🔔 {n['message']}", size=13),
                    ft.TextButton("Mark read", on_click=make_read(n["id"]))
                ])
            )
        page.update()

    def refresh_free_slots():
        free_slots_list.controls.clear()
        date = date_input.value.strip()
        if not date:
            free_slots_list.controls.append(ft.Text("Enter a date to find free slots.", italic=True))
            page.update()
            return
        all_ids = [u.lower() for u in USERS]
        slots = find_free_slots(all_ids, date)
        if not slots:
            free_slots_list.controls.append(ft.Text("No common free time found.", color="red"))
        for slot in slots:
            free_slots_list.controls.append(
                ft.Text(f"✅ {slot['start']} – {slot['end']}", color="green", size=14)
            )
        page.update()

    def save_event(e):
        if not all([title_input.value, date_input.value, start_input.value, end_input.value]):
            status_text.value = "Please fill in all fields!"
            status_text.color = "red"
            page.update()
            return
        try:
            user_id = user_dropdown.value.lower()
            add_event(user_id, title_input.value, date_input.value, start_input.value, end_input.value)
            status_text.value = f"✓ Saved: {title_input.value} on {date_input.value}"
            status_text.color = "green"
            title_input.value = ""
            start_input.value = ""
            end_input.value = ""
            refresh_events()
        except Exception as ex:
            status_text.value = f"Error: {ex}"
            status_text.color = "red"
        page.update()

    def on_user_change(e):
        refresh_events()
        refresh_notifications()

    user_dropdown.on_change = on_user_change

    page.add(
        ft.Text("Hangout Planner", size=24, weight=ft.FontWeight.BOLD),
        ft.Divider(),

        ft.Text("Add Event", size=18, weight=ft.FontWeight.BOLD),
        user_dropdown,
        title_input,
        date_input,
        ft.Row([start_input, end_input]),
        ft.ElevatedButton("Save Event", on_click=save_event, bgcolor="blue", color="white"),
        status_text,

        ft.Divider(),
        ft.Text("My Events", size=18, weight=ft.FontWeight.BOLD),
        ft.ElevatedButton("Refresh Events", on_click=lambda e: refresh_events()),
        events_list,

        ft.Divider(),
        ft.Text("Find Free Time", size=18, weight=ft.FontWeight.BOLD),
        ft.ElevatedButton("Find Free Slots", on_click=lambda e: refresh_free_slots()),
        free_slots_list,

        ft.Divider(),
        ft.Text("Notifications", size=18, weight=ft.FontWeight.BOLD),
        ft.ElevatedButton("Check Notifications", on_click=lambda e: refresh_notifications()),
        notif_list,
    )

    refresh_events()
    refresh_notifications()

ft.app(target=main)