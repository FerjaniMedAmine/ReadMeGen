# ReadMeGen

ReadMeGen generates a project README from a ZIP archive or an HTTPS Git repository by reading selected source files directly.

## How it works

1. The backend imports and filters project files.
2. A coordinator examines the file tree and calls `create_file_agent` with a role, a focused instruction, and exact file paths.
3. Each specialist can read only its assigned files and returns README-relevant findings with file and line references.
4. A writer produces `README.md` from those findings. Missing information is listed as an open question instead of being guessed.

The coordinator can create up to eight specialists with up to twelve files each. It chooses roles based on the repository, such as setup, frontend, backend, database, tests, or deployment. Generation progress and the completed README are available through the API and browser UI.

Assigned source files are sent to the configured Gemini model for analysis and writing.

## Requirements

- Python 3.10 or newer
- Node.js and npm
- Git, if importing a repository by URL
- A Gemini API key (`GOOGLE_API_KEY`)

## Run locally

In `backend`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and replace the placeholder with your Gemini API key.
uvicorn main:app --reload
```

In a second terminal, in `frontend`:

```bash
npm install
npm run dev
```

Open the address printed by Vite (normally `http://localhost:5173`). The frontend uses `http://localhost:8000` for the API by default. Set `VITE_API_BASE_URL` before starting Vite to use a different backend address.

## API

- `POST /api/v1/projects/upload-zip` accepts a ZIP file in the `zip_file` form field.
- `POST /api/v1/projects/import-git` accepts JSON such as `{ "git_url": "https://github.com/owner/repo" }`.
- `GET /api/v1/projects/{project_id}/status` returns progress and errors.
- `GET /api/v1/projects/{project_id}/readme` returns the generated Markdown after processing finishes.

Generated project files and READMEs are stored under `backend/data/projects/`. ZIP uploads and Git imports have size and host restrictions in the import services.

ZIP archives must include the files inside the project folder. A ZIP containing only a folder entry cannot be analyzed; enable recursive compression when creating the archive.
