"""
Objets d'embedding utilisés par le vector store LangChain/Qdrant.

- Dense : via le conteneur TEI (bge-small-en-v1.5), interrogé en HTTP.
- Sparse : BM25 (comptage de termes brut) via fastembed — l'IDF est
  ensuite appliqué côté Qdrant grâce au modifier "idf" de la collection.
"""

from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_qdrant import FastEmbedSparse

from core.config import SPARSE_MODEL_NAME, TEI_URL

dense_embeddings = HuggingFaceEndpointEmbeddings(
    model=TEI_URL,
    huggingfacehub_api_token="not-needed-for-self-hosted-tei",  # champ requis par le client, ignoré par TEI
)

sparse_embeddings = FastEmbedSparse(model_name=SPARSE_MODEL_NAME)