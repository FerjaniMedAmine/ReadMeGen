"""Build once for Python distributions; Node.js is only required for development."""

import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    npm = shutil.which("npm")
    if not npm:
        raise SystemExit("Install Node.js and npm to build the frontend.")
    subprocess.run([npm, "run", "build"], cwd=ROOT / "frontend", check=True)
    destination = ROOT / "src" / "readmegen" / "web" / "static"
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(ROOT / "frontend" / "dist", destination)
    print(f"Bundled GUI assets in {destination.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
