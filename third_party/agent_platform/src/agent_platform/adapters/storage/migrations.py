"""Alembic migration helpers for the storage adapter."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config


def build_alembic_config(database_url: str) -> Config:
    root = _project_root()
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def run_migrations(database_url: str, revision: str = "head") -> None:
    """Upgrade the storage schema to the requested revision."""
    config = build_alembic_config(database_url)
    command.upgrade(config, revision)


def _project_root() -> Path:
    return Path(__file__).resolve().parents[4]
