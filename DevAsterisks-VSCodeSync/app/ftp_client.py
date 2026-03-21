from __future__ import annotations

from datetime import datetime, timezone
from ftplib import FTP, FTP_TLS, error_perm
from pathlib import Path
import ssl
from time import sleep
from typing import Callable, TypeVar

from app.logger import AppLogger
from app.models import ConnectionProfile, OperationResult, RemoteFileInfo


T = TypeVar("T")


class FTPClient:
    """FTP engine with retry and structured result objects."""

    def __init__(self, logger: AppLogger, retries: int = 2, retry_delay_seconds: float = 1.0) -> None:
        self._logger = logger
        self._retries = retries
        self._retry_delay = retry_delay_seconds

    def _retry(self, action: Callable[[], T], action_name: str) -> OperationResult[T]:
        last_error = ""
        for attempt in range(1, self._retries + 2):
            try:
                data = action()
                return OperationResult(ok=True, message=f"{action_name} succeeded.", data=data)
            except Exception as ex:
                last_error = str(ex)
                self._logger.warning(f"{action_name} failed (attempt {attempt}).", error=last_error)
                if attempt <= self._retries:
                    sleep(self._retry_delay)
        return OperationResult(ok=False, message=f"{action_name} failed.", error=last_error)

    def _build_tls_context(self, profile: ConnectionProfile) -> ssl.SSLContext:
        """Builds a TLS context for explicit FTPS connections."""
        context = ssl.create_default_context()
        if not profile.verify_tls_certificate:
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            self._logger.warning(
                "TLS certificate verification disabled for profile.",
                profile=profile.title,
                host=profile.host,
            )
        return context

    def _format_exception(self, ex: Exception) -> str:
        """Formats connection errors for clearer GUI feedback."""
        if isinstance(ex, ssl.SSLCertVerificationError):
            return (
                "TLS certificate verification failed. "
                f"{ex}. If this server uses a mismatched or self-signed certificate, "
                "set verifyTlsCertificate to false only if you trust it."
            )
        return str(ex)

    def _build_path_suggestions(self, remote_path: str) -> list[str]:
        """Builds a few likely remote path variants for troubleshooting."""
        raw = remote_path.strip()
        variants: list[str] = []
        if not raw:
            return variants

        candidates = [raw]
        if raw.startswith("~/"):
            candidates.extend([raw[2:], f"/{raw[2:]}"])
        elif raw.startswith("/"):
            candidates.append(raw.lstrip("/"))
        else:
            candidates.append(f"/{raw}")

        seen: set[str] = set()
        for value in candidates:
            normalized = value.strip()
            if normalized and normalized not in seen:
                seen.add(normalized)
                variants.append(normalized)
        return variants[:4]

    def _build_cwd_failure_message(self, ftp: FTP | FTP_TLS, profile: ConnectionProfile, ex: Exception) -> str:
        """Builds a more helpful directory error message."""
        error_text = self._format_exception(ex)
        if "550" not in error_text:
            return error_text

        try:
            current_dir = ftp.pwd()
        except Exception:
            current_dir = "unknown"

        suggestions = ", ".join(self._build_path_suggestions(profile.remote_path))
        return (
            f"{error_text} Current FTP directory: {current_dir}. "
            f"Configured remotePath: {profile.remote_path}. "
            f"Try one of: {suggestions}"
        )

    def connect(self, profile: ConnectionProfile) -> OperationResult[FTP | FTP_TLS]:
        """Connects and authenticates to FTP server."""
        def action() -> FTP | FTP_TLS:
            if profile.protocol in {"ftpes", "ftps"}:
                ftp = FTP_TLS(context=self._build_tls_context(profile))
                ftp.connect(profile.host, profile.port, timeout=15)
                ftp.login(profile.username, profile.password)
                ftp.prot_p()
            else:
                ftp = FTP()
                ftp.connect(profile.host, profile.port, timeout=15)
                ftp.login(profile.username, profile.password)

            ftp.encoding = "utf-8"
            ftp.set_pasv(profile.passive_mode)
            return ftp

        return self._retry(action, f"connect:{profile.title}")

    def test_connection(self, profile: ConnectionProfile) -> OperationResult[None]:
        """Tests FTP connectivity and basic remote path access."""
        result = self.connect(profile)
        if not result.ok or result.data is None:
            return OperationResult(ok=False, message="Connection test failed.", error=result.error)

        ftp = result.data
        try:
            ftp.cwd(profile.remote_path)
            ftp.quit()
            return OperationResult(ok=True, message="Connection test passed.")
        except Exception as ex:
            try:
                ftp.quit()
            except Exception:
                pass
            return OperationResult(
                ok=False,
                message="Connection test failed.",
                error=self._build_cwd_failure_message(ftp, profile, ex),
            )

    def create_remote_directory_if_missing(self, ftp: FTP, remote_dir: str) -> OperationResult[None]:
        """Creates remote directory chain if it does not exist."""
        parts = [p for p in remote_dir.replace("\\", "/").split("/") if p]
        current = ""
        for part in parts:
            current = f"{current}/{part}"
            try:
                ftp.cwd(current)
            except error_perm:
                try:
                    ftp.mkd(current)
                except Exception as ex:
                    return OperationResult(ok=False, message="Create remote directory failed.", error=str(ex))
        return OperationResult(ok=True, message="Remote directory ready.")

    def upload_file(self, profile: ConnectionProfile, local_file: Path, remote_file: str) -> OperationResult[None]:
        """Uploads a single file to remote path."""
        conn = self.connect(profile)
        if not conn.ok or conn.data is None:
            return OperationResult(ok=False, message="Upload failed (connect).", error=conn.error)

        ftp = conn.data
        try:
            remote_parent = "/".join(remote_file.replace("\\", "/").split("/")[:-1])
            if remote_parent:
                mk = self.create_remote_directory_if_missing(ftp, remote_parent)
                if not mk.ok:
                    return mk
            with local_file.open("rb") as f:
                ftp.storbinary(f"STOR {remote_file}", f)
            ftp.quit()
            return OperationResult(ok=True, message=f"Uploaded {local_file.name}.")
        except Exception as ex:
            try:
                ftp.quit()
            except Exception:
                pass
            return OperationResult(
                ok=False,
                message=f"Upload failed: {local_file.name}",
                error=self._format_exception(ex),
            )

    def download_file(self, profile: ConnectionProfile, remote_file: str, local_file: Path) -> OperationResult[None]:
        """Downloads a single remote file to local path."""
        conn = self.connect(profile)
        if not conn.ok or conn.data is None:
            return OperationResult(ok=False, message="Download failed (connect).", error=conn.error)

        ftp = conn.data
        try:
            local_file.parent.mkdir(parents=True, exist_ok=True)
            with local_file.open("wb") as f:
                ftp.retrbinary(f"RETR {remote_file}", f.write)
            ftp.quit()
            return OperationResult(ok=True, message=f"Downloaded {local_file.name}.")
        except Exception as ex:
            try:
                ftp.quit()
            except Exception:
                pass
            return OperationResult(
                ok=False,
                message=f"Download failed: {remote_file}",
                error=self._format_exception(ex),
            )

    def _parse_mlsd_modify(self, raw: str | None) -> datetime | None:
        """Parses MLSD modify timestamp (YYYYMMDDHHMMSS) as UTC."""
        if not raw:
            return None
        try:
            return datetime.strptime(raw, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
        except ValueError:
            return None

    def _parse_mdtm_response(self, response: str | None) -> datetime | None:
        """Parses MDTM response values like '213 20260321191230'."""
        if not response:
            return None

        normalized = response.strip()
        if normalized.startswith("213 "):
            normalized = normalized[4:]

        return self._parse_mlsd_modify(normalized)

    def _supports_legacy_list_fallback(self, ex: Exception) -> bool:
        """Returns True when MLSD should fall back to older FTP commands."""
        message = str(ex).lower()
        fallback_tokens = (
            "unknown command",
            "command not understood",
            "not implemented",
            "mlsd",
            "500",
            "501",
            "502",
        )
        return any(token in message for token in fallback_tokens)

    def _is_remote_directory(self, ftp: FTP | FTP_TLS, remote_path: str) -> bool:
        """Checks whether a remote path is a directory by attempting to cwd into it."""
        current_dir = ftp.pwd()
        try:
            ftp.cwd(remote_path)
            return True
        except Exception:
            return False
        finally:
            try:
                ftp.cwd(current_dir)
            except Exception:
                pass

    def _get_remote_file_info_legacy(self, ftp: FTP | FTP_TLS, remote_path: str) -> RemoteFileInfo:
        """Builds remote file metadata using legacy SIZE and MDTM commands."""
        size: int | None = None
        modified: datetime | None = None

        try:
            size = ftp.size(remote_path)
        except Exception:
            size = None

        try:
            modified = self._parse_mdtm_response(ftp.sendcmd(f"MDTM {remote_path}"))
        except Exception:
            modified = None

        return RemoteFileInfo(path=remote_path, size=size, modified=modified, is_dir=False)

    def _list_files_legacy(self, ftp: FTP | FTP_TLS, remote_root: str) -> list[RemoteFileInfo]:
        """Lists remote files recursively using legacy FTP commands like NLST."""
        files: list[RemoteFileInfo] = []
        visited_directories: set[str] = set()

        def join_remote(parent: str, child: str) -> str:
            clean_child = child.replace("\\", "/").strip()
            if clean_child.startswith("/") or clean_child.startswith("~/"):
                return clean_child
            if parent in {"", "/"}:
                return f"/{clean_child.lstrip('/')}"
            return f"{parent.rstrip('/')}/{clean_child.lstrip('/')}"

        def walk(path: str) -> None:
            normalized_path = path.replace("\\", "/") or "/"
            if normalized_path in visited_directories:
                return
            visited_directories.add(normalized_path)

            previous_dir = ftp.pwd()
            ftp.cwd(normalized_path)
            current_dir = ftp.pwd()
            try:
                try:
                    entries = ftp.nlst()
                except error_perm as ex:
                    if "550" in str(ex):
                        entries = []
                    else:
                        raise

                for raw_entry in entries:
                    entry = raw_entry.replace("\\", "/").strip()
                    if not entry:
                        continue

                    name = entry.rstrip("/").split("/")[-1]
                    if name in {".", ".."}:
                        continue

                    full_path = entry if entry.startswith("/") or entry.startswith("~/") else join_remote(current_dir, entry)
                    if full_path in {current_dir, previous_dir}:
                        continue

                    if self._is_remote_directory(ftp, full_path):
                        walk(full_path)
                        ftp.cwd(current_dir)
                        continue

                    files.append(self._get_remote_file_info_legacy(ftp, full_path))
            finally:
                ftp.cwd(previous_dir)

        walk(remote_root)
        return files

    def list_files(self, profile: ConnectionProfile, remote_root: str) -> OperationResult[list[RemoteFileInfo]]:
        """Lists remote files recursively using MLSD when supported."""
        conn = self.connect(profile)
        if not conn.ok or conn.data is None:
            return OperationResult(ok=False, message="List files failed (connect).", error=conn.error)

        ftp = conn.data
        files: list[RemoteFileInfo] = []

        def walk(path: str) -> None:
            entries = list(ftp.mlsd(path))
            for name, facts in entries:
                full = f"{path.rstrip('/')}/{name}".replace("//", "/")
                kind = facts.get("type", "file")
                if kind == "dir":
                    walk(full)
                elif kind == "file":
                    size = int(facts["size"]) if "size" in facts else None
                    modified = self._parse_mlsd_modify(facts.get("modify"))
                    files.append(
                        RemoteFileInfo(path=full, size=size, modified=modified, is_dir=False)
                    )

        try:
            walk(remote_root)
            ftp.quit()
            return OperationResult(ok=True, message="Listed remote files.", data=files)
        except Exception as ex:
            if self._supports_legacy_list_fallback(ex):
                try:
                    self._logger.warning(
                        "MLSD unsupported. Falling back to legacy FTP listing.",
                        profile=profile.title,
                        remotePath=remote_root,
                        error=str(ex),
                    )
                    files = self._list_files_legacy(ftp, remote_root)
                    ftp.quit()
                    return OperationResult(
                        ok=True,
                        message="Listed remote files using legacy FTP commands.",
                        data=files,
                    )
                except Exception as legacy_ex:
                    try:
                        ftp.quit()
                    except Exception:
                        pass
                    return OperationResult(
                        ok=False,
                        message="List files failed.",
                        error=self._format_exception(legacy_ex),
                    )

            try:
                ftp.quit()
            except Exception:
                pass
            return OperationResult(
                ok=False,
                message="List files failed.",
                error=self._format_exception(ex),
            )
