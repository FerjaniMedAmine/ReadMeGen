from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PROJECTS_DIR = DATA_DIR / "projects"
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)



# Filtrage des projets

EXCLUDE_DIRS = {
    "node_modules", ".git", "__pycache__", "dist", "build",
    "venv", ".venv", "env", "target", ".next", "coverage",
    ".idea", ".vscode", "vendor", "bin", "obj",
}

EXCLUDE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp",
    ".pyc", ".pyo", ".so", ".dll", ".dylib", ".exe",
    ".lock", ".woff", ".woff2", ".ttf", ".eot",
    ".zip", ".tar", ".gz", ".rar", ".7z",
    ".mp4", ".mp3", ".pdf", ".min.js", ".min.css",
}

# fichiers cachés qu'on veut quand même garder car informatifs
KEEP_HIDDEN_FILES = {".env.example", ".gitignore", ".dockerignore", ".eslintrc"}

MAX_FILE_SIZE_BYTES = 500_000       # 500KB — au-delà, probablement pas du code source lisible
MAX_TOTAL_FILES = 3000              # protection contre les repos 



GEMINI_MODEL = "gemini-3.5-flash-lite"
MAX_FILE_READ_CHARS = 20_000
MAX_TREE_CHARS = 500_000
MAX_AGENTS = 8
MAX_AGENT_FILES = 12
