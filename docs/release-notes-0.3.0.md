# ReadMeGen 0.3.0

- Redesigned browser workspace with a softer green palette, a compact connection panel, clearer project import controls, and layouts for desktop and mobile.
- Generated READMEs render as formatted documents with headings, emphasis, lists, code blocks, GitHub-style tables, links, and checklists.
- Copy Markdown and download preserve the original source. Preview images are offered as links; remote images are not loaded automatically. Embedded HTML is omitted and unsafe link protocols are blocked.
- Progress, error, and completed states share the updated layout. Clipboard errors no longer display a generation failure alongside the completed README.

Validation includes frontend lint, Markdown rendering and safety tests, dependency audit, production build, and browser checks with simulated API responses. Browser checks cover desktop and mobile overflow, provider settings, repository submission, progress, rendered results, copy, download, and starting another project. Paid model inference was not used for these UI checks.

```bash
python -m pip install --upgrade 'readmegen-agent[web]'
readmegen ui
```
