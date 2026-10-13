"""Prevent a release tag from publishing a differently versioned package."""

import os
import tomllib
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    version = tomllib.loads((root / "pyproject.toml").read_text())["project"]["version"]
    if os.environ.get("RELEASE_TAG", "").removeprefix("v") != version:
        raise SystemExit(f"The release tag must be v{version}.")


if __name__ == "__main__":
    main()
