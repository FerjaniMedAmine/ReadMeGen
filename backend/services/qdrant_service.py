from langchain_core.documents import Document
from langchain_qdrant import QdrantVectorStore, RetrievalMode
from qdrant_client import AsyncQdrantClient, QdrantClient, models

from core.config import (
    DENSE_VECTOR_NAME,
    QDRANT_COLLECTION_NAME,
    QDRANT_URL,
    SPARSE_VECTOR_NAME,
)
from services.embedding_service import dense_embeddings, sparse_embeddings

_sync_client = QdrantClient(url=QDRANT_URL)
_async_client = AsyncQdrantClient(url=QDRANT_URL)

vector_store = QdrantVectorStore(
    client=_sync_client,
    async_client=_async_client,
    collection_name=QDRANT_COLLECTION_NAME,
    embedding=dense_embeddings,
    sparse_embedding=sparse_embeddings,
    retrieval_mode=RetrievalMode.HYBRID,
    vector_name=DENSE_VECTOR_NAME,
    sparse_vector_name=SPARSE_VECTOR_NAME,
)


async def insert_chunks(project_id: str, chunks: list[dict]) -> None:
    """
    Insère les chunks d'un projet. 
    """
    documents = [
        Document(
            page_content=chunk["text"],
            metadata={"project_id": project_id, "file_path": chunk["file_path"]},
        )
        for chunk in chunks
    ]
    ids = [chunk["id"] for chunk in chunks]
    await vector_store.aadd_documents(documents, ids=ids)


async def search_chunks(project_id: str, query: str, limit: int = 10):
    """
    Recherche hybride (dense + sparse, fusion RRF) limitée à un projet.
    """
    query_filter = models.Filter(
        must=[
            models.FieldCondition(
                key="metadata.project_id", match=models.MatchValue(value=project_id)
            )
        ]
    )
    return await vector_store.asimilarity_search(query, k=limit, filter=query_filter)
