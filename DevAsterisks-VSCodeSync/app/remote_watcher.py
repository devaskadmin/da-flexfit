from __future__ import annotations

from queue import Queue
from threading import Event, Thread
from time import sleep

from app.ftp_client import FTPClient
from app.logger import AppLogger
from app.models import ConnectionProfile, RemoteFileInfo
from app.utils import is_same_file_state, remote_to_relative, should_exclude


class RemoteWatcher:
    """Polls FTP directory and queues changed remote-relative file paths."""

    def __init__(
        self,
        profile: ConnectionProfile,
        queue: Queue[str],
        ftp_client: FTPClient,
        logger: AppLogger,
    ) -> None:
        self._profile = profile
        self._queue = queue
        self._ftp = ftp_client
        self._logger = logger
        self._stop = Event()
        self._thread: Thread | None = None
        self._state: dict[str, RemoteFileInfo] = {}

    def start(self) -> None:
        """Starts polling loop in background thread."""
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Stops polling loop."""
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    def _loop(self) -> None:
        while not self._stop.is_set():
            result = self._ftp.list_files(self._profile, self._profile.remote_path)
            if result.ok and result.data is not None:
                self._diff_and_queue(result.data)
            else:
                self._logger.warning(
                    "Remote watcher poll failed.",
                    profile=self._profile.title,
                    error=result.error,
                )
            sleep(max(2, self._profile.poll_interval_seconds))

    def _diff_and_queue(self, files: list[RemoteFileInfo]) -> None:
        new_state: dict[str, RemoteFileInfo] = {}

        for rf in files:
            rel = remote_to_relative(self._profile.remote_path, rf.path)
            if should_exclude(rel, self._profile.exclude):
                continue
            new_state[rel] = rf

            old = self._state.get(rel)
            if old is None:
                self._queue.put(rel)
                continue

            same = is_same_file_state(
                local_size=old.size,
                local_modified=old.modified,
                remote_size=rf.size,
                remote_modified=rf.modified,
            )
            if not same:
                self._queue.put(rel)

        self._state = new_state
