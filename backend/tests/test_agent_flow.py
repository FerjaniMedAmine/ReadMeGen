import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from services.agent_tools import build_file_tools
from services.agents_graph import generate_readme
from services.filter_service import FilteredFile


class FileToolTests(unittest.TestCase):
    def test_reader_is_limited_to_assigned_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "package.json").write_text('{"scripts":{"test":"vitest"}}')
            (root / "secret.txt").write_text("not assigned")
            reader = build_file_tools(root, ["package.json"])[0]
            self.assertIn('1: {"scripts"', reader.invoke({"relative_path": "package.json"}))
            self.assertIn("not assigned", reader.invoke({"relative_path": "secret.txt"}))
            self.assertIn("not assigned", reader.invoke({"relative_path": "../secret.txt"}))

    def test_symlink_cannot_escape_project(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "source"
            root.mkdir()
            outside = Path(directory) / "outside.txt"
            outside.write_text("outside")
            (root / "link.txt").symlink_to(outside)
            reader = build_file_tools(root, ["link.txt"])[0]
            self.assertIn("outside the project", reader.invoke({"relative_path": "link.txt"}))


class AgentFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_coordinator_creates_scoped_agent_then_writer(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            source.mkdir()
            package = source / "package.json"
            package.write_text('{"scripts":{"test":"vitest"}}')
            files = [FilteredFile(package, "package.json", package.stat().st_size)]
            tool_reads = []
            phases = []

            class FakeModel:
                def __init__(self, **kwargs):
                    pass

                async def ainvoke(self, messages):
                    self._writer_input = messages[-1][1]
                    return SimpleNamespace(content="# Demo\n\nRun `vitest`.")

            class FakeAgent:
                def __init__(self, tools):
                    self.tools = tools

                async def ainvoke(self, state, config=None):
                    agent_tool = self.tools[0]
                    if agent_tool.name == "create_file_agent":
                        rejected = await agent_tool.ainvoke({
                            "role": "tests", "instruction": "Find tests", "paths": ["missing.py"]
                        })
                        assert "Invalid paths" in rejected
                        result = await agent_tool.ainvoke({
                            "role": "tests",
                            "instruction": "Find the test command",
                            "paths": ["package.json"],
                        })
                        self_result = result
                    else:
                        self_result = agent_tool.invoke({"relative_path": "package.json"})
                        tool_reads.append(self_result)
                    return {"messages": [SimpleNamespace(content=self_result)]}

            with patch("services.agents_graph.ChatGoogleGenerativeAI", FakeModel), patch(
                "services.agents_graph.create_react_agent",
                side_effect=lambda llm, tools, prompt: FakeAgent(tools),
            ):
                readme = await generate_readme(
                    "demo", source, files,
                    on_progress=lambda phase, **extra: phases.append(phase),
                )

            self.assertEqual(readme, "# Demo\n\nRun `vitest`.\n")
            self.assertEqual(phases, ["planning", "analyzing", "writing"])
            self.assertIn("vitest", tool_reads[0])


if __name__ == "__main__":
    unittest.main()
