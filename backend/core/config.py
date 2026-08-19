from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PROJECTS_DIR = DATA_DIR / "projects"
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)



MAX_ZIP_SIZE = 50 * 1024 * 1024
MAX_EXTRACTED_SIZE = 200 * 1024 * 1024


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



EXTENSION_TO_LANGUAGE = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".java": "java",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".cc": "cpp",
    ".cs": "c_sharp",
    ".go": "go",
    ".rb": "ruby",
    ".php": "php",
    ".rs": "rust",
    ".kt": "kotlin",
    ".swift": "swift",
    ".scala": "scala",
    ".sh": "bash",
}

CHUNK_MAX_TOKENS = 200       # plafond par chunk (marge sous les 512 de bge-small)
CHUNK_OVERLAP_TOKENS = 30    # à augmenter si tu passes à un modèle avec plus de contexte
TOKENS_PER_WORD = 1.3        # estimation approx, pas de tokenizer dédié

# Embeddings
TEI_URL = "http://localhost:8080/embed"
EMBEDDING_BATCH_SIZE = 32
SPARSE_MODEL_NAME = "Qdrant/bm25"

# Qdrant
QDRANT_URL = "http://localhost:6333"
QDRANT_COLLECTION_NAME = "ReadMeGen"
DENSE_VECTOR_NAME = "dense"
SPARSE_VECTOR_NAME = "sparse"



GEMINI_MODEL = "gemini-3.7-flash"
ROUTER_TOKEN_THRESHOLD = 100_000
MAX_FILE_READ_CHARS = 20_000  # plafond de sécurité par lecture de fichier