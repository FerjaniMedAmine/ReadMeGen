from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from pydantic import BaseModel

from core.config import PROJECTS_DIR
from core.status import get_status, set_status
from services.filter_service import ProjectTooLargeError, filter_project_files
from services.git_service import import_git_project
from services.zip_service import import_zip_project

router = APIRouter(
    prefix="/api/v1/projects",
    tags=["Project ingestion"],
)


class GitImportRequest(BaseModel):
    git_url: str


def run_filtering(project_id: str):
    """
    Appelée en tâche de fond juste après l'extraction (zip ou git).
    Filtre les fichiers du projet et met à jour son statut.
    """
    source_dir = PROJECTS_DIR / project_id / "source"
    set_status(project_id, "filtering")

    try:
        files = filter_project_files(source_dir)
    except FileNotFoundError:
        set_status(project_id, "error", detail="Dossier source introuvable.")
        return
    except ProjectTooLargeError as error:
        set_status(project_id, "error", detail=str(error))
        return

    set_status(
        project_id,
        "ready",
        file_count=len(files),
        files=[f.relative_path for f in files],
    )


@router.post("/upload-zip", status_code=202)
async def upload_zip(background_tasks: BackgroundTasks, zip_file: UploadFile = File(...)):
    """
    Reçoit et extrait un ZIP. Le filtrage démarre automatiquement en
    arrière-plan — utilise GET /{project_id}/status pour suivre.
    """
    result = await import_zip_project(zip_file)

    if result["status"] == "imported":
        set_status(result["project_id"], "extracting")
        background_tasks.add_task(run_filtering, result["project_id"])

    return result


@router.post("/import-git", status_code=202)
async def import_git(background_tasks: BackgroundTasks, payload: GitImportRequest):
    """
    Clone un dépôt Git et lance le filtrage automatiquement.
    """
    result = await import_git_project(payload.git_url)

    if result["status"] == "imported":
        set_status(result["project_id"], "extracting")
        background_tasks.add_task(run_filtering, result["project_id"])

    return result


@router.get("/{project_id}/status")
async def project_status(project_id: str):
    status = get_status(project_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    return {"project_id": project_id, **status}