from __future__ import annotations

from pathlib import Path
from tkinter import filedialog, messagebox
import customtkinter as ctk
import tkinter as tk

from app.config_manager import ConfigManager
from app.logger import AppLogger
from app.models import AppConfig, ConnectionProfile, LogEvent, OperationResult
from app.sync_coordinator import SyncCoordinator


class DevAsterisksApp(ctk.CTk):
    """Main desktop GUI for FTP sync operations."""

    def __init__(
        self,
        logger: AppLogger,
        config_manager: ConfigManager,
        coordinator: SyncCoordinator,
        default_config_path: Path,
    ) -> None:
        super().__init__()
        self._logger = logger
        self._config_manager = config_manager
        self._coordinator = coordinator
        self._config: AppConfig | None = None
        self._status_labels: dict[str, ctk.CTkLabel] = {}
        self._pending_labels: dict[str, ctk.CTkLabel] = {}
        self._auto_sync_buttons: dict[str, ctk.CTkButton] = {}
        self._nav_buttons: dict[str, ctk.CTkButton] = {}
        self._app_version = "1.0"
        self._app_version_var = ctk.StringVar(value="1.0")
        self._last_result_var = ctk.StringVar(value="Ready.")
        self._profile_count_var = ctk.StringVar(value="0 profiles")
        self._active_watchers_var = ctk.StringVar(value="0 watching")
        self._pending_total_var = ctk.StringVar(value="0 pending")
        self._search_var = ctk.StringVar(value="")
        self._status_filter_var = ctk.StringVar(value="all")
        self._logs_collapsed = False
        self._profiles_min_content_width = 1500
        self._title_font = ctk.CTkFont(size=26, weight="bold")
        self._subtitle_font = ctk.CTkFont(size=12)
        self._section_font = ctk.CTkFont(size=15, weight="bold")
        self._body_font = ctk.CTkFont(size=13)
        self._mono_font = ctk.CTkFont(family="Consolas", size=12)

        self.title("DevAsterisks-VSCodeSync")
        self.geometry("1480x900")
        self.minsize(1320, 820)
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")
        self.configure(fg_color=("#eef2f7", "#0f172a"))

        self._build_ui()
        self._build_native_menu()
        self._search_var.trace_add("write", lambda *_: self._render_profiles())
        self._status_filter_var.trace_add("write", lambda *_: self._render_profiles())
        self._logger.subscribe(self._on_log)
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.bind("<Control-o>", lambda _event: self._menu_load_config())
        self._focus_section("dashboard")
        self.after(1000, self._refresh_auto_sync_state)
        self._try_load(default_config_path)

    def _build_ui(self) -> None:
        shell = ctk.CTkFrame(self, corner_radius=0, fg_color="transparent")
        shell.pack(fill="both", expand=True, padx=18, pady=18)
        shell.grid_columnconfigure(0, weight=0)
        shell.grid_columnconfigure(1, weight=1)
        shell.grid_rowconfigure(0, weight=1)

        sidebar = ctk.CTkFrame(shell, width=260, corner_radius=22, fg_color=("#ffffff", "#111827"))
        sidebar.grid(row=0, column=0, sticky="ns", padx=(0, 16))
        sidebar.grid_propagate(False)

        brand = ctk.CTkFrame(sidebar, fg_color="transparent")
        brand.pack(fill="x", padx=18, pady=(20, 18))
        ctk.CTkLabel(brand, text="◈ Dev Asterisks", font=ctk.CTkFont(size=12, weight="bold"), text_color=("#2563eb", "#60a5fa")).pack(anchor="w")
        ctk.CTkLabel(brand, text="VSCodeSync", font=ctk.CTkFont(size=22, weight="bold")).pack(anchor="w", pady=(2, 0))
        ctk.CTkLabel(brand, text="Modern FTP sync dashboard", font=self._subtitle_font, text_color=("#64748b", "#94a3b8")).pack(anchor="w", pady=(4, 0))

        nav = ctk.CTkFrame(sidebar, fg_color="transparent")
        nav.pack(fill="x", padx=14, pady=(0, 18))
        self._create_nav_button(nav, "dashboard", "⌂  Dashboard", lambda: self._focus_section("dashboard")).pack(fill="x", pady=4)
        self._create_nav_button(nav, "connections", "⇅  Connections", lambda: self._focus_section("connections")).pack(fill="x", pady=4)
        self._create_nav_button(nav, "activity", "☰  Activity Log", lambda: self._focus_section("logs")).pack(fill="x", pady=4)
        self._create_nav_button(nav, "about", "ⓘ  About", self._show_about).pack(fill="x", pady=4)
        self._create_nav_button(nav, "exit", "⏻  Exit", self._on_close).pack(fill="x", pady=4)
        self._highlight_nav_button("dashboard")

        self._sidebar_stats = ctk.CTkFrame(sidebar, fg_color="transparent")
        self._sidebar_stats.pack(fill="x", padx=14, pady=(0, 18))
        self._create_stat_card(self._sidebar_stats, "Connections", self._profile_count_var, "Configured profiles ready for sync").pack(fill="x", pady=6)
        self._create_stat_card(self._sidebar_stats, "Background Watchers", self._active_watchers_var, "Profiles currently auto syncing").pack(fill="x", pady=6)
        self._create_stat_card(self._sidebar_stats, "Pending Uploads", self._pending_total_var, "Queued file transfers across profiles").pack(fill="x", pady=6)

        self._sidebar_footer = ctk.CTkFrame(sidebar, fg_color="transparent")
        self._sidebar_footer.pack(side="bottom", fill="x", padx=18, pady=18)
        ctk.CTkLabel(self._sidebar_footer, text="Build", font=ctk.CTkFont(size=11, weight="bold"), text_color=("#64748b", "#94a3b8")).pack(anchor="w")
        ctk.CTkLabel(self._sidebar_footer, textvariable=self._app_version_var, font=self._subtitle_font, text_color=("#0f172a", "#e2e8f0")).pack(anchor="w", pady=(2, 0))
        ctk.CTkLabel(self._sidebar_footer, text="Reliable push, pull, and auto-sync operations.", font=self._subtitle_font, wraplength=210, justify="left", text_color=("#64748b", "#94a3b8")).pack(anchor="w", pady=(6, 0))

        self._main = ctk.CTkFrame(shell, fg_color="transparent")
        self._main.grid(row=0, column=1, sticky="nsew")

        self._hero = ctk.CTkFrame(self._main, corner_radius=20, fg_color=("#ffffff", "#111827"))
        self._hero.pack(fill="x", pady=(0, 16))

        hero_left = ctk.CTkFrame(self._hero, fg_color="transparent")
        hero_left.pack(side="left", fill="both", expand=True, padx=22, pady=18)
        ctk.CTkLabel(
            hero_left,
            text="DevAsterisks-VSCodeSync",
            font=self._title_font,
            anchor="w",
        ).pack(anchor="w")
        ctk.CTkLabel(
            hero_left,
            text="Reliable desktop FTP sync for fast push, pull, and background automation.",
            font=self._subtitle_font,
            text_color=("#475569", "#94a3b8"),
            anchor="w",
        ).pack(anchor="w", pady=(4, 12))

        chips = ctk.CTkFrame(hero_left, fg_color="transparent")
        chips.pack(anchor="w")
        self._create_stat_chip(chips, "Profiles", self._profile_count_var).pack(side="left", padx=(0, 10))
        self._create_stat_chip(chips, "Watching", self._active_watchers_var).pack(side="left", padx=(0, 10))
        self._create_stat_chip(chips, "Pending", self._pending_total_var).pack(side="left")

        hero_right = ctk.CTkFrame(self._hero, fg_color="transparent")
        hero_right.pack(side="right", padx=22, pady=18)
        ctk.CTkLabel(
            hero_right,
            text="Professional Sync Console",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color=("#0f172a", "#e2e8f0"),
        ).pack(anchor="e")
        ctk.CTkLabel(
            hero_right,
            text="Threaded transfers • FTPS support • live diagnostics",
            font=self._subtitle_font,
            text_color=("#64748b", "#94a3b8"),
        ).pack(anchor="e", pady=(4, 0))

        self._content = ctk.CTkFrame(self._main, fg_color="transparent")
        self._content.pack(fill="both", expand=True)
        self._content.grid_columnconfigure(0, weight=1)
        self._content.grid_rowconfigure(2, weight=3, minsize=540)
        self._content.grid_rowconfigure(3, weight=2, minsize=260)

        self._config_card = ctk.CTkFrame(self._content, corner_radius=18, fg_color=("#ffffff", "#111827"))
        self._config_card.grid(row=0, column=0, sticky="nsew", padx=(0, 0), pady=(0, 16))
        self._build_section_header(self._config_card, "⚙  Configuration", "Load and switch between saved connection profiles.").pack(fill="x", padx=18, pady=(16, 8))

        config_controls = ctk.CTkFrame(self._config_card, fg_color="transparent")
        config_controls.pack(fill="x", padx=18, pady=(0, 16))

        self.config_path_var = ctk.StringVar(value="")
        ctk.CTkEntry(
            config_controls,
            textvariable=self.config_path_var,
            height=42,
            font=self._body_font,
            corner_radius=12,
        ).pack(side="left", fill="x", expand=True, padx=(0, 10))
        ctk.CTkButton(config_controls, text="Browse Config", width=140, height=42, corner_radius=12, command=self._browse_config).pack(side="left", padx=(0, 10))
        ctk.CTkButton(config_controls, text="Load", width=120, height=42, corner_radius=12, command=self._load_clicked).pack(side="left")

        self._result_card = ctk.CTkFrame(self._content, corner_radius=18, fg_color=("#ffffff", "#111827"))
        self._result_card.grid(row=1, column=0, sticky="nsew", pady=(0, 16))
        self._build_section_header(self._result_card, "✓  Last Result", "The latest operation outcome and diagnostics.").pack(fill="x", padx=18, pady=(16, 8))
        ctk.CTkLabel(
            self._result_card,
            textvariable=self._last_result_var,
            anchor="w",
            justify="left",
            wraplength=1120,
            font=self._body_font,
            text_color=("#334155", "#cbd5e1"),
        ).pack(fill="x", padx=18, pady=(0, 18))

        self._connections_card = ctk.CTkFrame(self._content, corner_radius=18, fg_color=("#ffffff", "#111827"))
        self._connections_card.grid(row=2, column=0, sticky="nsew", pady=(0, 16))
        self._build_section_header(self._connections_card, "⇅  Connections", "Operate profiles individually with clear status, pull/push controls, and auto sync.").pack(fill="x", padx=18, pady=(16, 8))

        filter_row = ctk.CTkFrame(self._connections_card, fg_color="transparent")
        filter_row.pack(fill="x", padx=18, pady=(0, 12))
        ctk.CTkEntry(
            filter_row,
            textvariable=self._search_var,
            placeholder_text="Search by title, host, path, or protocol",
            height=40,
            corner_radius=12,
            font=self._body_font,
        ).pack(side="left", fill="x", expand=True, padx=(0, 10))
        self._status_filter_segment = ctk.CTkSegmentedButton(
            filter_row,
            values=["all", "idle", "watching", "error"],
            variable=self._status_filter_var,
            height=38,
            corner_radius=12,
        )
        self._status_filter_segment.pack(side="left")

        self.profiles_frame = ctk.CTkScrollableFrame(
            self._connections_card,
            label_text="",
            corner_radius=0,
            fg_color="transparent",
            height=500,
        )
        self.profiles_frame.pack(fill="both", expand=True, padx=12, pady=(0, 6))
        self._profiles_hscroll = ctk.CTkScrollbar(
            self._connections_card,
            orientation="horizontal",
            command=self._on_profiles_horizontal_scroll,
            height=14,
        )
        self._profiles_hscroll.pack(fill="x", padx=16, pady=(0, 12))
        self._enable_profiles_horizontal_scroll()

        self._log_card = ctk.CTkFrame(self._content, corner_radius=18, fg_color=("#ffffff", "#111827"))
        self._log_card.grid(row=3, column=0, sticky="nsew")
        log_header = ctk.CTkFrame(self._log_card, fg_color="transparent")
        log_header.pack(fill="x", padx=18, pady=(16, 8))
        self._build_section_header(log_header, "☰  Live Logs", "Timestamped activity from background sync operations.").pack(side="left", fill="x", expand=True)
        self._toggle_logs_button = ctk.CTkButton(log_header, text="Hide", width=70, height=34, corner_radius=10, command=self._toggle_logs)
        self._toggle_logs_button.pack(side="right", padx=(10, 0), pady=(4, 0))
        self.log_text = ctk.CTkTextbox(
            self._log_card,
            height=280,
            font=self._mono_font,
            corner_radius=14,
            border_width=1,
            border_color=("#dbe2ea", "#1e293b"),
        )
        self.log_text.pack(fill="both", expand=True, padx=18, pady=(0, 18))

    def _create_nav_button(self, parent: ctk.CTkBaseClass, key: str, text: str, command: callable) -> ctk.CTkButton:
        """Creates a sidebar navigation button."""
        button = ctk.CTkButton(
            parent,
            text=text,
            height=40,
            corner_radius=12,
            anchor="w",
            fg_color=("#f8fafc", "#0f172a"),
            hover_color=("#e2e8f0", "#1e293b"),
            text_color=("#0f172a", "#e2e8f0"),
            command=lambda: self._handle_nav_click(key, command),
        )
        self._nav_buttons[key] = button
        return button

    def _create_stat_card(self, parent: ctk.CTkBaseClass, title: str, value_var: ctk.StringVar, subtitle: str) -> ctk.CTkFrame:
        """Creates a sidebar stat card."""
        card = ctk.CTkFrame(parent, corner_radius=16, fg_color=("#f8fafc", "#0f172a"), border_width=1, border_color=("#e2e8f0", "#1e293b"))
        ctk.CTkLabel(card, text=title, font=ctk.CTkFont(size=12, weight="bold"), text_color=("#64748b", "#94a3b8")).pack(anchor="w", padx=14, pady=(12, 0))
        ctk.CTkLabel(card, textvariable=value_var, font=ctk.CTkFont(size=22, weight="bold")).pack(anchor="w", padx=14, pady=(2, 0))
        ctk.CTkLabel(card, text=subtitle, font=self._subtitle_font, wraplength=210, justify="left", text_color=("#64748b", "#94a3b8")).pack(anchor="w", padx=14, pady=(6, 12))
        return card

    def _handle_nav_click(self, key: str, command: callable) -> None:
        """Highlights sidebar navigation and executes the target action."""
        self._highlight_nav_button(key)
        command()

    def _highlight_nav_button(self, active_key: str) -> None:
        """Updates the active sidebar navigation styling."""
        for key, button in self._nav_buttons.items():
            if key == active_key:
                button.configure(fg_color="#2563eb", hover_color="#1d4ed8", text_color="#ffffff")
            else:
                button.configure(
                    fg_color=("#f8fafc", "#0f172a"),
                    hover_color=("#e2e8f0", "#1e293b"),
                    text_color=("#0f172a", "#e2e8f0"),
                )

    def _build_section_header(self, parent: ctk.CTkBaseClass, title: str, subtitle: str) -> ctk.CTkFrame:
        """Builds a reusable section header."""
        frame = ctk.CTkFrame(parent, fg_color="transparent")
        ctk.CTkLabel(frame, text=title, font=self._section_font, anchor="w").pack(anchor="w")
        ctk.CTkLabel(
            frame,
            text=subtitle,
            font=self._subtitle_font,
            text_color=("#64748b", "#94a3b8"),
            anchor="w",
        ).pack(anchor="w", pady=(2, 0))
        return frame

    def _create_stat_chip(self, parent: ctk.CTkBaseClass, label: str, value_var: ctk.StringVar) -> ctk.CTkFrame:
        """Creates a compact stat chip used in the hero header."""
        chip = ctk.CTkFrame(parent, corner_radius=14, fg_color=("#f8fafc", "#0f172a"), border_width=1, border_color=("#e2e8f0", "#1e293b"))
        ctk.CTkLabel(
            chip,
            text=label,
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=("#64748b", "#94a3b8"),
        ).pack(anchor="w", padx=12, pady=(8, 0))
        ctk.CTkLabel(chip, textvariable=value_var, font=ctk.CTkFont(size=16, weight="bold")).pack(anchor="w", padx=12, pady=(0, 8))
        return chip

    def _update_summary(self) -> None:
        """Refreshes top-level summary metrics."""
        if self._config is None:
            self._profile_count_var.set("0 profiles")
            self._active_watchers_var.set("0 watching")
            self._pending_total_var.set("0 pending")
            return

        total_profiles = len(self._config.connections)
        active_watchers = sum(1 for profile in self._config.connections if self._coordinator.is_auto_sync_active(profile))
        pending_total = sum(self._coordinator.get_auto_sync_pending_count(profile) for profile in self._config.connections)
        self._profile_count_var.set(f"{total_profiles} profiles")
        self._active_watchers_var.set(f"{active_watchers} watching")
        self._pending_total_var.set(f"{pending_total} pending")

    def _build_native_menu(self) -> None:
        """Builds a native top menu bar."""
        menu_bar = tk.Menu(self)

        file_menu = tk.Menu(menu_bar, tearoff=0)
        file_menu.add_command(label="Load Configuration...", accelerator="Ctrl+O", command=self._menu_load_config)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self._on_close)
        menu_bar.add_cascade(label="File", menu=file_menu)

        nav_menu = tk.Menu(menu_bar, tearoff=0)
        nav_menu.add_command(label="Dashboard", command=lambda: self._focus_section("dashboard"))
        nav_menu.add_command(label="Connections", command=lambda: self._focus_section("connections"))
        nav_menu.add_command(label="Activity Log", command=lambda: self._focus_section("logs"))
        menu_bar.add_cascade(label="Navigate", menu=nav_menu)

        help_menu = tk.Menu(menu_bar, tearoff=0)
        help_menu.add_command(label="About", command=self._show_about)
        menu_bar.add_cascade(label="Help", menu=help_menu)

        self.configure(menu=menu_bar)

    def _focus_section(self, section: str) -> None:
        """Switches the visible dashboard section."""
        if section == "dashboard":
            self._highlight_nav_button("dashboard")
            self._show_dashboard_view()
            self._logger.info("Navigated to Dashboard.")
        elif section == "connections":
            self._highlight_nav_button("connections")
            self._show_connections_view()
            self.profiles_frame.focus_set()
            self._logger.info("Navigated to Connections.")
        elif section == "logs":
            self._highlight_nav_button("activity")
            self._show_logs_view()
            self.log_text.focus_set()
            self._logger.info("Navigated to Activity Log.")

    def _show_dashboard_view(self) -> None:
        """Shows only the dashboard summary and configuration sections."""
        self._set_hero_visible(True)
        self._set_sidebar_stats_visible(False)
        self._content.grid_rowconfigure(2, weight=0, minsize=0)
        self._content.grid_rowconfigure(3, weight=0, minsize=0)
        self._config_card.grid()
        self._result_card.grid_remove()
        self._connections_card.grid_remove()
        self._log_card.grid_remove()

    def _show_connections_view(self) -> None:
        """Shows the connections area with logs directly below it."""
        self._set_hero_visible(False)
        self._set_sidebar_stats_visible(False)
        self._content.grid_rowconfigure(2, weight=3, minsize=540)
        self._content.grid_rowconfigure(3, weight=2, minsize=260)
        self._config_card.grid_remove()
        self._result_card.grid_remove()
        self._connections_card.grid()
        self._log_card.grid()

    def _show_logs_view(self) -> None:
        """Shows the activity log view only."""
        self._set_hero_visible(False)
        self._set_sidebar_stats_visible(False)
        self._content.grid_rowconfigure(2, weight=0, minsize=0)
        self._content.grid_rowconfigure(3, weight=1, minsize=620)
        self._config_card.grid_remove()
        self._result_card.grid_remove()
        self._connections_card.grid_remove()
        self._log_card.grid()

    def _set_hero_visible(self, visible: bool) -> None:
        """Shows or hides the hero header while preserving layout order."""
        if visible:
            if not self._hero.winfo_manager():
                self._hero.pack(before=self._content, fill="x", pady=(0, 16))
        else:
            if self._hero.winfo_manager():
                self._hero.pack_forget()

    def _set_sidebar_stats_visible(self, visible: bool) -> None:
        """Shows or hides the left sidebar stat stack."""
        if visible:
            if not self._sidebar_stats.winfo_manager():
                self._sidebar_stats.pack(fill="x", padx=14, pady=(0, 18), before=self._sidebar_footer)
        else:
            if self._sidebar_stats.winfo_manager():
                self._sidebar_stats.pack_forget()

    def _on_profiles_horizontal_scroll(self, *args: str) -> None:
        """Routes horizontal scrollbar events to the profiles canvas."""
        canvas = getattr(self.profiles_frame, "_parent_canvas", None)
        if canvas is not None:
            canvas.xview(*args)

    def _enable_profiles_horizontal_scroll(self) -> None:
        """Enables horizontal scrolling for wide profile rows."""
        canvas = getattr(self.profiles_frame, "_parent_canvas", None)
        if canvas is None:
            return

        canvas.configure(xscrollcommand=self._profiles_hscroll.set)

        def sync_width(_event: object | None = None) -> None:
            try:
                content = getattr(self.profiles_frame, "_scrollable_frame", None)
                if content is not None:
                    target_width = max(canvas.winfo_width(), self._profiles_min_content_width)
                    content.configure(width=target_width)
                canvas.configure(scrollregion=canvas.bbox("all"))
            except Exception:
                pass

        canvas.bind("<Configure>", lambda e: sync_width(e), add="+")
        self.profiles_frame.bind("<Configure>", lambda e: sync_width(e), add="+")
        self.after(120, sync_width)

    def _show_about(self) -> None:
        """Shows About dialog with version."""
        title = self._config.app_title if self._config else "DevAsterisks-VSCodeSync"
        version = self._app_version
        messagebox.showinfo("About", f"{title}\nVersion: {version}")

    def _choose_config_file(self) -> Path | None:
        """Opens a JSON-only file picker for configuration files."""
        initial_dir = ""
        current_value = self.config_path_var.get().strip() if hasattr(self, "config_path_var") else ""
        if current_value:
            current_path = Path(current_value)
            if current_path.exists():
                initial_dir = str(current_path.parent if current_path.is_file() else current_path)

        file_path = filedialog.askopenfilename(
            title="Select configuration JSON",
            initialdir=initial_dir or None,
            filetypes=[("JSON files", "*.json")],
            defaultextension=".json",
        )
        if not file_path:
            return None
        return Path(file_path)

    def _menu_load_config(self) -> None:
        """Opens a file picker and immediately loads the selected config file."""
        file_path = self._choose_config_file()
        if file_path is not None:
            self._try_load(file_path)

    def _browse_config(self) -> None:
        file_path = self._choose_config_file()
        if file_path is not None:
            self.config_path_var.set(str(file_path))

    def _load_clicked(self) -> None:
        value = self.config_path_var.get().strip()
        if value:
            self._try_load(Path(value))

    def _try_load(self, file_path: Path) -> None:
        if file_path.suffix.lower() != ".json":
            message = "Only JSON configuration files are supported."
            self._last_result_var.set(message)
            self._logger.error("Config load failed.", error=message)
            messagebox.showerror("Configuration Load Failed", message)
            return

        self.config_path_var.set(str(file_path))
        result = self._config_manager.load(file_path)
        if not result.ok or result.data is None:
            error_message = result.error or result.message or "Unknown configuration error."
            self._last_result_var.set(f"Configuration load failed: {error_message}")
            self._logger.error("Config load failed.", error=error_message)
            messagebox.showerror(
                "Configuration Load Failed",
                f"Unable to load the selected configuration file.\n\nReason: {error_message}",
            )
            return

        self._config = result.data
        self._app_version = self._config.app_version
        self._app_version_var.set(self._app_version)
        self.title(f"{self._config.app_title} v{self._app_version}")
        self._last_result_var.set(f"Configuration loaded: {file_path.name}")
        self._logger.info("Config loaded.", profiles=len(self._config.connections))
        self._render_profiles()
        self._update_summary()

    def _render_profiles(self) -> None:
        if not hasattr(self, "profiles_frame"):
            return

        for w in self.profiles_frame.winfo_children():
            w.destroy()
        self._status_labels.clear()
        self._pending_labels.clear()
        self._auto_sync_buttons.clear()

        if self._config is None:
            return

        filtered_profiles = [profile for profile in self._config.connections if self._matches_profile_filter(profile)]

        header = ctk.CTkFrame(self.profiles_frame)
        header.pack(anchor="w", padx=8, pady=(4, 8))
        header.configure(width=self._profiles_min_content_width)
        header.configure(fg_color=("#f8fafc", "#0b1220"), corner_radius=14)
        ctk.CTkLabel(header, text="Profile", width=430, anchor="w", font=ctk.CTkFont(size=12, weight="bold")).pack(side="left", padx=12, pady=10)
        ctk.CTkLabel(header, text="Status", width=110, anchor="w", font=ctk.CTkFont(size=12, weight="bold")).pack(side="left", padx=4, pady=10)
        ctk.CTkLabel(header, text="Pending", width=80, anchor="w", font=ctk.CTkFont(size=12, weight="bold")).pack(side="left", padx=4, pady=10)
        ctk.CTkLabel(header, text="Actions", anchor="w", font=ctk.CTkFont(size=12, weight="bold")).pack(side="left", padx=8, pady=10)

        if not filtered_profiles:
            empty_state = ctk.CTkFrame(self.profiles_frame, corner_radius=16, fg_color=("#f8fafc", "#0b1220"), border_width=1, border_color=("#e2e8f0", "#1e293b"))
            empty_state.pack(anchor="w", padx=8, pady=4)
            empty_state.configure(width=self._profiles_min_content_width)
            ctk.CTkLabel(empty_state, text="No connections match the current search or filter.", font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", padx=18, pady=(16, 4))
            ctk.CTkLabel(empty_state, text="Try a different search term or switch the status filter back to 'all'.", font=self._subtitle_font, text_color=("#64748b", "#94a3b8")).pack(anchor="w", padx=18, pady=(0, 16))
            self.after(50, self._enable_profiles_horizontal_scroll)
            return

        for profile in filtered_profiles:
            self._add_profile_row(profile)

        self.after(50, self._enable_profiles_horizontal_scroll)

    def _matches_profile_filter(self, profile: ConnectionProfile) -> bool:
        """Returns True when a profile matches the active search and status filter."""
        query = self._search_var.get().strip().lower()
        if query:
            haystack = " ".join(
                [
                    profile.title,
                    profile.host,
                    profile.protocol,
                    profile.local_path,
                    profile.remote_path,
                ]
            ).lower()
            if query not in haystack:
                return False

        filter_value = self._status_filter_var.get().strip().lower()
        if filter_value == "all":
            return True

        status = self._get_profile_status(profile).lower()
        if filter_value == "idle":
            return status == "idle"
        if filter_value == "watching":
            return status == "watching"
        if filter_value == "error":
            return status == "error"
        return True

    def _get_profile_status(self, profile: ConnectionProfile) -> str:
        """Returns the current UI status text for a profile."""
        label = self._status_labels.get(profile.title)
        if label is not None:
            return str(label.cget("text"))
        if self._coordinator.is_auto_sync_active(profile):
            return "Watching"
        return "Idle"

    def _add_profile_row(self, profile: ConnectionProfile) -> None:
        row = ctk.CTkFrame(self.profiles_frame, corner_radius=16, fg_color=("#f8fafc", "#0b1220"), border_width=1, border_color=("#e2e8f0", "#1e293b"))
        row.pack(anchor="w", padx=8, pady=4)
        row.configure(width=self._profiles_min_content_width)

        profile_block = ctk.CTkFrame(row, fg_color="transparent")
        profile_block.pack(side="left", fill="x", expand=True, padx=(14, 8), pady=10)
        ctk.CTkLabel(profile_block, text=profile.title, width=250, anchor="w", font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w")
        profile_meta = ctk.CTkFrame(profile_block, fg_color="transparent")
        profile_meta.pack(anchor="w", pady=(6, 0))
        protocol_color = "#0ea5e9" if profile.protocol.lower() == "ftp" else "#8b5cf6"
        secure_text = "TLS" if profile.protocol.lower() in {"ftpes", "ftps"} else "FTP"
        ctk.CTkLabel(
            profile_meta,
            text=secure_text,
            font=ctk.CTkFont(size=11, weight="bold"),
            corner_radius=999,
            fg_color=protocol_color,
            text_color="#ffffff",
            padx=10,
            pady=4,
        ).pack(side="left", padx=(0, 8))
        ctk.CTkLabel(
            profile_meta,
            text=f"{profile.host}:{profile.port}",
            anchor="w",
            font=self._subtitle_font,
            text_color=("#64748b", "#94a3b8"),
        ).pack(side="left")
        ctk.CTkLabel(
            profile_block,
            text=f"Local: {profile.local_path}    •    Remote: {profile.remote_path}",
            anchor="w",
            font=self._subtitle_font,
            text_color=("#64748b", "#94a3b8"),
            wraplength=760,
            justify="left",
        ).pack(anchor="w", pady=(6, 0))

        status = ctk.CTkLabel(
            row,
            text="Idle",
            width=110,
            anchor="center",
            font=ctk.CTkFont(size=12, weight="bold"),
            corner_radius=999,
            padx=10,
            pady=6,
        )
        status.pack(side="left", padx=6)
        self._status_labels[profile.title] = status
        pending = ctk.CTkLabel(
            row,
            text="0",
            width=80,
            anchor="center",
            font=ctk.CTkFont(size=12, weight="bold"),
            corner_radius=999,
            fg_color=("#e2e8f0", "#1e293b"),
            text_color=("#0f172a", "#e2e8f0"),
            padx=10,
            pady=6,
        )
        pending.pack(side="left", padx=6)
        self._pending_labels[profile.title] = pending

        actions = ctk.CTkFrame(row, fg_color="transparent")
        actions.pack(side="right", padx=10, pady=10)
        ctk.CTkButton(actions, text="⟳ Test", width=94, height=36, corner_radius=10, command=lambda p=profile: self._run_test(p)).pack(side="left", padx=4)
        ctk.CTkButton(actions, text="↑ Push", width=94, height=36, corner_radius=10, command=lambda p=profile: self._run_push(p)).pack(side="left", padx=4)
        ctk.CTkButton(actions, text="↓ Pull", width=94, height=36, corner_radius=10, command=lambda p=profile: self._run_pull(p)).pack(side="left", padx=4)
        auto_sync_button = ctk.CTkButton(
            actions,
            text="▶ Auto",
            width=118,
            height=36,
            corner_radius=10,
            command=lambda p=profile: self._toggle_auto_sync(p),
        )
        auto_sync_button.pack(side="left", padx=4)
        self._auto_sync_buttons[profile.title] = auto_sync_button
        self._set_status(profile, self._get_profile_status(profile))

    def _set_status(self, profile: ConnectionProfile, text: str) -> None:
        label = self._status_labels.get(profile.title)
        if label:
            fg_color = ("#e2e8f0", "#1e293b")
            text_color = ("#0f172a", "#e2e8f0")
            if text == "Idle":
                fg_color = ("#e2e8f0", "#1e293b")
                text_color = ("#0f172a", "#e2e8f0")
            elif text in {"Connecting", "Syncing"} or text.startswith("Pull ") or text.startswith("Push "):
                fg_color = ("#fef3c7", "#78350f")
                text_color = ("#92400e", "#fde68a")
            elif text == "Watching":
                fg_color = ("#dcfce7", "#14532d")
                text_color = ("#166534", "#bbf7d0")
            elif text == "Error":
                fg_color = ("#fee2e2", "#7f1d1d")
                text_color = ("#b91c1c", "#fecaca")

            label.configure(text=text, fg_color=fg_color, text_color=text_color)

    def _build_result_message(self, profile: ConnectionProfile, result: OperationResult[None]) -> str:
        """Builds a human-friendly operation summary for the UI."""
        base = f"{profile.title}: {result.message}"
        if result.error:
            return f"{base} Reason: {result.error}"
        return base

    def _run_test(self, profile: ConnectionProfile) -> None:
        self._set_status(profile, "Connecting")
        self._coordinator.test_connection(profile, lambda r: self.after(0, self._on_done, profile, r))

    def _run_push(self, profile: ConnectionProfile) -> None:
        self._set_status(profile, "Syncing")
        self._coordinator.push_profile(profile, lambda r: self.after(0, self._on_done, profile, r))

    def _run_pull(self, profile: ConnectionProfile) -> None:
        self._logger.info("Pull operation initiated by user.", profile=profile.title)
        self._set_status(profile, "Syncing")
        self._last_result_var.set(f"{profile.title}: Initializing pull operation...")
        self._coordinator.pull_profile(
            profile,
            lambda r: self.after(0, self._on_done, profile, r),
            lambda message: self.after(0, self._on_progress, profile, message),
        )

    def _on_progress(self, profile: ConnectionProfile, message: str) -> None:
        """Updates UI while a long-running pull is in progress."""
        self._logger.info("Pull progress update.", profile=profile.title, progress=message)
        self._set_status(profile, message)
        self._last_result_var.set(f"{profile.title}: {message}")

    def _toggle_auto_sync(self, profile: ConnectionProfile) -> None:
        if self._coordinator.is_auto_sync_active(profile):
            result = self._coordinator.stop_auto_sync(profile)
            self._set_status(profile, "Idle")
        else:
            result = self._coordinator.start_auto_sync(profile)
            if result.ok:
                self._set_status(profile, "Watching")
            else:
                self._set_status(profile, "Error")

        self._last_result_var.set(self._build_result_message(profile, result))
        if result.ok:
            self._logger.info(result.message, profile=profile.title)
        else:
            self._logger.error(result.message, profile=profile.title, error=result.error)
            messagebox.showerror("Auto Sync", self._build_result_message(profile, result))
        self._refresh_auto_sync_button(profile)
        self._update_summary()

    def _on_done(self, profile: ConnectionProfile, result: OperationResult[None]) -> None:
        if result.ok:
            self._logger.info(
                "Pull operation succeeded.",
                profile=profile.title,
                resultMessage=result.message,
            )
            self._set_status(profile, "Watching" if self._coordinator.is_auto_sync_active(profile) else "Idle")
        else:
            self._logger.error(
                "Pull operation failed.",
                profile=profile.title,
                resultMessage=result.message,
                error=result.error,
            )
            self._set_status(profile, "Error")
        result_message = self._build_result_message(profile, result)
        self._last_result_var.set(result_message)
        if result.ok:
            self._logger.info(result.message, profile=profile.title)
        else:
            self._logger.error(result.message, profile=profile.title, error=result.error)
            messagebox.showerror("FTP Operation Failed", result_message)
        self._update_summary()

    def _refresh_auto_sync_button(self, profile: ConnectionProfile) -> None:
        button = self._auto_sync_buttons.get(profile.title)
        if button is None:
            return

        if self._coordinator.is_auto_sync_active(profile):
            button.configure(text="■ Stop", fg_color="#2563eb", hover_color="#1d4ed8")
        else:
            button.configure(text="▶ Auto", fg_color=("#334155", "#334155"), hover_color=("#1e293b", "#475569"))

    def _toggle_logs(self) -> None:
        """Collapses or expands the live logs card."""
        self._logs_collapsed = not self._logs_collapsed
        if self._logs_collapsed:
            self.log_text.pack_forget()
            self._toggle_logs_button.configure(text="Show")
        else:
            self.log_text.pack(fill="both", expand=True, padx=18, pady=(0, 18))
            self._toggle_logs_button.configure(text="Hide")

    def _refresh_auto_sync_state(self) -> None:
        if self._config is not None:
            for profile in self._config.connections:
                pending_label = self._pending_labels.get(profile.title)
                if pending_label is not None:
                    pending_label.configure(text=str(self._coordinator.get_auto_sync_pending_count(profile)))

                self._refresh_auto_sync_button(profile)
                if self._coordinator.is_auto_sync_active(profile):
                    status_label = self._status_labels.get(profile.title)
                    if status_label is not None and status_label.cget("text") not in {"Syncing", "Error"}:
                        self._set_status(profile, "Watching")

        self._update_summary()

        self.after(1000, self._refresh_auto_sync_state)

    def _on_close(self) -> None:
        self._coordinator.stop_all_auto_sync()
        self.destroy()

    def _on_log(self, event: LogEvent) -> None:
        def append() -> None:
            context = ""
            if event.context:
                context_parts = [
                    f"{key}={value}"
                    for key, value in event.context.items()
                    if value is not None and value != ""
                ]
                if context_parts:
                    context = f" | {'; '.join(context_parts)}"

            line = f"[{event.timestamp:%H:%M:%S}] [{event.level}] {event.message}{context}"
            self.log_text.insert("end", line + "\n")
            self.log_text.see("end")

        self.after(0, append)
