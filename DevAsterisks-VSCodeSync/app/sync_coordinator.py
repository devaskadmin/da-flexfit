from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from queue import Empty, Queue
from threading import Event, Lock, Thread
from time import monotonic
from typing import Callable

from app.ftp_client import FTPClient
from app.local_watcher import LocalWatcher
from app.logger import AppLogger
from app.models import ConnectionProfile, OperationResult
from app.utils import is_same_file_state, remote_to_relative, should_exclude, to_remote_path


DoneCallback = Callable[[OperationResult[None]], None]
ProgressCallback = Callable[[str], None]


@dataclass(slots=True)
class AutoSyncRuntime:
    """Per-profile runtime state for local auto sync."""

    watcher: LocalWatcher
    queue: Queue[str]
    stop_event: Event
    worker_thread: Thread
    pending_files: dict[str, float] = field(default_factory=dict)
    changed_files: list[str] = field(default_factory=list)
    lock: Lock = field(default_factory=Lock)


class SyncCoordinator:
    """Coordinates manual sync operations without blocking GUI."""

    def __init__(self, logger: AppLogger, ftp_client: FTPClient) -> None:
        self._logger = logger
        self._ftp = ftp_client
        self._active_jobs: set[tuple[str, str]] = set()
        self._auto_sync_runtime: dict[str, AutoSyncRuntime] = {}
        self._lock = Lock()

    def _start_job(self, profile: ConnectionProfile, job_type: str, func: Callable[[], OperationResult[None]], done: DoneCallback) -> None:
        key = (profile.title, job_type)
        with self._lock:
            if key in self._active_jobs:
                done(OperationResult(ok=False, message=f"{job_type} already running for {profile.title}."))
                return
            self._active_jobs.add(key)

        def run() -> None:
            self._logger.info(f"{job_type} started.", profile=profile.title)
            try:
                result = func()
                done(result)
                if result.ok:
                    self._logger.info(f"{job_type} finished.", profile=profile.title)
                else:
                    self._logger.error(f"{job_type} failed.", profile=profile.title, error=result.error)
            finally:
                with self._lock:
                    self._active_jobs.discard(key)

        Thread(target=run, daemon=True).start()

    def test_connection(self, profile: ConnectionProfile, done: DoneCallback) -> None:
        self._start_job(
            profile=profile,
            job_type="test_connection",
            func=lambda: self._ftp.test_connection(profile),
            done=done,
        )

    def _emit_progress(self, progress: ProgressCallback | None, message: str) -> None:
        """Safely emits progress text to the UI callback."""
        if progress is None:
            return

        try:
            progress(message)
        except Exception:
            pass

    def push_profile(self, profile: ConnectionProfile, done: DoneCallback) -> None:
        def action() -> OperationResult[None]:
            local_root = Path(profile.local_path)
            if not local_root.exists():
                return OperationResult(ok=False, message="Local path does not exist.", error=profile.local_path)

            remote_list = self._ftp.list_files(profile, profile.remote_path)
            if not remote_list.ok or remote_list.data is None:
                return OperationResult(ok=False, message="Push failed while listing remote files.", error=remote_list.error)

            remote_map = {
                remote_to_relative(profile.remote_path, rf.path): rf
                for rf in remote_list.data
            }

            uploaded = 0
            skipped = 0
            for file in local_root.rglob("*"):
                if not file.is_file():
                    continue
                rel = str(file.relative_to(local_root)).replace("\\", "/")
                if should_exclude(rel, profile.exclude):
                    continue

                stat = file.stat()
                local_size = stat.st_size
                local_modified = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)

                remote = remote_map.get(rel)
                if remote and is_same_file_state(
                    local_size=local_size,
                    local_modified=local_modified,
                    remote_size=remote.size,
                    remote_modified=remote.modified,
                ):
                    skipped += 1
                    continue

                remote_file = to_remote_path(profile.remote_path, Path(rel))
                r = self._ftp.upload_file(profile, file, remote_file)
                if not r.ok:
                    return OperationResult(ok=False, message="Push failed.", error=r.error)
                uploaded += 1

            return OperationResult(
                ok=True,
                message=f"Push complete. Uploaded {uploaded}, skipped {skipped}.",
            )

        self._start_job(profile, "push", action, done)

    def pull_profile(
        self,
        profile: ConnectionProfile,
        done: DoneCallback,
        progress: ProgressCallback | None = None,
    ) -> None:
        def action() -> OperationResult[None]:
            local_root = Path(profile.local_path)
            local_root.mkdir(parents=True, exist_ok=True)

            listed = self._ftp.list_files(profile, profile.remote_path)
            if not listed.ok or listed.data is None:
                return OperationResult(ok=False, message="Pull failed while listing files.", error=listed.error)

            eligible_files: list[tuple[object, str]] = []
            for rf in listed.data:
                rel = remote_to_relative(profile.remote_path, rf.path)
                if should_exclude(rel, profile.exclude):
                    continue
                eligible_files.append((rf, rel))

            total_files = len(eligible_files)
            downloaded = 0
            skipped = 0
            processed = 0

            if total_files == 0:
                self._emit_progress(progress, "Pull 0/0")

            for rf, rel in eligible_files:
                processed += 1

                local_target = local_root / Path(rel)
                if local_target.exists() and local_target.is_file():
                    stat = local_target.stat()
                    local_size = stat.st_size
                    local_modified = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
                    if is_same_file_state(
                        local_size=local_size,
                        local_modified=local_modified,
                        remote_size=rf.size,
                        remote_modified=rf.modified,
                    ):
                        skipped += 1
                        self._emit_progress(progress, f"Pull {processed}/{total_files} ({downloaded} downloaded)")
                        continue

                r = self._ftp.download_file(profile, rf.path, local_target)
                if not r.ok:
                    return OperationResult(ok=False, message="Pull failed.", error=r.error)
                downloaded += 1
                self._emit_progress(progress, f"Pull {processed}/{total_files} ({downloaded} downloaded)")

            return OperationResult(
                ok=True,
                message=f"Pull complete. Downloaded {downloaded}, skipped {skipped}.",
            )

        self._start_job(profile, "pull", action, done)

    def start_auto_sync(self, profile: ConnectionProfile) -> OperationResult[None]:
        """Starts local auto sync for one profile."""
        local_root = Path(profile.local_path)
        if not local_root.exists():
            return OperationResult(ok=False, message="Auto sync start failed.", error="Local path does not exist.")

        with self._lock:
            if profile.title in self._auto_sync_runtime:
                return OperationResult(ok=False, message="Auto sync is already running.")

            queue: Queue[str] = Queue()
            stop_event = Event()
            watcher = LocalWatcher(
                root=local_root,
                queue=queue,
                exclude=profile.exclude,
                poll_interval_seconds=profile.poll_interval_seconds,
            )
            runtime = AutoSyncRuntime(
                watcher=watcher,
                queue=queue,
                stop_event=stop_event,
                worker_thread=Thread(
                    target=self._auto_sync_worker,
                    args=(profile, ),
                    daemon=True,
                ),
            )
            self._auto_sync_runtime[profile.title] = runtime

        try:
            watcher.start()
            runtime.worker_thread = Thread(
                target=self._auto_sync_worker,
                args=(profile,),
                daemon=True,
            )
            runtime.worker_thread.start()
        except Exception as ex:
            watcher.stop()
            with self._lock:
                self._auto_sync_runtime.pop(profile.title, None)
            return OperationResult(ok=False, message="Auto sync start failed.", error=str(ex))

        self._logger.info(
            "Auto sync started.",
            profile=profile.title,
            pollIntervalSeconds=profile.poll_interval_seconds,
            uploadFileSyncInterval=profile.upload_file_sync_interval_seconds,
        )
        return OperationResult(ok=True, message="Auto sync started.")

    def stop_auto_sync(self, profile: ConnectionProfile) -> OperationResult[None]:
        """Stops local auto sync for one profile."""
        runtime = self._remove_auto_sync_runtime(profile.title)

        if runtime is None:
            return OperationResult(ok=False, message="Auto sync is not running.")

        runtime.stop_event.set()
        runtime.watcher.stop()
        runtime.worker_thread.join(timeout=2)
        self._logger.info("Auto sync stopped.", profile=profile.title)
        return OperationResult(ok=True, message="Auto sync stopped.")

    def stop_all_auto_sync(self) -> None:
        """Stops all active auto sync workers."""
        with self._lock:
            titles = list(self._auto_sync_runtime.keys())

        for title in titles:
            runtime = self._remove_auto_sync_runtime(title)
            if runtime is None:
                continue
            runtime.stop_event.set()
            runtime.watcher.stop()
            runtime.worker_thread.join(timeout=2)
            self._logger.info("Auto sync stopped.", profile=title)

    def is_auto_sync_active(self, profile: ConnectionProfile) -> bool:
        """Returns whether auto sync is active for a profile."""
        with self._lock:
            return profile.title in self._auto_sync_runtime

    def get_auto_sync_pending_count(self, profile: ConnectionProfile) -> int:
        """Returns the number of queued local file uploads for a profile."""
        with self._lock:
            runtime = self._auto_sync_runtime.get(profile.title)

        if runtime is None:
            return 0

        with runtime.lock:
            return len(runtime.pending_files)

    def _remove_auto_sync_runtime(self, profile_title: str) -> AutoSyncRuntime | None:
        """Removes and returns auto sync runtime state for a profile title."""
        with self._lock:
            return self._auto_sync_runtime.pop(profile_title, None)

    def _auto_sync_worker(self, profile: ConnectionProfile) -> None:
        with self._lock:
            runtime = self._auto_sync_runtime.get(profile.title)

        if runtime is None:
            return

        while not runtime.stop_event.is_set():
            try:
                relative_path = runtime.queue.get(timeout=0.5)
                with runtime.lock:
                    runtime.pending_files[relative_path] = monotonic()
                    runtime.changed_files.append(relative_path)
                    if len(runtime.changed_files) > 250:
                        runtime.changed_files = runtime.changed_files[-250:]
                    pending_count = len(runtime.pending_files)
                self._logger.info(
                    "Auto sync queued file change.",
                    profile=profile.title,
                    file=relative_path,
                    pending=pending_count,
                )
            except Empty:
                pass

            self._flush_auto_sync_queue(profile, runtime)

    def _flush_auto_sync_queue(self, profile: ConnectionProfile, runtime: AutoSyncRuntime) -> None:
        ready_files: list[str] = []
        now = monotonic()
        with runtime.lock:
            for relative_path, queued_at in runtime.pending_files.items():
                if now - queued_at >= profile.upload_file_sync_interval_seconds:
                    ready_files.append(relative_path)

        for relative_path in ready_files:
            self._upload_auto_sync_file(profile, runtime, relative_path)

    def _upload_auto_sync_file(self, profile: ConnectionProfile, runtime: AutoSyncRuntime, relative_path: str) -> None:
        local_file = Path(profile.local_path) / Path(relative_path)
        if should_exclude(relative_path, profile.exclude):
            with runtime.lock:
                runtime.pending_files.pop(relative_path, None)
            return

        if not local_file.exists() or not local_file.is_file():
            self._logger.warning(
                "Auto sync skipped missing file.",
                profile=profile.title,
                file=relative_path,
            )
            with runtime.lock:
                runtime.pending_files.pop(relative_path, None)
            return

        remote_file = to_remote_path(profile.remote_path, Path(relative_path))
        result = self._ftp.upload_file(profile, local_file, remote_file)
        if result.ok:
            self._logger.info(
                "Auto sync uploaded file.",
                profile=profile.title,
                file=relative_path,
            )
            with runtime.lock:
                runtime.pending_files.pop(relative_path, None)
            return

        self._logger.error(
            "Auto sync upload failed.",
            profile=profile.title,
            file=relative_path,
            error=result.error,
        )
        with runtime.lock:
            runtime.pending_files[relative_path] = monotonic()
