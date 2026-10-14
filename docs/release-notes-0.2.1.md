# ReadMeGen 0.2.1

Fix Windows project paths in the interactive `readmegen>` shell. Previously, `/generate C:\Users\Alice\project` lost its backslashes during Unix-style command parsing and failed to find the project.

Windows shell commands now preserve backslashes in drive paths, UNC shares, quoted paths with spaces, and trailing separators. Quoted output paths such as `--output="D:\My Docs\README.md"` are also preserved. Unix shell escaping is unchanged.

Regression tests cover the reported command, quoted paths, UNC shares, output paths, platform detection, and native directory and ZIP ingestion. A Windows CI job runs the CLI and path tests.

Upgrade with:

```powershell
python -m pip install --upgrade readmegen-agent
```

Then use:

```text
/generate C:\Users\Za7lou9\Desktop\sales-analyzer
```
