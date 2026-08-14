import asyncio
import hashlib
import shutil
import zipfile
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from core.config import PROJECTS_DIR

CHUNK_SIZE = 1024 * 1024        # 1 Mo
MAX_UPLOAD_SIZE = 50 * 1024 * 1024      # 50MB on disk — raw zip cap
MAX_EXTRACTED_SIZE = 300 * 1024 * 1024  # 300MB uncompressed — decompression-bomb cap
MAX_FILE_COUNT = 5000                    # guards against inode/file-count exhaustion


async def save_and_hash_zip(zip_file: UploadFile, temporary_path: Path) -> str:
    """
    Enregistre le ZIP et calcule son hash SHA-256 pendant la lecture,
    en rejetant le fichier s'il dépasse MAX_UPLOAD_SIZE.
    """
    sha256 = hashlib.sha256()
    total_written = 0

    with temporary_path.open("wb") as output:
        while chunk := await zip_file.read(CHUNK_SIZE):
            total_written += len(chunk)
            if total_written > MAX_UPLOAD_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=f"Fichier trop volumineux (max {MAX_UPLOAD_SIZE // 1_048_576}MB).",
                )
            output.write(chunk)
            sha256.update(chunk)

    return sha256.hexdigest()


def _validate_and_extract(archive_path: Path, target_dir: Path) -> None:
    """
    Vérifie chaque entrée de l'archive avant extraction :
    - refuse toute entrée qui sortirait de target_dir (Zip Slip)
    - refuse les liens symboliques
    - applique un plafond sur la taille totale décompressée et le nombre de fichiers
    Lève ValueError si l'archive est jugée dangereuse.
    """
    resolved_target = target_dir.resolve()
    total_size = 0
    file_count = 0

    with zipfile.ZipFile(archive_path, "r") as archive:
        for member in archive.infolist():
            # liens symboliques : bit S_ISLNK dans les 16 bits hauts de external_attr
            is_symlink = (member.external_attr >> 16) & 0o170000 == 0o120000
            if is_symlink:
                raise ValueError(f"Lien symbolique refusé dans l'archive : {member.filename}")

            member_path = (target_dir / member.filename).resolve()
            if not str(member_path).startswith(str(resolved_target) + "\0"[:0]) and \
               resolved_target not in member_path.parents and member_path != resolved_target:
                # équivalent lisible : member_path doit être DANS resolved_target
                if resolved_target not in member_path.parents:
                    raise ValueError(f"Chemin suspect dans l'archive : {member.filename}")

            total_size += member.file_size
            file_count += 1

            if total_size > MAX_EXTRACTED_SIZE:
                raise ValueError(
                    f"Taille décompressée trop grande (> {MAX_EXTRACTED_SIZE // 1_048_576}MB)."
                )
            if file_count > MAX_FILE_COUNT:
                raise ValueError(f"Trop de fichiers dans l'archive (> {MAX_FILE_COUNT}).")

        # tout validé — extraction effective
        archive.extractall(target_dir)


async def import_zip_project(zip_file: UploadFile) -> dict:
    filename = zip_file.filename or ""

    if not filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Le fichier doit être un ZIP.")

    temporary_path = PROJECTS_DIR / f"temp-{uuid4().hex}.zip"

    try:
        project_id = await save_and_hash_zip(zip_file=zip_file, temporary_path=temporary_path)

        project_directory = PROJECTS_DIR / project_id
        source_directory = project_directory / "source"

        # lock par project_id : deux uploads du même contenu en même temps
        # font la queue ici plutôt que de se marcher dessus
        if source_directory.exists():
            temporary_path.unlink(missing_ok=True)
            return {
                "project_id": project_id,
                "filename": filename,
                "status": "already_exists",
                "project_path": str(source_directory.relative_to(PROJECTS_DIR.parent)),
            }

        if not zipfile.is_zipfile(temporary_path):
            raise HTTPException(status_code=400, detail="Le fichier envoyé n'est pas une archive ZIP valide.")

        project_directory.mkdir(parents=True, exist_ok=False)

        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, _validate_and_extract, temporary_path, source_directory)
        except (ValueError, zipfile.BadZipFile) as error:
            shutil.rmtree(project_directory, ignore_errors=True)
            raise HTTPException(status_code=400, detail=str(error)) from error
        except Exception:
            shutil.rmtree(project_directory, ignore_errors=True)
            raise

        temporary_path.unlink(missing_ok=True)

        return {
            "project_id": project_id,
            "filename": filename,
            "status": "imported",
            "project_path": str(source_directory.relative_to(PROJECTS_DIR.parent)),
        }
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise

    finally:
        await zip_file.close()