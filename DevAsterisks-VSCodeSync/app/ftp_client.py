from __future__ import annotations

from datetime import datetime, timezone
from ftplib import FTP, FTP_TLS, error_perm
from pathlib import Path
import ssl
from time import sleep
from typing import Callable, TypeVar

from app.logger import AppLogger
from app.models import ConnectionProfile, OperationResult, RemoteFileInfo
from app.utils import remote_to_relative, should_exclude


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
            self._logger.info(
                "FTP connection attempt started.",
                profile=profile.title,
                host=profile.host,
                port=profile.port,
                protocol=profile.protocol,
            )
            
            if profile.protocol in {"ftpes", "ftps"}:
                self._logger.info("Using FTPS with TLS.", profile=profile.title)
                ftp = FTP_TLS(context=self._build_tls_context(profile))
                ftp.connect(profile.host, profile.port, timeout=15)
                self._logger.info("FTPS connection established.", profile=profile.title)
                ftp.login(profile.username, profile.password)
                self._logger.info("FTPS login successful.", profile=profile.title)
                ftp.prot_p()
                self._logger.info("FTPS data connection protection enabled.", profile=profile.title)
            else:
                self._logger.info("Using standard FTP.", profile=profile.title)
                ftp = FTP()
                ftp.connect(profile.host, profile.port, timeout=15)
                self._logger.info("FTP connection established.", profile=profile.title)
                ftp.login(profile.username, profile.password)
                self._logger.info("FTP login successful.", profile=profile.title)

            ftp.encoding = "utf-8"
            ftp.set_pasv(profile.passive_mode)
            self._logger.info(
                "FTP connection ready.",
                profile=profile.title,
                passiveMode=profile.passive_mode,
            )
            return ftp

        result = self._retry(action, f"connect:{profile.title}")
        if result.ok:
            self._logger.info("FTP connection successful.", profile=profile.title)
        else:
            self._logger.error(
                "FTP connection failed after retries.",
                profile=profile.title,
                error=result.error,
            )
        return result

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
        self._logger.info(
            "Download file operation started.",
            profile=profile.title,
            remoteFile=remote_file,
            localFile=str(local_file),
        )
        
        conn = self.connect(profile)
        if not conn.ok or conn.data is None:
            self._logger.error(
                "Download failed - connection error.",
                profile=profile.title,
                remoteFile=remote_file,
                error=conn.error,
            )
            return OperationResult(ok=False, message="Download failed (connect).", error=conn.error)

        ftp = conn.data
        try:
            local_file.parent.mkdir(parents=True, exist_ok=True)
            self._logger.info(
                "Local directory created.",
                profile=profile.title,
                localDir=str(local_file.parent),
            )
            
            # Verify the remote file exists before downloading
            self._logger.info(
                "Checking remote file size.",
                profile=profile.title,
                remoteFile=remote_file,
            )
            try:
                ftp_size = ftp.size(remote_file)
                self._logger.info(
                    "Remote file size retrieved.",
                    profile=profile.title,
                    remoteFile=remote_file,
                    sizeBytes=ftp_size,
                )
                if ftp_size is None or ftp_size < 0:
                    raise ValueError(f"Invalid remote file size: {ftp_size}")
            except Exception as size_check_ex:
                self._logger.error(
                    "Remote file size check failed.",
                    profile=profile.title,
                    remoteFile=remote_file,
                    error=str(size_check_ex),
                )
                ftp.quit()
                return OperationResult(
                    ok=False,
                    message=f"Download failed: {remote_file} (file check)",
                    error=f"File verification failed: {str(size_check_ex)}",
                )
            
            self._logger.info(
                "Starting binary transfer.",
                profile=profile.title,
                remoteFile=remote_file,
                localFile=str(local_file),
            )
            with local_file.open("wb") as f:
                ftp.retrbinary(f"RETR {remote_file}", f.write)
            
            self._logger.info(
                "File download completed.",
                profile=profile.title,
                remoteFile=remote_file,
                localFile=str(local_file),
            )
            ftp.quit()
            return OperationResult(ok=True, message=f"Downloaded {local_file.name}.")
        except Exception as ex:
            self._logger.error(
                "File download failed with exception.",
                profile=profile.title,
                remoteFile=remote_file,
                localFile=str(local_file),
                error=str(ex),
                errorType=type(ex).__name__,
            )
            try:
                ftp.quit()
            except Exception as quit_ex:
                self._logger.warning("Failed to close FTP connection.", error=str(quit_ex))
            return OperationResult(
                ok=False,
                message=f"Download failed: {remote_file}",
                error=self._format_exception(ex),
            )

    def pull_directory_streaming(
        self,
        profile: ConnectionProfile,
        remote_root: str,
        local_root: Path,
        exclude: list[str],
        progress: Callable[[str], None] | None = None,
    ) -> OperationResult[dict[str, int]]:
        """Recursively pulls files while walking directories, without pre-listing all files first."""

        def emit(message: str) -> None:
            if progress is None:
                return
            try:
                progress(message)
            except Exception:
                pass

        def join_remote(parent: str, child: str) -> str:
            clean_child = child.replace("\\", "/").strip()
            if clean_child.startswith("/") or clean_child.startswith("~/"):
                return clean_child
            if parent in {"", "/"}:
                return f"/{clean_child.lstrip('/')}"
            return f"{parent.rstrip('/')}/{clean_child.lstrip('/')}"

        self._logger.info(
            "Streaming pull operation started.",
            profile=profile.title,
            remoteRoot=remote_root,
            localRoot=str(local_root),
        )

        conn = self.connect(profile)
        if not conn.ok or conn.data is None:
            self._logger.error(
                "Streaming pull failed - connection error.",
                profile=profile.title,
                error=conn.error,
            )
            return OperationResult(ok=False, message="Pull failed (connect).", error=conn.error)

        ftp = conn.data
        counters: dict[str, int] = {
            "downloaded": 0,
            "excluded": 0,
            "directories": 0,
        }
        visited_directories: set[str] = set()

        def download_remote_file(remote_file: str) -> None:
            relative_path = remote_to_relative(remote_root, remote_file)
            if should_exclude(relative_path, exclude):
                counters["excluded"] += 1
                return

            local_target = local_root / Path(relative_path)
            local_target.parent.mkdir(parents=True, exist_ok=True)
            with local_target.open("wb") as stream:
                ftp.retrbinary(f"RETR {remote_file}", stream.write)

            counters["downloaded"] += 1
            emit(f"Pull downloaded {counters['downloaded']}: {relative_path}")

        def walk_legacy(path: str) -> None:
            normalized_path = path.replace("\\", "/") or "/"
            if normalized_path in visited_directories:
                return
            visited_directories.add(normalized_path)
            counters["directories"] += 1

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
                        walk_legacy(full_path)
                        ftp.cwd(current_dir)
                        continue

                    download_remote_file(full_path)
            finally:
                ftp.cwd(previous_dir)

        def walk(path: str) -> None:
            normalized_path = path.replace("\\", "/") or "/"
            if normalized_path in visited_directories:
                return
            visited_directories.add(normalized_path)
            counters["directories"] += 1

            try:
                entries = list(ftp.mlsd(normalized_path))
            except Exception as mlsd_ex:
                if self._supports_legacy_list_fallback(mlsd_ex):
                    self._logger.warning(
                        "MLSD unsupported during streaming pull. Falling back to legacy walk.",
                        profile=profile.title,
                        path=normalized_path,
                        error=str(mlsd_ex),
                    )
                    walk_legacy(normalized_path)
                    return
                raise

            for name, facts in entries:
                if name in {".", ".."}:
                    continue

                full_path = join_remote(normalized_path, name)
                kind = facts.get("type", "file")
                if kind == "dir":
                    walk(full_path)
                elif kind == "file":
                    download_remote_file(full_path)

        try:
            local_root.mkdir(parents=True, exist_ok=True)
            ftp.cwd(remote_root)
            emit("Pull started...")
            walk(remote_root)
            ftp.quit()
            self._logger.info(
                "Streaming pull completed.",
                profile=profile.title,
                downloaded=counters["downloaded"],
                excluded=counters["excluded"],
                directories=counters["directories"],
            )
            return OperationResult(
                ok=True,
                message="Pull completed.",
                data=counters,
            )
        except Exception as ex:
            self._logger.error(
                "Streaming pull failed with exception.",
                profile=profile.title,
                error=str(ex),
                errorType=type(ex).__name__,
            )
            try:
                ftp.quit()
            except Exception:
                pass
            return OperationResult(
                ok=False,
                message="Pull failed.",
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
        self._logger.info(
            "List files operation started.",
            profile=profile.title,
            remoteRoot=remote_root,
        )
        
        conn = self.connect(profile)
        if not conn.ok or conn.data is None:
            self._logger.error(
                "List files failed - connection error.",
                profile=profile.title,
                error=conn.error,
            )
            return OperationResult(ok=False, message="List files failed (connect).", error=conn.error)

        ftp = conn.data
        files: list[RemoteFileInfo] = []
        
        # First, verify we can access the remote root
        self._logger.info("Verifying remote directory access.", profile=profile.title, path=remote_root)
        try:
            ftp.cwd(remote_root)
            self._logger.info("Successfully changed to remote directory.", profile=profile.title, path=remote_root)
        except Exception as cwd_ex:
            self._logger.error(
                "Failed to access remote directory.",
                profile=profile.title,
                path=remote_root,
                error=str(cwd_ex),
            )
            try:
                ftp.quit()
            except Exception:
                pass
            return OperationResult(
                ok=False,
                message="List files failed.",
                error=self._build_cwd_failure_message(ftp, profile, cwd_ex),
            )

        def walk(path: str, depth: int = 0) -> None:
            self._logger.info(
                "Walking remote directory.",
                profile=profile.title,
                path=path,
                depth=depth,
            )
            try:
                entries = list(ftp.mlsd(path))
                self._logger.info(
                    f"MLSD returned {len(entries)} entries.",
                    profile=profile.title,
                    path=path,
                    count=len(entries),
                )
            except Exception as mlsd_ex:
                self._logger.warning(
                    "MLSD failed, trying fallback.",
                    profile=profile.title,
                    path=path,
                    error=str(mlsd_ex),
                )
                entries = []
                
            for name, facts in entries:
                full = f"{path.rstrip('/')}/{name}".replace("//", "/")
                kind = facts.get("type", "file")
                if kind == "dir":
                    self._logger.debug("Found directory.", profile=profile.title, path=full)
                    try:
                        walk(full, depth + 1)
                    except Exception as walk_ex:
                        self._logger.warning(
                            "Error walking subdirectory.",
                            profile=profile.title,
                            path=full,
                            error=str(walk_ex),
                        )
                elif kind == "file":
                    size = int(facts["size"]) if "size" in facts else None
                    modified = self._parse_mlsd_modify(facts.get("modify"))
                    files.append(
                        RemoteFileInfo(path=full, size=size, modified=modified, is_dir=False)
                    )
                    self._logger.debug(
                        "Found file.",
                        profile=profile.title,
                        path=full,
                        size=size,
                    )

        try:
            walk(remote_root)
            self._logger.info(
                "Remote directory walk completed.",
                profile=profile.title,
                totalFiles=len(files),
            )
            ftp.quit()
            self._logger.info("FTP connection closed.", profile=profile.title)
            return OperationResult(ok=True, message="Listed remote files.", data=files)
        except Exception as ex:
            self._logger.error(
                "List files walk failed.",
                profile=profile.title,
                error=str(ex),
            )
            if self._supports_legacy_list_fallback(ex):
                try:
                    self._logger.warning(
                        "MLSD unsupported. Falling back to legacy FTP listing.",
                        profile=profile.title,
                        remotePath=remote_root,
                        error=str(ex),
                    )
                    files = self._list_files_legacy(ftp, remote_root)
                    self._logger.info(
                        "Legacy listing completed.",
                        profile=profile.title,
                        totalFiles=len(files),
                    )
                    ftp.quit()
                    return OperationResult(
                        ok=True,
                        message="Listed remote files using legacy FTP commands.",
                        data=files,
                    )
                except Exception as legacy_ex:
                    self._logger.error(
                        "Legacy FTP listing also failed.",
                        profile=profile.title,
                        error=str(legacy_ex),
                    )
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
