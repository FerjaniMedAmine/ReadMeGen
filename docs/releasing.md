# Releasing

GitHub and Python distributions share one version. Wheels and source distributions include built GUI assets; Node.js is needed to build them, not to run them.

## Maintainer setup

1. Use `readmegen-agent` as the PyPI distribution name. The CLI and import package remain `readmegen`; PyPI rejected `readmegen` because it is too similar to an existing project.
2. Configure a PyPI Trusted Publisher for `FerjaniMedAmine/ReadMeGen`, workflow `publish.yml`, environment `pypi`.
   Configure a separate pending publisher on TestPyPI using the same repository and workflow, with environment `testpypi`.
3. Require a reviewer on GitHub's `pypi` environment so publishing has a final human approval step.
4. Validate sign-in, model selection, generation, logout, and restart against real providers and an eligible ChatGPT account. Record tested models in release notes without credentials or private source.

Production publication runs when a GitHub release is published. A manual run of the **Publish** workflow builds, tests, installs, and uploads the package to TestPyPI. Adding or pushing source does not publish a package. See [PyPI Trusted Publishing](https://docs.pypi.org/trusted-publishers/using-a-publisher/).

## Build and review

Update versions in `pyproject.toml` and `frontend/package.json`, refresh lockfiles, and run CI checks. Then:

```bash
npm ci --prefix frontend
python scripts/build_frontend.py
python -m build
twine check dist/*
python scripts/check_distribution.py dist
```

Check that neither archive includes local keys, imported projects, virtual environments, or Node modules. The GUI must include `readmegen/web/static/index.html` and its referenced assets.

Install the wheel in a fresh environment, change outside the checkout, and verify help, version, and `readmegen ui --no-browser`. Verify that CLI-only installations give clear GUI dependency instructions.

Create `v<project-version>` only after verification. Publication validates the tag, builds and tests before obtaining PyPI credentials, and uses OIDC rather than a long-lived PyPI token. Trial a first release against TestPyPI before production publication.

## First publication

1. Push the release candidate and wait for every CI job, including Python 3.12–3.14, to pass.
2. In GitHub Actions, select **Publish**, then **Run workflow** on the verified branch. This targets TestPyPI only.
3. In a fresh environment, install the locally built wheel with its `web` extra to obtain dependencies from PyPI, then reinstall the trial package without resolving dependencies:

   ```bash
   python -m pip install './dist/readmegen_agent-0.2.0-py3-none-any.whl[web]'
   python -m pip install --force-reinstall --no-deps --index-url https://test.pypi.org/simple/ readmegen-agent==0.2.0
   readmegen --version
   readmegen ui --no-browser
   ```

4. Record live provider validation and any remaining limitations in release notes.
5. Publish the GitHub release `v0.2.0`; select **pre-release** for the initial beta. The workflow uploads to PyPI after the `pypi` environment approval and attaches the wheel and source archive to the GitHub release.
6. Check both publishing jobs and verify `python -m pip install 'readmegen-agent[web]'` from PyPI in a fresh environment before announcing availability. If a version was already uploaded manually, publish a new version through the workflow; PyPI does not allow reusing uploaded files.
