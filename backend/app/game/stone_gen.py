"""Generate stones (spherical caps) ensuring navigation between queens."""
import numpy as np

from app.game.constants import SPHERE_RADIUS
from app.game.types import Stone
from app.game.sphere_math import normalize, fibonacci_sphere


MAX_SURFACE_FRACTION = 0.35   # max total surface coverage
MAX_CAP_ANGLE = 0.15          # max single stone size (~8.6 degrees)
QUEEN_BUFFER_ANGLE = 0.20     # keep stones away from queen positions
MAX_STONES = 60


def _stone_fraction(cap_angle: float) -> float:
    """Fraction of sphere surface covered by one spherical cap."""
    return (1 - np.cos(cap_angle)) / 2


def generate_stones(num_tribes: int, queen_positions: list,
                    rng: np.random.Generator) -> list:
    """Generate random stones, keeping them away from queen positions."""
    stones: list[Stone] = []
    total_fraction = 0.0
    stone_id = 0

    # Unit vectors of queen positions (for exclusion zone checks)
    queen_units = [q / np.linalg.norm(q) for q in queen_positions]

    attempts = 0
    while (total_fraction < MAX_SURFACE_FRACTION and
           len(stones) < MAX_STONES and
           attempts < 300):
        attempts += 1

        # Random stone size (small to moderate)
        cap_angle = rng.uniform(0.04, MAX_CAP_ANGLE)
        fraction = _stone_fraction(cap_angle)

        if total_fraction + fraction > MAX_SURFACE_FRACTION:
            continue

        # Random center on unit sphere
        v = rng.standard_normal(3)
        center = normalize(v)

        # Reject if too close to any queen
        too_close = False
        for qv in queen_units:
            dot = float(np.clip(np.dot(center, qv), -1.0, 1.0))
            angle = np.arccos(dot)
            if angle < cap_angle + QUEEN_BUFFER_ANGLE:
                too_close = True
                break
        if too_close:
            continue

        # Reject if overlapping too much with existing stones
        overlap = False
        for s in stones:
            dot = float(np.clip(np.dot(center, s.center), -1.0, 1.0))
            angle = np.arccos(dot)
            if angle < cap_angle + s.cap_angle:
                overlap = True
                break
        if overlap:
            continue

        stones.append(Stone(id=stone_id, center=center, cap_angle=cap_angle))
        total_fraction += fraction
        stone_id += 1

    return stones
