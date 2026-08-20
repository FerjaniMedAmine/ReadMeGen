"""
Objets d'embedding utilisés par le vector store LangChain/Qdrant.

- Dense : via le conteneur TEI (bge-small-en-v1.5). TEI expose une API
  compatible OpenAI, donc on utilise OpenAIEmbeddings pointé dessus
  (aucune donnée ne part vers OpenAI, tout reste sur le conteneur local).
- Sparse : BM25 (comptage de termes brut) via fastembed — l'IDF est
  ensuite appliqué côté Qdrant grâce au modifier "idf" de la collection.
"""

from langchain_openai import OpenAIEmbeddings
from langchain_qdrant import FastEmbedSparse

from core.config import SPARSE_MODEL_NAME, TEI_URL

dense_embeddings = OpenAIEmbeddings(
    model="bge-small-en-v1.5",
    base_url=TEI_URL,
    api_key="not-needed-for-self-hosted-tei",
    check_embedding_ctx_length=False,
    chunk_size=32,  # doit correspondre à la limite de batch de ton conteneur TEI
)

sparse_embeddings = FastEmbedSparse(model_name=SPARSE_MODEL_NAME)