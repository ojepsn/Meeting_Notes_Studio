"""Observability adapters. Start with null; upgrade to langfuse/otel when needed."""

from .null_adapter import NullObservability

__all__ = ["NullObservability"]
