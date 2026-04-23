"""Alembic migration helpers for the storage adapter."""

from __future__ import annotations

import sys
from pathlib import Path

from alembic import command
from alembic.config import Config


def build_alembic_config(database_url: str) -> Config:
    root = _migration_root()
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def run_migrations(database_url: str, revision: str = "head") -> None:
    """Upgrade the storage schema to the requested revision."""
    config = build_alembic_config(database_url)
    command.upgrade(config, revision)


def _migration_root() -> Path:
    bundle_root = getattr(sys, "_MEIPASS", None)
    if bundle_root:
        candidate = Path(bundle_root)
        if _has_migration_assets(candidate):
            return candidate

    project_root = _project_root()
    if _has_migration_assets(project_root):
        return project_root

    package_root = Path(__file__).resolve().parents[3]
    if _has_migration_assets(package_root):
        return package_root

    return project_root


def _has_migration_assets(root: Path) -> bool:
    return (root / "alembic.ini").is_file() and (root / "alembic").is_dir()


def _project_root() -> Path:
    return Path(__file__).resolve().parents[4]
