"""AI decision logic for queens and unit behavior."""
import math
import numpy as np
from typing import Optional

from app.game.constants import (
    DEFENSE_RADIUS, DEFENDER_LEASH, ATTACK_RANGE, ATTACK_INTERVAL_TICKS,
    MAX_UNITS, MAX_DEFENDERS, UNIT_STATS, ATTACKER_VS_QUEEN_BONUS, DEFENDER_ZONE_BONUS,
    WORKER_ENERGY_VISION, DEFENDER_PATROL_MIN, DEFENDER_PATROL_MAX,
    PALACE_BUILD_THRESHOLD, MAX_WORKERS_PER_SOURCE, ATTACKER_QUEEN_VISION,
    PALACE_VISION_PER_FLOOR,
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
    attackers = [u for u in tribe_units if u.unit_type == "attacker"]
    workers = [u for u in tribe_units if u.unit_type == "worker"]

    num_tribes_alive = sum(1 for t in state.tribes.values() if t.alive)
    min_defenders = max(math.ceil(num_tribes_alive * 1.5), math.ceil(len(tribe_units) * 0.30))

    under_attack = tribe.alert_pos is not None
    enemies_in_zone = any(
        u.tribe_id != tribe.id and
        great_circle_dist(u.pos, queen.pos) <= DEFENSE_RADIUS * 3
        for u in state.units.values()
    )

    if tribe.energy < UNIT_STATS["worker"]["cost"]:
        return None

    # 1. Defenders — when under attack or below minimum, up to MAX_DEFENDERS
    need_defenders = (enemies_in_zone or under_attack or len(defenders) < min_defenders)
    if need_defenders and len(defenders) < MAX_DEFENDERS:
        if tribe.energy >= UNIT_STATS["defender"]["cost"]:
            return "defender"

    # 2. Attackers — aggressive production when energy comfortable, ratio < 3:1 vs defenders
    if not under_attack and tribe.energy >= 12:
        if len(attackers) < len(defenders) * 3:
            if tribe.energy >= UNIT_STATS["attacker"]["cost"]:
                return "attacker"

    # 3. Late game / rich: build attackers freely when defenses are solid
    if not under_attack and tribe.energy >= 20 and len(defenders) >= min_defenders:
        if tribe.energy >= UNIT_STATS["attacker"]["cost"]:
            return "attacker"

    # 4. Palace — greedy queen builds palace when defenses solid and has spare energy
    if not under_attack and tribe.energy >= PALACE_BUILD_THRESHOLD and len(defenders) >= min_defenders:
        return "palace"

    # 5. Workers — always, no cap
    return "worker"


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
        _attacker_behavior(unit, state, tribe, rng)
    elif unit.unit_type == "defender":
        _defender_behavior(unit, state, tribe, rng)


def _queen_behavior(unit: Unit, state: GameState) -> None:
    """Queen attacks nearest enemy in vision; shares spotted energy sources with tribe."""
    unit.target_pos = None
    nearest_enemy = _nearest_enemy_in_vision(unit, state)
    unit.target_unit_id = nearest_enemy.id if nearest_enemy else None

    # Share energy sources visible to queen with all tribe workers
    # Also alert defenders about enemy attackers in vision
    tribe = state.tribes.get(unit.tribe_id)
    if tribe:
        vision = UNIT_STATS["queen"]["vision"]
        nearest_attacker = None
        nearest_dist = float('inf')
        for es_id, es in state.energy_sources.items():
            if great_circle_dist(unit.pos, es.pos) <= vision:
                tribe.known_energy_sources.add(es_id)
        for other in state.units.values():
            if other.tribe_id == unit.tribe_id:
                continue
            if other.unit_type != 'attacker':
                continue
            d = great_circle_dist(unit.pos, other.pos)
            if d <= vision and d < nearest_dist:
                nearest_dist = d
                nearest_attacker = other
        tribe.alert_pos = nearest_attacker.pos.copy() if nearest_attacker else None


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

    # Go to known energy source (respect MAX_WORKERS_PER_SOURCE)
    if tribe.known_energy_sources:
        best_es = None
        best_dist = float("inf")
        for es_id in list(tribe.known_energy_sources):
            es = state.energy_sources.get(es_id)
            if es is None:
                tribe.known_energy_sources.discard(es_id)
                continue
            # Skip sources that already have max workers assigned
            workers_here = sum(
                1 for u in state.units.values()
                if u.unit_type == "worker" and u.known_energy_id == es_id
            )
            if workers_here >= MAX_WORKERS_PER_SOURCE:
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


def _attacker_behavior(unit: Unit, state: GameState, tribe: Tribe,
                        rng: np.random.Generator) -> None:
    """Attacker hunts enemies in vision; explores randomly when no target found."""
    vision = UNIT_STATS["attacker"]["vision"]

    # Continue chasing current target if still close enough
    if unit.target_unit_id is not None:
        target = state.units.get(unit.target_unit_id)
        if target and target.tribe_id != unit.tribe_id:
            dist = great_circle_dist(unit.pos, target.pos)
            if dist <= vision * 1.5 and not los_blocked(unit.pos, target.pos, state.stones):
                unit.target_pos = target.pos.copy()
                return

    # Priority 1: nearest enemy worker in vision
    best_worker: Optional[Unit] = None
    best_worker_dist = float('inf')
    for other in state.units.values():
        if other.tribe_id == unit.tribe_id or other.unit_type != 'worker':
            continue
        d = great_circle_dist(unit.pos, other.pos)
        if d <= vision and d < best_worker_dist and not los_blocked(unit.pos, other.pos, state.stones):
            best_worker_dist = d
            best_worker = other

    if best_worker:
        unit.target_unit_id = best_worker.id
        unit.target_pos = best_worker.pos.copy()
        return

    # Priority 2: any other enemy in vision
    nearest = _nearest_enemy_in_vision(unit, state)
    if nearest:
        unit.target_unit_id = nearest.id
        unit.target_pos = nearest.pos.copy()
        return

    # Priority 3: enemy queen spotted within extended queen-vision radius
    best_queen: Optional[Unit] = None
    best_queen_dist = float('inf')
    for other in state.units.values():
        if other.tribe_id == unit.tribe_id or other.unit_type != 'queen':
            continue
        d = great_circle_dist(unit.pos, other.pos)
        if d <= ATTACKER_QUEEN_VISION and d < best_queen_dist and not los_blocked(unit.pos, other.pos, state.stones):
            best_queen_dist = d
            best_queen = other

    if best_queen:
        unit.target_unit_id = best_queen.id
        unit.target_pos = best_queen.pos.copy()
        return

    # No target in vision — explore randomly (like a worker searching for energy)
    unit.target_unit_id = None
    if unit.target_pos is None or _at_target(unit):
        unit.target_pos = random_sphere_point(rng)


def _defender_behavior(unit: Unit, state: GameState, tribe: Tribe,
                        rng: np.random.Generator) -> None:
    """Defender patrols around queen or guards energy sources if surplus."""
    queen = state.units.get(tribe.queen_id) if tribe.queen_id else None
    if queen is None:
        return

    queen_dist = great_circle_dist(unit.pos, queen.pos)

    # If defender is within queen's vision radius, it can see all enemies queen sees
    queen_vision = (UNIT_STATS["queen"]["vision"]
                    + math.isqrt(tribe.palace_bricks) * PALACE_VISION_PER_FLOOR)
    in_queen_vision = great_circle_dist(unit.pos, queen.pos) <= queen_vision
    if in_queen_vision:
        nearest = _nearest_enemy_in_range(unit, state, queen_vision)
    else:
        nearest = _nearest_enemy_in_vision(unit, state)
    if nearest:
        unit.target_unit_id = nearest.id
        enemy_dist = great_circle_dist(unit.pos, nearest.pos)
        if queen_dist < DEFENDER_LEASH or enemy_dist < ATTACK_RANGE * 2:
            unit.target_pos = nearest.pos.copy()
            return

    unit.target_unit_id = None

    # If queen spotted an enemy attacker — intercept it
    if tribe.alert_pos is not None:
        unit.target_pos = tribe.alert_pos.copy()
        return

    # Determine if this defender should guard an energy source (surplus defenders)
    tribe_units = [u for u in state.units.values() if u.tribe_id == tribe.id]
    num_tribes_alive = sum(1 for t in state.tribes.values() if t.alive)
    min_defenders = max(math.ceil(num_tribes_alive * 1.5), math.ceil(len(tribe_units) * 0.30))
    tribe_defender_ids = sorted(u.id for u in tribe_units if u.unit_type == "defender")
    my_rank = tribe_defender_ids.index(unit.id) if unit.id in tribe_defender_ids else 0

    # Surplus defenders (rank >= min_defenders) guard nearest known energy source
    if my_rank >= int(min_defenders) and tribe.known_energy_sources:
        best_es = None
        best_dist = float("inf")
        for es_id in tribe.known_energy_sources:
            es = state.energy_sources.get(es_id)
            if es is None:
                continue
            d = great_circle_dist(unit.pos, es.pos)
            if d < best_dist:
                best_dist = d
                best_es = es
        if best_es:
            if unit.target_pos is None or _at_target(unit):
                unit.target_pos = _random_patrol_point(best_es.pos, 30.0, rng)
            return

    # Patrol radius is stable per unit (spread defenders across patrol range)
    patrol_radius = DEFENDER_PATROL_MIN + (unit.id % 31) * (
        (DEFENDER_PATROL_MAX - DEFENDER_PATROL_MIN) / 30.0
    )

    # Pick new patrol point when reached target or too far from queen
    if unit.target_pos is None or _at_target(unit) or queen_dist > DEFENDER_LEASH:
        unit.target_pos = _random_patrol_point(queen.pos, patrol_radius, rng)


def _random_patrol_point(queen_pos: np.ndarray, radius: float,
                          rng: np.random.Generator) -> np.ndarray:
    """Return a random point on the sphere at geodesic distance `radius` from queen."""
    from app.game.sphere_math import normalize
    from app.game.constants import SPHERE_RADIUS as R
    q = normalize(queen_pos)
    # Random tangent vector perpendicular to q
    arb = rng.standard_normal(3)
    arb -= np.dot(arb, q) * q
    t = normalize(arb)
    b = np.cross(q, t)
    angle = rng.uniform(0, 2 * math.pi)
    d = math.cos(angle) * t + math.sin(angle) * b
    return R * (math.cos(radius / R) * q + math.sin(radius / R) * d)


def _nearest_enemy_in_range(unit: Unit, state: GameState, vision: float) -> Optional[Unit]:
    """Find nearest enemy within a given vision radius (ignores unit's own vision stat)."""
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
    if los_blocked(attacker.pos, target.pos, state.stones):
        return False

    atk_range = UNIT_STATS[attacker.unit_type]["attack_range"]
    if dist > atk_range:
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
