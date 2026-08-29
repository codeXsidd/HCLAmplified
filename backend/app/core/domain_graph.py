"""
DomainGraph: DB-backed competency graph for a specific domain pack.
Provides the same interface as SkillGraph so existing code can drop it in.
Falls back to the static skill_graph when no domain pack is available.
"""
from typing import List, Dict, Optional, Set

try:
    import networkx as nx
    _nx_available = True
except ImportError:
    _nx_available = False


class DomainGraph:
    """
    Loads competency graph from a domain pack dict (already fetched from DB).
    The pack_data structure matches what domain_service generates/stores.
    """

    def __init__(self, pack_data: dict):
        self.skill_map: Dict[str, Dict] = {}
        self._prereq_edges: List[Dict] = []
        self._transfer_edges: List[Dict] = []
        self._all_edges: List[Dict] = []
        self.graph = nx.DiGraph() if _nx_available else None
        self._load(pack_data)

    def _load(self, pack_data: dict) -> None:
        competencies = pack_data.get("competencies", [])
        for c in competencies:
            name = c.get("name", c.get("id", ""))
            entry = {
                "name": name,
                "id": c.get("id", ""),
                "domain": pack_data.get("domain_name", "general"),
                "difficulty_level": c.get("difficulty", 0.5),
                "estimated_hours": c.get("estimated_hours", 3.0),
                "is_goal_skill": c.get("is_goal_skill", False),
            }
            self.skill_map[name] = entry
            if self.graph is not None:
                self.graph.add_node(name, **entry)

        for edge in pack_data.get("prerequisite_edges", []):
            src_id = edge.get("source", "")
            tgt_id = edge.get("target", "")
            # Resolve id → name
            src = self._id_to_name(competencies, src_id)
            tgt = self._id_to_name(competencies, tgt_id)
            if not src or not tgt:
                continue
            e = {
                "source": src,
                "target": tgt,
                "link_type": "prerequisite",
                "strength": edge.get("strength", 0.8),
            }
            self._prereq_edges.append(e)
            self._all_edges.append(e)
            if self.graph is not None:
                self.graph.add_edge(src, tgt, link_type="prerequisite", strength=e["strength"])

        for edge in pack_data.get("transfer_edges", []):
            src_id = edge.get("source", "")
            tgt_id = edge.get("target", "")
            src = self._id_to_name(competencies, src_id)
            tgt = self._id_to_name(competencies, tgt_id)
            if not src or not tgt:
                continue
            coeff = min(edge.get("coefficient", edge.get("transfer_coefficient", 0.3)), 0.65)
            e = {
                "source": src,
                "target": tgt,
                "link_type": "transfer",
                "strength": coeff,
                "transfer_coefficient": coeff,
                "explanation": edge.get("explanation", ""),
            }
            self._transfer_edges.append(e)
            self._all_edges.append(e)
            if self.graph is not None:
                self.graph.add_edge(src, tgt, link_type="transfer",
                                    strength=coeff, transfer_coefficient=coeff,
                                    explanation=e["explanation"])

    @staticmethod
    def _id_to_name(competencies: list, comp_id: str) -> str:
        """Resolve competency id (or qualified id) to its name."""
        # Strip pack prefix if present (e.g. "pack-id::comp-id" → "comp-id")
        bare_id = comp_id.split("::")[-1] if "::" in comp_id else comp_id
        for c in competencies:
            if c.get("id") == bare_id or c.get("id") == comp_id:
                return c.get("name", bare_id)
        return ""

    def get_all_skills(self) -> List[Dict]:
        return list(self.skill_map.values())

    def get_skill(self, name: str) -> Optional[Dict]:
        return self.skill_map.get(name)

    def get_prerequisites(self, skill_name: str) -> List[str]:
        return [e["source"] for e in self._prereq_edges if e["target"] == skill_name]

    def get_successors(self, skill_name: str) -> List[str]:
        return [e["target"] for e in self._prereq_edges if e["source"] == skill_name]

    def get_reachable_skills(self, skill_name: str) -> Set[str]:
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

    def build_transfer_map(self) -> Dict[str, Dict]:
        """Return a transfer coefficient map compatible with TransferAnalyzer."""
        result = {}
        for e in self._transfer_edges:
            key = f"{e['source']}::{e['target']}"
            result[key] = {
                "source_skill": e["source"],
                "target_skill": e["target"],
                "transfer_coefficient": e["transfer_coefficient"],
                "explanation": e.get("explanation", ""),
            }
        return result
