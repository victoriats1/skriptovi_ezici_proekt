import flet as ft
from main import add_event

BG_DARK      = "#0D1117"
BG_CARD2     = "#1C2230"
ACCENT_TEAL  = "#2DD4BF"
TEXT_PRIMARY = "#E6EDF3"
TEXT_MUTED   = "#8B949E"
BORDER_CLR   = "#30363D"

WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
DAY_KEYS  = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
DAY_TO_DATE_OFFSET = {"MON": 0, "TUE": 1, "WED": 2, "THU": 3,
                      "FRI": 4, "SAT": 5, "SUN": 6}


def build_routine_form(page: ft.Page, current_user_id="alex", on_save=None):
    from datetime import datetime, timedelta

    is_routine    = [False]
    selected_days = set()
    repeat_until  = [""]

    routine_options = ft.Column(visible=False, spacing=12)
    day_toggles     = ft.Row(spacing=6, wrap=True)

    def render_day_toggles():
        day_toggles.controls.clear()
        for label, key in zip(WEEK_DAYS, DAY_KEYS):
            is_sel = key in selected_days
            day_toggles.controls.append(
                ft.Container(
                    content=ft.Text(label, size=12,
                                    color=BG_DARK if is_sel else TEXT_MUTED,
                                    weight=ft.FontWeight.W_600),
                    width=44, height=36,
                    bgcolor=ACCENT_TEAL if is_sel else BG_CARD2,
                    border_radius=8,
                    border=ft.border.all(1, ACCENT_TEAL if is_sel else BORDER_CLR),
                    alignment=ft.alignment.center,
                    animate=ft.animation.Animation(150, ft.AnimationCurve.EASE_OUT),
                    on_click=lambda e, k=key: toggle_day(k),
                )
            )

    def toggle_day(key):
        if key in selected_days:
            selected_days.discard(key)
        else:
            selected_days.add(key)
        render_day_toggles()
        page.update()

    repeat_until_field = ft.TextField(
        label="Repeat until (YYYY-MM-DD) — optional",
        hint_text="e.g. 2025-12-31",
        bgcolor=BG_CARD2, color=TEXT_PRIMARY,
        label_style=ft.TextStyle(color=TEXT_MUTED),
        hint_style=ft.TextStyle(color=TEXT_MUTED),
        border_color=BORDER_CLR, focused_border_color=ACCENT_TEAL,
        border_radius=10, cursor_color=ACCENT_TEAL,
        on_change=lambda e: repeat_until.__setitem__(0, e.control.value),
    )

    routine_options.controls = [
        ft.Text("Repeat on these days:", size=13, color=TEXT_MUTED),
        day_toggles,
        repeat_until_field,
    ]

    routine_badge = ft.Container(
        visible=False,
        content=ft.Text("🔄 Routine", size=10, color=ACCENT_TEAL),
        bgcolor="#0D2E2B", border_radius=6,
        padding=ft.padding.symmetric(horizontal=8, vertical=3),
    )

    def on_routine_toggle(e):
        is_routine[0] = e.control.value
        routine_options.visible = is_routine[0]
        routine_badge.visible   = is_routine[0]
        if is_routine[0]:
            render_day_toggles()
        page.update()

    routine_switch = ft.Switch(
        value=False, active_color=ACCENT_TEAL,
        on_change=on_routine_toggle,
    )

    title_field = ft.TextField(
        label="Event title", hint_text="e.g. Morning Workout",
        bgcolor=BG_CARD2, color=TEXT_PRIMARY,
        label_style=ft.TextStyle(color=TEXT_MUTED),
        hint_style=ft.TextStyle(color=TEXT_MUTED),
        border_color=BORDER_CLR, focused_border_color=ACCENT_TEAL,
        border_radius=10, cursor_color=ACCENT_TEAL,
    )
    start_field = ft.TextField(
        label="Start (HH:MM)", hint_text="09:00",
        bgcolor=BG_CARD2, color=TEXT_PRIMARY,
        label_style=ft.TextStyle(color=TEXT_MUTED),
        hint_style=ft.TextStyle(color=TEXT_MUTED),
        border_color=BORDER_CLR, focused_border_color=ACCENT_TEAL,
        border_radius=10, cursor_color=ACCENT_TEAL, width=150,
    )
    end_field = ft.TextField(
        label="End (HH:MM)", hint_text="10:30",
        bgcolor=BG_CARD2, color=TEXT_PRIMARY,
        label_style=ft.TextStyle(color=TEXT_MUTED),
        hint_style=ft.TextStyle(color=TEXT_MUTED),
        border_color=BORDER_CLR, focused_border_color=ACCENT_TEAL,
        border_radius=10, cursor_color=ACCENT_TEAL, width=150,
    )

    success_banner = ft.Container(
        visible=False,
        content=ft.Text("", size=13, color="#22C55E"),
        bgcolor="#0D2E1A", border_radius=8,
        padding=ft.padding.symmetric(horizontal=14, vertical=10),
        border=ft.border.all(1, "#22C55E"),
    )

    def do_save():
        title = title_field.value.strip()
        start = start_field.value.strip()
        end   = end_field.value.strip()

        if not title:
            page.snack_bar = ft.SnackBar(
                ft.Text("Title is required"), bgcolor=BG_CARD2)
            page.snack_bar.open = True
            page.update()
            return

        saved_dates = []

        if is_routine[0] and selected_days:
            # Generate all dates from today up to repeat_until for selected days
            today = datetime.now().date()
            try:
                end_date = datetime.strptime(
                    repeat_until[0], "%Y-%m-%d").date() if repeat_until[0] else (
                    today + timedelta(weeks=12))
            except ValueError:
                end_date = today + timedelta(weeks=12)

            current = today
            while current <= end_date:
                day_key = DAY_KEYS[current.weekday()]
                if day_key in selected_days:
                    date_str = current.strftime("%Y-%m-%d")
                    add_event(current_user_id, title, date_str, start, end)
                    saved_dates.append(date_str)
                current += timedelta(days=1)

            success_banner.content = ft.Text(
                f"✅ Routine saved for {len(saved_dates)} days "
                f"({', '.join(list(selected_days))})",
                size=13, color="#22C55E",
            )
        else:
            # One-time event: use today's date
            date_str = datetime.now().strftime("%Y-%m-%d")
            add_event(current_user_id, title, date_str, start, end)
            success_banner.content = ft.Text(
                f"✅ Saved: {title} ({start}–{end})",
                size=13, color="#22C55E",
            )

        success_banner.visible = True
        if on_save:
            on_save({"title": title, "start": start, "end": end,
                     "isRoutine": is_routine[0],
                     "repeatDays": list(selected_days)})
        page.update()

    render_day_toggles()

    return ft.Container(
        content=ft.Column([
            ft.Text("🔄 Routine Commitments", size=22,
                    weight=ft.FontWeight.BOLD, color=TEXT_PRIMARY,
                    font_family="monospace"),
            ft.Text("Toggle 'Repeat weekly' to save this event on multiple days automatically.",
                    size=12, color=TEXT_MUTED),
            ft.Divider(height=1, color=BORDER_CLR),
            ft.Row([routine_badge]),
            title_field,
            ft.Row([start_field, end_field], spacing=12),
            ft.Container(
                content=ft.Row([
                    ft.Column([
                        ft.Text("Repeat weekly", size=14, color=TEXT_PRIMARY,
                                weight=ft.FontWeight.W_500),
                        ft.Text("Saves this event on every selected day",
                                size=11, color=TEXT_MUTED),
                    ], spacing=2, expand=True),
                    routine_switch,
                ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
                bgcolor=BG_CARD2, border_radius=12,
                padding=ft.padding.symmetric(horizontal=16, vertical=12),
                border=ft.border.all(1, BORDER_CLR),
            ),
            routine_options,
            success_banner,
            ft.ElevatedButton(
                content=ft.Row([
                    ft.Icon(ft.icons.SAVE, size=16, color=BG_DARK),
                    ft.Text("Save", size=13, color=BG_DARK,
                            weight=ft.FontWeight.W_600),
                ], spacing=6),
                bgcolor=ACCENT_TEAL,
                on_click=lambda e: do_save(),
                style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=10)),
            ),
        ], spacing=14),
        bgcolor=BG_DARK, padding=20, expand=True,
    )


if __name__ == "__main__":
    def main(page: ft.Page):
        page.title = "Task 4 – Routine Commitments"
        page.bgcolor = BG_DARK
        page.padding = 0
        page.add(build_routine_form(page, current_user_id="alex"))
    ft.app(target=main)