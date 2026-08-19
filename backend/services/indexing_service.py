"""
Orchestre l'indexation : lecture des fichiers filtrés -> chunking -> insertion Qdrant.
"""

from services.chunking_service import chunk_file
from services.filter_service import FilteredFile
from services.qdrant_service import insert_chunks


def _read_file_content(file: FilteredFile) -> str | None:
    try:
        return file.path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


async def index_project(project_id: str, files: list[FilteredFile]) -> int:
    all_chunks: list[dict] = []

    for file in files:
        content = _read_file_content(file)
        if content is None or not content.strip():
            continue
        all_chunks.extend(chunk_file(content, file.relative_path))

    if not all_chunks:
        return 0

    await insert_chunks(project_id, all_chunks)
    return len(all_chunks)