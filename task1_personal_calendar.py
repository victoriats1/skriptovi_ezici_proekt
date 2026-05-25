import flet as ft
from datetime import datetime, timedelta
import firebase_admin
from firebase_admin import credentials
from main import get_events_for_user, delete_event

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

DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def get_week_dates(offset=0):
    today = datetime.now()
    monday = today - timedelta(days=today.weekday()) + timedelta(weeks=offset)
    return [monday + timedelta(days=i) for i in range(7)]


def load_events_for_week(user_id: str, week_dates: list) -> dict:
    all_events = get_events_for_user(user_id)
    result = {i: [] for i in range(7)}
    for ev in all_events:
        for i, date in enumerate(week_dates):
            if ev["date"] == date.strftime("%Y-%m-%d"):
                result[i].append({
                    "title":   ev["title"],
                    "start":   ev["start_time"],
                    "end":     ev["end_time"],
                    "routine": False,
                    "id":      ev["id"],
                })
    return result


def build_calendar_view(page: ft.Page, current_user_id="alex", on_add_callback=None):
    selected_day   = [datetime.now().weekday()]
    week_offset    = [0]
    week_dates_ref = [get_week_dates(0)]
    events_data    = [load_events_for_week(current_user_id, week_dates_ref[0])]

    title      = ft.Text("📅 My Calendar", size=22, weight=ft.FontWeight.BOLD,
                         color=TEXT_PRIMARY, font_family="monospace")
    week_label = ft.Text("", size=13, color=TEXT_MUTED)
    day_buttons    = ft.Row(spacing=6, alignment=ft.MainAxisAlignment.CENTER)
    events_column  = ft.Column(spacing=10, scroll=ft.ScrollMode.AUTO)

    def update_week_label():
        dates = week_dates_ref[0]
        week_label.value = f"{dates[0].strftime('%d %b')} — {dates[6].strftime('%d %b %Y')}"

    def render_day_buttons():
        day_buttons.controls.clear()
        dates = week_dates_ref[0]
        today = datetime.now().date()
        for i, date in enumerate(dates):
            is_selected = i == selected_day[0]
            is_today    = date.date() == today
            has_events  = bool(events_data[0].get(i))
            dot = ft.Container(
                width=5, height=5, border_radius=3,
                bgcolor=ACCENT_TEAL if has_events else "transparent"
            )
            btn = ft.Container(
                content=ft.Column([
                    ft.Text(DAY_NAMES[i], size=11,
                            color=ACCENT_TEAL if is_selected else TEXT_MUTED,
                            weight=ft.FontWeight.W_600),
                    ft.Text(str(date.day), size=18,
                            color=TEXT_PRIMARY if is_selected else TEXT_MUTED,
                            weight=ft.FontWeight.BOLD),
                    dot,
                ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=2),
                width=44,
                padding=ft.padding.symmetric(vertical=8),
                border_radius=12,
                bgcolor=BG_CARD2 if is_selected else "transparent",
                border=ft.border.all(1, ACCENT_TEAL) if is_selected else (
                    ft.border.all(1, ACCENT_PINK) if is_today else None),
                animate=ft.animation.Animation(200, ft.AnimationCurve.EASE_OUT),
                on_click=lambda e, idx=i: select_day(idx),
            )
            day_buttons.controls.append(btn)

    def render_events():
        events_column.controls.clear()
        day_idx = selected_day[0]
        events  = events_data[0].get(day_idx, [])
        dates   = week_dates_ref[0]

        events_column.controls.append(
            ft.Text(f"{DAY_NAMES[day_idx]}, {dates[day_idx].strftime('%d.%m.%Y')}",
                    size=14, color=TEXT_MUTED, weight=ft.FontWeight.W_500)
        )

        if not events:
            events_column.controls.append(
                ft.Container(
                    content=ft.Column([
                        ft.Icon(ft.icons.CALENDAR_TODAY_OUTLINED, color=TEXT_MUTED, size=36),
                        ft.Text("No commitments for this day", color=TEXT_MUTED,
                                size=13, text_align=ft.TextAlign.CENTER),
                    ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=8),
                    padding=40, alignment=ft.alignment.center,
                )
            )
        else:
            for ev in events:
                def make_delete(event_id, event_title):
                    def on_delete(e):
                        delete_event(event_id)
                        events_data[0] = load_events_for_week(
                            current_user_id, week_dates_ref[0])
                        render_events()
                        render_day_buttons()
                        page.update()
                    return on_delete

                card = ft.Container(
                    content=ft.Row([
                        ft.Container(width=3, height=60,
                                     bgcolor=ACCENT_TEAL, border_radius=2),
                        ft.Column([
                            ft.Text(ev["title"], size=14, color=TEXT_PRIMARY,
                                    weight=ft.FontWeight.W_600),
                            ft.Text(f"⏰ {ev['start']} – {ev['end']}",
                                    size=12, color=TEXT_MUTED),
                        ], spacing=4, expand=True),
                        ft.IconButton(
                            ft.icons.DELETE_OUTLINE,
                            icon_color="#EF4444",
                            icon_size=18,
                            on_click=make_delete(ev["id"], ev["title"]),
                        ),
                    ], spacing=12),
                    bgcolor=BG_CARD2, border_radius=12,
                    padding=ft.padding.symmetric(horizontal=16, vertical=12),
                    border=ft.border.all(1, BORDER_CLR),
                )
                events_column.controls.append(card)

        events_column.controls.append(
            ft.ElevatedButton(
                content=ft.Row([
                    ft.Icon(ft.icons.ADD, size=16, color=BG_DARK),
                    ft.Text("Add commitment", size=13, color=BG_DARK,
                            weight=ft.FontWeight.W_600),
                ], spacing=6),
                bgcolor=ACCENT_TEAL,
                on_click=lambda e: on_add_callback(
                    selected_day[0],
                    week_dates_ref[0][selected_day[0]].strftime("%Y-%m-%d")
                ) if on_add_callback else None,
                style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=10)),
            )
        )

    def reload_week():
        events_data[0] = load_events_for_week(current_user_id, week_dates_ref[0])
        update_week_label()
        render_day_buttons()
        render_events()
        page.update()

    def select_day(idx):
        selected_day[0] = idx
        render_day_buttons()
        render_events()
        page.update()

    def prev_week(e):
        week_offset[0] -= 1
        week_dates_ref[0] = get_week_dates(week_offset[0])
        reload_week()

    def next_week(e):
        week_offset[0] += 1
        week_dates_ref[0] = get_week_dates(week_offset[0])
        reload_week()

    def today_week(e):
        week_offset[0] = 0
        week_dates_ref[0] = get_week_dates(0)
        selected_day[0] = datetime.now().weekday()
        reload_week()

    nav_row = ft.Row([
        ft.IconButton(ft.icons.CHEVRON_LEFT, icon_color=TEXT_MUTED, on_click=prev_week),
        week_label,
        ft.IconButton(ft.icons.CHEVRON_RIGHT, icon_color=TEXT_MUTED, on_click=next_week),
        ft.TextButton("Today", on_click=today_week,
                      style=ft.ButtonStyle(color=ACCENT_TEAL)),
    ], alignment=ft.MainAxisAlignment.CENTER, spacing=4)

    update_week_label()
    render_day_buttons()
    render_events()

    return ft.Container(
        content=ft.Column([
            title, nav_row, day_buttons,
            ft.Divider(height=1, color=BORDER_CLR),
            ft.Container(content=events_column, expand=True),
        ], spacing=14, expand=True),
        bgcolor=BG_DARK, padding=20, expand=True,
    )


if __name__ == "__main__":
    def main(page: ft.Page):
        page.title = "Task 1 – Personal Calendar"
        page.bgcolor = BG_DARK
        page.padding = 0
        page.add(build_calendar_view(page, current_user_id="alex"))
    ft.app(target=main)