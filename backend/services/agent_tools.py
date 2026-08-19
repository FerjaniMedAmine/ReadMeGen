"""
Outils utilisés par les agents LangGraph : lecture de fichier, arborescence
du projet, recherche hybride dans Qdrant. Créés via des factories pour
capturer le project_id / chemin source propres à chaque exécution.
"""

from pathlib import Path

from langchain_core.tools import tool

from core.config import MAX_FILE_READ_CHARS
from services.qdrant_service import search_chunks


def build_file_tools(source_dir: Path) -> list:
    @tool
    def read_file(relative_path: str) -> str:
        """Lit le contenu d'un fichier du projet à partir de son chemin relatif (ex: 'src/main.py')."""
        target = (source_dir / relative_path).resolve()
        if source_dir.resolve() not in target.parents:
            return "Erreur : chemin en dehors du projet."
        try:
            return target.read_text(encoding="utf-8")[:MAX_FILE_READ_CHARS]
        except (UnicodeDecodeError, OSError) as error:
            return f"Erreur de lecture : {error}"

    @tool
    def get_project_tree() -> str:
        """Retourne l'arborescence complète du projet (dossiers et fichiers)."""
        lines = [
            str(path.relative_to(source_dir))
            for path in sorted(source_dir.rglob("*"))
        ]
        return "\n".join(lines)

    return [read_file, get_project_tree]


def build_qdrant_tool(project_id: str):
    @tool
    async def search_codebase(query: str) -> str:
        """Recherche hybride (dense+sparse) dans le code indexé. Utilise des mots-clés précis (ex: nom de framework, pattern d'accès DB)."""
        results = await search_chunks(project_id, query, limit=5)
        return "\n---\n".join(r.page_content for r in results) or "Aucun résultat."

    return search_codebase