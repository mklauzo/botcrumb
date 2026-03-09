SPHERE_RADIUS = 6000.0
TICK_MS = 200           # 5 ticks per second
DT = TICK_MS / 1000.0   # seconds per tick

MAX_UNITS = 2000
MAX_DEFENDERS = 20      # max live defenders per tribe
DEFENSE_RADIUS = 150.0  # queen defense zone radius
DEFENDER_LEASH = 500.0  # max distance defender can chase from queen
DEFENDER_PATROL_MIN = 100.0  # min patrol radius around queen
DEFENDER_PATROL_MAX = 400.0  # max patrol radius around queen

ATTACK_INTERVAL_TICKS = 25  # 1 attack every 5 seconds at 5 ticks/sec
ATTACK_RANGE = 3.0          # geodesic distance to trigger attack

ENERGY_SPAWN_INTERVAL = 9000  # ticks (30 minutes at 200ms/tick)
ENERGY_SPAWN_COUNT = (1, 5)  # min/max energy sources per spawn
ENERGY_AMOUNT = (10, 60)     # min/max energy per source

AI_DECISION_INTERVAL = 5    # queen AI runs every N ticks

WORKER_ENERGY_VISION = 200.0  # radius within which workers detect energy sources

PALACE_VISION_PER_FLOOR = 25.0  # vision radius increase per palace floor
ATTACKER_QUEEN_VISION = 50.0    # radius at which attacker can spot an enemy queen
PALACE_BUILD_THRESHOLD = 10     # min energy to spend on palace brick
MAX_WORKERS_PER_SOURCE = 10     # max workers (any tribe) allowed per energy source

# Unit stats
UNIT_STATS = {
    "worker":   {"speed": 6.0, "vision": 16.0, "hp": 1,  "cost": 1, "accuracy": 0.0,  "attack_range": 3.0},
    "attacker": {"speed": 9.0, "vision": 25.0, "hp": 3,  "cost": 3, "accuracy": 0.70, "attack_range": 3.0},
    "defender": {"speed": 3.0, "vision": 3.0,  "hp": 4,  "cost": 2, "accuracy": 0.50, "attack_range": 3.0},
    "queen":    {"speed": 0.0, "vision": 800.0, "hp": 10, "cost": 0, "accuracy": 0.80, "attack_range": 5.0},
}

# Attacker vs queen: +20% accuracy
ATTACKER_VS_QUEEN_BONUS = 0.20
# Defender in defense zone: +10% accuracy
DEFENDER_ZONE_BONUS = 0.10

# Tribe neon colors (hex)
TRIBE_COLORS = [
    "#00ff88",
    "#ff0066",
    "#00ccff",
    "#ffcc00",
    "#ff6600",
    "#cc00ff",
    "#00ffcc",
    "#ff3333",
    "#66ff00",
    "#ff66cc",
]
