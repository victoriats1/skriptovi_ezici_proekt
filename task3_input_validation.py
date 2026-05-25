import flet as ft
from datetime import datetime
import firebase_admin
from firebase_admin import credentials
from main import add_event

if not firebase_admin._apps:
    cred = credentials.Certificate("firebase_key.json")
    firebase_admin.initialize_app(cred)

BG_DARK      = "#0D1117"
BG_CARD2     = "#1C2230"
ACCENT_TEAL  = "#2DD4BF"
TEXT_PRIMARY = "#E6EDF3"
TEXT_MUTED   = "#8B949E"
BORDER_CLR   = "#30363D"
ERROR_COLOR  = "#EF4444"
SUCCESS_CLR  = "#22C55E"


def validate_time(value: str):
    value = value.strip()
    if not value:
        return "Required"
    parts = value.split(":")
    if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
        return "Format must be HH:MM"
    h, m = int(parts[0]), int(parts[1])
    if not (0 <= h <= 23):
        return f"Hour must be 0–23, got {h}"
    if not (0 <= m <= 59):
        return f"Minutes must be 0–59, got {m}"
    return None


def validate_title(value: str):
    if not value.strip():
        return "Title cannot be empty"
    if len(value) > 80:
        return f"Too long ({len(value)}/80)"
    return None


def validate_date(value: str):
    try:
        d = datetime.strptime(value.strip(), "%Y-%m-%d")
        if d.date() < datetime.now().date():
            return "Cannot add events in the past"
        return None
    except ValueError:
        return "Format must be YYYY-MM-DD"


def build_validation_form(page: ft.Page, current_user_id="alex", on_save=None):
    errors = {"title": None, "date": None, "start": None, "end": None}
    values = {"title": "", "date": "", "start": "", "end": ""}

    success_banner = ft.Container(
        visible=False,
        content=ft.Text("", size=13, color=SUCCESS_CLR),
        bgcolor="#0D2E1A", border_radius=8,
        padding=ft.padding.symmetric(horizontal=14, vertical=10),
        border=ft.border.all(1, SUCCESS_CLR),
    )

    save_btn = ft.ElevatedButton(
        content=ft.Row([
            ft.Icon(ft.icons.SAVE, size=16, color=BG_DARK),
            ft.Text("Save commitment", size=13, color=BG_DARK,
                    weight=ft.FontWeight.W_600),
        ], spacing=6),
        bgcolor=ACCENT_TEAL, disabled=True,
        style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=10)),
    )

    def update_save_btn():
        all_filled = all(v.strip() for v in values.values())
        no_errors  = all(v is None for v in errors.values())
        save_btn.disabled = not (all_filled and no_errors)

    def make_field(label, key, hint, validate_fn):
        err_text = ft.Text("", size=11, color=ERROR_COLOR)

        def on_change(e):
            values[key] = e.control.value
            err = validate_fn(e.control.value)
            errors[key] = err
            err_text.value = err or ""
            e.control.border_color = ERROR_COLOR if err else ACCENT_TEAL
            update_save_btn()
            page.update()

        field = ft.TextField(
            label=label, hint_text=hint,
            on_change=on_change, on_blur=on_change,
            bgcolor=BG_CARD2, color=TEXT_PRIMARY,
            label_style=ft.TextStyle(color=TEXT_MUTED),
            hint_style=ft.TextStyle(color=TEXT_MUTED),
            border_color=BORDER_CLR, focused_border_color=ACCENT_TEAL,
            border_radius=10, cursor_color=ACCENT_TEAL,
        )
        return ft.Column([field, err_text], spacing=3), field

    def on_save_click(e):
        # Cross-field check: end > start
        if not errors["start"] and not errors["end"] and values["start"] and values["end"]:
            sh, sm = map(int, values["start"].split(":"))
            eh, em = map(int, values["end"].split(":"))
            if (eh * 60 + em) <= (sh * 60 + sm):
                page.snack_bar = ft.SnackBar(
                    ft.Text("End time must be after start time"), bgcolor=BG_CARD2)
                page.snack_bar.open = True
                page.update()
                return

        try:
            # Save to Firebase via backend
            add_event(
                current_user_id,
                values["title"],
                values["date"],
                values["start"],
                values["end"],
            )
            success_banner.visible = True
            success_banner.content = ft.Text(
                f"✅ Saved: {values['title']} on {values['date']} "
                f"({values['start']}–{values['end']})",
                size=13, color=SUCCESS_CLR,
            )
            if on_save:
                on_save(values)
        except Exception as ex:
            page.snack_bar = ft.SnackBar(
                ft.Text(f"Firebase error: {ex}"), bgcolor=BG_CARD2)
            page.snack_bar.open = True

        page.update()

    save_btn.on_click = on_save_click

    title_row, _ = make_field("Event title", "title",
                               "e.g. Morning Workout", validate_title)
    date_row,  _ = make_field("Date (YYYY-MM-DD)", "date",
                               "e.g. 2025-06-15", validate_date)
    start_row, _ = make_field("Start (HH:MM)", "start",
                               "e.g. 09:00", validate_time)
    end_row,   _ = make_field("End (HH:MM)", "end",
                               "e.g. 10:30", validate_time)

    return ft.Container(
        content=ft.Column([
            ft.Text("➕ Add Commitment", size=22,
                    weight=ft.FontWeight.BOLD, color=TEXT_PRIMARY,
                    font_family="monospace"),
            ft.Text("All fields required. Times must be valid HH:MM.",
                    size=12, color=TEXT_MUTED),
            ft.Divider(height=1, color=BORDER_CLR),
            title_row,
            date_row,
            ft.Row([
                ft.Column([start_row], expand=True),
                ft.Column([end_row], expand=True),
            ], spacing=12),
            success_banner,
            save_btn,
        ], spacing=14),
        bgcolor=BG_DARK, padding=20, expand=True,
    )


if __name__ == "__main__":
    def main(page: ft.Page):
        page.title = "Task 3 – Input Validation"
        page.bgcolor = BG_DARK
        page.padding = 0
        page.add(build_validation_form(page, current_user_id="alex"))
    ft.app(target=main)