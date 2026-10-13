"""CLI and interactive shell; both call the same application service as the GUI."""

import asyncio
import shlex
import sys
import time
import webbrowser
from pathlib import Path
from typing import Annotated

import typer
from pydantic import ValidationError

from readmegen import __version__
from readmegen.auth.chatgpt import ChatGPTAuth
from readmegen.auth.credentials import CredentialStore
from readmegen.config import Settings, load_settings, save_settings
from readmegen.errors import ReadMeGenError
from readmegen.providers import list_models
from readmegen.service import generate as generate_document
from readmegen.storage import write_text

app = typer.Typer(
    help="Generate evidence-based READMEs from source code.",
    invoke_without_command=True,
    pretty_exceptions_enable=False,
)
credentials = CredentialStore()
chatgpt = ChatGPTAuth(credentials)


def fail(error: Exception) -> None:
    typer.echo(f"Error: {error}", err=True)
    raise typer.Exit(1)


def version_callback(value: bool) -> None:
    if value:
        typer.echo(__version__)
        raise typer.Exit()


@app.callback()
def main(
    ctx: typer.Context,
    version: Annotated[
        bool, typer.Option("--version", callback=version_callback, is_eager=True)
    ] = False,
) -> None:
    if ctx.invoked_subcommand is None:
        if sys.stdin.isatty():
            shell()
        else:
            typer.echo(ctx.get_help())


def select_model(settings: Settings) -> str:
    try:
        models = asyncio.run(list_models(settings, credentials, chatgpt))
    except ReadMeGenError as error:
        typer.echo(str(error), err=True)
        models = []
    # Catalogs can include non-chat models. Keep manual IDs available.
    for index, model in enumerate(models, 1):
        typer.echo(f"{index:>3}. {model['name']} ({model['id']})")
    value = typer.prompt("Choose a model number or enter a tool-capable model ID").strip()
    if value.isdigit() and 1 <= int(value) <= len(models):
        return models[int(value) - 1]["id"]
    if not value or any(character.isspace() for character in value):
        raise typer.BadParameter("Enter a valid model ID.")
    return value


@app.command()
def setup() -> None:
    """Choose authentication, provider, and model without editing an .env file."""
    try:
        mode = typer.prompt("Authentication: api-key or chatgpt", default="api-key").strip()
        if mode == "api-key":
            provider = typer.prompt("Provider: gemini, openai, anthropic", default="gemini").strip()
            settings = Settings(provider=provider)
            key = typer.prompt("API key", hide_input=True).strip()
            if not key:
                raise typer.BadParameter("The API key cannot be empty.")
            typer.echo(
                "Setup saves your key in the OS credential store. For session-only use, enter it during generate or in the GUI."
            )
            credentials.set(f"api-key:{provider}", key)
        elif mode == "chatgpt":
            profiles = chatgpt.profiles()
            profile_id = None
            if profiles:
                for index, profile in enumerate(profiles, 1):
                    typer.echo(f"{index}. {profile['label']}")
                choice = typer.prompt("Saved account number, or 'new'", default="new")
                if choice != "new":
                    if not choice.isdigit() or not 1 <= int(choice) <= len(profiles):
                        raise typer.BadParameter("Choose a saved account number or 'new'.")
                    profile_id = profiles[int(choice) - 1]["id"]
            pending = chatgpt.start(profile_id=profile_id)
            typer.echo(f"Continue with ChatGPT in your browser:\n{pending.url}")
            webbrowser.open(pending.url)
            try:
                while (profile_id := chatgpt.finish(pending.id)) is None:
                    time.sleep(0.2)
            finally:
                chatgpt.cancel(pending.id)
            settings = Settings(auth_mode="chatgpt", provider="openai", profile_id=profile_id)
        else:
            raise typer.BadParameter("Choose api-key or chatgpt.")
        settings = Settings.model_validate(
            {**settings.model_dump(), "model": select_model(settings)}
        )
        settings.require_model()
        save_settings(settings)
        typer.echo(f"Configured {settings.provider} / {settings.model}.")
    except ValidationError:
        fail(ValueError("Invalid provider. Choose gemini, openai, or anthropic."))
    except ReadMeGenError as error:
        fail(error)


@app.command("generate")
def generate_command(
    source: Annotated[
        str, typer.Argument(help="Directory, ZIP file, or public HTTPS Git URL.")
    ] = ".",
    output: Annotated[Path, typer.Option("--output", "-o")] = Path("README.generated.md"),
    provider: Annotated[
        str | None, typer.Option(help="Override the saved API-key provider.")
    ] = None,
    model: Annotated[str | None, typer.Option(help="Override the saved model ID.")] = None,
    force: Annotated[
        bool, typer.Option(help="Allow replacement of an existing output file.")
    ] = False,
) -> None:
    """Generate a README; existing output files are protected by default."""
    if output.exists() and not force:
        fail(ValueError("Output already exists. Choose another --output or pass --force."))
    try:
        saved = load_settings()
        updates = {}
        if provider:
            if saved.auth_mode == "chatgpt":
                raise typer.BadParameter(
                    "Switch to API-key authentication before overriding the provider."
                )
            updates["provider"] = provider
            # Never silently reuse another provider's model.
            if provider != saved.provider and not model:
                raise typer.BadParameter("Specify --model when switching providers.")
        if model:
            updates["model"] = model
        settings = Settings.model_validate({**saved.model_dump(), **updates})
        settings.require_model()
        if settings.auth_mode == "api-key":
            try:
                credentials.api_key(settings.provider)
            except ReadMeGenError:
                if not sys.stdin.isatty():
                    raise
                credentials.set(
                    f"api-key:{settings.provider}",
                    typer.prompt("API key for this session", hide_input=True),
                    persist=False,
                )
        typer.echo(
            f"Using {settings.provider} / {settings.model}. Selected source files will be sent to this model.",
            err=True,
        )
        result = asyncio.run(
            generate_document(
                source,
                settings,
                credentials,
                chatgpt,
                on_progress=lambda phase, **_extra: typer.echo(f"  {phase}", err=True),
            )
        )
        write_text(output, result, overwrite=force)
        typer.echo(f"Saved {output}")
    except ValidationError:
        fail(ValueError("Invalid provider or model configuration."))
    except (ReadMeGenError, OSError) as error:
        fail(error)


@app.command()
def models() -> None:
    """List the current connection's model catalog."""
    try:
        for model in asyncio.run(list_models(load_settings(), credentials, chatgpt)):
            typer.echo(f"{model['id']}\t{model['name']}")
    except ReadMeGenError as error:
        fail(error)


@app.command()
def logout() -> None:
    """Remove the current connection's saved credentials."""
    try:
        settings = load_settings()
        if settings.auth_mode == "chatgpt" and settings.profile_id:
            if not chatgpt.logout(settings.profile_id):
                typer.echo(
                    "Local credentials cleared. Remote revocation was not confirmed; disconnect the app in ChatGPT settings."
                )
                return
        else:
            credentials.delete(f"api-key:{settings.provider}")
        typer.echo("Saved credentials cleared. Environment variables are controlled by your shell.")
    except ReadMeGenError as error:
        fail(error)


@app.command()
def ui(
    port: Annotated[int, typer.Option(min=0, max=65535)] = 8765,
    browser: Annotated[bool, typer.Option("--browser/--no-browser")] = True,
) -> None:
    """Launch the bundled local GUI. Ctrl+C stops the server."""
    from readmegen.web.server import launch_ui

    try:
        handle = launch_ui(credentials, chatgpt, port=port, open_browser=browser)
        typer.echo(f"Web interface: {handle.url}\nPress Ctrl+C to stop.")
        try:
            while handle.thread.is_alive():
                handle.thread.join(timeout=0.2)
        except KeyboardInterrupt:
            pass
        finally:
            handle.stop()
    except ReadMeGenError as error:
        fail(error)


@app.command()
def shell() -> None:
    """Interactive commands: /ui, /setup, /models, /generate, /logout, /exit."""
    from readmegen.web.server import launch_ui

    handle = None
    typer.echo(
        "ReadMeGen — /help for commands. Selected source files are sent to your chosen model."
    )
    try:
        while True:
            try:
                command = input("readmegen> ").strip()
                parts = shlex.split(command)
                if not parts:
                    continue
                name, *arguments = parts
                if name in {"/exit", "/quit"}:
                    break
                if name == "/help":
                    typer.echo(
                        "/ui [--no-browser]  /setup  /models  /generate <source> [--output <path>]  /logout  /exit"
                    )
                elif name == "/ui":
                    if arguments not in ([], ["--no-browser"]):
                        typer.echo("Usage: /ui [--no-browser]")
                        continue
                    if not handle or not handle.thread.is_alive():
                        handle = launch_ui(
                            credentials, chatgpt, open_browser="--no-browser" not in arguments
                        )
                    typer.echo(f"Web interface: {handle.url}")
                elif name in {"/setup", "/models", "/generate", "/logout"}:
                    app(args=[name[1:], *arguments], standalone_mode=False)
                else:
                    typer.echo("Unknown command. Type /help.")
            except (ValueError, ReadMeGenError) as error:
                typer.echo(f"Error: {error}", err=True)
            except (typer.Exit, typer.BadParameter) as error:
                if isinstance(error, typer.BadParameter):
                    typer.echo(str(error), err=True)
            except KeyboardInterrupt:
                typer.echo()
            except EOFError:
                break
    finally:
        if handle:
            handle.stop()
        chatgpt.close()
