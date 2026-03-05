"""Spatial index for sphere units using scipy cKDTree."""
import numpy as np
from scipy.spatial import cKDTree


class SphereOctree:
    """O(N log N) build, O(log N + k) radius queries using cKDTree."""

    def __init__(self):
        self._ids: list = []
        self._units: dict = {}
        self._tree: cKDTree | None = None
        self._positions: np.ndarray | None = None

    def rebuild(self, units: dict) -> None:
        self._units = units
        if not units:
            self._ids = []
            self._tree = None
            self._positions = None
            return
        self._ids = list(units.keys())
        self._positions = np.array([units[uid].pos for uid in self._ids])
        self._tree = cKDTree(self._positions)

    def query_radius(self, center: np.ndarray, radius: float,
                     exclude_id: int | None = None) -> list:
        """Return all units within euclidean radius of center."""
        if self._tree is None:
            return []
        indices = self._tree.query_ball_point(center, radius)
        result = []
        for i in indices:
            uid = self._ids[i]
            if uid != exclude_id:
                result.append(self._units[uid])
        return result

    def nearest(self, center: np.ndarray, k: int = 1,
                exclude_id: int | None = None) -> list:
        """Return k nearest units."""
        if self._tree is None or len(self._ids) == 0:
            return []
        k_actual = min(k + (1 if exclude_id is not None else 0), len(self._ids))
        dists, indices = self._tree.query(center, k=k_actual)
        if k_actual == 1:
            indices = [indices]
        result = []
        for i in indices:
            uid = self._ids[i]
            if uid != exclude_id:
                result.append(self._units[uid])
                if len(result) >= k:
                    break
        return result
