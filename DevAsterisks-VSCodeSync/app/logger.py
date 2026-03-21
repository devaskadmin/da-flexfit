from __future__ import annotations

from pathlib import Path
from threading import Lock
from typing import Callable

from app.models import LogEvent


class AppLogger:
    """Thread-safe logger for file + GUI callback sinks."""

    def __init__(self, logs_dir: Path, file_name: str = "app.log") -> None:
        self._lock = Lock()
        self._callbacks: list[Callable[[LogEvent], None]] = []
        logs_dir.mkdir(parents=True, exist_ok=True)
        self._log_path = logs_dir / file_name

    def subscribe(self, callback: Callable[[LogEvent], None]) -> None:
        """Registers a callback for new log events."""
        with self._lock:
            self._callbacks.append(callback)

    def _format_context(self, context: dict[str, object]) -> str:
        """Formats context values for file and GUI log output."""
        if not context:
            return ""

        parts: list[str] = []
        for key, value in context.items():
            if value is None or value == "":
                continue
            parts.append(f"{key}={value}")

        return f" | {'; '.join(parts)}" if parts else ""

    def log(self, level: str, message: str, **context: object) -> None:
        """Writes one log event to disk and notifies subscribers safely."""
        event = LogEvent(level=level.upper(), message=message, context=dict(context))
        line = (
            f"[{event.timestamp:%Y-%m-%d %H:%M:%S}] [{event.level}] "
            f"{event.message}{self._format_context(event.context)}"
        )

        with self._lock:
            with self._log_path.open("a", encoding="utf-8") as f:
                f.write(line + "\n")
            callbacks = list(self._callbacks)

        for cb in callbacks:
            try:
                cb(event)
            except Exception:
                # Keep logger resilient to bad UI callback implementations.
                pass

    def info(self, message: str, **context: object) -> None:
        self.log("INFO", message, **context)

    def warning(self, message: str, **context: object) -> None:
        self.log("WARNING", message, **context)

    def error(self, message: str, **context: object) -> None:
        self.log("ERROR", message, **context)

    def debug(self, message: str, **context: object) -> None:
        self.log("DEBUG", message, **context)
