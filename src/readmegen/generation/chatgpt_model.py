"""LangChain adapter for the documented ChatGPT-plan Responses transport."""

import asyncio
import json
from collections.abc import Callable, Sequence
from typing import Any

import httpx
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, SystemMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.utils.function_calling import convert_to_openai_function
from pydantic import Field

from readmegen.errors import GenerationError


def request_body(model: str, messages: list[BaseMessage], tools: list[dict]) -> dict:
    instructions: list[str] = []
    inputs: list[dict] = []
    for message in messages:
        if isinstance(message, SystemMessage):
            instructions.append(str(message.content))
        elif isinstance(message, ToolMessage):
            inputs.append(
                {
                    "type": "function_call_output",
                    "call_id": message.tool_call_id,
                    "output": str(message.content),
                }
            )
        elif isinstance(message, AIMessage) and "responses_output" in message.additional_kwargs:
            # Replay reasoning and namespaced function calls with their original IDs.
            inputs.extend(message.additional_kwargs["responses_output"])
        else:
            inputs.append(
                {
                    "role": "assistant" if isinstance(message, AIMessage) else "user",
                    "content": message.content,
                }
            )
    body = {
        "model": model,
        "input": inputs,
        "store": False,
        "stream": True,
        "include": ["reasoning.encrypted_content"],
    }
    if instructions:
        body["instructions"] = "\n\n".join(instructions)
    if tools:
        body["tools"] = [
            {
                "type": "namespace",
                "name": "readmegen",
                "description": "ReadMeGen source research tools.",
                "tools": tools,
            }
        ]
    return body


def completed_message(response: dict) -> AIMessage:
    text: list[str] = []
    calls: list[dict] = []
    output = response.get("output", [])
    for item in output:
        if item["type"] == "message":
            for content in item.get("content", []):
                if content["type"] == "output_text":
                    text.append(content["text"])
                elif content["type"] == "refusal":
                    raise GenerationError("The selected model declined this generation request.")
        elif item["type"] == "function_call":
            try:
                arguments = json.loads(item["arguments"])
                if not isinstance(arguments, dict):
                    raise ValueError("Tool arguments must be an object")
                calls.append(
                    {
                        "name": item["name"],
                        "args": arguments,
                        "id": item["call_id"],
                        "type": "tool_call",
                    }
                )
            except (ValueError, KeyError, TypeError) as error:
                raise GenerationError("The model returned invalid tool arguments.") from error
    return AIMessage(
        content="\n".join(text), tool_calls=calls, additional_kwargs={"responses_output": output}
    )


class ChatGPTModel(BaseChatModel):
    model: str
    token_supplier: Callable[[], str] = Field(exclude=True, repr=False)
    tools: list[dict] = Field(default_factory=list)

    @property
    def _llm_type(self) -> str:
        return "chatgpt-plan-responses"

    @property
    def _identifying_params(self) -> dict:
        return {"model": self.model}

    def bind_tools(self, tools: Sequence, *, tool_choice: str | None = None, **kwargs: Any):
        if tool_choice not in {None, "auto"}:
            raise GenerationError("This ChatGPT adapter supports automatic tool selection.")
        definitions = []
        for tool in tools:
            definition = convert_to_openai_function(tool)
            definitions.append({"type": "function", **definition, "strict": False})
        return self.model_copy(update={"tools": definitions})

    def _generate(
        self, messages: list[BaseMessage], stop=None, run_manager=None, **kwargs
    ) -> ChatResult:
        return asyncio.run(self._agenerate(messages, stop=stop, run_manager=run_manager, **kwargs))

    async def _agenerate(
        self, messages: list[BaseMessage], stop=None, run_manager=None, **kwargs
    ) -> ChatResult:
        body = request_body(self.model, messages, self.tools)
        token = await asyncio.to_thread(self.token_supplier)
        try:
            async with (
                httpx.AsyncClient(timeout=httpx.Timeout(180, connect=20)) as client,
                client.stream(
                    "POST",
                    "https://api.openai.com/v1/responses",
                    json=body,
                    headers={"Authorization": f"Bearer {token}"},
                ) as response,
            ):
                if response.status_code == 401:
                    raise GenerationError("ChatGPT authorization expired. Sign in again.")
                if response.status_code >= 400:
                    raise GenerationError(
                        "ChatGPT rejected this request. Check model access and plan usage limits."
                    )
                event_lines: list[str] = []
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        event_lines.append(line[5:].lstrip())
                    elif not line and event_lines:
                        event = json.loads("\n".join(event_lines))
                        event_lines = []
                        if event.get("type") == "response.completed":
                            return ChatResult(
                                generations=[
                                    ChatGeneration(message=completed_message(event["response"]))
                                ]
                            )
                        if event.get("type") in {
                            "response.failed",
                            "response.incomplete",
                            "error",
                        }:
                            raise GenerationError(
                                "ChatGPT could not complete this request. Check plan limits or try another model."
                            )
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
            raise GenerationError(
                "The ChatGPT response failed or was interrupted. Try again."
            ) from error
        raise GenerationError(
            "The ChatGPT stream ended before completion. No partial README was saved."
        )
