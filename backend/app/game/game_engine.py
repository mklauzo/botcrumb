"""Main game engine: tick loop, spawning, combat, collection."""
import numpy as np
from typing import Optional

from app.game.constants import (
    SPHERE_RADIUS, DT, MAX_UNITS, ATTACK_RANGE,
    ENERGY_SPAWN_INTERVAL, ENERGY_SPAWN_COUNT, ENERGY_AMOUNT,
    AI_DECISION_INTERVAL, UNIT_STATS, TRIBE_COLORS, DEFENSE_RADIUS
)
from app.game.types import Unit, Tribe, EnergySource, Stone, GameState
from app.game.sphere_math import (
    fibonacci_sphere, random_sphere_point, great_circle_dist, move_on_sphere
)
from app.game.octree import SphereOctree
from app.game.ai_controller import (
    queen_ai_decision, unit_behavior, resolve_combat
)
from app.game.stone_gen import generate_stones


class GameEngine:
    def __init__(self):
        self.state = GameState()
        self.octree = SphereOctree()
        self.rng = np.random.default_rng()
        self._prev_positions: dict = {}
        self._diff_data: dict = {}

    def init_game(self, num_tribes: int, tribe_names: list[str]) -> None:
        self.state = GameState(running=True)
        self.rng = np.random.default_rng()

        # Place queens using fibonacci sphere
        queen_positions = fibonacci_sphere(num_tribes)

        # Generate stones
        self.state.stones = generate_stones(num_tribes, queen_positions, self.rng)

        # Create tribes and queens
        for i in range(num_tribes):
            color = TRIBE_COLORS[i % len(TRIBE_COLORS)]
            tribe = Tribe(id=i, name=tribe_names[i], color=color)
            self.state.tribes[i] = tribe

            # Spawn queen
            queen_id = self._next_unit_id()
            hp = UNIT_STATS["queen"]["hp"]
            queen = Unit(
                id=queen_id,
                tribe_id=i,
                unit_type="queen",
                pos=queen_positions[i].copy(),
                hp=hp,
                max_hp=hp,
            )
            self.state.units[queen_id] = queen
            tribe.queen_id = queen_id

            # Initial units — temporarily give enough energy to cover spawn costs
            from app.game.constants import UNIT_STATS as _US
            spawn_cost = (10 * _US["worker"]["cost"] + 3 * _US["attacker"]["cost"]
                          + 1 * _US["defender"]["cost"])
            tribe.energy = spawn_cost
            for _ in range(10):
                self._spawn_unit(tribe, "worker")
            for _ in range(3):
                self._spawn_unit(tribe, "attacker")
            for _ in range(1):
                self._spawn_unit(tribe, "defender")
            tribe.energy = 0  # reset to zero so queen AI doesn't immediately spawn units

    def _next_unit_id(self) -> int:
        uid = self.state.next_unit_id
        self.state.next_unit_id += 1
        return uid

    def _next_energy_id(self) -> int:
        eid = self.state.next_energy_id
        self.state.next_energy_id += 1
        return eid

    def _spawn_unit(self, tribe: Tribe, unit_type: str) -> Optional[Unit]:
        if len(self.state.units) >= MAX_UNITS:
            return None
        queen = self.state.units.get(tribe.queen_id)
        if queen is None:
            return None

        cost = UNIT_STATS[unit_type]["cost"]
        if tribe.energy < cost:
            return None
        tribe.energy -= cost

        # Spawn near queen
        offset_dir = self.rng.standard_normal(3)
        spawn_radius = 5.0 + self.rng.random() * 10.0
        from app.game.sphere_math import normalize
        offset = normalize(offset_dir) * spawn_radius
        pos = normalize(queen.pos + offset) * SPHERE_RADIUS

        uid = self._next_unit_id()
        hp = UNIT_STATS[unit_type]["hp"]
        unit = Unit(
            id=uid,
            tribe_id=tribe.id,
            unit_type=unit_type,
            pos=pos,
            hp=hp,
            max_hp=hp,
        )
        self.state.units[uid] = unit
        return unit

    def tick(self) -> dict:
        """Run one game tick. Returns diff data."""
        if not self.state.running:
            return {}

        tick = self.state.tick
        self.state.events = []
        self._diff_data = {
            "moved": [],
            "spawned": [],
            "died": [],
            "hp_changed": [],
            "hit_flashes": [],
            "energy_spawned": [],
            "energy_depleted": [],
            "tribe_stats": [],
            "events": [],
        }

        # Save previous positions for diff
        self._prev_positions = {uid: u.pos.copy() for uid, u in self.state.units.items()}

        # 1. AI decisions (queens every N ticks)
        if tick % AI_DECISION_INTERVAL == 0:
            self._ai_decisions()

        # 2. Spawn energy
        if tick % ENERGY_SPAWN_INTERVAL == 0 and tick > 0:
            self._spawn_energy()

        # 3. Unit behavior update
        for unit in list(self.state.units.values()):
            unit_behavior(unit, self.state, self.rng)

        # 4. Move units
        self._move_units()

        # 5. Combat
        self._resolve_combat()

        # 6. Energy collection
        self._collect_energy()

        # 7. Remove dead units
        self._remove_dead()

        # 8. Check win condition
        self._check_win()

        # 9. Rebuild spatial index
        self.octree.rebuild(self.state.units)

        # 10. Compute diff
        self._compute_diff()

        self.state.tick += 1
        return self._diff_data

    def _ai_decisions(self) -> None:
        for tribe in self.state.tribes.values():
            if not tribe.alive:
                continue
            unit_type = queen_ai_decision(tribe, self.state, self.rng)
            if unit_type:
                new_unit = self._spawn_unit(tribe, unit_type)
                if new_unit:
                    self._diff_data["spawned"].append(self._serialize_unit(new_unit))

    def _spawn_energy(self) -> None:
        count = int(self.rng.integers(ENERGY_SPAWN_COUNT[0], ENERGY_SPAWN_COUNT[1] + 1))
        for _ in range(count):
            pos = random_sphere_point(self.rng)
            amount = int(self.rng.integers(ENERGY_AMOUNT[0], ENERGY_AMOUNT[1] + 1))
            eid = self._next_energy_id()
            es = EnergySource(id=eid, pos=pos, amount=amount)
            self.state.energy_sources[eid] = es
            self._diff_data["energy_spawned"].append({
                "id": eid,
                "pos": pos.tolist(),
                "amount": amount,
            })

    def _move_units(self) -> None:
        for unit in self.state.units.values():
            if unit.unit_type == "queen":
                continue
            speed = UNIT_STATS[unit.unit_type]["speed"]
            target = unit.target_pos
            if target is not None:
                unit.pos = move_on_sphere(unit.pos, target, speed, DT)

    def _resolve_combat(self) -> None:
        tick = self.state.tick
        units_list = list(self.state.units.values())

        for attacker in units_list:
            if attacker.unit_type == "worker":
                continue  # workers don't attack
            if attacker.id not in self.state.units:
                continue

            # Find targets in attack range
            atk_range = UNIT_STATS[attacker.unit_type]["attack_range"]
            target_unit = None
            if attacker.target_unit_id and attacker.target_unit_id in self.state.units:
                candidate = self.state.units[attacker.target_unit_id]
                if (candidate.tribe_id != attacker.tribe_id and
                        great_circle_dist(attacker.pos, candidate.pos) <= atk_range):
                    target_unit = candidate
            else:
                # Find nearest enemy in attack range
                best_dist = atk_range + 1
                for other in self.state.units.values():
                    if other.tribe_id == attacker.tribe_id:
                        continue
                    d = great_circle_dist(attacker.pos, other.pos)
                    if d <= atk_range and d < best_dist:
                        best_dist = d
                        target_unit = other

            if target_unit is None:
                continue

            hit = resolve_combat(attacker, target_unit, self.state, self.rng, tick)
            if hit:
                self._diff_data["hit_flashes"].append(target_unit.pos.tolist())
                self._diff_data["hp_changed"].append([target_unit.id, target_unit.hp])

                if target_unit.hp <= 0:
                    tribe_name = self.state.tribes[target_unit.tribe_id].name
                    attacker_tribe = self.state.tribes[attacker.tribe_id].name
                    self.state.events.append({
                        "type": "unit_killed",
                        "tribe_id": attacker.tribe_id,
                        "msg": f"{attacker_tribe} killed {tribe_name}'s {target_unit.unit_type}",
                    })
                    if target_unit.unit_type == "queen":
                        self.state.events.append({
                            "type": "queen_killed",
                            "tribe_id": attacker.tribe_id,
                            "msg": f"{tribe_name}'s queen was eliminated by {attacker_tribe}!",
                        })

    def _collect_energy(self) -> None:
        for unit in list(self.state.units.values()):
            if unit.unit_type != "worker":
                continue
            tribe = self.state.tribes[unit.tribe_id]
            queen = self.state.units.get(tribe.queen_id)

            if unit.carrying_energy:
                # Deliver to queen
                if queen and great_circle_dist(unit.pos, queen.pos) < 10.0:
                    tribe.energy += 1
                    unit.carrying_energy = False
                    unit.target_pos = None
            else:
                # Check for energy sources nearby
                for es_id, es in list(self.state.energy_sources.items()):
                    if great_circle_dist(unit.pos, es.pos) < 8.0:
                        es.amount -= 1
                        unit.carrying_energy = True
                        unit.target_pos = None

                        # Share location with tribe
                        if es.amount > 0:
                            tribe.known_energy_sources.add(es_id)
                            self.state.events.append({
                                "type": "energy_found",
                                "tribe_id": tribe.id,
                                "msg": f"{tribe.name} found energy source ({es.amount} remaining)",
                            })
                        else:
                            tribe.known_energy_sources.discard(es_id)
                            del self.state.energy_sources[es_id]
                            self._diff_data["energy_depleted"].append(es_id)
                            # Remove from all tribes
                            for t in self.state.tribes.values():
                                t.known_energy_sources.discard(es_id)
                        break

    def _remove_dead(self) -> None:
        dead_ids = [uid for uid, u in self.state.units.items() if u.hp <= 0]
        for uid in dead_ids:
            if uid not in self.state.units:
                continue
            unit = self.state.units[uid]
            self._diff_data["died"].append(uid)

            # If queen died, mark tribe as dead
            tribe = self.state.tribes.get(unit.tribe_id)
            if tribe and unit.unit_type == "queen":
                tribe.alive = False
                tribe.queen_id = None
                # Kill all tribe units
                tribe_dead = [
                    u.id for u in list(self.state.units.values())
                    if u.tribe_id == unit.tribe_id and u.id != uid
                ]
                for tid in tribe_dead:
                    self._diff_data["died"].append(tid)
                    del self.state.units[tid]

            del self.state.units[uid]

    def _check_win(self) -> None:
        alive_tribes = [t for t in self.state.tribes.values() if t.alive]
        if len(alive_tribes) == 1:
            winner = alive_tribes[0]
            self.state.running = False
            self.state.winner = {"id": winner.id, "name": winner.name}
        elif len(alive_tribes) == 0:
            self.state.running = False
            self.state.winner = {"id": -1, "name": "Draw"}

    def _compute_diff(self) -> None:
        # Moved units (position changed)
        for uid, unit in self.state.units.items():
            prev = self._prev_positions.get(uid)
            if prev is not None and not np.allclose(prev, unit.pos, atol=0.01):
                self._diff_data["moved"].append([uid] + unit.pos.tolist())

        # Tribe stats
        for tribe in self.state.tribes.values():
            counts = {"worker": 0, "attacker": 0, "defender": 0, "queen": 0}
            for u in self.state.units.values():
                if u.tribe_id == tribe.id:
                    counts[u.unit_type] = counts.get(u.unit_type, 0) + 1
            self._diff_data["tribe_stats"].append({
                "id": tribe.id,
                "energy": tribe.energy,
                "units": counts,
                "alive": tribe.alive,
            })

        # Events
        self._diff_data["events"] = self.state.events

    def _serialize_unit(self, unit: Unit) -> dict:
        return {
            "id": unit.id,
            "tribe_id": unit.tribe_id,
            "type": unit.unit_type,
            "pos": unit.pos.tolist(),
            "hp": unit.hp,
            "max_hp": unit.max_hp,
        }

    def get_snapshot(self) -> dict:
        """Full game state snapshot for new WebSocket connections."""
        return {
            "type": "game_init",
            "tick": self.state.tick,
            "sphere_radius": SPHERE_RADIUS,
            "stones": [
                {"id": s.id, "center": s.center.tolist(), "cap_angle": s.cap_angle}
                for s in self.state.stones
            ],
            "tribes": [
                {"id": t.id, "name": t.name, "color": t.color, "energy": t.energy, "alive": t.alive}
                for t in self.state.tribes.values()
            ],
            "units": [self._serialize_unit(u) for u in self.state.units.values()],
            "energy_sources": [
                {"id": es.id, "pos": es.pos.tolist(), "amount": es.amount}
                for es in self.state.energy_sources.values()
            ],
        }
