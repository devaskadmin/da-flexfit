from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path


def should_exclude(relative_path: str, exclude: list[str]) -> bool:
    """Returns True if path should be skipped by exclude rules."""
    normalized = relative_path.replace("\\", "/").strip("/")
    parts = normalized.split("/") if normalized else []
    exclude_set = {x.strip().lower() for x in exclude}
    return any(part.lower() in exclude_set for part in parts)


def to_remote_path(base_remote: str, relative_local_path: Path) -> str:
    """Builds a unix-style remote path from base and local relative path."""
    rel = str(relative_local_path).replace("\\", "/").strip("/")
    return f"{base_remote.rstrip('/')}/{rel}" if rel else base_remote.rstrip("/")


def remote_to_relative(remote_root: str, full_remote_path: str) -> str:
    """Converts remote absolute path into profile-relative path."""
    root = remote_root.replace("\\", "/").rstrip("/")
    full = full_remote_path.replace("\\", "/")
    if full.startswith(root):
        return full[len(root):].lstrip("/")
    return full.lstrip("/")


def is_same_file_state(
    local_size: int | None,
    local_modified: datetime | None,
    remote_size: int | None,
    remote_modified: datetime | None,
    mtime_tolerance_seconds: int = 2,
) -> bool:
    """Compares size + modified time with tolerance."""
    if local_size is not None and remote_size is not None and local_size != remote_size:
        return False

    if local_modified is None or remote_modified is None:
        return local_size == remote_size

    l = int(local_modified.astimezone(timezone.utc).timestamp())
    r = int(remote_modified.astimezone(timezone.utc).timestamp())
    return abs(l - r) <= mtime_tolerance_seconds and local_size == remote_size
