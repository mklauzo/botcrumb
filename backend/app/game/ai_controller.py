"""AI decision logic for queens and unit behavior."""
import math
import numpy as np
from typing import Optional

from app.game.constants import (
    DEFENSE_RADIUS, DEFENDER_LEASH, ATTACK_RANGE, ATTACK_INTERVAL_TICKS,
    MAX_UNITS, UNIT_STATS, ATTACKER_VS_QUEEN_BONUS, DEFENDER_ZONE_BONUS,
    WORKER_ENERGY_VISION,
)
from app.game.types import Unit, Tribe, GameState
from app.game.sphere_math import great_circle_dist, move_on_sphere, random_sphere_point, los_blocked


def queen_ai_decision(tribe: Tribe, state: GameState, rng: np.random.Generator) -> Optional[str]:
    """Decide what unit type to produce. Returns unit type or None."""
    if tribe.queen_id is None or tribe.queen_id not in state.units:
        return None

    total_units = len(state.units)
    if total_units >= MAX_UNITS:
        return None

    queen = state.units[tribe.queen_id]
    tribe_units = [u for u in state.units.values() if u.tribe_id == tribe.id]
    defenders = [u for u in tribe_units if u.unit_type == "defender"]
    workers = [u for u in tribe_units if u.unit_type == "worker"]

    num_tribes_alive = sum(1 for t in state.tribes.values() if t.alive)
    min_defenders = max(math.ceil(num_tribes_alive * 1.5), math.ceil(len(tribe_units) * 0.30))

    # Check for enemies in defense zone
    enemies_in_zone = [
        u for u in state.units.values()
        if u.tribe_id != tribe.id and
        great_circle_dist(u.pos, queen.pos) <= DEFENSE_RADIUS * 3
    ]

    if enemies_in_zone or len(defenders) < min_defenders:
        if tribe.energy >= UNIT_STATS["defender"]["cost"]:
            return "defender"
    elif len(workers) < 2 or tribe.energy < 5:
        if tribe.energy >= UNIT_STATS["worker"]["cost"]:
            return "worker"
    else:
        if tribe.energy >= UNIT_STATS["attacker"]["cost"]:
            return "attacker"

    return None


def unit_behavior(unit: Unit, state: GameState,
                  rng: np.random.Generator) -> None:
    """Update unit target_pos and target_unit_id based on AI logic."""
    tribe = state.tribes.get(unit.tribe_id)
    if tribe is None or not tribe.alive:
        return

    if unit.unit_type == "queen":
        _queen_behavior(unit, state)
    elif unit.unit_type == "worker":
        _worker_behavior(unit, state, tribe, rng)
    elif unit.unit_type == "attacker":
        _attacker_behavior(unit, state, tribe)
    elif unit.unit_type == "defender":
        _defender_behavior(unit, state, tribe)


def _queen_behavior(unit: Unit, state: GameState) -> None:
    """Queen attacks nearest enemy in vision."""
    unit.target_pos = None
    nearest_enemy = _nearest_enemy_in_vision(unit, state)
    unit.target_unit_id = nearest_enemy.id if nearest_enemy else None


def _worker_behavior(unit: Unit, state: GameState,
                     tribe: Tribe, rng: np.random.Generator) -> None:
    """Worker collects energy and flees from enemies."""
    tribe = state.tribes[unit.tribe_id]
    queen = state.units.get(tribe.queen_id) if tribe.queen_id else None

    # Check for nearby enemies - flee
    enemies_nearby = _enemies_in_vision(unit, state)
    if enemies_nearby and queen:
        # Try to flee behind a stone away from enemies
        flee_target = _flee_direction(unit, enemies_nearby[0], state, rng)
        unit.target_pos = flee_target
        unit.target_unit_id = None
        return

    if unit.carrying_energy:
        # Return to queen
        if queen:
            unit.target_pos = queen.pos.copy()
        unit.target_unit_id = None
        return

    # Detect nearby energy sources within vision radius and share with tribe
    for es_id, es in state.energy_sources.items():
        if great_circle_dist(unit.pos, es.pos) <= WORKER_ENERGY_VISION:
            tribe.known_energy_sources.add(es_id)

    # Go to known energy source
    if tribe.known_energy_sources:
        best_es = None
        best_dist = float("inf")
        for es_id in list(tribe.known_energy_sources):
            es = state.energy_sources.get(es_id)
            if es is None:
                tribe.known_energy_sources.discard(es_id)
                continue
            d = great_circle_dist(unit.pos, es.pos)
            if d < best_dist:
                best_dist = d
                best_es = es
        if best_es:
            unit.target_pos = best_es.pos.copy()
            unit.known_energy_id = best_es.id
            unit.target_unit_id = None
            return

    # Wander randomly (update target occasionally)
    if unit.target_pos is None or _at_target(unit):
        unit.target_pos = random_sphere_point(rng)
    unit.target_unit_id = None


def _attacker_behavior(unit: Unit, state: GameState, tribe: Tribe) -> None:
    """Attacker chases nearest enemy in vision; pursues until out of sight."""
    # Continue chasing current target if still in vision
    if unit.target_unit_id is not None:
        target = state.units.get(unit.target_unit_id)
        if target and target.tribe_id != unit.tribe_id:
            dist = great_circle_dist(unit.pos, target.pos)
            vision = UNIT_STATS["attacker"]["vision"]
            if dist <= vision * 1.5 and not los_blocked(unit.pos, target.pos, state.stones):
                unit.target_pos = target.pos.copy()
                return

    # Find new target
    nearest = _nearest_enemy_in_vision(unit, state)
    if nearest:
        unit.target_unit_id = nearest.id
        unit.target_pos = nearest.pos.copy()
    else:
        unit.target_unit_id = None
        # Head toward enemy queen if known
        enemy_queens = [
            u for u in state.units.values()
            if u.tribe_id != unit.tribe_id and u.unit_type == "queen"
        ]
        if enemy_queens:
            closest = min(enemy_queens, key=lambda q: great_circle_dist(unit.pos, q.pos))
            unit.target_pos = closest.pos.copy()


def _defender_behavior(unit: Unit, state: GameState, tribe: Tribe) -> None:
    """Defender protects queen, attacks in defense zone."""
    queen = state.units.get(tribe.queen_id) if tribe.queen_id else None
    if queen is None:
        return

    queen_dist = great_circle_dist(unit.pos, queen.pos)

    # Attack nearest enemy
    nearest = _nearest_enemy_in_vision(unit, state)
    if nearest:
        unit.target_unit_id = nearest.id
        enemy_dist = great_circle_dist(unit.pos, nearest.pos)
        # Only chase within leash range from queen
        if queen_dist < DEFENDER_LEASH or enemy_dist < ATTACK_RANGE * 2:
            unit.target_pos = nearest.pos.copy()
            return

    unit.target_unit_id = None
    # Return to queen if too far
    if queen_dist > DEFENDER_LEASH * 0.7:
        unit.target_pos = queen.pos.copy()
    elif unit.target_pos is None:
        # Orbit around queen
        unit.target_pos = queen.pos.copy()


def _nearest_enemy_in_vision(unit: Unit, state: GameState) -> Optional[Unit]:
    vision = UNIT_STATS[unit.unit_type]["vision"]
    best = None
    best_dist = float("inf")
    for other in state.units.values():
        if other.tribe_id == unit.tribe_id:
            continue
        d = great_circle_dist(unit.pos, other.pos)
        if d <= vision and d < best_dist:
            if not los_blocked(unit.pos, other.pos, state.stones):
                best = other
                best_dist = d
    return best


def _enemies_in_vision(unit: Unit, state: GameState) -> list:
    vision = UNIT_STATS[unit.unit_type]["vision"]
    result = []
    for other in state.units.values():
        if other.tribe_id == unit.tribe_id:
            continue
        d = great_circle_dist(unit.pos, other.pos)
        if d <= vision and not los_blocked(unit.pos, other.pos, state.stones):
            result.append(other)
    return result


def _flee_direction(unit: Unit, threat: Unit, state: GameState,
                    rng: np.random.Generator) -> np.ndarray:
    """Compute flee target: away from threat, ideally behind a stone."""
    from app.game.sphere_math import normalize, SPHERE_RADIUS as R
    # Move in opposite direction from threat
    threat_dir = normalize(unit.pos - threat.pos)
    # Perturb to potentially go around a stone
    perturb = rng.standard_normal(3) * 0.3
    flee_dir = normalize(threat_dir + perturb)
    return flee_dir * R


def _at_target(unit: Unit) -> bool:
    if unit.target_pos is None:
        return True
    return great_circle_dist(unit.pos, unit.target_pos) < 5.0


def resolve_combat(attacker: Unit, target: Unit, state: GameState,
                   rng: np.random.Generator, tick: int) -> bool:
    """Attempt attack. Returns True if hit."""
    if tick - attacker.last_attack_tick < ATTACK_INTERVAL_TICKS:
        return False
    dist = great_circle_dist(attacker.pos, target.pos)
    if dist > ATTACK_RANGE:
        return False
    if los_blocked(attacker.pos, target.pos, state.stones):
        return False

    accuracy = UNIT_STATS[attacker.unit_type]["accuracy"]
    if attacker.unit_type == "attacker" and target.unit_type == "queen":
        accuracy += ATTACKER_VS_QUEEN_BONUS
    if attacker.unit_type == "defender":
        queen = state.units.get(state.tribes[attacker.tribe_id].queen_id)
        if queen and great_circle_dist(target.pos, queen.pos) <= DEFENSE_RADIUS:
            accuracy += DEFENDER_ZONE_BONUS

    if rng.random() < accuracy:
        target.hp -= 1
        attacker.last_attack_tick = tick
        return True
    attacker.last_attack_tick = tick
    return False
