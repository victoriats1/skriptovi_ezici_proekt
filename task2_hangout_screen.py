import flet as ft
from datetime import datetime
import firebase_admin
from firebase_admin import credentials
from main import find_free_slots, get_events_for_user
from notifications import get_notifications, mark_as_read

if not firebase_admin._apps:
    cred = credentials.Certificate("firebase_key.json")
    firebase_admin.initialize_app(cred)

BG_DARK      = "#0D1117"
BG_CARD2     = "#1C2230"
ACCENT_TEAL  = "#2DD4BF"
ACCENT_PINK  = "#F472B6"
TEXT_PRIMARY = "#E6EDF3"
TEXT_MUTED   = "#8B949E"
BORDER_CLR   = "#30363D"
FREE_COLOR   = "#22C55E"
BUSY_COLOR   = "#EF4444"

PARTICIPANTS = [
    {"name": "Alex",  "user_id": "alex",  "avatar": "🧑"},
    {"name": "Maria", "user_id": "maria", "avatar": "👩"},
]


def get_busy_hours(user_id: str, date: str) -> list:
    events = get_events_for_user(user_id)
    busy = []
    for ev in events:
        if ev["date"] == date:
            sh = int(ev["start_time"].split(":")[0])
            eh = int(ev["end_time"].split(":")[0])
            busy.extend(range(sh, eh))
    return busy


def build_hangout_view(page: ft.Page, current_user_id="alex"):
    selected_date  = [datetime.now().strftime("%Y-%m-%d")]
    detail_visible = [False]

    # ── Notifications ─────────────────────────────────────────────
    notif_column = ft.Column(spacing=6)

    def refresh_notifications():
        notif_column.controls.clear()
        notifs = get_notifications(current_user_id)
        if not notifs:
            notif_column.controls.append(
                ft.Text("No new notifications", size=12,
                        color=TEXT_MUTED, italic=True))
        for n in notifs:
            def make_read(nid):
                def on_read(e):
                    mark_as_read(nid)
                    refresh_notifications()
                    page.update()
                return on_read

            notif_column.controls.append(
                ft.Container(
                    content=ft.Row([
                        ft.Icon(ft.icons.NOTIFICATIONS_ACTIVE,
                                color=ACCENT_PINK, size=16),
                        ft.Text(n["message"], size=12,
                                color=TEXT_PRIMARY, expand=True),
                        ft.TextButton("Mark read",
                                      on_click=make_read(n["id"]),
                                      style=ft.ButtonStyle(color=TEXT_MUTED)),
                    ], spacing=8),
                    bgcolor="#1E1020",
                    border=ft.border.all(1, ACCENT_PINK),
                    border_radius=10,
                    padding=ft.padding.symmetric(horizontal=14, vertical=8),
                )
            )

    # ── Participants ───────────────────────────────────────────────
    participants_row = ft.Row(spacing=8, wrap=True)

    def render_participants():
        participants_row.controls.clear()
        for p in PARTICIPANTS:
            participants_row.controls.append(
                ft.Container(
                    content=ft.Row([
                        ft.Text(p["avatar"], size=18),
                        ft.Text(p["name"], size=12, color=TEXT_PRIMARY),
                    ], spacing=6, tight=True),
                    bgcolor=BG_CARD2, border_radius=20,
                    padding=ft.padding.symmetric(horizontal=12, vertical=6),
                    border=ft.border.all(1, BORDER_CLR),
                )
            )

    # ── Free slots grid ───────────────────────────────────────────
    grid_column   = ft.Column(spacing=4, scroll=ft.ScrollMode.AUTO)
    detail_popup  = ft.Container(
        visible=False, bgcolor=BG_CARD2, border_radius=14,
        padding=20, border=ft.border.all(1, ACCENT_TEAL),
        content=ft.Column([]),
    )

    def render_grid():
        grid_column.controls.clear()
        date = selected_date[0]

        # Get free slots from backend
        all_ids   = [p["user_id"] for p in PARTICIPANTS]
        free_slots = find_free_slots(all_ids, date)
        free_hours = set()
        for slot in free_slots:
            sh = int(slot["start"].split(":")[0])
            eh = int(slot["end"].split(":")[0])
            free_hours.update(range(sh, eh))

        for hour in range(8, 22):
            busy = [
                p["name"] for p in PARTICIPANTS
                if hour in get_busy_hours(p["user_id"], date)
            ]
            is_free   = hour in free_hours
            color     = FREE_COLOR if is_free else BUSY_COLOR
            status_tx = "Everyone free ✓" if is_free else f"Busy: {', '.join(busy)}"

            grid_column.controls.append(
                ft.Container(
                    content=ft.Row([
                        ft.Text(f"{hour:02d}:00", size=12,
                                color=TEXT_MUTED, width=45),
                        ft.Container(
                            width=240, height=28, border_radius=6,
                            bgcolor=color + "33",
                            border=ft.border.all(1, color),
                            content=ft.Text(status_tx, size=11, color=color,
                                            overflow=ft.TextOverflow.ELLIPSIS),
                            padding=ft.padding.symmetric(horizontal=8, vertical=4),
                        ),
                        ft.IconButton(
                            ft.icons.OPEN_IN_NEW, icon_size=14,
                            icon_color=ACCENT_TEAL if is_free else TEXT_MUTED,
                            on_click=lambda e, h=hour, b=busy, f=is_free:
                                show_slot_detail(h, b, f),
                        ),
                    ], spacing=8),
                )
            )

    def show_slot_detail(hour, busy_people, is_free):
        free_people = [p["name"] for p in PARTICIPANTS
                       if p["name"] not in busy_people]
        detail_popup.visible = True
        detail_popup.content = ft.Column([
            ft.Text(f"🕐 {hour:02d}:00 – {hour+1:02d}:00",
                    size=16, color=TEXT_PRIMARY, weight=ft.FontWeight.BOLD),
            ft.Text(f"Free:  {', '.join(free_people) or 'Nobody'}",
                    size=13, color=FREE_COLOR),
            ft.Text(f"Busy:  {', '.join(busy_people) or 'Nobody'}",
                    size=13, color=BUSY_COLOR),
            ft.ElevatedButton(
                "Send hangout invite 📨",
                bgcolor=ACCENT_TEAL if is_free else "#333",
                color=BG_DARK, disabled=not is_free,
                on_click=lambda e: send_invite(hour),
                style=ft.ButtonStyle(
                    shape=ft.RoundedRectangleBorder(radius=8)),
            ),
            ft.TextButton("Close",
                          on_click=lambda e: close_detail(),
                          style=ft.ButtonStyle(color=TEXT_MUTED)),
        ], spacing=10)
        page.update()

    def close_detail():
        detail_popup.visible = False
        page.update()

    def send_invite(hour):
        page.snack_bar = ft.SnackBar(ft.Text(f"Invite sent for {hour:02d}:00! 🎉"), bgcolor=BG_CARD2)
        page.snack_bar.open = True
        close_detail()

    # ── Date field ─────────────────────────────────────────────────
    def on_date_change(e):
        selected_date[0] = e.control.value.strip()
        render_grid()
        page.update()

    date_field = ft.TextField(
        label="Check date (YYYY-MM-DD)",
        value=selected_date[0],
        width=220, bgcolor=BG_CARD2, color=TEXT_PRIMARY,
        label_style=ft.TextStyle(color=TEXT_MUTED),
        border_color=BORDER_CLR, focused_border_color=ACCENT_TEAL,
        border_radius=10, cursor_color=ACCENT_TEAL,
        on_submit=on_date_change,
    )

    refresh_notifications()
    render_participants()
    render_grid()

    return ft.Container(
        content=ft.Column([
            ft.Text("🤝 Hangout Planner", size=22,
                    weight=ft.FontWeight.BOLD, color=TEXT_PRIMARY,
                    font_family="monospace"),
            notif_column,
            ft.ElevatedButton(
                "Refresh notifications",
                bgcolor=BG_CARD2,
                color=ACCENT_PINK,
                on_click=lambda e: [refresh_notifications(), page.update()],
                style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=8)),
            ),
            ft.Text("Participants", size=13, color=TEXT_MUTED),
            participants_row,
            ft.Divider(height=1, color=BORDER_CLR),
            ft.Row([
                date_field,
                ft.ElevatedButton(
                    "Check",
                    bgcolor=ACCENT_TEAL, color=BG_DARK,
                    on_click=on_date_change,
                    style=ft.ButtonStyle(
                        shape=ft.RoundedRectangleBorder(radius=8)),
                ),
            ], spacing=10),
            ft.Text("Shared availability", size=13, color=TEXT_MUTED),
            ft.Container(content=grid_column, expand=True),
            detail_popup,
        ], spacing=14, expand=True),
        bgcolor=BG_DARK, padding=20, expand=True,
    )


if __name__ == "__main__":
    def main(page: ft.Page):
        page.title = "Task 2 – Hangout Screen"
        page.bgcolor = BG_DARK
        page.padding = 0
        page.add(build_hangout_view(page, current_user_id="alex"))
    ft.app(target=main)