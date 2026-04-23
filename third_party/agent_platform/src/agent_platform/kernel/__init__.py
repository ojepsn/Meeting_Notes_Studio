"""agent_platform.kernel — the reusable core.

Must not import from agent_platform.adapters or agent_platform.apps.
Must not import FastAPI, SQLAlchemy models, LangGraph, or any provider SDK.

Import only: stdlib, pydantic, structlog, typing_extensions.
"""
