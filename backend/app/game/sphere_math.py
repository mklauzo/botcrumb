"""Sphere surface math utilities."""
import numpy as np
from app.game.constants import SPHERE_RADIUS


def normalize(v: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(v)
    if n < 1e-12:
        return v
    return v / n


def great_circle_dist(a: np.ndarray, b: np.ndarray) -> float:
    """Geodesic distance between two points on the sphere."""
    a_u = a / SPHERE_RADIUS
    b_u = b / SPHERE_RADIUS
    dot = float(np.clip(np.dot(a_u, b_u), -1.0, 1.0))
    return SPHERE_RADIUS * np.arccos(dot)


def slerp(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    """Spherical linear interpolation. a and b are on the sphere surface."""
    a_u = normalize(a)
    b_u = normalize(b)
    dot = float(np.clip(np.dot(a_u, b_u), -1.0, 1.0))
    if dot > 0.9999:
        return normalize(a_u + t * (b_u - a_u)) * SPHERE_RADIUS
    omega = np.arccos(dot)
    sin_omega = np.sin(omega)
    return (np.sin((1 - t) * omega) / sin_omega * a_u +
            np.sin(t * omega) / sin_omega * b_u) * SPHERE_RADIUS


def move_on_sphere(pos: np.ndarray, target: np.ndarray, speed: float, dt: float) -> np.ndarray:
    """Move pos towards target along great circle at given speed."""
    dist = great_circle_dist(pos, target)
    if dist < 1e-4:
        return target.copy()
    move = speed * dt
    if move >= dist:
        return target.copy()
    return slerp(pos, target, move / dist)


def fibonacci_sphere(n: int) -> list:
    """n evenly distributed points on sphere surface."""
    golden = (1 + np.sqrt(5)) / 2
    points = []
    for i in range(n):
        theta = np.arccos(1 - 2 * (i + 0.5) / n)
        phi = 2 * np.pi * i / golden
        x = np.sin(theta) * np.cos(phi)
        y = np.sin(theta) * np.sin(phi)
        z = np.cos(theta)
        points.append(np.array([x, y, z]) * SPHERE_RADIUS)
    return points


def random_sphere_point(rng: np.random.Generator) -> np.ndarray:
    """Uniform random point on sphere surface."""
    v = rng.standard_normal(3)
    return normalize(v) * SPHERE_RADIUS


def los_blocked(a_sph: np.ndarray, b_sph: np.ndarray, stones: list) -> bool:
    """Check if line-of-sight between a and b is blocked by any stone cap."""
    a = normalize(a_sph)
    b = normalize(b_sph)

    # Great circle normal
    n = np.cross(a, b)
    n_norm = np.linalg.norm(n)
    if n_norm < 1e-10:
        return False
    n = n / n_norm

    for stone in stones:
        c = stone.center  # unit vector
        cap = stone.cap_angle

        # Project stone center onto the great circle plane
        c_perp = c - np.dot(c, n) * n
        c_perp_norm = np.linalg.norm(c_perp)
        if c_perp_norm < 1e-10:
            continue
        c_gc = c_perp / c_perp_norm  # closest point on full great circle

        # Check if c_gc lies within arc from a to b
        in_arc = (np.dot(n, np.cross(a, c_gc)) >= -1e-9 and
                  np.dot(n, np.cross(c_gc, b)) >= -1e-9)

        if in_arc:
            ang = np.arccos(float(np.clip(np.dot(c_gc, c), -1.0, 1.0)))
        else:
            ang_a = np.arccos(float(np.clip(np.dot(a, c), -1.0, 1.0)))
            ang_b = np.arccos(float(np.clip(np.dot(b, c), -1.0, 1.0)))
            ang = min(ang_a, ang_b)

        if ang < cap:
            return True

    return False

