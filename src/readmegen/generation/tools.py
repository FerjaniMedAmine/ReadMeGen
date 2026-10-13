"""File tools scoped to a specialist's coordinator-assigned paths."""

from collections.abc import Callable
from pathlib import Path

from langchain_core.tools import tool

from readmegen.generation.limits import MAX_FILE_READ_CHARS, MAX_FILE_SIZE_BYTES


def build_file_tools(
    source_dir: Path, assigned_paths: list[str], on_read: Callable[[str], None] | None = None
) -> list:
    allowed = set(assigned_paths)
    root = source_dir.resolve()

    @tool
    def read_file(relative_path: str, start_line: int = 1) -> str:
        """Read an assigned file from start_line with line numbers. Continue at the next line if truncated."""
        if relative_path not in allowed:
            return "File is not assigned to this agent."
        if start_line < 1:
            return "start_line must be at least 1."
        target = (root / relative_path).resolve()
        if root not in target.parents or not target.is_file():
            return "File is unavailable or outside the project."
        try:
            with target.open("rb") as stream:
                raw = stream.read(MAX_FILE_SIZE_BYTES + 1)
            if len(raw) > MAX_FILE_SIZE_BYTES or b"\0" in raw:
                return "File is binary or exceeds the source-file size limit."
            content = raw.decode("utf-8")
        except (UnicodeDecodeError, OSError):
            return "Could not read file as UTF-8 text."
        lines = content.splitlines()
        selected = []
        length = 0
        next_line = start_line
        for number in range(start_line, len(lines) + 1):
            line = f"{number}: {lines[number - 1]}"
            if selected and length + len(line) > MAX_FILE_READ_CHARS:
                break
            selected.append(line[:MAX_FILE_READ_CHARS])
            if len(line) > MAX_FILE_READ_CHARS:
                selected.append("[This line was truncated; its remaining content was omitted.]")
            length += len(line) + 1
            next_line = number + 1
        if selected and on_read:
            on_read(relative_path)
        continuation = (
            f"\n[Continue with start_line={next_line}]" if next_line <= len(lines) else ""
        )
        return "\n".join(selected) + continuation

    return [read_file]
