from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models

from core.config import DENSE_VECTOR_NAME, QDRANT_COLLECTION_NAME, QDRANT_URL, SPARSE_VECTOR_NAME

client = AsyncQdrantClient(url=QDRANT_URL)

COLLECTION_NAME = QDRANT_COLLECTION_NAME


async def insert_chunks(project_id: str, chunks: list[dict]):
    """
    Insère les chunks d'un projet dans Qdrant.

    chunks : liste de dicts avec au minimum
        {"text": str, "dense_vector": list[float], "sparse_vector": dict, "file_path": str}
    """
    points = [
        models.PointStruct(
            id=chunk["id"],
            vector={
                DENSE_VECTOR_NAME: chunk["dense_vector"],
                SPARSE_VECTOR_NAME: models.SparseVector(
                    indices=chunk["sparse_vector"]["indices"],
                    values=chunk["sparse_vector"]["values"],
                ),
            },
            payload={
                "project_id": project_id,
                "file_path": chunk["file_path"],
                "text": chunk["text"],
            },
        )
        for chunk in chunks
    ]

    await client.upsert(collection_name=COLLECTION_NAME, points=points)


async def search_chunks(project_id: str, dense_query: list[float], sparse_query: dict, limit: int = 10):
    """
    Recherche hybride (dense + sparse) limitée aux chunks d'un seul projet.
    """
    results = await client.query_points(
        collection_name=COLLECTION_NAME,
        prefetch=[
            models.Prefetch(query=dense_query, using=DENSE_VECTOR_NAME, limit=limit * 2),
            models.Prefetch(
                query=models.SparseVector(
                    indices=sparse_query["indices"], values=sparse_query["values"]
                ),
                using=SPARSE_VECTOR_NAME,
                limit=limit * 2,
            ),
        ],
        query=models.FusionQuery(fusion=models.Fusion.RRF),
        query_filter=models.Filter(
            must=[models.FieldCondition(key="project_id", match=models.MatchValue(value=project_id))]
        ),
        limit=limit,
    )
    return results.points