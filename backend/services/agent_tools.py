"""File tools scoped to a specialist's coordinator-assigned paths."""

from pathlib import Path

from langchain_core.tools import tool

from core.config import MAX_FILE_READ_CHARS


def build_file_tools(source_dir: Path, assigned_paths: list[str]) -> list:
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
            content = target.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError) as error:
            return f"Could not read file: {error}"
        lines = content.splitlines()
        selected = []
        length = 0
        for number in range(start_line, len(lines) + 1):
            line = f"{number}: {lines[number - 1]}"
            if selected and length + len(line) > MAX_FILE_READ_CHARS:
                break
            selected.append(line)
            length += len(line) + 1
        next_line = start_line + len(selected)
        continuation = f"\n[Continue with start_line={next_line}]" if next_line <= len(lines) else ""
        return "\n".join(selected) + continuation

    return [read_file]
