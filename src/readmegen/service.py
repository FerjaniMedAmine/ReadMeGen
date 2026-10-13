"""The application use case shared by the CLI and local web application."""

import asyncio
from collections.abc import Callable
from pathlib import Path

from readmegen.auth.chatgpt import ChatGPTAuth
from readmegen.auth.credentials import CredentialStore
from readmegen.concurrency import run_blocking
from readmegen.config import Settings
from readmegen.errors import GenerationError, ReadMeGenError
from readmegen.generation.agents import generate_readme
from readmegen.providers import build_model
from readmegen.sources import filter_project_files, prepare_source, temporary_workspace


async def generate(
    source: str,
    settings: Settings,
    credentials: CredentialStore,
    chatgpt: ChatGPTAuth,
    *,
    on_progress: Callable[..., None] | None = None,
) -> str:
    """Return a complete document, releasing imported files on success or failure."""
    model = build_model(settings, credentials, chatgpt)
    with temporary_workspace() as directory:
        try:
            async with asyncio.timeout(settings.generation_timeout):
                if on_progress:
                    on_progress("extracting")
                root = await prepare_source(source, Path(directory))
                if on_progress:
                    on_progress("filtering")
                files = await run_blocking(filter_project_files, root)
                if not files:
                    raise GenerationError("No readable project files were found.")

                def progress(phase: str, **extra) -> None:
                    if on_progress:
                        on_progress(phase, file_count=len(files), **extra)

                return await generate_readme(root.name, root, files, model, settings, progress)
        except ReadMeGenError:
            raise
        except TimeoutError as error:
            raise GenerationError(
                "Generation timed out. Try a smaller project or another model."
            ) from error
        except Exception as error:
            # Provider errors can contain tokens, source excerpts, or request bodies.
            raise GenerationError(
                "Generation failed. Check model tool-calling support, credentials, and provider limits."
            ) from error
