// Movimiento y colisiones SIN dependencias de Three.js (se prueba en Node).
// `world` debe ofrecer:
//   groundAt(x, z, refY) -> null | { y, kind: 'ground' | 'water' }   (superficie más alta alcanzable desde refY)
//   obstacles: [{x, z, r}]         círculos bloqueantes (troncos, rocas…)
//   bounds: {minX, maxX, minZ, maxZ} | null
//   killY: número (por debajo => cayó al vacío)

export const DEFAULTS = {
  speed: 3.2, accel: 14, radius: 0.35,
  stepMax: 0.65,    // escalón máximo que sube sin saltar (resuelve los 0.56 m del puente)
  dropMax: 0.9,     // caída máxima que baja caminando
  gravity: 22,
};

export function createBody(x = 0, y = 0, z = 0, opts = {}) {
  return { x, y, z, vx: 0, vz: 0, vy: 0, yaw: 0, grounded: true, jumping: false, speed01: 0, ...DEFAULTS, ...opts };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return a + d * t;
}

function blockedByObstacle(world, b, x, z) {
  const obs = world.obstacles || [];
  for (const o of obs) {
    const dx = x - o.x, dz = z - o.z, rr = o.r + b.radius;
    if (dx * dx + dz * dz < rr * rr) {
      // Si ya estamos dentro, solo se bloquea el movimiento que nos mete más.
      const cx = b.x - o.x, cz = b.z - o.z;
      if (cx * cx + cz * cz < dx * dx + dz * dz && cx * cx + cz * cz < rr * rr) continue;
      return true;
    }
  }
  return false;
}

/**
 * Suelo "con huecos": los tablones de un puente suelen tener separaciones (en `puente.glb`, ≈10 cm entre tablas).
 * Un solo rayo en el centro del personaje cae por esa rendija, ve agua o terreno bajo el puente y lo toma por vacío:
 * el personaje se frena o se hunde justo ahí. Aquí se prueba además a ambos lados del punto (en X y en Z):
 * si LAS DOS muestras opuestas son suelo a la misma altura, el punto está sobre un hueco estrecho y se toma esa altura.
 * Un borde real (suelo de un solo lado) NO cuenta, así el río y los bordes del tablero siguen siendo sólidos.
 *
 * raw(x, z, refY) -> null | { y, kind }  (el groundAt "crudo" de un único rayo)
 */
export const GAP_R = 0.14;
export function resolveGround(raw, x, z, refY, r = GAP_R) {
  const c = raw(x, z, refY);
  let best = c && c.kind === 'ground' ? c : null;
  for (const [dx, dz] of [[r, 0], [0, r]]) {
    const a = raw(x + dx, z + dz, refY), b = raw(x - dx, z - dz, refY);
    if (!(a && b && a.kind === 'ground' && b.kind === 'ground')) continue;
    const y = Math.max(a.y, b.y);
    // misma altura a ambos lados: rendija entre dos tablones; alturas distintas: rendija entre el tablero y la orilla
    // (solo si el centro no es suelo, para no "subir" a escalones reales)
    if (Math.abs(a.y - b.y) <= 0.1 ? (!best || y > best.y + 0.05) : !best) best = { y, kind: 'ground' };
  }
  return best || c;
}

/**
 * Seguimiento de compañeros: avanza el cuerpo `c` hacia su puesto detrás del líder `L` (slot 1, 2…).
 * Devuelve { teleport:{x,z} } solo si quedó a más de 14 m (se recoloca detrás del líder), si no null.
 */
export function followStep(c, L, slot, dt, world) {
  const back = { x: -Math.sin(L.yaw), z: -Math.cos(L.yaw) }, side = { x: Math.cos(L.yaw), z: -Math.sin(L.yaw) };
  const tx = L.x + back.x * 1.5 * slot + side.x * (slot % 2 ? 0.9 : -0.9);
  const tz = L.z + back.z * 1.5 * slot + side.z * (slot % 2 ? 0.9 : -0.9);
  const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
  if (d > 14) return { teleport: { x: L.x + back.x * 1.5, z: L.z + back.z * 1.5, yaw: L.yaw } };
  const m = d > 0.5 ? Math.min(1, (d - 0.4) / 1.2) : 0;
  stepBody(c, { x: d ? dx / d * m : 0, z: d ? dz / d * m : 0 }, dt, world, { speedMul: 1.15 });
  return null;
}

export function canStand(world, b, x, z, canFall = false) {
  const bd = world.bounds;
  if (bd && (x < bd.minX + b.radius || x > bd.maxX - b.radius || z < bd.minZ + b.radius || z > bd.maxZ - b.radius)) return false;
  if (blockedByObstacle(world, b, x, z)) return false;
  const g = world.groundAt(x, z, b.y);
  if (!g) return canFall;
  if (g.kind !== 'ground') return false;
  if (g.y - b.y > b.stepMax) return false;
  if (b.y - g.y > b.dropMax && !canFall) return false;
  return true;
}

/** Avanza un paso. wish = {x,z} dirección deseada en el mundo (magnitud 0..1). */
const COYOTE = 0.1; // s tras salir del borde en los que aún se puede saltar / mantener el impulso
export function stepBody(b, wish, dt, world, o = {}) {
  const canFall = !!o.canFall;
  const ev = { fell: false, landed: false, blocked: false };
  const mag = Math.min(1, Math.hypot(wish.x, wish.z));
  const sp = b.speed * (o.speedMul ?? 1);
  // noGlide: sin salto, al perder el suelo no hay control en el aire (caída casi vertical)
  const drop = !!o.noGlide && !b.grounded && !b.jumping;
  const tx = !drop && mag > 0.001 ? (wish.x / Math.hypot(wish.x, wish.z)) * sp * mag : 0;
  const tz = !drop && mag > 0.001 ? (wish.z / Math.hypot(wish.x, wish.z)) * sp * mag : 0;
  const k = 1 - Math.exp(-(drop ? 30 : b.accel) * dt);
  b.vx += (tx - b.vx) * k;
  b.vz += (tz - b.vz) * k;

  const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
  if (b.grounded) {
    if (canStand(world, b, nx, nz, canFall)) { b.x = nx; b.z = nz; }
    else if (canStand(world, b, nx, b.z, canFall)) { b.x = nx; b.vz = 0; ev.blocked = true; }
    else if (canStand(world, b, b.x, nz, canFall)) { b.z = nz; b.vx = 0; ev.blocked = true; }
    else { b.vx = 0; b.vz = 0; ev.blocked = true; }
  } else { // en el aire: sigue su inercia (solo limitada por los bordes)
    b.x = nx; b.z = nz;
    const bd = world.bounds;
    if (bd) { b.x = clamp(b.x, bd.minX, bd.maxX); b.z = clamp(b.z, bd.minZ, bd.maxZ); }
  }

  const g = world.groundAt(b.x, b.z, b.y);
  if (b.grounded) {
    if (g && g.kind === 'ground' && b.y - g.y <= (canFall ? b.dropMax : 1e9)) {
      b.y += (g.y - b.y) * Math.min(1, 22 * dt);
      if (Math.abs(g.y - b.y) < 0.002) b.y = g.y;
    } else {
      b.grounded = false; b.vy = 0;
      // o.noGlide: al salir del borde SIN saltar se cae casi en vertical (no se "planea" sobre un hueco con la inercia)
      if (o.noGlide && !b.jumping) { b.coyote = COYOTE; b.vx *= 0.3; b.vz *= 0.3; }
    }
  } else {
    if (b.coyote > 0) b.coyote -= dt;
    b.vy -= b.gravity * dt;
    b.y += b.vy * dt;
    if (g && g.kind === 'ground' && b.y <= g.y && b.vy <= 0) { b.y = g.y; b.vy = 0; b.grounded = true; b.jumping = false; b.coyote = 0; ev.landed = true; }
    if (world.killY !== undefined && b.y < world.killY) ev.fell = true;
  }

  const spd = Math.hypot(b.vx, b.vz);
  b.speed01 = clamp(spd / b.speed, 0, 1);
  if (spd > 0.15) b.yaw = angleLerp(b.yaw, Math.atan2(b.vx, b.vz), 1 - Math.exp(-14 * dt));
  return ev;
}

/** Salto: solo desde el suelo. Devuelve true si despegó. (El aterrizaje y la gravedad los resuelve stepBody.) */
export function jump(b, v) {
  if (!b.grounded && !(b.coyote > 0)) return false;
  b.coyote = 0; b.grounded = false; b.jumping = true; b.vy = v; return true;
}

/** Dirección (x,z) del mundo a partir de las flechas y el yaw de la cámara. */
export function cameraRelativeWish(axis, camYaw) {
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);     // hacia donde mira la cámara
  const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);    // derecha de la cámara
  let x = fx * axis.fwd + rx * axis.right, z = fz * axis.fwd + rz * axis.right;
  const m = Math.hypot(x, z);
  if (m > 1) { x /= m; z /= m; }
  return { x, z };
}
