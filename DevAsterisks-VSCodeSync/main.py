from pathlib import Path

from app.config_manager import ConfigManager
from app.ftp_client import FTPClient
from app.gui import DevAsterisksApp
from app.logger import AppLogger
from app.sync_coordinator import SyncCoordinator


def main() -> None:
    project_root = Path(__file__).resolve().parent
    logs_dir = project_root / "logs"
    default_config = project_root / "config" / "synctool-ftp-settings.json"

    logger = AppLogger(logs_dir=logs_dir, file_name="app.log")
    config_manager = ConfigManager()
    ftp_client = FTPClient(logger=logger)
    coordinator = SyncCoordinator(logger=logger, ftp_client=ftp_client)

    app = DevAsterisksApp(
        logger=logger,
        config_manager=config_manager,
        coordinator=coordinator,
        default_config_path=default_config,
    )
    app.mainloop()


if __name__ == "__main__":
    main()
