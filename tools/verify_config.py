#!/usr/bin/env python3
"""Verifica assets_config.json contra los GLB ORIGINALES, sin Three.js.

Aplica la misma formula que normalizeAssets.js:
    p_mundo = position + RotY(rotationY_deg) * ( scale * (p_modelo - pivot) )
y comprueba: altura objetivo, apoyo en el suelo (y min = 0), tamano normalizado
declarado, y que los personajes miran hacia +Z.

Uso:  python3 tools/verify_config.py            (desde la raiz del proyecto)
Solo requiere Python 3 + numpy. No modifica ningun archivo.
"""
import json, os, struct, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def load_glb(path):
    d = open(path, 'rb').read()
    assert struct.unpack('<I', d[:4])[0] == 0x46546C67, 'no es GLB'
    off, js, binc = 12, None, b''
    while off < len(d):
        cl, ct = struct.unpack('<II', d[off:off + 8])
        cd = d[off + 8:off + 8 + cl]
        if ct == 0x4E4F534A:
            js = json.loads(cd)
        elif ct == 0x004E4942:
            binc = cd
        off += 8 + cl
    return js, binc


def accessor(js, b, i):
    a = js['accessors'][i]
    bv = js['bufferViews'][a['bufferView']]
    n, dt = NC[a['type']], CT[a['componentType']]
    st = bv.get('byteStride', 0)
    o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    isz = np.dtype(dt).itemsize * n
    if st and st != isz:
        raw = np.frombuffer(b, np.uint8, st * a['count'], o).reshape(a['count'], st)[:, :isz].copy()
        return raw.view(dt).reshape(a['count'], n)
    return np.frombuffer(b, dt, a['count'] * n, o).reshape(a['count'], n)


def node_matrix(n):
    if 'matrix' in n:
        return np.array(n['matrix']).reshape(4, 4).T
    t = n.get('translation', [0, 0, 0]); r = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    x, y, z, w = r
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4); M[:3, :3] = R * np.array(s); M[:3, 3] = t
    return M


def primitives(path):
    """Devuelve lista de (nombre_malla, material_idx, vertices_en_espacio_del_glb)."""
    js, b = load_glb(path)
    nodes = js['nodes']; out = []

    def walk(i, P):
        n = nodes[i]; M = P @ node_matrix(n)
        if 'mesh' in n:
            for pr in js['meshes'][n['mesh']]['primitives']:
                pos = accessor(js, b, pr['attributes']['POSITION']).astype(float)
                h = (np.hstack([pos, np.ones((len(pos), 1))]) @ M.T)[:, :3]
                out.append((n.get('name', ''), pr.get('material'), h))
        for c in n.get('children', []):
            walk(c, M)

    sc = js['scenes'][js.get('scene', 0)]
    for r in sc['nodes']:
        walk(r, np.eye(4))
    return out


def roty(V, deg):
    # Misma convencion que THREE.Object3D.rotation.y (mano derecha, Y arriba)
    t = np.radians(deg); c, s = np.cos(t), np.sin(t)
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    return np.stack([x * c + z * s, y, -x * s + z * c], 1)


def to_world(V, e):
    return np.array(e['position']) + roty((V - np.array(e['pivot'])) * e['scale'], e['rotationY_deg'])


# Como se distingue "delante" en cada personaje (ver informe de analisis)
EYE_MATS = {'Bobby': [1, 2], 'berry': [3, 4, 5], 'cookie': [0, 1, 2], 'Toffee': [2, 3, 4]}


def facing_dz_dx(key, prims, e):
    allv = to_world(np.concatenate([p[2] for p in prims]), e)
    if key in EYE_MATS:
        eyes = to_world(np.concatenate([p[2] for p in prims if p[1] in EYE_MATS[key]]), e)
        d = eyes.mean(0) - allv.mean(0)
    else:  # zorro: la cabeza esta en el extremo mas alto del cuerpo
        d = allv[np.argsort(allv[:, 1])[-30:]].mean(0) - allv.mean(0)
    return d[2], d[0]


def main():
    cfg = json.load(open(os.path.join(ROOT, 'assets_config.json')))
    models = cfg['models']
    bad = 0
    print(f"{'modelo':18s} {'alto m':>7s} {'objetivo':>8s} {'y min':>7s} {'tam normalizado (X,Y,Z)':>26s}  frente")
    for key, e in models.items():
        prims = primitives(os.path.join(ROOT, 'assets', e['file']))
        W = to_world(np.concatenate([p[2] for p in prims]), e)
        mn, mx = W.min(0), W.max(0); size = mx - mn
        problems = []
        decl = np.array(e['tamano_normalizado_XYZ_m'])
        if np.abs(size - decl).max() > 0.03 * max(1, decl.max()) * 0.5 + 0.015:
            problems.append(f'tamano != declarado {np.round(size, 2)} vs {decl}')
        if 'targetHeight_m' in e and abs(size[1] - e['targetHeight_m']) > 0.02:
            problems.append('altura != objetivo')
        face = ''
        if e['role'] in ('character', 'object'):
            if abs(mn[1]) > 0.02:
                problems.append(f'no apoya en el suelo (y min={mn[1]:.3f})')
        if e['role'] == 'character':
            dz, dx = facing_dz_dx(key, prims, e)
            face = f'dz={dz:+.2f} dx={dx:+.2f}'
            if dz <= 0.05 or abs(dx) > abs(dz):
                problems.append('NO mira hacia +Z')
        tgt = e.get('targetHeight_m', '-')
        print(f"{key:18s} {size[1]:7.2f} {str(tgt):>8s} {mn[1]:7.3f} {str(np.round(size, 2)):>26s}  {face} {'OK' if not problems else 'FALLO'}")
        for p in problems:
            print('    !!', p); bad += 1
    print('\nRESULTADO:', 'TODO CORRECTO' if bad == 0 else f'{bad} problema(s)')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
