"""ReadMeGen: evidence-based documentation from source code."""

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("readmegen-agent")
except PackageNotFoundError:
    __version__ = "0.2.0"
