SPHERE_RADIUS = 6000.0
TICK_MS = 200           # 5 ticks per second
DT = TICK_MS / 1000.0   # seconds per tick

MAX_UNITS = 2000
DEFENSE_RADIUS = 10.0   # queen defense zone radius
DEFENDER_LEASH = 20.0   # max distance defender can go from queen

ATTACK_INTERVAL_TICKS = 25  # 1 attack every 5 seconds at 5 ticks/sec
ATTACK_RANGE = 3.0          # geodesic distance to trigger attack

ENERGY_SPAWN_INTERVAL = 300  # ticks
ENERGY_SPAWN_COUNT = (1, 5)  # min/max energy sources per spawn
ENERGY_AMOUNT = (10, 100)    # min/max energy per source

AI_DECISION_INTERVAL = 5    # queen AI runs every N ticks

WORKER_ENERGY_VISION = 50.0  # radius within which workers detect energy sources

# Unit stats
UNIT_STATS = {
    "worker":   {"speed": 2.0, "vision": 8.0, "hp": 1,  "cost": 1, "accuracy": 0.0},
    "attacker": {"speed": 3.0, "vision": 5.0, "hp": 3,  "cost": 3, "accuracy": 0.70},
    "defender": {"speed": 1.0, "vision": 3.0, "hp": 4,  "cost": 2, "accuracy": 0.50},
    "queen":    {"speed": 0.0, "vision": 5.0, "hp": 10, "cost": 0, "accuracy": 0.80},
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
