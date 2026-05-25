import flet as ft
import firebase_admin
from firebase_admin import credentials
from task1_personal_calendar  import build_calendar_view
from task2_hangout_screen     import build_hangout_view
from task3_input_validation   import build_validation_form
from task4_routine_commitments import build_routine_form

if not firebase_admin._apps:
    cred = credentials.Certificate("firebase_key.json")
    firebase_admin.initialize_app(cred)

BG_DARK      = "#0D1117"
ACCENT_TEAL  = "#2DD4BF"
TEXT_MUTED   = "#8B949E"
BORDER_CLR   = "#30363D"

USERS = [
    {"label": "Alex",  "id": "alex"},
    {"label": "Maria", "id": "maria"},
]

NAV_ITEMS = [
    (ft.icons.CALENDAR_MONTH, "Calendar"),
    (ft.icons.PEOPLE,         "Hangout"),
    (ft.icons.ADD_CIRCLE,     "Add"),
    (ft.icons.REPEAT,         "Routines"),
]


def main(page: ft.Page):
    page.title   = "Hangout Planner"
    page.bgcolor = BG_DARK
    page.padding = 0

    selected_tab  = [0]
    current_user  = ["alex"]
    content_area  = ft.Container(expand=True)
    nav_row       = ft.Row(spacing=0, alignment=ft.MainAxisAlignment.SPACE_AROUND)

    # ── User switcher ──────────────────────────────────────────────
    user_dropdown = ft.Dropdown(
        width=160,
        value="alex",
        options=[ft.dropdown.Option(u["id"], u["label"]) for u in USERS],
        bgcolor=BG_DARK,
        color=ACCENT_TEAL,
        border_color=BORDER_CLR,
        on_change=lambda e: switch_user(e.control.value),
    )

    def switch_user(uid):
        current_user[0] = uid
        load_tab(selected_tab[0])

    def load_tab(idx):
        selected_tab[0] = idx
        uid = current_user[0]

        if idx == 0:
            content_area.content = build_calendar_view(
                page,
                current_user_id=uid,
                on_add_callback=lambda day, date: load_tab(2),
            )
        elif idx == 1:
            content_area.content = build_hangout_view(page, current_user_id=uid)
        elif idx == 2:
            content_area.content = build_validation_form(
                page,
                current_user_id=uid,
                on_save=lambda v: load_tab(0),
            )
        elif idx == 3:
            content_area.content = build_routine_form(
                page,
                current_user_id=uid,
                on_save=lambda v: load_tab(0),
            )

        render_nav()
        page.update()

    def render_nav():
        nav_row.controls.clear()
        for i, (icon, label) in enumerate(NAV_ITEMS):
            is_active = i == selected_tab[0]
            nav_row.controls.append(
                ft.Container(
                    content=ft.Column([
                        ft.Icon(icon,
                                color=ACCENT_TEAL if is_active else TEXT_MUTED,
                                size=22),
                        ft.Text(label, size=10,
                                color=ACCENT_TEAL if is_active else TEXT_MUTED,
                                weight=ft.FontWeight.W_600 if is_active
                                       else ft.FontWeight.NORMAL),
                    ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=2),
                    expand=True,
                    padding=ft.padding.symmetric(vertical=10),
                    on_click=lambda e, idx=i: load_tab(idx),
                )
            )

    top_bar = ft.Container(
        content=ft.Row([
            ft.Text("Hangout Planner", size=16,
                    weight=ft.FontWeight.BOLD, color=ACCENT_TEAL,
                    expand=True),
            user_dropdown,
        ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
        bgcolor="#161B22",
        padding=ft.padding.symmetric(horizontal=20, vertical=10),
        border=ft.border.only(bottom=ft.BorderSide(1, BORDER_CLR)),
    )

    bottom_nav = ft.Container(
        content=nav_row,
        bgcolor="#161B22",
        border=ft.border.only(top=ft.BorderSide(1, BORDER_CLR)),
    )

    page.add(
        ft.Column([
            top_bar,
            content_area,
            bottom_nav,
        ], expand=True, spacing=0)
    )

    load_tab(0)


ft.app(target=main)