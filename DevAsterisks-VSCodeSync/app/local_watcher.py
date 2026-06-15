from __future__ import annotations

from pathlib import Path
from queue import Queue
from threading import Event, Thread
from time import sleep

from app.utils import should_exclude


class LocalWatcher:
    """Polls a local directory and queues changed relative file paths."""

    def __init__(
        self,
        root: Path,
        queue: Queue[str],
        exclude: list[str] | None = None,
        poll_interval_seconds: int = 10,
    ) -> None:
        self._root = root
        self._queue = queue
        self._exclude = exclude or []
        self._poll_interval_seconds = max(1, poll_interval_seconds)
        self._stop = Event()
        self._thread: Thread | None = None
        self._known_files: dict[str, tuple[int, int]] = {}

    def start(self) -> None:
        """Starts background polling."""
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        self._root.mkdir(parents=True, exist_ok=True)
        self._known_files = self._scan(queue_changes=False)
        self._thread = Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Stops background polling."""
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2)
            self._thread = None

    def _loop(self) -> None:
        while not self._stop.is_set():
            self._scan(queue_changes=True)
            sleep(self._poll_interval_seconds)

    def _scan(self, queue_changes: bool) -> dict[str, tuple[int, int]]:
        current: dict[str, tuple[int, int]] = {}
        if not self._root.exists():
            self._known_files = current
            return current

        for file_path in self._root.rglob("*"):
            if not file_path.is_file():
                continue

            rel = str(file_path.relative_to(self._root)).replace("\\", "/")
            if should_exclude(rel, self._exclude):
                continue

            try:
                stat = file_path.stat()
            except OSError:
                continue

            signature = (stat.st_mtime_ns, stat.st_size)
            current[rel] = signature

            if not queue_changes:
                continue

            previous = self._known_files.get(rel)
            if previous is None or previous != signature:
                self._queue.put(rel)

        self._known_files = current
        return current
