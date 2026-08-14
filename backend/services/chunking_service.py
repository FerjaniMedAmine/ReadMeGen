"""
Service de chunking multi-langage basé sur tree-sitter.

Découpe chaque fichier en unités sémantiques (fonction/classe/méthode)
via tree-sitter quand le langage est supporté, avec un fallback par
mots (avec overlap) pour les langages non supportés, les échecs de
parsing, ou les blocs sémantiques trop volumineux.
"""

import uuid
from pathlib import Path

from tree_sitter_language_pack import get_parser

from core.config import CHUNK_MAX_TOKENS, CHUNK_OVERLAP_TOKENS, EXTENSION_TO_LANGUAGE, TOKENS_PER_WORD

# Types de nœuds tree-sitter considérés comme des unités sémantiques.
# Le naming des grammaires est assez cohérent entre langages pour que
# ces mots-clés couvrent la majorité des cas (fonction, méthode, classe...).
SEMANTIC_NODE_KEYWORDS = ("function", "method", "class", "struct", "interface", "impl", "enum")


def _estimate_tokens(text: str) -> int:
    return int(len(text.split()) * TOKENS_PER_WORD)


def _make_chunk(text: str, file_path: str) -> dict:
    return {"id": str(uuid.uuid4()), "text": text, "file_path": file_path}


def chunk_by_words(content: str, file_path: str) -> list[dict]:
    """Découpage générique par mots avec overlap (fallback universel)."""
    words = content.split()
    if not words:
        return []

    max_words = max(int(CHUNK_MAX_TOKENS / TOKENS_PER_WORD), 1)
    overlap_words = int(CHUNK_OVERLAP_TOKENS / TOKENS_PER_WORD)
    step = max(max_words - overlap_words, 1)

    chunks = []
    for i in range(0, len(words), step):
        piece = " ".join(words[i : i + max_words])
        if piece.strip():
            chunks.append(_make_chunk(piece, file_path))
        if i + max_words >= len(words):
            break
    return chunks


def _is_semantic_node(node_type: str) -> bool:
    return any(keyword in node_type for keyword in SEMANTIC_NODE_KEYWORDS)


def chunk_with_tree_sitter(content: str, file_path: str, language: str) -> list[dict]:
    try:
        parser = get_parser(language)
        tree = parser.parse(bytes(content, "utf8"))
    except Exception:
        return chunk_by_words(content, file_path)

    source_bytes = bytes(content, "utf8")
    chunks: list[dict] = []

    def walk(node) -> None:
        if _is_semantic_node(node.type):
            snippet = source_bytes[node.start_byte : node.end_byte].decode("utf8", errors="ignore")
            if snippet.strip():
                if _estimate_tokens(snippet) > CHUNK_MAX_TOKENS:
                    chunks.extend(chunk_by_words(snippet, file_path))
                else:
                    chunks.append(_make_chunk(snippet, file_path))
            return  # on ne descend pas dans les enfants d'une unité déjà découpée
        for child in node.children:
            walk(child)

    walk(tree.root_node)
    return chunks or chunk_by_words(content, file_path)


def chunk_file(content: str, file_path: str) -> list[dict]:
    """Point d'entrée : choisit la stratégie selon l'extension du fichier."""
    language = EXTENSION_TO_LANGUAGE.get(Path(file_path).suffix.lower())
    if language is None:
        return chunk_by_words(content, file_path)
    return chunk_with_tree_sitter(content, file_path, language)