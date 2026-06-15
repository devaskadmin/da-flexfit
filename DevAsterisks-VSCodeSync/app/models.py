from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Generic, TypeVar


T = TypeVar("T")


@dataclass(slots=True)
class OperationResult(Generic[T]):
    """Standard operation result for service calls."""
    ok: bool
    message: str
    data: T | None = None
    error: str | None = None


@dataclass(slots=True)
class RemoteFileInfo:
    """Remote file metadata used for pull and comparison."""
    path: str
    size: int | None = None
    modified: datetime | None = None
    is_dir: bool = False


@dataclass(slots=True)
class ConnectionProfile:
    """Normalized FTP connection profile."""
    title: str
    protocol: str
    host: str
    port: int
    username: str
    password: str
    local_path: str
    remote_path: str
    exclude: list[str] = field(default_factory=list)
    poll_interval_seconds: int = 10
    upload_file_sync_interval_seconds: int = 3
    verify_tls_certificate: bool = True
    passive_mode: bool = True
    # SFTP-specific fields
    ssh_key_path: str | None = None
    ssh_known_hosts_policy: str = "reject"  # "reject" | "warn" | "auto_add"


@dataclass(slots=True)
class AppConfig:
    """Top-level app config."""
    app_title: str
    app_version: str = "1.0.0"
    max_connections: int = 2
    connections: list[ConnectionProfile] = field(default_factory=list)


@dataclass(slots=True)
class LogEvent:
    """Log event payload for GUI and file output."""
    level: str
    message: str
    timestamp: datetime = field(default_factory=datetime.now)
    context: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class SyncFileState:
    """Comparable file state for first-pass change detection."""
    relative_path: str
    size: int | None = None
    modified_utc: datetime | None = None

    def modified_epoch(self) -> int | None:
        """Returns UTC modified epoch seconds when available."""
        if self.modified_utc is None:
            return None
        return int(self.modified_utc.astimezone(timezone.utc).timestamp())
