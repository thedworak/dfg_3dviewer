// A small mesh builder for the pagoda (scripts/build-pagoda-examples.mjs):
// triangles gathered per part (a node of the model) and material, with
// normals and UVs in metres divided by each material's texture size, so the
// tiling textures keep their scale whatever the piece.
//
// Placement goes through a transform stack (rotations about Y and offsets),
// so a side of the building is written once and turned four times.

export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

// Rotation about Y by angle (radians), then translation.
function makeTransform(angle = 0, offset = [0, 0, 0]) {
  return { c: Math.cos(angle), s: Math.sin(angle), o: offset };
}
function compose(outer, inner) {
  // outer(inner(p))
  const c = outer.c * inner.c - outer.s * inner.s;
  const s = outer.s * inner.c + outer.c * inner.s;
  const o = applyPoint(outer, inner.o);
  return { c, s, o };
}
function applyDir(t, d) {
  return [t.c * d[0] + t.s * d[2], d[1], -t.s * d[0] + t.c * d[2]];
}
function applyPoint(t, p) {
  const r = applyDir(t, p);
  return [r[0] + t.o[0], r[1] + t.o[1], r[2] + t.o[2]];
}

export class Builder {
  constructor(materials) {
    // materials: { name: { size: metres per texture repeat } }
    this.materials = materials;
    this.parts = new Map(); // part -> Map(material -> { p, n, uv, i })
    this.stack = [makeTransform()];
    this.part = 'Main';
  }

  setPart(name) {
    this.part = name;
  }

  get t() {
    return this.stack[this.stack.length - 1];
  }

  // Runs fn with a rotation about Y (and an offset) on top of the stack.
  with(angle, offset, fn) {
    this.stack.push(compose(this.t, makeTransform(angle, offset)));
    try {
      fn();
    } finally {
      this.stack.pop();
    }
  }

  // fn four times, turned 0, 90, 180, 270 degrees about Y.
  fourSides(fn) {
    for (let k = 0; k < 4; k += 1) this.with((k * Math.PI) / 2, [0, 0, 0], () => fn(k));
  }

  bucket(material) {
    if (!this.materials[material]) throw new Error(`unknown material ${material}`);
    let part = this.parts.get(this.part);
    if (!part) {
      part = new Map();
      this.parts.set(this.part, part);
    }
    let b = part.get(material);
    if (!b) {
      b = { p: [], n: [], uv: [], i: [] };
      part.set(material, b);
    }
    return b;
  }

  // Raw triangles in local coordinates: points [[x,y,z]], normals, uvs in
  // metres (divided here by the material's size), indices.
  raw(material, points, normals, uvs, indices) {
    const b = this.bucket(material);
    const base = b.p.length / 3;
    const size = this.materials[material].size;
    for (let k = 0; k < points.length; k += 1) {
      const p = applyPoint(this.t, points[k]);
      const n = applyDir(this.t, normals[k]);
      b.p.push(p[0], p[1], p[2]);
      b.n.push(n[0], n[1], n[2]);
      b.uv.push(uvs[k][0] / size, uvs[k][1] / size);
    }
    for (const index of indices) b.i.push(base + index);
  }

  // A flat quad p0 p1 p2 p3 (counter-clockwise seen from the front), UVs
  // along p0->p1 (u) and p0->p3 (v), in metres from uv0.
  quad(material, p0, p1, p2, p3, uv0 = [0, 0]) {
    const n = v3.norm(v3.cross(v3.sub(p1, p0), v3.sub(p3, p0)));
    const ua = v3.norm(v3.sub(p1, p0));
    const va = v3.norm(v3.cross(n, ua));
    const uv = (p) => {
      const d = v3.sub(p, p0);
      return [uv0[0] + v3.dot(d, ua), uv0[1] + v3.dot(d, va)];
    };
    this.raw(material, [p0, p1, p2, p3], [n, n, n, n], [uv(p0), uv(p1), uv(p2), uv(p3)], [0, 1, 2, 0, 2, 3]);
  }

  // An oriented box: centre, three orthogonal axes (unit) and full sizes.
  // UVs: on each face u runs along the face's longer side (the grain).
  orientedBox(material, centre, ax, ay, az, sx, sy, sz, faces = 'all') {
    const axes = [
      [ax, sx],
      [ay, sy],
      [az, sz],
    ];
    const seed = (centre[0] * 7.31 + centre[1] * 3.17 + centre[2] * 5.03) % 3;
    for (let a = 0; a < 3; a += 1) {
      for (const sign of [1, -1]) {
        if (faces !== 'all' && !faces.includes(`${sign > 0 ? '+' : '-'}${'xyz'[a]}`)) continue;
        const [n, size] = axes[a];
        const [u, su] = axes[(a + 1) % 3];
        const [w, sw] = axes[(a + 2) % 3];
        const normal = v3.scale(n, sign);
        const fc = v3.add(centre, v3.scale(n, (sign * size) / 2));
        // Corners counter-clockwise seen from outside.
        let e1 = v3.scale(u, su / 2);
        let e2 = v3.scale(w, sw / 2);
        if (sign < 0) [e1, e2] = [e2, e1];
        const l1 = sign < 0 ? sw : su;
        const l2 = sign < 0 ? su : sw;
        const pts = [
          v3.sub(v3.sub(fc, e1), e2),
          v3.sub(v3.add(fc, e1), e2),
          v3.add(v3.add(fc, e1), e2),
          v3.add(v3.sub(fc, e1), e2),
        ];
        // UV in metres, the long side along u; a per-piece offset so
        // neighbours do not repeat the same grain.
        const off = [seed * 0.37, seed * 0.61];
        let uvs;
        if (l1 >= l2) uvs = [[0, 0], [l1, 0], [l1, l2], [0, l2]];
        else uvs = [[0, 0], [0, l1], [l2, l1], [l2, 0]];
        uvs = uvs.map(([x, y]) => [x + off[0], y + off[1]]);
        this.raw(material, pts, [normal, normal, normal, normal], uvs, [0, 1, 2, 0, 2, 3]);
      }
    }
  }

  // An axis-aligned box (local), from min to max corner.
  box(material, min, max, faces = 'all') {
    const c = v3.scale(v3.add(min, max), 0.5);
    this.orientedBox(material, c, [1, 0, 0], [0, 1, 0], [0, 0, 1], max[0] - min[0], max[1] - min[1], max[2] - min[2], faces);
  }

  // A beam from a to b with a w (sideways) x h (up) section; up: a hint
  // for the section's "up".
  beam(material, a, b, w, h, up = [0, 1, 0], faces = 'all') {
    const along = v3.sub(b, a);
    const length = v3.len(along);
    const ax = v3.norm(along);
    let side = v3.cross(up, ax);
    if (v3.len(side) < 1e-6) side = v3.cross([1, 0, 0], ax);
    side = v3.norm(side);
    const ay = v3.norm(v3.cross(ax, side));
    const az = v3.cross(ax, ay); // right-handed (= -side)
    this.orientedBox(material, v3.scale(v3.add(a, b), 0.5), ax, ay, az, length, h, w, faces);
  }

  // A cylinder (prism) round an axis from a to b, radius r (or [r0, r1]).
  // caps: true (both ends), false, 'start' (at a) or 'end' (at b) - a cap
  // hidden in what the cylinder stands in is left out.
  cylinder(material, a, b, r, segments = 12, caps = true) {
    const [r0, r1] = Array.isArray(r) ? r : [r, r];
    const axis = v3.norm(v3.sub(b, a));
    const height = v3.len(v3.sub(b, a));
    let e1 = v3.cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
    e1 = v3.norm(e1);
    const e2 = v3.cross(axis, e1);
    const pts = [];
    const nrm = [];
    const uvs = [];
    const idx = [];
    const slope = (r0 - r1) / height;
    for (let s = 0; s <= segments; s += 1) {
      const ang = (s / segments) * Math.PI * 2;
      const dir = v3.add(v3.scale(e1, Math.cos(ang)), v3.scale(e2, Math.sin(ang)));
      const n = v3.norm(v3.add(dir, v3.scale(axis, slope)));
      const arc = (s / segments) * Math.PI * 2 * Math.max(r0, r1);
      pts.push(v3.add(a, v3.scale(dir, r0)), v3.add(b, v3.scale(dir, r1)));
      nrm.push(n, n);
      uvs.push([0, arc], [height, arc]);
    }
    for (let s = 0; s < segments; s += 1) {
      const k = s * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
    this.raw(material, pts, nrm, uvs, idx);
    if (caps) {
      for (const [centre, radius, sign] of [[a, r0, -1], [b, r1, 1]]) {
        if (radius <= 0) continue;
        if ((caps === 'start' && sign > 0) || (caps === 'end' && sign < 0)) continue;
        const cp = [centre];
        const cn = [v3.scale(axis, sign)];
        const cu = [[0, 0]];
        const ci = [];
        for (let s = 0; s <= segments; s += 1) {
          const ang = (s / segments) * Math.PI * 2;
          const dir = v3.add(v3.scale(e1, Math.cos(ang)), v3.scale(e2, Math.sin(ang)));
          cp.push(v3.add(centre, v3.scale(dir, radius)));
          cn.push(v3.scale(axis, sign));
          cu.push([Math.cos(ang) * radius, Math.sin(ang) * radius]);
        }
        for (let s = 1; s <= segments; s += 1) {
          if (sign > 0) ci.push(0, s, s + 1);
          else ci.push(0, s + 1, s);
        }
        this.raw(material, cp, cn, cu, ci);
      }
    }
  }

  // A surface of revolution about the local Y axis through centre: profile
  // [[radius, y], ...] from bottom to top.
  lathe(material, centre, profile, segments = 24) {
    const pts = [];
    const nrm = [];
    const uvs = [];
    const idx = [];
    // Arc length along the profile, for v.
    const along = [0];
    for (let k = 1; k < profile.length; k += 1) {
      along.push(along[k - 1] + Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]));
    }
    const rows = profile.length;
    for (let s = 0; s <= segments; s += 1) {
      const ang = (s / segments) * Math.PI * 2;
      const cx = Math.sin(ang);
      const cz = Math.cos(ang);
      for (let k = 0; k < rows; k += 1) {
        const [r, y] = profile[k];
        const prev = profile[Math.max(0, k - 1)];
        const next = profile[Math.min(rows - 1, k + 1)];
        const dr = next[0] - prev[0];
        const dy = next[1] - prev[1];
        // Outward normal of the profile (dy, -dr).
        const l = Math.hypot(dy, dr) || 1;
        const nr = dy / l;
        const ny = -dr / l;
        pts.push([centre[0] + r * cx, centre[1] + y, centre[2] + r * cz]);
        nrm.push([nr * cx, ny, nr * cz]);
        uvs.push([(s / segments) * Math.PI * 2 * 0.3, along[k]]);
      }
    }
    for (let s = 0; s < segments; s += 1) {
      for (let k = 0; k < rows - 1; k += 1) {
        const a = s * rows + k;
        const b = (s + 1) * rows + k;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    this.raw(material, pts, nrm, uvs, idx);
  }

  // A grid surface: fn(u, v) -> point for u, v in [0, 1]; uvfn(u, v) ->
  // [metres, metres]. Normals from the grid (flip: the other side).
  surface(material, fn, nu, nv, uvfn, flip = false) {
    const pts = [];
    const uvs = [];
    for (let j = 0; j <= nv; j += 1) {
      for (let i = 0; i <= nu; i += 1) {
        pts.push(fn(i / nu, j / nv));
        uvs.push(uvfn(i / nu, j / nv));
      }
    }
    const at = (i, j) => pts[j * (nu + 1) + i];
    const nrm = [];
    for (let j = 0; j <= nv; j += 1) {
      for (let i = 0; i <= nu; i += 1) {
        const du = v3.sub(at(Math.min(nu, i + 1), j), at(Math.max(0, i - 1), j));
        const dv = v3.sub(at(i, Math.min(nv, j + 1)), at(i, Math.max(0, j - 1)));
        let n = v3.norm(v3.cross(du, dv));
        if (flip) n = v3.scale(n, -1);
        nrm.push(n);
      }
    }
    const idx = [];
    for (let j = 0; j < nv; j += 1) {
      for (let i = 0; i < nu; i += 1) {
        const a = j * (nu + 1) + i;
        const b = a + 1;
        const c = a + nu + 1;
        const d = c + 1;
        if (flip) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
    }
    this.raw(material, pts, nrm, uvs, idx);
  }

  stats() {
    let triangles = 0;
    let vertices = 0;
    for (const part of this.parts.values()) {
      for (const b of part.values()) {
        triangles += b.i.length / 3;
        vertices += b.p.length / 3;
      }
    }
    return { triangles, vertices };
  }
}
