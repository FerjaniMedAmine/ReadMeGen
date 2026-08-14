"""
Service d'embedding : dense (via TEI, bge-small-en-v1.5) et sparse
(BM25 via fastembed — le TF est calculé localement, l'IDF est ensuite
appliqué côté Qdrant grâce au modifier "idf" configuré sur la collection).
"""

import httpx
from fastembed import SparseTextEmbedding

from core.config import EMBEDDING_BATCH_SIZE, SPARSE_MODEL_NAME, TEI_URL

_sparse_model = SparseTextEmbedding(model_name=SPARSE_MODEL_NAME)


async def get_dense_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Interroge TEI par lots pour éviter de dépasser sa limite de batch."""
    embeddings: list[list[float]] = []
    async with httpx.AsyncClient(timeout=60) as client:
        for i in range(0, len(texts), EMBEDDING_BATCH_SIZE):
            batch = texts[i : i + EMBEDDING_BATCH_SIZE]
            response = await client.post(TEI_URL, json={"inputs": batch})
            response.raise_for_status()
            embeddings.extend(response.json())
    return embeddings


def get_sparse_embeddings_batch(texts: list[str]) -> list[dict]:
    results = _sparse_model.embed(texts)
    return [{"indices": r.indices.tolist(), "values": r.values.tolist()} for r in results]