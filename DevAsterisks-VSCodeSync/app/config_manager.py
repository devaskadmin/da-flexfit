from __future__ import annotations

import json
from pathlib import Path

from app.models import AppConfig, ConnectionProfile, OperationResult


class ConfigManager:
    """Loads and validates JSON config for FTP profiles."""

    REQUIRED_PROFILE_FIELDS = {
        "title",
        "protocol",
        "host",
        "port",
        "username",
        "password",
        "localPath",
        "remotePath",
        "exclude",
        "pollIntervalSeconds",
    }

    def _coerce_bool(self, value: object, default: bool) -> bool:
        """Safely converts JSON values to bool."""
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1", "yes", "on"}:
                return True
            if normalized in {"false", "0", "no", "off"}:
                return False
        if value is None:
            return default
        return bool(value)

    def load(self, file_path: Path) -> OperationResult[AppConfig]:
        """Loads app config from JSON file and validates it."""
        if not file_path.exists():
            return OperationResult(ok=False, message="Config file not found.", error=str(file_path))

        try:
            raw = json.loads(file_path.read_text(encoding="utf-8"))
        except Exception as ex:
            return OperationResult(ok=False, message="Invalid JSON.", error=str(ex))

        errors: list[str] = []
        app_title = str(raw.get("appTitle", "DevAsterisks-VSCodeSync"))
        app_version = str(raw.get("appVersion", "1.0.0"))
        max_connections = int(raw.get("maxConnections", 2))
        raw_connections = raw.get("connections", [])

        if not isinstance(raw_connections, list):
            return OperationResult(ok=False, message="`connections` must be a list.", error="invalid_type")

        profiles: list[ConnectionProfile] = []
        for idx, c in enumerate(raw_connections):
            missing = self.REQUIRED_PROFILE_FIELDS.difference(set(c.keys()))
            if missing:
                errors.append(f"connections[{idx}] missing fields: {sorted(missing)}")
                continue

            protocol = str(c["protocol"]).lower().strip()
            if protocol not in {"ftp", "ftpes", "ftps"}:
                errors.append(
                    f"connections[{idx}] protocol must be one of 'ftp', 'ftpes', or 'ftps'."
                )
                continue

            try:
                profile = ConnectionProfile(
                    title=str(c["title"]).strip(),
                    protocol=protocol,
                    host=str(c["host"]).strip(),
                    port=int(c["port"]),
                    username=str(c["username"]),
                    password=str(c["password"]),
                    local_path=str(c["localPath"]).strip(),
                    remote_path=str(c["remotePath"]).strip(),
                    exclude=[str(x) for x in c.get("exclude", [])],
                    poll_interval_seconds=max(2, int(c.get("pollIntervalSeconds", 10))),
                    upload_file_sync_interval_seconds=max(
                        1,
                        int(c.get("uploadFileSyncInterval", 3)),
                    ),
                    verify_tls_certificate=self._coerce_bool(
                        c.get("verifyTlsCertificate"),
                        True,
                    ),
                    passive_mode=self._coerce_bool(c.get("passiveMode"), True),
                )
            except Exception as ex:
                errors.append(f"connections[{idx}] invalid values: {ex}")
                continue

            if not profile.title or not profile.host or not profile.remote_path or not profile.local_path:
                errors.append(f"connections[{idx}] contains empty required values.")
                continue

            profiles.append(profile)

        if errors:
            return OperationResult(
                ok=False,
                message="Config validation failed.",
                error="; ".join(errors),
            )

        return OperationResult(
            ok=True,
            message="Config loaded.",
            data=AppConfig(
                app_title=app_title,
                app_version=app_version,
                max_connections=max_connections,
                connections=profiles,
            ),
        )
