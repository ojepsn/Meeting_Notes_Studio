"""Export the FastAPI OpenAPI schema to a JSON file."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import tempfile
from pathlib import Path
from typing import Any

from agent_platform.adapters.api.app import create_app
from agent_platform.adapters.storage.migrations import run_migrations
from agent_platform.kernel.bootstrap import Settings, build_container

PROJECT_ROOT = Path(__file__).resolve().parents[3]


async def _shutdown_container(container) -> None:
    tools = container.tool_registry()
    tools_aclose = getattr(tools, "aclose", None)
    if callable(tools_aclose):
        await tools_aclose()

    observability = container.observability()
    observability_aclose = getattr(observability, "aclose", None)
    if callable(observability_aclose):
        await observability_aclose()

    workflow = container.workflow_engine()
    workflow_aclose = getattr(workflow, "aclose", None)
    if callable(workflow_aclose):
        await workflow_aclose()

    engine = container.db_engine()
    dispose = getattr(engine, "dispose", None)
    if callable(dispose):
        await dispose()


def build_openapi_document() -> dict[str, Any]:
    previous_cwd = Path.cwd()
    os.chdir(PROJECT_ROOT)
    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            settings = Settings(
                data_dir=tmp_path / "data",
                skills_dir=PROJECT_ROOT / "skills",
                database={
                    "url": f"sqlite+aiosqlite:///{(tmp_path / 'app.db').as_posix()}",
                },
                workflow={
                    "checkpoint_db_url": (
                        f"sqlite+aiosqlite:///{(tmp_path / 'checkpoints.db').as_posix()}"
                    ),
                },
                tools={"fs_root": tmp_path / "workspace"},
            )
            run_migrations(settings.database.url)
            container = build_container(settings)
            try:
                app = create_app(container=container, settings=settings)
                return app.openapi()
            finally:
                asyncio.run(_shutdown_container(container))
    finally:
        os.chdir(previous_cwd)


def export_openapi_document(output_path: Path) -> Path:
    document = build_openapi_document()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(document, indent=2) + "\n",
        encoding="utf-8",
    )
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Export OpenAPI JSON for the agent API.")
    parser.add_argument(
        "--out",
        default="sdk/typescript/openapi.json",
        help="Path to write the exported OpenAPI JSON.",
    )
    args = parser.parse_args()
    export_openapi_document(Path(args.out))


if __name__ == "__main__":
    main()
