"""Tool-calling contracts and validation helpers."""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ToolCallEnvelope:
    call_id: str
    name: str
    arguments_json: str


def validate_tools_and_choice(tools: list[dict[str, Any]] | None, tool_choice: str | dict[str, Any] | None) -> None:
    declared_tools = tools or []
    if tool_choice is not None and not declared_tools:
        raise ValueError("tool_choice was provided but no tools were declared.")

    names: set[str] = set()
    for index, tool in enumerate(declared_tools):
        if not isinstance(tool, dict):
            raise ValueError(f"tools[{index}] must be an object.")
        if tool.get("type") != "function":
            raise ValueError(f"tools[{index}].type must be 'function'.")
        function = tool.get("function")
        if not isinstance(function, dict):
            raise ValueError(f"tools[{index}].function must be an object.")
        name = function.get("name")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"tools[{index}].function.name must be a non-empty string.")
        if name in names:
            raise ValueError(f"tools[{index}].function.name duplicates '{name}'.")
        names.add(name)

        parameters = function.get("parameters")
        if parameters is not None and not isinstance(parameters, dict):
            raise ValueError(f"tools[{index}].function.parameters must be an object when provided.")

    if tool_choice is None:
        return
    if isinstance(tool_choice, str):
        if tool_choice not in {"auto", "none", "required"}:
            raise ValueError("tool_choice must be one of: auto, none, required.")
        return
    if not isinstance(tool_choice, dict):
        raise ValueError("tool_choice must be a string or object.")
    if tool_choice.get("type") != "function":
        raise ValueError("tool_choice object must include type='function'.")
    function = tool_choice.get("function")
    if not isinstance(function, dict):
        raise ValueError("tool_choice.function must be an object.")
    function_name = function.get("name")
    if not isinstance(function_name, str) or not function_name.strip():
        raise ValueError("tool_choice.function.name must be a non-empty string.")
    if function_name not in names:
        raise ValueError(f"tool_choice.function.name '{function_name}' was not declared in tools.")
