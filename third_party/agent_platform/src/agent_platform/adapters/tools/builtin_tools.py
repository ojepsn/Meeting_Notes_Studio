"""Generic built-in tool adapters.

These tools are in-process `ToolPort` implementations that validate the tool
pipeline without tying the core to any app-specific behavior.
"""

from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone, tzinfo
from html import unescape
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
import structlog

from agent_platform.kernel.domain import RiskLevel
from agent_platform.kernel.ports import ToolDescriptor, ToolPort, ToolResult
from agent_platform.kernel.ports.llm import ToolSchema

from .http_url_safety import (
    UnsafeUrlError,
    safe_redirect_url,
    validate_http_fetch_url_resolved,
)

log = structlog.get_logger(__name__)

_REDIRECT_STATUS = frozenset({301, 302, 303, 307, 308})
_MAX_REGEX_PATTERN_CHARS = 512


class _SafeFilesystemTool:
    def __init__(self, *, root: Path) -> None:
        self._root = root.resolve()

    def _resolve_path(self, raw_path: str | None) -> Path:
        candidate = (self._root / (raw_path or ".")).resolve()
        try:
            candidate.relative_to(self._root)
        except ValueError as exc:
            raise ValueError(
                f"path '{raw_path or '.'}' escapes configured fs_root"
            ) from exc
        return candidate


class ListDirectoryTool(_SafeFilesystemTool, ToolPort):
    def __init__(self, *, root: Path) -> None:
        super().__init__(root=root)
        self.descriptor = ToolDescriptor(
            name="list_directory",
            description="List files and directories within the configured safe root.",
            tool_schema=ToolSchema(
                name="list_directory",
                description="List directory contents within the safe filesystem root.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative path to list."},
                    },
                    "additionalProperties": False,
                },
            ),
            risk_level=RiskLevel.LOW,
            source="builtin:list_directory",
        )

    async def invoke(self, tool_use_id: str, arguments: dict[str, Any]) -> ToolResult:
        started = time.monotonic()
        try:
            target = self._resolve_path(arguments.get("path"))
            if not target.exists():
                raise FileNotFoundError(f"{target} does not exist")
            if not target.is_dir():
                raise NotADirectoryError(f"{target} is not a directory")

            entries = []
            for child in sorted(target.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower())):
                rel_path = child.relative_to(self._root).as_posix()
                entries.append(
                    {
                        "path": rel_path,
                        "name": child.name,
                        "is_dir": child.is_dir(),
                        "size_bytes": child.stat().st_size if child.is_file() else None,
                    }
                )

            content = json.dumps(
                {
                    "root": self._root.as_posix(),
                    "path": target.relative_to(self._root).as_posix() if target != self._root else ".",
                    "entries": entries,
                },
                ensure_ascii=True,
            )
            return ToolResult(
                tool_use_id=tool_use_id,
                content=content,
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        except Exception as exc:  # noqa: BLE001
            return _error_result(tool_use_id, started, exc)


class ReadFileTool(_SafeFilesystemTool, ToolPort):
    def __init__(self, *, root: Path) -> None:
        super().__init__(root=root)
        self.descriptor = ToolDescriptor(
            name="read_file",
            description="Read a UTF-8 text file within the configured safe root.",
            tool_schema=ToolSchema(
                name="read_file",
                description="Read a text file from the safe filesystem root.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative file path."},
                        "max_chars": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 200000,
                            "default": 20000,
                        },
                    },
                    "required": ["path"],
                    "additionalProperties": False,
                },
            ),
            risk_level=RiskLevel.LOW,
            source="builtin:read_file",
        )

    async def invoke(self, tool_use_id: str, arguments: dict[str, Any]) -> ToolResult:
        started = time.monotonic()
        try:
            target = self._resolve_path(_require_str(arguments, "path"))
            if not target.exists():
                raise FileNotFoundError(f"{target} does not exist")
            if not target.is_file():
                raise IsADirectoryError(f"{target} is not a file")

            max_chars = _bounded_int(arguments.get("max_chars"), default=20000, max_value=200000)
            content = target.read_text(encoding="utf-8")
            truncated = len(content) > max_chars
            payload = {
                "path": target.relative_to(self._root).as_posix(),
                "content": content[:max_chars],
                "truncated": truncated,
                "total_chars": len(content),
            }
            return ToolResult(
                tool_use_id=tool_use_id,
                content=json.dumps(payload, ensure_ascii=True),
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        except Exception as exc:  # noqa: BLE001
            return _error_result(tool_use_id, started, exc)


class WriteFileTool(_SafeFilesystemTool, ToolPort):
    def __init__(self, *, root: Path) -> None:
        super().__init__(root=root)
        self.descriptor = ToolDescriptor(
            name="write_file",
            description="Write UTF-8 text to a file within the configured safe root.",
            tool_schema=ToolSchema(
                name="write_file",
                description="Write or append text to a file inside the safe filesystem root.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative file path."},
                        "content": {"type": "string", "description": "Text to write."},
                        "append": {"type": "boolean", "default": False},
                        "create_parents": {"type": "boolean", "default": True},
                    },
                    "required": ["path", "content"],
                    "additionalProperties": False,
                },
            ),
            risk_level=RiskLevel.MEDIUM,
            source="builtin:write_file",
        )

    async def invoke(self, tool_use_id: str, arguments: dict[str, Any]) -> ToolResult:
        started = time.monotonic()
        try:
            target = self._resolve_path(_require_str(arguments, "path"))
            content = _require_str(arguments, "content")
            append = bool(arguments.get("append", False))
            create_parents = bool(arguments.get("create_parents", True))

            if create_parents:
                target.parent.mkdir(parents=True, exist_ok=True)
            elif not target.parent.exists():
                raise FileNotFoundError(f"parent directory for {target} does not exist")

            existing_chars = 0
            if target.exists():
                existing_chars = target.stat().st_size
            mode = "a" if append else "w"
            with target.open(mode, encoding="utf-8") as handle:
                handle.write(content)

            payload = {
                "path": target.relative_to(self._root).as_posix(),
                "append": append,
                "bytes_written": len(content.encode("utf-8")),
                "previous_size_bytes": existing_chars,
            }
            return ToolResult(
                tool_use_id=tool_use_id,
                content=json.dumps(payload, ensure_ascii=True),
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        except Exception as exc:  # noqa: BLE001
            return _error_result(tool_use_id, started, exc)


class GlobFilesTool(_SafeFilesystemTool, ToolPort):
    """List files (and optionally directories) under a path matching a glob pattern."""

    def __init__(self, *, root: Path) -> None:
        super().__init__(root=root)
        self.descriptor = ToolDescriptor(
            name="glob_files",
            description=(
                "Find paths under a directory within the safe root using a pathlib glob "
                "pattern (e.g. '*.md', '**/*.py')."
            ),
            tool_schema=ToolSchema(
                name="glob_files",
                description="Glob for files under a directory inside the safe filesystem root.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Relative directory to search (default: '.').",
                        },
                        "pattern": {
                            "type": "string",
                            "description": "Glob pattern relative to path (default: '*').",
                            "default": "*",
                        },
                        "max_matches": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 2000,
                            "default": 200,
                        },
                        "include_directories": {
                            "type": "boolean",
                            "description": "Include directory paths in results.",
                            "default": False,
                        },
                    },
                    "additionalProperties": False,
                },
            ),
            risk_level=RiskLevel.LOW,
            source="builtin:glob_files",
        )

    async def invoke(self, tool_use_id: str, arguments: dict[str, Any]) -> ToolResult:
        started = time.monotonic()
        try:
            rel_dir = _optional_rel_path(arguments.get("path"))
            pattern = _glob_pattern_argument(arguments.get("pattern"))
            max_matches = _bounded_int(arguments.get("max_matches"), default=200, max_value=2000)
            include_directories = bool(arguments.get("include_directories", False))

            base = self._resolve_path(rel_dir)
            if not base.exists():
                raise FileNotFoundError(f"{base} does not exist")
            if not base.is_dir():
                raise NotADirectoryError(f"{base} is not a directory")

            matches: list[dict[str, Any]] = []
            for candidate in sorted(base.glob(pattern), key=lambda p: str(p).lower()):
                if len(matches) >= max_matches:
                    break
                resolved = candidate.resolve()
                try:
                    resolved.relative_to(self._root)
                except ValueError as exc:
                    raise ValueError("matched path escapes configured fs_root") from exc
                if candidate.is_dir() and not include_directories:
                    continue
                rel = resolved.relative_to(self._root).as_posix()
                matches.append(
                    {
                        "path": rel,
                        "is_dir": candidate.is_dir(),
                        "is_file": candidate.is_file(),
                    }
                )

            payload = {
                "root": self._root.as_posix(),
                "search_path": base.relative_to(self._root).as_posix() if base != self._root else ".",
                "pattern": pattern,
                "truncated": len(matches) >= max_matches,
                "matches": matches,
            }
            return ToolResult(
                tool_use_id=tool_use_id,
                content=json.dumps(payload, ensure_ascii=True),
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        except Exception as exc:  # noqa: BLE001
            return _error_result(tool_use_id, started, exc)


class FileStatTool(_SafeFilesystemTool, ToolPort):
    """Return file or directory metadata within the safe root."""

    def __init__(self, *, root: Path) -> None:
        super().__init__(root=root)
        self.descriptor = ToolDescriptor(
            name="file_stat",
            description="Get size and timestamps for a path within the configured safe root.",
            tool_schema=ToolSchema(
                name="file_stat",
                description="Stat a file or directory inside the safe filesystem root.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Relative path to the file or directory.",
                        },
                    },
                    "required": ["path"],
                    "additionalProperties": False,
                },
            ),
            risk_level=RiskLevel.LOW,
            source="builtin:file_stat",
        )

    async def invoke(self, tool_use_id: str, arguments: dict[str, Any]) -> ToolResult:
        started = time.monotonic()
        try:
            target = self._resolve_path(_require_str(arguments, "path"))
            if not target.exists():
                raise FileNotFoundError(f"{target} does not exist")
            st = target.stat()
            modified = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat()
            payload = {
                "path": target.relative_to(self._root).as_posix(),
                "is_file": target.is_file(),
                "is_dir": target.is_dir(),
                "size_bytes": st.st_size if target.is_file() else None,
                "modified_utc": modified,
            }
            return ToolResult(
                tool_use_id=tool_use_id,
                content=json.dumps(payload, ensure_ascii=True),
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        except Exception as exc:  # noqa: BLE001
            return _error_result(tool_use_id, started, exc)


class SearchInFilesTool(_SafeFilesystemTool, ToolPort):
    """Search for a substring or regex in UTF-8 text files under a directory."""

    def __init__(self, *, root: Path) -> None:
        super().__init__(root=root)
        self.descriptor = ToolDescriptor(
            name="search_in_files",
            description=(
                "Search text files under a directory for a literal substring or regex. "
                "Bounded by file count, bytes per file, and hit count."
            ),
            tool_schema=ToolSchema(
                name="search_in_files",
                description="Search inside UTF-8 text files under the safe filesystem root.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Relative directory to search (default: '.').",
                        },
                        "substring": {
                            "type": "string",
                            "description": "Literal text to find (use this or regex, not both).",
                        },
                        "regex": {
                            "type": "string",
                            "description": "Regex pattern matched per line (use this or substring).",
                        },
                        "ignore_case": {
                            "type": "boolean",
                            "default": False,
                        },
                        "max_files": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 500,
                            "default": 50,
                        },
                        "max_file_bytes": {
                            "type": "integer",
                            "minimum": 1024,
                            "maximum": 2_000_000,
                            "default": 500_000,
                        },
                        "max_hits": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 5000,
                            "default": 200,
                        },
                        "max_line_length": {
                            "type": "integer",
                            "minimum": 80,
                            "maximum": 8000,
                            "default": 2000,
                        },
                    },
                    "additionalProperties": False,
                },
            ),
            risk_level=RiskLevel.MEDIUM,
            source="builtin:search_in_files",
        )

    async def invoke(self, tool_use_id: str, arguments: dict[str, Any]) -> ToolResult:
        started = time.monotonic()
        try:
            root_dir = self._resolve_path(_optional_rel_path(arguments.get("path")))
            if not root_dir.is_dir():
                raise NotADirectoryError(f"{root_dir} is not a directory")

            substring = arguments.get("substring")
            regex_raw = arguments.get("regex")
            if (substring is None or substring == "") and (regex_raw is None or regex_raw == ""):
                raise ValueError("provide either 'substring' or 'regex'")
            if substring not in (None, "") and regex_raw not in (None, ""):
                raise ValueError("provide only one of 'substring' or 'regex'")

            ignore_case = bool(arguments.get("ignore_case", False))
            max_files = _bounded_int(arguments.get("max_files"), default=50, max_value=500)
            max_file_bytes = max(
                1024,
                _bounded_int(
                    arguments.get("max_file_bytes"), default=500_000, max_value=2_000_000
                ),
            )
            max_hits = _bounded_int(arguments.get("max_hits"), default=200, max_value=5000)
            max_line_length = max(
                80,
                _bounded_int(arguments.get("max_line_length"), default=2000, max_value=8000),
            )

            compiled: re.Pattern[str] | None = None
            needle: str | None = None
            if regex_raw not in (None, ""):
                if not isinstance(regex_raw, str):
                    raise ValueError("regex must be a string")
                if len(regex_raw) > _MAX_REGEX_PATTERN_CHARS:
                    raise ValueError(
                        f"regex must be at most {_MAX_REGEX_PATTERN_CHARS} characters"
                    )
                flags = re.IGNORECASE if ignore_case else 0
                compiled = re.compile(regex_raw, flags)
            else:
                if not isinstance(substring, str) or not substring:
                    raise ValueError("substring must be a non-empty string")
                needle = substring if not ignore_case else substring.lower()

            hits: list[dict[str, Any]] = []
            files_scanned = 0
            truncated_files = False

            for path in sorted(root_dir.rglob("*"), key=lambda p: str(p).lower()):
                if len(hits) >= max_hits:
                    break
                if not path.is_file():
                    continue
                resolved = path.resolve()
                try:
                    resolved.relative_to(self._root)
                except ValueError as exc:
                    raise ValueError("matched path escapes configured fs_root") from exc
                if files_scanned >= max_files:
                    truncated_files = True
                    break

                raw = path.read_bytes()[:max_file_bytes]
                try:
                    text = raw.decode("utf-8")
                except UnicodeDecodeError:
                    continue

                files_scanned += 1
                rel = resolved.relative_to(self._root).as_posix()
                for line_no, line in enumerate(text.splitlines(), start=1):
                    if len(hits) >= max_hits:
                        break
                    display = line
                    if len(display) > max_line_length:
                        display = display[:max_line_length] + "…"
                    if compiled is not None:
                        if compiled.search(line) is None:
                            continue
                    else:
                        hay = line if not ignore_case else line.lower()
                        assert needle is not None
                        if needle not in hay:
                            continue
                    hits.append({"path": rel, "line": line_no, "text": display})

            payload = {
                "root": self._root.as_posix(),
                "search_path": root_dir.relative_to(self._root).as_posix()
                if root_dir != self._root
                else ".",
                "files_scanned": files_scanned,
                "truncated_files": truncated_files,
                "truncated_hits": len(hits) >= max_hits,
                "hits": hits,
            }
            return ToolResult(
                tool_use_id=tool_use_id,
                content=json.dumps(payload, ensure_ascii=True),
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        except Exception as exc:  # noqa: BLE001
            return _error_result(tool_use_id, started, exc)


class NowUtcTool(ToolPort):
    """Current time in ISO-8601 for a named IANA timezone (default UTC)."""

    def __init__(self) -> None:
        self.descriptor = ToolDescriptor(
            name="now_utc",
            description="Return the current date and time as ISO-8601 in a given IANA timezone.",
            tool_schema=ToolSchema(
                name="now_utc",
                description="Current time (ISO-8601). Default timezone is UTC.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "timezone": {
                            "type": "string",
                            "description": "IANA timezone name, e.g. UTC or Europe/Stockholm.",
                            "default": "UTC",
                        },
                    },
                    "additionalProperties": False,
                },
            ),
            risk_level=RiskLevel.LOW,
            source="builtin:now_utc",
        )

    async def invoke(self, tool_use_id: str, arguments: dict[str, Any]) -> ToolResult:
        started = time.monotonic()
        try:
            tz_name = arguments.get("timezone", "UTC")
            if not isinstance(tz_name, str) or not tz_name.strip():
                raise ValueError("argument 'timezone' must be a non-empty string")
            key = tz_name.strip()
            if key.upper() == "UTC" or key.upper() == "GMT":
                tz: tzinfo = timezone.utc
            else:
                try:
                    tz = ZoneInfo(key)
                except ZoneInfoNotFoundError as exc:
                    raise ValueError(f"unknown timezone: {tz_name!r}") from exc
            now = datetime.now(tz)
            payload = {
                "timezone": tz_name.strip(),
                "iso": now.isoformat(),
            }
            return ToolResult(
                tool_use_id=tool_use_id,
                content=json.dumps(payload, ensure_ascii=True),
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        except Exception as exc:  # noqa: BLE001
            return _error_result(tool_use_id, started, exc)


class ParseJsonTool(_SafeFilesystemTool, ToolPort):
    """Parse JSON from a string or from a file under the safe root."""

    def __init__(self, *, root: Path) -> None:
        super().__init__(root=root)
        self.descriptor = ToolDescriptor(
            name="parse_json",
            description="Parse JSON from inline text or a file path and return formatted JSON.",
            tool_schema=ToolSchema(
                name="parse_json",
                description="Validate JSON and return a pretty-printed string.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "json_string": {
                            "type": "string",
                            "description": "Raw JSON text (use this or path).",
                        },
                        "path": {
                            "type": "string",
                            "description": "Relative path to a UTF-8 JSON file (use this or json_string).",
                        },
                        "indent": {
                            "type": "integer",
                            "minimum": 0,
                            "maximum": 16,
                            "default": 2,
                        },
                        "sort_keys": {
                            "type": "boolean",
                            "default": False,
                        },
                        "max_chars": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 500_000,
                            "default": 200_000,
                        },
                    },
                    "additionalProperties": False,
                },
            ),
            risk_level=RiskLevel.LOW,
            source="builtin:parse_json",
        )

    async def invoke(self, tool_use_id: str, arguments: dict[str, Any]) -> ToolResult:
        started = time.monotonic()
        try:
            raw_json = arguments.get("json_string")
            rel_path = arguments.get("path")
            if (raw_json is None or raw_json == "") and (rel_path is None or rel_path == ""):
                raise ValueError("provide either 'json_string' or 'path'")
            if raw_json not in (None, "") and rel_path not in (None, ""):
                raise ValueError("provide only one of 'json_string' or 'path'")

            indent = int(arguments.get("indent", 2))
            if indent < 0 or indent > 16:
                raise ValueError("indent must be between 0 and 16")
            sort_keys = bool(arguments.get("sort_keys", False))
            max_chars = _bounded_int(arguments.get("max_chars"), default=200_000, max_value=500_000)

            if rel_path not in (None, ""):
                target = self._resolve_path(_require_str(arguments, "path"))
                if not target.is_file():
                    raise IsADirectoryError(f"{target} is not a file")
                raw = target.read_text(encoding="utf-8")[:max_chars]
            else:
                if not isinstance(raw_json, str):
                    raise ValueError("json_string must be a string")
                raw = raw_json[:max_chars]

            parsed: Any = json.loads(raw)
            pretty = json.dumps(parsed, indent=indent if indent else None, ensure_ascii=True, sort_keys=sort_keys)
            top = type(parsed).__name__
            payload = {
                "ok": True,
                "top_level_type": top,
                "pretty": pretty,
                "truncated_input": len(raw) >= max_chars,
            }
            return ToolResult(
                tool_use_id=tool_use_id,
                content=json.dumps(payload, ensure_ascii=True),
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        except Exception as exc:  # noqa: BLE001
            return _error_result(tool_use_id, started, exc)


class WebFetchTool(ToolPort):
    def __init__(
        self,
        *,
        timeout_seconds: float,
        user_agent: str,
        block_private_networks: bool = True,
        host_allowlist: list[str] | None = None,
        max_redirects: int = 8,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._block_private_networks = block_private_networks
        self._host_allowlist = list(host_allowlist or [])
        self._max_redirects = max(1, min(max_redirects, 20))
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            timeout=timeout_seconds,
            follow_redirects=False,
            headers={"User-Agent": user_agent},
        )
        self.descriptor = ToolDescriptor(
            name="web_fetch",
            description="Fetch and lightly clean a public web page or text resource.",
            tool_schema=ToolSchema(
                name="web_fetch",
                description="Fetch a public web resource over HTTP(S).",
                input_schema={
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "HTTP or HTTPS URL."},
                        "max_chars": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 200000,
                            "default": 20000,
                        },
                    },
                    "required": ["url"],
                    "additionalProperties": False,
                },
            ),
            risk_level=RiskLevel.MEDIUM,
            source="builtin:web_fetch",
        )

    async def invoke(self, tool_use_id: str, arguments: dict[str, Any]) -> ToolResult:
        started = time.monotonic()
        try:
            url = _require_url(arguments, "url")
            max_chars = _bounded_int(arguments.get("max_chars"), default=20000, max_value=200000)
            current = url
            response: httpx.Response | None = None
            for hop in range(self._max_redirects + 1):
                await validate_http_fetch_url_resolved(
                    current,
                    block_private_networks=self._block_private_networks,
                    host_allowlist=self._host_allowlist,
                )
                response = await self._client.get(current)
                if response.status_code in _REDIRECT_STATUS:
                    if hop >= self._max_redirects:
                        raise ValueError("too many HTTP redirects")
                    loc = response.headers.get("location")
                    current = safe_redirect_url(str(response.url), loc)
                    continue
                response.raise_for_status()
                break
            if response is None:
                raise RuntimeError("no HTTP response from web_fetch")

            body = response.text
            content_type = response.headers.get("content-type", "")
            if "html" in content_type:
                body = _html_to_text(body)

            payload = {
                "url": str(response.url),
                "status_code": response.status_code,
                "content_type": content_type,
                "content": body[:max_chars],
                "truncated": len(body) > max_chars,
            }
            return ToolResult(
                tool_use_id=tool_use_id,
                content=json.dumps(payload, ensure_ascii=True),
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        except (UnsafeUrlError, ValueError) as exc:
            return _error_result(tool_use_id, started, exc)
        except Exception as exc:  # noqa: BLE001
            return _error_result(tool_use_id, started, exc)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()


class WebSearchTool(ToolPort):
    """Lightweight public web search using DuckDuckGo's instant answer endpoint."""

    def __init__(
        self,
        *,
        timeout_seconds: float,
        user_agent: str,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            timeout=timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": user_agent},
        )
        self.descriptor = ToolDescriptor(
            name="web_search",
            description="Search the public web and return lightweight result summaries.",
            tool_schema=ToolSchema(
                name="web_search",
                description="Run a lightweight public web search.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query."},
                        "max_results": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 20,
                            "default": 5,
                        },
                    },
                    "required": ["query"],
                    "additionalProperties": False,
                },
            ),
            risk_level=RiskLevel.MEDIUM,
            source="builtin:web_search",
        )

    async def invoke(self, tool_use_id: str, arguments: dict[str, Any]) -> ToolResult:
        started = time.monotonic()
        try:
            query = _require_str(arguments, "query")
            max_results = _bounded_int(arguments.get("max_results"), default=5, max_value=20)
            response = await self._client.get(
                "https://api.duckduckgo.com/",
                params={
                    "q": query,
                    "format": "json",
                    "no_html": "1",
                    "skip_disambig": "1",
                },
            )
            response.raise_for_status()
            payload = response.json()
            results = _normalise_search_results(payload, max_results=max_results)
            return ToolResult(
                tool_use_id=tool_use_id,
                content=json.dumps({"query": query, "results": results}, ensure_ascii=True),
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        except Exception as exc:  # noqa: BLE001
            return _error_result(tool_use_id, started, exc)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()


def _optional_rel_path(value: Any, *, default: str = ".") -> str:
    if value is None:
        return default
    if not isinstance(value, str):
        raise ValueError("path must be a string when provided")
    stripped = value.strip()
    return stripped if stripped else default


def _glob_pattern_argument(value: Any, *, default: str = "*") -> str:
    if value is None:
        return _validate_glob_pattern(default)
    if not isinstance(value, str) or not value.strip():
        raise ValueError("pattern must be a non-empty string")
    return _validate_glob_pattern(value.strip())


def _validate_glob_pattern(pattern: str) -> str:
    if ".." in pattern:
        raise ValueError("pattern must not contain '..'")
    return pattern


def _require_str(arguments: dict[str, Any], key: str) -> str:
    value = arguments.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"argument '{key}' must be a non-empty string")
    return value


def _require_url(arguments: dict[str, Any], key: str) -> str:
    value = _require_str(arguments, key)
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"argument '{key}' must be a valid HTTP(S) URL")
    return value


def _bounded_int(value: Any, *, default: int, max_value: int) -> int:
    if value is None:
        return default
    if not isinstance(value, int):
        raise ValueError("integer argument must be an integer")
    return max(1, min(value, max_value))


def _error_result(tool_use_id: str, started: float, exc: Exception) -> ToolResult:
    log.warning("builtin tool invocation failed", error=str(exc))
    return ToolResult(
        tool_use_id=tool_use_id,
        content=f"{type(exc).__name__}: {exc}",
        is_error=True,
        duration_ms=int((time.monotonic() - started) * 1000),
    )


def _html_to_text(raw_html: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", raw_html)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p>", "\n\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _normalise_search_results(payload: dict[str, Any], *, max_results: int) -> list[dict[str, str]]:
    results: list[dict[str, str]] = []

    abstract = payload.get("AbstractText")
    abstract_url = payload.get("AbstractURL")
    heading = payload.get("Heading")
    if isinstance(abstract, str) and abstract.strip():
        results.append(
            {
                "title": heading or "Instant answer",
                "url": abstract_url or "",
                "snippet": abstract.strip(),
            }
        )

    for item in payload.get("RelatedTopics", []):
        if len(results) >= max_results:
            break
        if isinstance(item, dict) and "Topics" in item:
            for nested in item.get("Topics", []):
                _append_topic_result(results, nested)
                if len(results) >= max_results:
                    break
        else:
            _append_topic_result(results, item)

    return results[:max_results]


def _append_topic_result(results: list[dict[str, str]], item: Any) -> None:
    if not isinstance(item, dict):
        return
    text = item.get("Text")
    url = item.get("FirstURL")
    if not isinstance(text, str) or not text.strip():
        return
    title = text.split(" - ", 1)[0]
    results.append(
        {
            "title": title,
            "url": url if isinstance(url, str) else "",
            "snippet": text,
        }
    )
