from dataclasses import dataclass, field
from typing import Optional
import numpy as np


@dataclass
class Unit:
    id: int
    tribe_id: int
    unit_type: str          # "queen" | "worker" | "attacker" | "defender"
    pos: np.ndarray         # 3D point on sphere surface, magnitude = SPHERE_RADIUS
    hp: int
    max_hp: int
    target_pos: Optional[np.ndarray] = None
    target_unit_id: Optional[int] = None
    last_attack_tick: int = 0
    carrying_energy: bool = False
    known_energy_id: Optional[int] = None  # worker: tracked energy source


@dataclass
class Tribe:
    id: int
    name: str
    color: str              # hex like "#00ff88"
    energy: int = 10
    queen_id: Optional[int] = None
    alive: bool = True
    # shared knowledge: set of known energy source ids
    known_energy_sources: set = field(default_factory=set)
    # queen alert: position of enemy attacker spotted by queen (None if no threat)
    alert_pos: Optional[np.ndarray] = None
    # palace bricks built (each costs 1 energy, height = floor(sqrt(bricks)))
    palace_bricks: int = 0


@dataclass
class EnergySource:
    id: int
    pos: np.ndarray         # 3D point on sphere surface
    amount: int
    reserved_by: Optional[int] = None  # unit id reserving this source
    owner_tribe_id: Optional[int] = None  # tribe that last collected from this source


@dataclass
class Stone:
    id: int
    center: np.ndarray      # unit vector (magnitude = 1)
    cap_angle: float        # angular radius in radians


@dataclass
class GameState:
    tick: int = 0
    running: bool = False
    started_at: float = 0.0   # Unix timestamp (seconds) when game started
    tribes: dict = field(default_factory=dict)    # tribe_id -> Tribe
    units: dict = field(default_factory=dict)     # unit_id -> Unit
    energy_sources: dict = field(default_factory=dict)  # es_id -> EnergySource
    stones: list = field(default_factory=list)    # list of Stone
    next_unit_id: int = 1
    next_energy_id: int = 1
    winner: Optional[dict] = None
    events: list = field(default_factory=list)    # cleared each tick after broadcast
