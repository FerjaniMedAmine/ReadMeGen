from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import Field

from readmegen.auth.chatgpt import ChatGPTAuth
from readmegen.config import Settings
from readmegen.service import generate


class ResearchModel(BaseChatModel):
    bound_names: list[str] = Field(default_factory=list)
    reads: list[str] = Field(default_factory=list)

    @property
    def _llm_type(self):
        return "test-research"

    def bind_tools(self, tools, **_kwargs):
        return self.model_copy(update={"bound_names": [tool.name for tool in tools]})

    def _generate(self, messages, stop=None, run_manager=None, **_kwargs):
        if self.bound_names and not isinstance(messages[-1], ToolMessage):
            name = self.bound_names[0]
            arguments = (
                {"role": "setup", "instruction": "Find the entry point", "paths": ["app.py"]}
                if name == "create_file_agent"
                else {"relative_path": "app.py"}
            )
            message = AIMessage(
                content="",
                tool_calls=[{"name": name, "args": arguments, "id": "call", "type": "tool_call"}],
            )
        elif self.bound_names == ["read_file"]:
            self.reads.append(messages[-1].content)
            message = AIMessage(content="The app prints hello. Evidence: app.py:1.")
        elif self.bound_names:
            message = AIMessage(content="Research complete.")
        else:
            message = AIMessage(content="# Demo\n\nPrints hello.\n")
        return ChatResult(generations=[ChatGeneration(message=message)])


async def test_real_agent_graph_uses_scoped_reader_and_writer(tmp_path, monkeypatch, credentials):
    (tmp_path / "app.py").write_text("print('hello')\n")
    (tmp_path / ".env").write_text("should never be read")
    model = ResearchModel()
    monkeypatch.setattr("readmegen.service.build_model", lambda *_args: model)
    phases = []
    result = await generate(
        str(tmp_path),
        Settings(model="test"),
        credentials,
        ChatGPTAuth(credentials),
        on_progress=lambda phase, **_extra: phases.append(phase),
    )
    assert result == "# Demo\n\nPrints hello.\n"
    assert phases == ["extracting", "filtering", "planning", "analyzing", "writing"]
    assert model.reads == ["1: print('hello')"]
