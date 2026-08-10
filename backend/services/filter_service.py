"""
Service de filtrage des projets importés.

Parcourt le dossier `source/` d'un projet et retourne uniquement les
fichiers pertinents pour l'analyse (code, configuration), en excluant
les dossiers générés, les fichiers binaires et les fichiers trop volumineux.
"""

from dataclasses import dataclass
from pathlib import Path

from core.config import (
    EXCLUDE_DIRS,
    EXCLUDE_EXTENSIONS,
    KEEP_HIDDEN_FILES,
    MAX_FILE_SIZE_BYTES,
    MAX_TOTAL_FILES,
)


@dataclass(frozen=True)
class FilteredFile:
    path: Path            # chemin absolu sur disque
    relative_path: str    # chemin relatif au dossier source — c'est ce qu'on montre au LLM
    size_bytes: int


class ProjectTooLargeError(Exception):
    """Levée quand un projet dépasse MAX_TOTAL_FILES après filtrage."""


def _is_in_excluded_dir(relative_path: Path) -> bool:
    return any(part in EXCLUDE_DIRS for part in relative_path.parts)


def _is_excluded_file(path: Path) -> bool:
    if path.name.startswith(".") and path.name not in KEEP_HIDDEN_FILES:
        return True
    if path.suffix.lower() in EXCLUDE_EXTENSIONS:
        return True
    if path.name.lower().endswith((".min.js", ".min.css")):
        return True
    return False


def filter_project_files(source_dir: Path) -> list[FilteredFile]:
    """
    Retourne la liste des fichiers pertinents d'un projet.

    Lève FileNotFoundError si source_dir n'existe pas, et
    ProjectTooLargeError si le nombre de fichiers filtrés dépasse
    MAX_TOTAL_FILES (protection contre les repos anormalement gros).
    """
    if not source_dir.exists():
        raise FileNotFoundError(f"Dossier introuvable : {source_dir}")

    results: list[FilteredFile] = []

    for path in source_dir.rglob("*"):
        if path.is_dir():
            continue

        relative_path = path.relative_to(source_dir)

        if _is_in_excluded_dir(relative_path.parent):
            continue
        if _is_excluded_file(path):
            continue

        try:
            size = path.stat().st_size
        except OSError:
            # lien symbolique cassé ou fichier supprimé pendant le parcours
            continue

        if size == 0 or size > MAX_FILE_SIZE_BYTES:
            continue

        results.append(
            FilteredFile(path=path, relative_path=str(relative_path), size_bytes=size)
        )

        if len(results) > MAX_TOTAL_FILES:
            raise ProjectTooLargeError(
                f"Projet trop volumineux : plus de {MAX_TOTAL_FILES} fichiers après filtrage."
            )

    return results