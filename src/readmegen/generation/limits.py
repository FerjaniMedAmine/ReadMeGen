"""Resource limits shared by ingestion and agent tools."""

EXCLUDE_DIRS = {
    "node_modules",
    ".git",
    "__pycache__",
    "dist",
    "build",
    "venv",
    ".venv",
    "env",
    "target",
    ".next",
    "coverage",
    ".idea",
    ".vscode",
    "vendor",
    "bin",
    "obj",
}

EXCLUDE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".svg",
    ".webp",
    ".pyc",
    ".pyo",
    ".so",
    ".dll",
    ".dylib",
    ".exe",
    ".lock",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".7z",
    ".mp4",
    ".mp3",
    ".pdf",
    ".min.js",
    ".min.css",
}

# Hidden files that describe setup without containing live credentials.
KEEP_HIDDEN_FILES = {".env.example", ".gitignore", ".dockerignore", ".eslintrc"}

MAX_FILE_SIZE_BYTES = 500_000  # 500 KB per source file
MAX_TOTAL_FILES = 3000  # Maximum number of readable files


MAX_FILE_READ_CHARS = 20_000
MAX_TREE_CHARS = 500_000
