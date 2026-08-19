"""
Graphe LangGraph de génération de README.

Route selon la taille du projet :
- petit projet -> un seul agent explorateur (lit tree + fichiers librement)
- gros projet -> 3 agents spécialisés en parallèle (stack, tests, logique DB)
Les deux chemins convergent vers un agent Writer qui rédige le README final.
"""

import operator
from pathlib import Path
from typing import Annotated, TypedDict

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import create_react_agent

from core.config import GEMINI_MODEL, ROUTER_TOKEN_THRESHOLD, TOKENS_PER_WORD
from services.agent_tools import build_file_tools, build_qdrant_tool

llm = ChatGoogleGenerativeAI(model=GEMINI_MODEL)


class GraphState(TypedDict):
    project_id: str
    source_dir: str
    token_count: int
    agent_reports: Annotated[list[dict], operator.add]
    readme: str


# --- Node : estimation de la taille du projet ---


async def estimate_tokens_node(state: GraphState) -> dict:
    source_dir = Path(state["source_dir"])
    total_words = 0
    for path in source_dir.rglob("*"):
        if path.is_file():
            try:
                total_words += len(path.read_text(encoding="utf-8").split())
            except (UnicodeDecodeError, OSError):
                continue
    return {"token_count": int(total_words * TOKENS_PER_WORD)}


def route_by_size(state: GraphState) -> list[str]:
    if state["token_count"] < ROUTER_TOKEN_THRESHOLD:
        return ["explorer_agent"]
    return ["stack_agent", "tests_agent", "db_logic_agent"]


# --- Prompts des agents ---

EXPLORER_PROMPT = (
    "Tu explores un petit projet en entier pour comprendre sa stack, sa "
    "structure, sa logique métier et son installation. Utilise get_project_tree "
    "pour voir la structure, puis read_file pour lire les fichiers pertinents "
    "(choisis intelligemment, ne lis pas tout bêtement). Produis un résumé complet."
)
STACK_PROMPT = (
    "Tu identifies la stack technique d'un projet (langages, frameworks, "
    "dépendances) en explorant sa structure et ses fichiers de config. "
    "Résume la stack en quelques phrases."
)
TESTS_PROMPT = (
    "Tu analyses la stratégie de tests d'un projet. Cherche via search_codebase "
    "avec des mots-clés pertinents (ex: 'test', 'pytest', 'describe it'). "
    "Résume ce qui est testé et comment."
)
DB_LOGIC_PROMPT = (
    "Tu analyses comment le projet accède à sa base de données (routes, services, "
    "ORM/requêtes). D'abord identifie le langage/framework via les fichiers de "
    "config, puis génère toi-même des mots-clés de recherche adaptés à ce "
    "framework (ex: Python/FastAPI -> 'SQLAlchemy', 'session.query' ; "
    "Node/Express -> 'mongoose', 'router.get') et cherche avec search_codebase. "
    "Résume la logique métier et l'accès aux données."
)
WRITER_PROMPT = (
    "Tu rédiges un fichier README.md professionnel à partir des analyses "
    "fournies. Le README DOIT contenir, dans cet ordre : "
    "1. Un titre  2. Un paragraphe d'introduction  "
    "3. Ce que fait l'application, sa logique, ses contraintes principales  "
    "4. Instructions d'installation  5. Instructions d'utilisation. "
    "Rédige en Markdown, de façon claire et professionnelle."
)


async def _run_agent(prompt: str, tools: list, task: str, agent_name: str) -> dict:
    agent = create_react_agent(llm, tools, prompt=prompt)
    result = await agent.ainvoke({"messages": [("user", task)]})
    summary = result["messages"][-1].content
    return {"agent_reports": [{"agent": agent_name, "summary": summary}]}


async def run_explorer_agent(state: GraphState) -> dict:
    tools = build_file_tools(Path(state["source_dir"]))
    return await _run_agent(
        EXPLORER_PROMPT, tools, "Explore et comprends ce projet en entier.", "explorer"
    )


async def run_stack_agent(state: GraphState) -> dict:
    tools = build_file_tools(Path(state["source_dir"]))
    return await _run_agent(
        STACK_PROMPT, tools, "Analyse la stack technique de ce projet.", "stack"
    )


async def run_tests_agent(state: GraphState) -> dict:
    tools = [build_qdrant_tool(state["project_id"])]
    return await _run_agent(
        TESTS_PROMPT, tools, "Analyse les tests de ce projet.", "tests"
    )


async def run_db_logic_agent(state: GraphState) -> dict:
    tools = [
        *build_file_tools(Path(state["source_dir"])),
        build_qdrant_tool(state["project_id"]),
    ]
    return await _run_agent(
        DB_LOGIC_PROMPT,
        tools,
        "Analyse les routes, services et l'accès à la base de données.",
        "db_logic",
    )


async def run_writer(state: GraphState) -> dict:
    reports_text = "\n\n".join(
        f"### {r['agent']}\n{r['summary']}" for r in state["agent_reports"]
    )
    messages = [
        ("system", WRITER_PROMPT),
        ("user", f"Analyses disponibles :\n\n{reports_text}"),
    ]
    result = await llm.ainvoke(messages)
    return {"readme": result.content}


# --- Assemblage du graphe ---

graph_builder = StateGraph(GraphState)
graph_builder.add_node("estimate_tokens", estimate_tokens_node)
graph_builder.add_node("explorer_agent", run_explorer_agent)
graph_builder.add_node("stack_agent", run_stack_agent)
graph_builder.add_node("tests_agent", run_tests_agent)
graph_builder.add_node("db_logic_agent", run_db_logic_agent)
graph_builder.add_node("writer", run_writer)

graph_builder.add_edge(START, "estimate_tokens")
graph_builder.add_conditional_edges("estimate_tokens", route_by_size)
graph_builder.add_edge("explorer_agent", "writer")
graph_builder.add_edge("stack_agent", "writer")
graph_builder.add_edge("tests_agent", "writer")
graph_builder.add_edge("db_logic_agent", "writer")
graph_builder.add_edge("writer", END)

readme_graph = graph_builder.compile()


async def generate_readme(project_id: str, source_dir: Path) -> str:
    result = await readme_graph.ainvoke(
        {
            "project_id": project_id,
            "source_dir": str(source_dir),
            "token_count": 0,
            "agent_reports": [],
            "readme": "",
        }
    )
    return result["readme"]
