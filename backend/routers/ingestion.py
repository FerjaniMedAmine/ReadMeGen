from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from pydantic import BaseModel
from core.config import PROJECTS_DIR
from core.status import get_status, set_status

from services.zip_service import import_zip_project
from services.filter_service import ProjectTooLargeError, filter_project_files
from services.git_service import import_git_project
from services.agents_graph import generate_readme
from fastapi.responses import PlainTextResponse

router = APIRouter(
    prefix="/api/v1/projects",
    tags=["Project ingestion"],
)


class GitImportRequest(BaseModel):
    git_url: str


async def run_filtering(project_id: str):
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

    if not files:
        set_status(project_id, "error", detail="Aucun fichier source lisible trouvé dans le projet.")
        return

    set_status(project_id, "planning", file_count=len(files))

    try:
        readme_content = await generate_readme(
            project_id,
            source_dir,
            files,
            on_progress=lambda phase, **extra: set_status(
                project_id, phase, file_count=len(files), **extra
            ),
        )
    except Exception as error:
        set_status(
            project_id, "error", detail=f"Échec de la génération du README : {error}"
        )
        return

    readme_path = PROJECTS_DIR / project_id / "README.md"
    readme_path.write_text(readme_content, encoding="utf-8")

    set_status(
        project_id,
        "ready",
        file_count=len(files),
        files=[f.relative_path for f in files],
    )


@router.post("/upload-zip", status_code=202)
async def upload_zip(
    background_tasks: BackgroundTasks, zip_file: UploadFile = File(...)
):
    result = await import_zip_project(zip_file)

    project_id = result["project_id"]
    current = get_status(project_id)
    if current and current["status"] in {"extracting", "filtering", "planning", "analyzing", "writing"}:
        return result

    if result["status"] == "already_exists" and (PROJECTS_DIR / project_id / "README.md").is_file():
        set_status(project_id, "ready")
    else:
        set_status(project_id, "extracting")
        background_tasks.add_task(run_filtering, project_id)

    return result


@router.post("/import-git", status_code=202)
async def import_git(background_tasks: BackgroundTasks, payload: GitImportRequest):
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


@router.get("/{project_id}/readme", response_class=PlainTextResponse)
async def get_readme(project_id: str):
    readme_path = PROJECTS_DIR / project_id / "README.md"
    if not readme_path.exists():
        raise HTTPException(status_code=404, detail="README pas encore généré.")
    return readme_path.read_text(encoding="utf-8")
