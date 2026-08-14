"""
Orchestre le pipeline complet d'indexation d'un projet :
lecture des fichiers filtrés -> chunking -> embeddings -> insertion Qdrant.
"""

from services.chunking_service import chunk_file
from services.embedding_service import get_dense_embeddings_batch, get_sparse_embeddings_batch
from services.filter_service import FilteredFile
from services.qdrant_service import insert_chunks


def _read_file_content(file: FilteredFile) -> str | None:
    """Lit un fichier en UTF-8. Retourne None si le fichier n'est pas du texte lisible."""
    try:
        return file.path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


async def index_project(project_id: str, files: list[FilteredFile]) -> int:
    """
    Chunke, embed et insère tous les fichiers d'un projet dans Qdrant.
    Retourne le nombre de chunks insérés.
    """
    all_chunks: list[dict] = []

    for file in files:
        content = _read_file_content(file)
        if content is None or not content.strip():
            continue
        all_chunks.extend(chunk_file(content, file.relative_path))

    if not all_chunks:
        return 0

    texts = [chunk["text"] for chunk in all_chunks]
    dense_vectors = await get_dense_embeddings_batch(texts)
    sparse_vectors = get_sparse_embeddings_batch(texts)

    for chunk, dense, sparse in zip(all_chunks, dense_vectors, sparse_vectors):
        chunk["dense_vector"] = dense
        chunk["sparse_vector"] = sparse

    insert_chunks(project_id, all_chunks)
    return len(all_chunks)