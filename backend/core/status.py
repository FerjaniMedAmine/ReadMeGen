"""
Garde en mémoire l'avancement de chaque projet (juste un dictionnaire Python).
C'est simple exprès : pas de base de données pour l'instant.
Suffisant pour développer et tester en solo.
"""

project_statuses: dict[str, dict] = {}


def set_status(project_id: str, status: str, **extra):
    project_statuses[project_id] = {"status": status, **extra}


def get_status(project_id: str):
    return project_statuses.get(project_id)