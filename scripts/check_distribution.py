"""Fail release checks if a wheel/sdist misses the GUI or includes local secrets."""

import sys
import tarfile
import zipfile
from pathlib import Path


def main() -> None:
    directory = Path(sys.argv[1] if len(sys.argv) > 1 else "dist")
    artifacts = [*directory.glob("*.whl"), *directory.glob("*.tar.gz")]
    if len(artifacts) != 2:
        raise SystemExit("Expected one wheel and one source distribution.")
    for artifact in artifacts:
        if artifact.suffix == ".whl":
            with zipfile.ZipFile(artifact) as archive:
                names = archive.namelist()
        else:
            with tarfile.open(artifact) as archive:
                names = archive.getnames()
        if not any(name.endswith("readmegen/web/static/index.html") for name in names):
            raise SystemExit(f"{artifact.name}: missing GUI. Build the frontend first.")
        for name in names:
            parts = Path(name).parts
            if any(
                part in {"backend", ".env", "node_modules", ".venv", ".git", "jobs.sqlite3"}
                for part in parts
            ):
                raise SystemExit(f"{artifact.name}: contains local development state: {name}")
        print(f"Verified {artifact.name}: bundled GUI, no local development state.")


if __name__ == "__main__":
    main()
