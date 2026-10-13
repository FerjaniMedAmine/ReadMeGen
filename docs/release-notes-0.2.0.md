# ReadMeGen 0.2.0 beta

Generate source-based README drafts from a local directory, ZIP archive, or public Git repository using the CLI or bundled local browser interface.

- Shared Python generation engine for terminal and browser use.
- Gemini, OpenAI, and Anthropic API-key connections, with OS credential storage or session-only connections.
- Experimental ChatGPT-plan connection.
- Scoped research agents, protected output files, and bounded source ingestion.
- Bundled GUI in the wheel and source distribution; Node.js is only needed when building from source.

## Validation

The release candidate passed 60 Python tests on Python 3.12/Linux, with 76% coverage. Python and frontend lint checks, frontend tests, GUI build, wheel and source distribution checks, and installation into a fresh environment passed. The installed GUI served its HTML, assets, and health API and shut down cleanly. Dependency audits of the development environment and frontend reported no known vulnerabilities on 2026-10-13.

GitHub CI results for Python 3.12–3.14 and TestPyPI installation must be confirmed before publication. Real provider generation, credential persistence/restart, and live ChatGPT sign-in have not been validated in this release session. ChatGPT support remains experimental. Windows and macOS were not tested in this session.

## Installation

After successful PyPI publication:

```bash
python -m pip install 'readmegen[web]'
readmegen setup
readmegen generate ./my-project
readmegen ui
```

Python 3.12 or later is required. Git is required for repository URL imports. Review generated drafts before committing them; selected source files are sent to the configured provider.
