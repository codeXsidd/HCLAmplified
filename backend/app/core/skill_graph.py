import json
import os
from typing import List, Dict, Optional, Set, Any

try:
    import networkx as nx
    _nx_available = True
except ImportError:
    _nx_available = False

_GRAPH_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "seeds", "skill_graph.json"
)


class SkillGraph:
    def __init__(self):
        self.skill_map: Dict[str, Dict] = {}
        self._prereq_edges: List[Dict] = []
        self._transfer_edges: List[Dict] = []
        self._all_edges: List[Dict] = []
        if _nx_available:
            self.graph = nx.DiGraph()
        else:
            self.graph = None
        self._load()

    def _load(self):
        try:
            with open(_GRAPH_PATH, "r") as f:
                data = json.load(f)

            for skill in data["skills"]:
                self.skill_map[skill["name"]] = skill
                if self.graph is not None:
                    self.graph.add_node(skill["name"], **skill)

            for edge in data.get("prerequisite_edges", []):
                e = {
                    "source": edge["source"],
                    "target": edge["target"],
                    "link_type": "prerequisite",
                    "strength": edge.get("strength", 1.0),
                }
                self._prereq_edges.append(e)
                self._all_edges.append(e)
                if self.graph is not None:
                    self.graph.add_edge(
                        edge["source"],
                        edge["target"],
                        link_type="prerequisite",
                        strength=edge.get("strength", 1.0),
                    )

            for edge in data.get("transfer_edges", []):
                e = {
                    "source": edge["source"],
                    "target": edge["target"],
                    "link_type": "transfer",
                    "strength": edge.get("transfer_coefficient", 0.3),
                    "transfer_coefficient": edge.get("transfer_coefficient", 0.3),
                    "explanation": edge.get("explanation", ""),
                }
                self._transfer_edges.append(e)
                self._all_edges.append(e)
                if self.graph is not None:
                    self.graph.add_edge(
                        edge["source"],
                        edge["target"],
                        link_type="transfer",
                        strength=edge.get("transfer_coefficient", 0.3),
                        transfer_coefficient=edge.get("transfer_coefficient", 0.3),
                        explanation=edge.get("explanation", ""),
                    )

            print(
                f"Skill graph loaded: {len(self.skill_map)} skills, "
                f"{len(self._prereq_edges)} prerequisite edges, "
                f"{len(self._transfer_edges)} transfer edges"
            )
        except Exception as e:
            print(f"Warning: Could not load skill graph: {e}")

    def get_all_skills(self) -> List[Dict]:
        return list(self.skill_map.values())

    def get_skill(self, name: str) -> Optional[Dict]:
        return self.skill_map.get(name)

    def get_prerequisites(self, skill_name: str) -> List[str]:
        return [
            e["source"]
            for e in self._prereq_edges
            if e["target"] == skill_name
        ]

    def get_successors(self, skill_name: str) -> List[str]:
        return [
            e["target"]
            for e in self._prereq_edges
            if e["source"] == skill_name
        ]

    def get_reachable_skills(self, skill_name: str) -> Set[str]:
        """BFS over prerequisite edges to find all descendants."""
        visited: Set[str] = set()
        queue = [skill_name]
        while queue:
            current = queue.pop(0)
            for e in self._prereq_edges:
                if e["source"] == current and e["target"] not in visited:
                    visited.add(e["target"])
                    queue.append(e["target"])
        return visited

    def get_all_edges(self) -> List[Dict]:
        return self._all_edges

    def get_transfer_edges(self) -> List[Dict]:
        return self._transfer_edges


skill_graph = SkillGraph()
