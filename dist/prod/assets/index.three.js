import { I as DefaultLoadingManager, M as Matrix4, g as GLTFLoader, G as Group, E as EventDispatcher, am as PerspectiveCamera, an as OrthographicCamera, V as Vector3, ao as Clock, j as MathUtils, X as Quaternion, S as Sphere, w as Ray, ap as Euler, aq as Spherical, k as Box3, ar as Plane, o as Vector2, x as Raycaster, as as InstancedMesh, P as PointsMaterial, q as BufferGeometry, m as BufferAttribute, C as Color, r as Points, at as LoadingManager, a as Mesh, i as PlaneGeometry, A as Frustum, au as estimateBytesUsed, a1 as ShaderMaterial, O as Matrix3, $ as TextureUtils } from './three.js';

//#region \0rolldown/runtime.js
var e = Object.defineProperty, t = (t, n) => {
	let r = {};
	for (var i in t) e(r, i, {
		get: t[i],
		enumerable: true
	});
	return e(r, Symbol.toStringTag, { value: "Module" }), r;
};
//#endregion
//#region src/core/renderer/utilities/urlExtension.js
function n(e) {
	try {
		let t = typeof location < "u" ? location.href : void 0;
		return new URL(e, t).origin;
	} catch {
		return null;
	}
}
function r(e) {
	if (!e) return null;
	let t = e.length, n = e.indexOf("?"), r = e.indexOf("#");
	n !== -1 && (t = Math.min(t, n)), r !== -1 && (t = Math.min(t, r));
	let i = e.lastIndexOf(".", t), a = e.lastIndexOf("/", t), o = e.indexOf("://");
	return o !== -1 && o + 2 === a || i === -1 || i < a ? null : e.substring(i + 1, t) || null;
}
//#endregion
//#region src/core/renderer/utilities/Scheduler.js
var i = class {
	static pending = /* @__PURE__ */ new Map();
	static session = null;
	static setXRSession(e) {
		e !== this.session && (this.flushPending(), this.session = e);
	}
	static requestAnimationFrame(e) {
		let { session: t, pending: n } = this, r, i = () => {
			n.delete(r), e();
		};
		return r = t ? t.requestAnimationFrame(i) : requestAnimationFrame(i), n.set(r, e), r;
	}
	static cancelAnimationFrame(e) {
		let { pending: t, session: n } = this;
		t.delete(e), n ? n.cancelAnimationFrame(e) : cancelAnimationFrame(e);
	}
	static flushPending() {
		this.pending.forEach((e, t) => {
			e(), this.cancelAnimationFrame(t);
		});
	}
}, a = 2 ** 30, o = class {
	get unloadPriorityCallback() {
		return this._unloadPriorityCallback;
	}
	set unloadPriorityCallback(e) {
		e.length === 1 ? (console.warn("LRUCache: \"unloadPriorityCallback\" function has been changed to take two arguments."), this._unloadPriorityCallback = (t, n) => {
			let r = e(t), i = e(n);
			return r < i ? -1 : +(r > i);
		}) : this._unloadPriorityCallback = e;
	}
	constructor() {
		this.minSize = 6e3, this.maxSize = 8e3, this.minBytesSize = .3 * a, this.maxBytesSize = .4 * a, this.unloadPercent = .05, this.autoMarkUnused = true, this.cachedBytes = 0, this.itemSet = /* @__PURE__ */ new Map(), this.itemList = [], this.usedSet = /* @__PURE__ */ new Set(), this.callbacks = /* @__PURE__ */ new Map(), this.unloadingHandle = -1, this.bytesMap = /* @__PURE__ */ new Map(), this.loadedSet = /* @__PURE__ */ new Set(), this._unloadPriorityCallback = null;
		let e = this.itemSet;
		this.defaultPriorityCallback = (t) => e.get(t);
	}
	isFull() {
		return this.itemSet.size >= this.maxSize || this.cachedBytes >= this.maxBytesSize;
	}
	getMemoryUsage(e) {
		return this.bytesMap.get(e) || 0;
	}
	setMemoryUsage(e, t) {
		let { bytesMap: n, itemSet: r } = this;
		r.has(e) && (t = Math.round(t), this.cachedBytes -= n.get(e) || 0, n.set(e, t), this.cachedBytes += t);
	}
	add(e, t) {
		let n = this.itemSet;
		if (n.has(e) || this.isFull()) return false;
		let r = this.usedSet, i = this.itemList, a = this.callbacks;
		return i.push(e), r.add(e), n.set(e, Date.now()), a.set(e, t), true;
	}
	has(e) {
		return this.itemSet.has(e);
	}
	remove(e) {
		let t = this.usedSet, n = this.itemSet, r = this.itemList, i = this.bytesMap, a = this.callbacks, o = this.loadedSet;
		if (n.has(e)) {
			this.cachedBytes -= i.get(e) || 0, i.delete(e), a.get(e)(e);
			let s = r.indexOf(e);
			return r.splice(s, 1), t.delete(e), n.delete(e), a.delete(e), o.delete(e), true;
		}
		return false;
	}
	setLoaded(e, t) {
		let { itemSet: n, loadedSet: r } = this;
		n.has(e) && (t === true ? r.add(e) : r.delete(e));
	}
	markUsed(e) {
		let t = this.itemSet, n = this.usedSet;
		t.has(e) && !n.has(e) && (t.set(e, Date.now()), n.add(e));
	}
	markUnused(e) {
		this.usedSet.delete(e);
	}
	markAllUnused() {
		this.usedSet.clear();
	}
	isUsed(e) {
		return this.usedSet.has(e);
	}
	unloadUnusedContent() {
		let { unloadPercent: e, minSize: t, maxSize: n, itemList: r, itemSet: a, usedSet: o, loadedSet: s, callbacks: c, bytesMap: l, minBytesSize: u, maxBytesSize: d } = this, f = r.length - o.size, p = r.length - s.size, m = Math.max(Math.min(r.length - t, f), 0), h = this.cachedBytes - u, g = this.unloadPriorityCallback || this.defaultPriorityCallback, _ = false, v = m > 0 && f > 0 || p && r.length > n;
		if (f && this.cachedBytes > u || p && this.cachedBytes > d || v) {
			r.sort((e, t) => {
				let n = o.has(e);
				if (n === o.has(t)) {
					let n = s.has(e);
					return n === s.has(t) ? -g(e, t) : n ? 1 : -1;
				} else return n ? 1 : -1;
			});
			let i = Math.max(t * e, m * e), p = Math.ceil(Math.min(i, f, m)), v = Math.max(e * h, e * u), y = Math.min(v, h), b = 0, x = 0;
			for (; b < r.length && (this.cachedBytes - x > d || r.length - b > n);) {
				let e = r[b], t = l.get(e) || 0;
				if (o.has(e) && s.has(e) || this.cachedBytes - x - t < d && r.length - b <= n) break;
				x += t, b++;
			}
			for (; b < r.length && (x < y || b < p);) {
				let e = r[b], t = l.get(e) || 0;
				if (o.has(e) || this.cachedBytes - x - t < u && b >= p) break;
				x += t, b++;
			}
			r.splice(0, b).forEach((e) => {
				this.cachedBytes -= l.get(e) || 0, c.get(e)(e), l.delete(e), a.delete(e), c.delete(e), s.delete(e), o.delete(e);
			}), _ = b < m || x < h && b < f, _ &&= b > 0;
		}
		_ && (this.unloadingHandle = i.requestAnimationFrame(() => this.scheduleUnload()));
	}
	scheduleUnload() {
		i.cancelAnimationFrame(this.unloadingHandle), this.scheduled || (this.scheduled = true, queueMicrotask(() => {
			this.scheduled = false, this.unloadUnusedContent();
		}));
	}
}, s = class extends DOMException {
	constructor() {
		super("PriorityQueue: Item removed", "AbortError");
	}
}, c = class {
	get running() {
		return this.items.length !== 0 || this.currJobs !== 0;
	}
	constructor() {
		this.maxJobs = 6, this.items = [], this.callbacks = /* @__PURE__ */ new Map(), this.currJobs = 0, this.scheduled = false, this.autoUpdate = true, this.priorityCallback = null, this._schedulingCallback = (e) => {
			i.requestAnimationFrame(e);
		}, this._runjobs = () => {
			this.scheduled = false, this.tryRunJobs();
		};
	}
	sort() {
		let e = this.priorityCallback, t = this.items;
		e !== null && t.sort(e);
	}
	has(e) {
		return this.callbacks.has(e);
	}
	add(e, t) {
		let n = {
			callback: t,
			reject: null,
			resolve: null,
			promise: null
		};
		return n.promise = new Promise((t, r) => {
			let i = this.items, a = this.callbacks;
			n.resolve = t, n.reject = r, i.unshift(e), a.set(e, n), this.autoUpdate && this.scheduleJobRun();
		}), n.promise;
	}
	remove(e) {
		let t = this.items, n = this.callbacks, r = t.indexOf(e);
		if (r !== -1) {
			let i = n.get(e);
			i.promise.catch((e) => {
				if (e.name !== "AbortError") throw e;
			}), i.reject(new s()), t.splice(r, 1), n.delete(e);
		}
	}
	removeByFilter(e) {
		let { items: t } = this;
		for (let n = 0; n < t.length; n++) {
			let r = t[n];
			e(r) && (this.remove(r), n--);
		}
	}
	tryRunJobs() {
		this.sort();
		let e = this.items, t = this.callbacks, n = this.maxJobs, r = 0, i = () => {
			this.currJobs--, this.autoUpdate && this.scheduleJobRun();
		};
		for (; n > this.currJobs && e.length > 0 && r < n;) {
			this.currJobs++, r++;
			let n = e.pop(), { callback: a, resolve: o, reject: s } = t.get(n);
			t.delete(n);
			let c;
			try {
				c = a(n);
			} catch (e) {
				s(e), i();
				continue;
			}
			c instanceof Promise ? c.then(o).catch(s).finally(i) : (o(c), i());
		}
	}
	flush(e) {
		let { items: t, callbacks: n } = this, r = t.indexOf(e);
		if (!n.has(e)) return;
		let { callback: i, resolve: a, reject: o } = n.get(e);
		n.delete(e), t.splice(r, 1);
		let s;
		try {
			s = i(e);
		} catch (e) {
			o(e);
			return;
		}
		return s instanceof Promise ? s.then(a).catch(o) : a(s), s;
	}
	scheduleJobRun() {
		this.scheduled ||= (this._schedulingCallback(this._runjobs), true);
	}
}, l = class {
	get running() {
		for (let e of this.originQueues.values()) if (e.running) return true;
		return false;
	}
	get maxJobsPerOrigin() {
		return this._maxJobsPerOrigin;
	}
	set maxJobsPerOrigin(e) {
		this._maxJobsPerOrigin = e, this.originQueues.forEach((t) => t.maxJobs = e);
	}
	get maxJobs() {
		return this.maxJobsPerOrigin;
	}
	set maxJobs(e) {
		console.warn("DownloadPriorityQueue: \"maxJobs\" is no longer valid and limits jobs per server origin. Use \"maxJobsPerOrigin\", instead."), this.maxJobsPerOrigin = e;
	}
	get priorityCallback() {
		return this._priorityCallback;
	}
	set priorityCallback(e) {
		this._priorityCallback = e, this.originQueues.forEach((t) => t.priorityCallback = e);
	}
	constructor() {
		this.originQueues = /* @__PURE__ */ new Map(), this._itemQueues = /* @__PURE__ */ new WeakMap(), this._maxJobsPerOrigin = 6, this._priorityCallback = null;
	}
	add(e, t, r, i = null) {
		this.originQueues.forEach((e, t) => {
			e.running || this.originQueues.delete(t);
		});
		let a = e === null ? null : n(e), o = this.originQueues.get(a);
		o || (o = new c(), o.maxJobs = this._maxJobsPerOrigin, o.priorityCallback = this._priorityCallback, this.originQueues.set(a, o));
		let s = this._itemQueues.get(t);
		if (s && s !== o && s.has(t)) throw Error("DownloadPriorityQueue: Item is already queued with a different url origin.");
		this._itemQueues.set(t, o);
		let l = o.add(t, r);
		return i !== null && (i.aborted ? this.remove(t) : i.addEventListener("abort", () => this.remove(t), { once: true })), l;
	}
	remove(e) {
		let t = this._itemQueues.get(e);
		t && (t.remove(e), this._itemQueues.delete(e));
	}
	has(e) {
		let t = this._itemQueues.get(e);
		return !!(t && t.has(e));
	}
}, g = 6378137, v = 6356752.314245179, y = {
	inView: false,
	error: Infinity,
	distanceFromCamera: Infinity
};
function b(e) {
	return e === 4 || e === -1;
}
function x(e, t) {
	return S(e) && e.traversal.lastFrameVisited === t && e.traversal.used;
}
function S(e) {
	return !!e.traversal;
}
function C(e) {
	let { children: t } = e, n = t.length === 0 || S(t[t.length - 1]), r = !e.internal.hasUnrenderableContent || b(e.internal.loadingState);
	return n && r;
}
function w(e) {
	return e.traversal.unconditionallyRefine;
}
function T(e, t, n = true) {
	if (S(e) && (t.ensureChildrenArePreprocessed(e), e.traversal.lastFrameVisited !== t.frameCount && (e.traversal.wasInFrustum = e.traversal.inFrustum, e.traversal.wasSetActive = e.traversal.active, e.traversal.wasSetVisible = e.traversal.visible, e.traversal.usedLastFrame = e.traversal.used, e.traversal.lastFrameVisited = t.frameCount, e.traversal.used = false, e.traversal.inFrustum = false, e.traversal.isLeaf = false, e.traversal.visible = false, e.traversal.active = false, e.traversal.error = Infinity, e.traversal.distanceFromCamera = Infinity, e.traversal.allChildrenReady = false, e.traversal.allChildrenLoaded = false, e.traversal.kicked = false, e.traversal.allUsedChildrenProcessed = false, n && (t.calculateTileViewErrorWithPlugin(e, y), e.traversal.inFrustum = y.inView, e.traversal.error = y.error, e.traversal.distanceFromCamera = y.distanceFromCamera), e.traversal.unconditionallyRefine = e.internal.hasUnrenderableContent, !e.traversal.unconditionallyRefine))) {
		let t = e.parent;
		for (; t && t.traversal.unconditionallyRefine;) t = t.parent;
		t && t.geometricError <= e.geometricError && (e.traversal.unconditionallyRefine = true);
	}
}
function E$1(e, t, n = false) {
	if (T(e, t), n ? t.markTileUsed(e) : O$1(e), w(e) && C(e)) {
		let r = e.children;
		for (let e = 0, i = r.length; e < i; e++) E$1(r[e], t, n);
	}
}
function D$1(e, t) {
	if (T(e, t), e.traversal.usedLastFrame && (O$1(e), e.traversal.wasSetActive && (e.traversal.active = true), (!e.traversal.active || w(e)) && C(e))) {
		let n = e.children;
		for (let e = 0, r = n.length; e < r; e++) D$1(n[e], t);
	}
}
function O$1(e) {
	e.traversal.used = true;
}
function ee(e, t) {
	return !(e.traversal.error <= t.errorTarget && !w(e) || t.maxDepth > 0 && e.internal.depth + 1 >= t.maxDepth || !C(e));
}
function k$1(e, t) {
	let { frameCount: n } = t, { children: r } = e;
	for (let e = 0, i = r.length; e < i; e++) {
		let i = r[e];
		x(i, n) && (i.traversal.active && (i.traversal.kicked = true, i.traversal.active = false), k$1(i, t));
	}
}
function A$1(e) {
	return !w(e) && (!e.internal.hasContent || b(e.internal.loadingState));
}
function j$1(e, t) {
	if (T(e, t), !e.traversal.inFrustum) return;
	let n = e.parent;
	if (n && n.refine === "ADD" && e.geometricError > 0 && e.traversal.error * (n.geometricError / e.geometricError) <= t.errorTarget) return;
	if (!ee(e, t)) {
		O$1(e);
		return;
	}
	let r = false, i = false, a = e.children;
	for (let e = 0, n = a.length; e < n; e++) {
		let n = a[e];
		j$1(n, t), r ||= x(n, t.frameCount), i ||= n.traversal.inFrustum;
	}
	if (e.refine === "REPLACE" && !i && a.length !== 0) {
		e.traversal.inFrustum = false, t.markTileUsed(e);
		for (let e = 0, n = a.length; e < n; e++) E$1(a[e], t, true);
		return;
	}
	if (O$1(e), e.refine === "REPLACE" && r && (t.loadSiblings || t.loadAncestors)) for (let e = 0, n = a.length; e < n; e++) E$1(a[e], t);
}
function M$1(e, t) {
	let n = t.frameCount;
	if (!x(e, n)) return;
	let r = e.children, i = false;
	for (let e = 0, t = r.length; e < t; e++) {
		let t = r[e];
		i ||= x(t, n);
	}
	if (!i) e.traversal.isLeaf = true;
	else {
		for (let e = 0, n = r.length; e < n; e++) M$1(r[e], t);
		let i = true;
		for (let e = 0, t = r.length; e < t; e++) {
			let t = r[e];
			if (x(t, n)) {
				let e = !w(t), n = !t.internal.hasContent || b(t.internal.loadingState);
				e && n || t.traversal.allChildrenLoaded || (i = false);
			}
		}
		e.traversal.allChildrenLoaded = i;
	}
	let a = true;
	for (let e = 0, n = r.length; e < n; e++) {
		let n = r[e];
		x(n, t.frameCount) && !n.traversal.allUsedChildrenProcessed && (a = false);
	}
	e.traversal.allUsedChildrenProcessed = a && C(e);
}
function N$1(e, t) {
	if (!x(e, t.frameCount)) return;
	let n = e.children;
	if (e.refine === "REPLACE" && t.loadAncestors && !e.traversal.allChildrenLoaded && !w(e) && (e.traversal.isLeaf = true), e.traversal.isLeaf) {
		if (!w(e) && (e.traversal.active = true, C(e) && e.internal.hasContent && !b(e.internal.loadingState))) for (let e = 0, r = n.length; e < r; e++) D$1(n[e], t);
		return;
	}
	let r = n.length > 0;
	for (let e = 0, i = n.length; e < i; e++) {
		let i = n[e];
		N$1(i, t), x(i, t.frameCount) && !(i.traversal.active && A$1(i)) && !i.traversal.allChildrenReady && (r = false);
	}
	e.traversal.allChildrenReady = r, e.refine === "REPLACE" && !r && e.traversal.wasSetActive && A$1(e) && (e.traversal.active = true, k$1(e, t));
}
function P$1(e, t) {
	T(e, t, false);
	let n = x(e, t.frameCount);
	if (n && (e.internal.hasUnrenderableContent && (t.markTileUsed(e), t.queueTileForDownload(e)), e.internal.hasRenderableContent && e.refine === "ADD" && (e.traversal.active = true), (e.traversal.active || e.traversal.kicked) && e.internal.hasContent && (t.markTileUsed(e), e.traversal.allUsedChildrenProcessed && t.queueTileForDownload(e), e.internal.loadingState !== 4 && (e.traversal.active = false)), t.loadAncestors && e.internal.hasContent && (t.markTileUsed(e), t.queueTileForDownload(e)), e.internal.virtualChildCount > 0 && e.internal.hasContent && t.markTileUsed(e), e.traversal.visible = e.internal.hasRenderableContent && e.traversal.active && e.traversal.inFrustum && e.internal.loadingState === 4, t.stats.used++, e.traversal.inFrustum && t.stats.inFrustum++), n || S(e) && e.traversal.usedLastFrame) {
		let r = false, i = false;
		n ? (r = e.traversal.active, i = t.displayActiveTiles && e.traversal.active || e.traversal.visible) : T(e, t, false), e.internal.hasRenderableContent && e.internal.loadingState === 4 ? (r && t.stats.active++, i && t.stats.visible++, e.traversal.wasSetActive !== r && t.invokeOnePlugin((t) => t.setTileActive && t.setTileActive(e, r)), e.traversal.wasSetVisible !== i && t.invokeOnePlugin((t) => t.setTileVisible && t.setTileVisible(e, i))) : e.internal.hasRenderableContent || (i = e.traversal.isLeaf, e.traversal.wasSetVisible !== i && t.invokeOnePlugin((t) => t.setEmptyTileVisible && t.setEmptyTileVisible(e, i))), e.traversal.visible = i, e.traversal.active = r;
		let a = e.children;
		for (let e = 0, n = a.length; e < n; e++) {
			let n = a[e];
			P$1(n, t);
		}
	}
}
function te(e, t) {
	j$1(e, t), M$1(e, t), N$1(e, t), P$1(e, t);
}
//#endregion
//#region src/core/renderer/utilities/throttle.js
function ne(e) {
	let t = null;
	return () => {
		t === null && (t = i.requestAnimationFrame(() => {
			t = null, e();
		}));
	};
}
function F$1(e, t = null, n = null) {
	let r = [];
	for (r.push(e), r.push(null), r.push(0); r.length > 0;) {
		let e = r.pop(), i = r.pop(), a = r.pop();
		if (t && t(a, i, e)) {
			n && n(a, i, e);
			return;
		}
		let o = a.children;
		if (o) for (let t = o.length - 1; t >= 0; t--) r.push(o[t]), r.push(a), r.push(e + 1);
		n && n(a, i, e);
	}
}
function I$1(e, t = null) {
	let n = e;
	for (; n;) {
		let e = n.internal.depth, r = n.parent;
		t && t(n, r, e), n = r;
	}
}
//#endregion
//#region src/core/renderer/tiles/TilesRendererBase.js
var L$1 = Symbol("PLUGIN_REGISTERED"), R$1 = {
	inView: true,
	error: 0,
	distance: Infinity
}, z$1 = (e, t) => {
	let n = e.priority || 0, r = t.priority || 0;
	return n === r ? !e.traversal || !t.traversal ? 0 : e.traversal.used === t.traversal.used ? e.traversal.error === t.traversal.error ? e.traversal.distanceFromCamera === t.traversal.distanceFromCamera ? e.internal.depthFromRenderedParent === t.internal.depthFromRenderedParent ? 0 : e.internal.depthFromRenderedParent > t.internal.depthFromRenderedParent ? -1 : 1 : e.traversal.distanceFromCamera > t.traversal.distanceFromCamera ? -1 : 1 : e.traversal.error > t.traversal.error ? 1 : -1 : e.traversal.used ? 1 : -1 : n > r ? 1 : -1;
}, B$1 = (e, t) => e.traversal.used === t.traversal.used ? e.traversal.inFrustum === t.traversal.inFrustum ? e.internal.hasUnrenderableContent === t.internal.hasUnrenderableContent ? e.traversal.distanceFromCamera === t.traversal.distanceFromCamera ? e.internal.depthFromRenderedParent === t.internal.depthFromRenderedParent ? 0 : e.internal.depthFromRenderedParent > t.internal.depthFromRenderedParent ? -1 : 1 : e.traversal.distanceFromCamera > t.traversal.distanceFromCamera ? -1 : 1 : e.internal.hasUnrenderableContent ? 1 : -1 : e.traversal.inFrustum ? 1 : -1 : e.traversal.used ? 1 : -1, V$1 = (e, t) => e.traversal.lastFrameVisited === t.traversal.lastFrameVisited ? e.internal.depthFromRenderedParent === t.internal.depthFromRenderedParent ? e.internal.loadingState === t.internal.loadingState ? e.internal.hasUnrenderableContent === t.internal.hasUnrenderableContent ? e.traversal.error === t.traversal.error ? 0 : e.traversal.error > t.traversal.error ? -1 : 1 : e.internal.hasUnrenderableContent ? -1 : 1 : e.internal.loadingState > t.internal.loadingState ? -1 : 1 : e.internal.depthFromRenderedParent > t.internal.depthFromRenderedParent ? 1 : -1 : e.traversal.lastFrameVisited > t.traversal.lastFrameVisited ? -1 : 1, H$1 = (e, t) => {
	let n = e.priority ?? Infinity, r = t.priority ?? Infinity;
	if (n !== r) return n > r ? 1 : -1;
	if (!e.internal || !t.internal) return 0;
	let i = e.internal.renderer, a = t.internal.renderer, o = !i.loadAncestors, s = !a.loadAncestors;
	return o && s ? B$1(e, t) : z$1(e, t);
}, U$1 = new o();
U$1.unloadPriorityCallback = V$1;
var W$1 = new l();
W$1.maxJobsPerOrigin = 25, W$1.priorityCallback = H$1;
var G$1 = new c();
G$1.maxJobs = 5, G$1.priorityCallback = H$1;
var K$1 = new c();
K$1.maxJobs = 25, K$1.priorityCallback = (e, t) => {
	let n = e.parent, r = t.parent;
	return n === r ? 0 : n ? r ? H$1(n, r) : -1 : 1;
};
var ie = class {
	get root() {
		let e = this.rootTileset;
		return e ? e.root : null;
	}
	get loadProgress() {
		let { stats: e, isLoading: t } = this, n = e.queued + e.downloading + e.parsing, r = e.inCacheSinceLoad + +!!t;
		return r === 0 ? 1 : 1 - n / r;
	}
	get downloadQueue() {
		return this._downloadQueue;
	}
	set downloadQueue(e) {
		if (e instanceof c) {
			console.warn("TilesRenderer: \"downloadQueue\" is no longer valid as a PriorityQueue. Use a DownloadPriorityQueue, instead.");
			return;
		}
		this._downloadQueue = e;
	}
	constructor(e = null) {
		this.rootLoadingState = 0, this.rootTileset = null, this.rootURL = e, this.fetchOptions = {}, this.plugins = [], this.queuedTiles = [], this.queuedTileSet = /* @__PURE__ */ new Set(), this.cachedSinceLoadComplete = /* @__PURE__ */ new Set(), this.isLoading = false, this.processedTiles = /* @__PURE__ */ new WeakSet(), this.visibleTiles = /* @__PURE__ */ new Set(), this.activeTiles = /* @__PURE__ */ new Set(), this.usedSet = /* @__PURE__ */ new Set(), this.loadingTiles = /* @__PURE__ */ new Set(), this.lruCache = U$1, this.downloadQueue = W$1, this.parseQueue = G$1, this.processNodeQueue = K$1, this.stats = {
			inCacheSinceLoad: 0,
			inCache: 0,
			queued: 0,
			downloading: 0,
			parsing: 0,
			loaded: 0,
			failed: 0,
			inFrustum: 0,
			used: 0,
			active: 0,
			visible: 0,
			refused: 0,
			tilesProcessed: 0
		}, this.frameCount = 0, this._dispatchNeedsUpdateEvent = ne(() => {
			this.dispatchEvent({ type: "needs-update" });
		}), this.errorTarget = 16, this.errorFalloff = 0, this.errorFalloffDensity = 2e-4, this.displayActiveTiles = false, this.maxDepth = Infinity, this.loadSiblings = true, this.loadAncestors = true, this.maxTilesProcessed = 250;
	}
	registerPlugin(e) {
		if (e[L$1] === true) throw Error("TilesRendererBase: A plugin can only be registered to a single tileset");
		let t = this.plugins, n = e.priority || 0, r = t.length;
		for (let e = 0; e < t.length; e++) if ((t[e].priority || 0) > n) {
			r = e;
			break;
		}
		t.splice(r, 0, e), e[L$1] = true, e.init && e.init(this);
	}
	unregisterPlugin(e) {
		let t = this.plugins;
		if (typeof e == "string" && (e = this.getPluginByName(e)), t.includes(e)) {
			let n = t.indexOf(e);
			return t.splice(n, 1), e.dispose && e.dispose(), true;
		}
		return false;
	}
	getPluginByName(e) {
		return this.plugins.find((t) => t.name === e) || null;
	}
	invokeOnePlugin(e) {
		let t = [...this.plugins, this];
		for (let n = 0; n < t.length; n++) {
			let r = e(t[n]);
			if (r) return r;
		}
		return null;
	}
	invokeAllPlugins(e) {
		let t = [...this.plugins, this], n = [];
		for (let r = 0; r < t.length; r++) {
			let i = e(t[r]);
			i && n.push(i);
		}
		return n.length === 0 ? null : Promise.all(n);
	}
	traverse(e, t, n = true) {
		this.root && F$1(this.root, (t, ...r) => (n && this.ensureChildrenArePreprocessed(t, true), e ? e(t, ...r) : false), t);
	}
	getAttributions(e = []) {
		return this.invokeAllPlugins((t) => t !== this && t.getAttributions && t.getAttributions(e)), e;
	}
	update() {
		let { lruCache: e, usedSet: t, stats: n, root: r, downloadQueue: i, parseQueue: a, processNodeQueue: o, queuedTiles: s, queuedTileSet: c } = this;
		if (this.rootLoadingState === 0 && (this.rootLoadingState = 2, this.invokeOnePlugin((e) => e.loadRootTileset && e.loadRootTileset()).then((e) => {
			let t = this.rootURL;
			t !== null && this.invokeAllPlugins((e) => t = e.preprocessURL ? e.preprocessURL(t, null) : t), this.rootLoadingState = 4, this.rootTileset = e, this.dispatchEvent({ type: "needs-update" }), this.dispatchEvent({
				type: "load-tileset",
				tileset: e,
				url: t
			}), this.dispatchEvent({
				type: "load-root-tileset",
				tileset: e,
				url: t
			});
		}).catch((e) => {
			this.rootLoadingState = -1, console.error(e), this.rootTileset = null, this.dispatchEvent({
				type: "load-error",
				tile: null,
				error: e,
				url: this.rootURL
			});
		})), !r) return;
		let l = null;
		if (this.invokeAllPlugins((e) => {
			if (e.doTilesNeedUpdate) {
				let t = e.doTilesNeedUpdate();
				l = l === null ? t : !!(l || t);
			}
		}), l === false) {
			this.dispatchEvent({ type: "update-before" }), this.dispatchEvent({ type: "update-after" });
			return;
		}
		this.dispatchEvent({ type: "update-before" }), n.inFrustum = 0, n.used = 0, n.active = 0, n.visible = 0, n.refused = 0, n.tilesProcessed = 0, this.frameCount++, t.forEach((t) => e.markUnused(t)), t.clear(), this.prepareForTraversal(), te(r, this), this.removeUnusedPendingTiles(), s.sort(e.unloadPriorityCallback);
		let u = 0, d = s.length;
		for (; u < d && !e.isFull(); u++) this.requestTileContents(s[u]);
		n.refused += s.length - u, s.length = 0, c.clear(), e.scheduleUnload(), (i.running || a.running || o.running) === false && this.isLoading === true && (this.cachedSinceLoadComplete.clear(), n.inCacheSinceLoad = 0, this.dispatchEvent({ type: "tiles-load-end" }), this.isLoading = false), this.dispatchEvent({ type: "update-after" });
	}
	resetFailedTiles() {
		this.rootLoadingState === -1 && (this.rootLoadingState = 0);
		let e = this.stats;
		e.failed !== 0 && (this.traverse((e) => {
			e.internal.loadingState === -1 && (e.internal.loadingState = 0);
		}, null, false), e.failed = 0);
	}
	calculateTileViewErrorWithPlugin(e, t) {
		this.calculateTileViewError(e, t);
		let { errorFalloff: n, errorFalloffDensity: r } = this;
		if (n > 0 && Number.isFinite(t.distanceFromCamera)) {
			let e = t.distanceFromCamera * r;
			t.error -= n * (1 - Math.exp(-e * e));
		}
		let i = null, a = 0, o = Infinity;
		this.invokeAllPlugins((t) => {
			t !== this && t.calculateTileViewError && (R$1.inView = true, R$1.error = 0, R$1.distance = Infinity, t.calculateTileViewError(e, R$1) && (i === null && (i = true), i &&= R$1.inView, R$1.inView && (o = Math.min(o, R$1.distance), a = Math.max(a, R$1.error))));
		}), t.inView && i !== false ? (t.error = Math.max(t.error, a), t.distanceFromCamera = Math.min(t.distanceFromCamera, o)) : i ? (t.inView = true, t.error = a, t.distanceFromCamera = o) : t.inView = false;
	}
	dispose() {
		[...this.plugins].forEach((e) => {
			this.unregisterPlugin(e);
		});
		let e = this.lruCache, t = [];
		this.traverse((e) => (t.push(e), false), null, false);
		for (let n = 0, r = t.length; n < r; n++) e.remove(t[n]);
		this.stats = {
			queued: 0,
			parsing: 0,
			downloading: 0,
			failed: 0,
			inFrustum: 0,
			traversed: 0,
			used: 0,
			active: 0,
			visible: 0
		}, this.frameCount = 0, this.loadingTiles.clear();
	}
	calculateBytesUsed(e, t) {
		return 0;
	}
	dispatchEvent(e) {}
	addEventListener(e, t) {}
	removeEventListener(e, t) {}
	parseTile(e, t, n) {
		return null;
	}
	prepareForTraversal() {}
	disposeTile(e) {
		e.traversal.visible && (e.internal.hasRenderableContent ? this.invokeOnePlugin((t) => t.setTileVisible && t.setTileVisible(e, false)) : this.invokeOnePlugin((t) => t.setEmptyTileVisible && t.setEmptyTileVisible(e, false)), e.traversal.visible = false), e.traversal.active && e.internal.hasRenderableContent && this.invokeOnePlugin((t) => t.setTileActive && t.setTileActive(e, false)), e.traversal.active = false;
		let { scene: t } = e.engineData;
		t && this.dispatchEvent({
			type: "dispose-model",
			scene: t,
			tile: e
		});
	}
	preprocessNode(e, t, n = null) {
		if (this.processedTiles.add(e), this.stats.tilesProcessed++, e.content && (!("uri" in e.content) && "url" in e.content && (e.content.uri = e.content.url, delete e.content.url), e.content.boundingVolume && !("box" in e.content.boundingVolume || "sphere" in e.content.boundingVolume || "region" in e.content.boundingVolume) && delete e.content.boundingVolume), e.parent = n, e.children = e.children || [], e.internal = {
			hasContent: false,
			hasRenderableContent: false,
			hasUnrenderableContent: false,
			loadingState: 0,
			basePath: t,
			depth: -1,
			depthFromRenderedParent: -1,
			isVirtual: false,
			virtualChildCount: 0,
			renderer: this,
			...e.internal
		}, e.content?.uri) {
			let t = r(e.content.uri), n = !!(t && /json$/.test(t));
			e.internal.hasContent = true, e.internal.hasUnrenderableContent = n, e.internal.hasRenderableContent = !n;
		} else e.internal.hasContent = false, e.internal.hasUnrenderableContent = false, e.internal.hasRenderableContent = false;
		n ? (e.internal.depth = n.internal.depth + 1, e.internal.depthFromRenderedParent = n.internal.depthFromRenderedParent + +!!e.internal.hasRenderableContent) : (e.internal.depth = 0, e.internal.depthFromRenderedParent = +!!e.internal.hasRenderableContent), e.traversal = {
			distanceFromCamera: Infinity,
			error: Infinity,
			inFrustum: false,
			wasInFrustum: false,
			isLeaf: false,
			used: false,
			usedLastFrame: false,
			visible: false,
			wasSetVisible: false,
			active: false,
			wasSetActive: false,
			allChildrenReady: false,
			allChildrenLoaded: false,
			kicked: false,
			allUsedChildrenProcessed: false,
			lastFrameVisited: -1
		}, n === null ? e.refine = e.refine || "REPLACE" : e.refine = e.refine || n.refine, e.engineData = {
			scene: null,
			metadata: null,
			boundingVolume: null
		}, Object.defineProperty(e, "cached", {
			get() {
				return console.warn("TilesRenderer: \"tile.cached\" field has been renamed to \"tile.engineData\"."), this.engineData;
			},
			enumerable: false,
			configurable: true
		}), this.invokeAllPlugins((r) => {
			r !== this && r.preprocessNode && r.preprocessNode(e, t, n);
		});
	}
	setTileActive(e, t) {
		t ? this.activeTiles.add(e) : this.activeTiles.delete(e);
	}
	setTileVisible(e, t) {
		t ? this.visibleTiles.add(e) : this.visibleTiles.delete(e), this.dispatchEvent({
			type: "tile-visibility-change",
			scene: e.engineData.scene,
			tile: e,
			visible: t
		});
	}
	calculateTileViewError(e, t) {}
	removeUnusedPendingTiles() {
		let { lruCache: e, loadingTiles: t } = this, n = [];
		for (let r of t) !e.isUsed(r) && r.internal.loadingState === 1 && n.push(r);
		for (let t = 0; t < n.length; t++) e.remove(n[t]);
	}
	queueTileForDownload(e) {
		let { queuedTileSet: t } = this;
		if (!(e.internal.loadingState !== 0 || t.has(e))) {
			if (t.add(e), this.lruCache.isFull()) {
				this.stats.refused++;
				return;
			}
			this.queuedTiles.push(e);
		}
	}
	markTileUsed(e) {
		this.usedSet.add(e), this.lruCache.markUsed(e);
	}
	fetchData(e, t) {
		return fetch(e, t);
	}
	ensureChildrenArePreprocessed(e, t = this.stats.tilesProcessed < this.maxTilesProcessed) {
		let n = e.children;
		if (n.length === 0 || n[n.length - 1].traversal) return;
		let r = (t) => {
			for (let n = 0, r = t.length; n < r; n++) {
				let r = t[n];
				r && !r.traversal && this.preprocessNode(r, e.internal.basePath, e);
			}
		};
		t ? (this.processNodeQueue.remove(e), r(n)) : this.processNodeQueue.has(e) || this.processNodeQueue.add(e, (e) => {
			r(e.children), this._dispatchNeedsUpdateEvent();
		});
	}
	getBytesUsed(e) {
		let t = 0;
		return this.invokeAllPlugins((n) => {
			n.calculateBytesUsed && (t += n.calculateBytesUsed(e, e.engineData.scene) || 0);
		}), t;
	}
	recalculateBytesUsed(e = null) {
		let { lruCache: t, processedTiles: n } = this;
		e === null ? t.itemSet.forEach((e) => {
			n.has(e) && t.setMemoryUsage(e, this.getBytesUsed(e));
		}) : t.setMemoryUsage(e, this.getBytesUsed(e));
	}
	preprocessTileset(e, t, n = null) {
		let [r, i] = e.asset.version.split(".").map((e) => parseInt(e));
		console.assert(r <= 1, "TilesRenderer: asset.version is expected to be a 1.x or a compatible version."), r === 1 && i > 0 && console.warn("TilesRenderer: tiles versions at 1.1 or higher have limited support. Some new extensions and features may not be supported.");
		let a = t.replace(/\/[^/]*$/, "");
		a = new URL(a, window.location.href).toString(), this.preprocessNode(e.root, a, n);
	}
	loadRootTileset() {
		let e = this.rootURL;
		return this.invokeAllPlugins((t) => e = t.preprocessURL ? t.preprocessURL(e, null) : e), this.invokeOnePlugin((t) => t.fetchData && t.fetchData(e, this.fetchOptions)).then((t) => {
			if (!(t instanceof Response)) return t;
			if (t.ok) return t.json();
			throw Error(`TilesRenderer: Failed to load tileset "${e}" with status ${t.status} : ${t.statusText}`);
		}).then((t) => (this.preprocessTileset(t, e), t));
	}
	requestTileContents(e) {
		if (e.internal.loadingState !== 0) return;
		let t = false, n = null, i = new URL(e.content.uri, e.internal.basePath + "/").toString();
		this.invokeAllPlugins((t) => i = t.preprocessURL ? t.preprocessURL(i, e) : i);
		let a = this.stats, o = this.lruCache, s = this.downloadQueue, c = this.parseQueue, l = this.loadingTiles, u = r(i), d = new AbortController(), f = d.signal;
		if (o.add(e, (n) => {
			d.abort(), t ? n.children.length = 0 : this.invokeAllPlugins((e) => {
				e.disposeTile && e.disposeTile(n);
			}), a.inCache--, this.cachedSinceLoadComplete.has(e) && (this.cachedSinceLoadComplete.delete(e), a.inCacheSinceLoad--), n.internal.loadingState === 1 ? a.queued-- : n.internal.loadingState === 2 ? a.downloading-- : n.internal.loadingState === 3 ? a.parsing-- : n.internal.loadingState === 4 && a.loaded--, n.internal.loadingState = 0, c.remove(n), s.remove(n), l.delete(n);
		})) return this.isLoading || (this.isLoading = true, this.dispatchEvent({ type: "tiles-load-start" })), o.setMemoryUsage(e, this.getBytesUsed(e)), this.cachedSinceLoadComplete.add(e), a.inCacheSinceLoad++, a.inCache++, a.queued++, e.internal.loadingState = 1, l.add(e), s.add(i, e, (t) => {
			if (f.aborted) return Promise.resolve();
			e.internal.loadingState = 2, a.downloading++, a.queued--;
			let n = this.invokeOnePlugin((e) => e.fetchData && e.fetchData(i, {
				...this.fetchOptions,
				signal: f
			}));
			return this.dispatchEvent({
				type: "tile-download-start",
				tile: e,
				url: i,
				get uri() {
					return console.warn("tile-download-start event: \"uri\" has been renamed to \"url\"."), this.url;
				}
			}), n;
		}).then((e) => {
			if (!f.aborted) {
				if (!(e instanceof Response)) return e;
				if (e.ok) return u === "json" ? e.json() : e.arrayBuffer();
				throw Error(`Failed to load model with error code ${e.status}`);
			}
		}).then((r) => {
			if (!f.aborted) return a.downloading--, a.parsing++, e.internal.loadingState = 3, c.add(e, (a) => f.aborted ? Promise.resolve() : u === "json" && r.root ? (this.preprocessTileset(r, i, e), e.children.push(r.root), n = r, t = true, Promise.resolve()) : this.invokeOnePlugin((e) => e.parseTile && e.parseTile(r, a, u, i, f)));
		}).then(() => {
			if (f.aborted) return;
			a.parsing--, a.loaded++, e.internal.loadingState = 4, l.delete(e), o.setLoaded(e, true);
			let r = this.getBytesUsed(e);
			if (o.getMemoryUsage(e) === 0 && r > 0 && o.isFull()) {
				o.remove(e);
				return;
			}
			o.setMemoryUsage(e, r), this.dispatchEvent({ type: "needs-update" }), t && this.dispatchEvent({
				type: "load-tileset",
				tileset: n,
				url: i
			}), e.engineData.scene && this.dispatchEvent({
				type: "load-model",
				scene: e.engineData.scene,
				tile: e,
				url: i
			});
		}).catch((t) => {
			f.aborted || (t.name === "AbortError" ? o.remove(e) : (c.remove(e), s.remove(e), e.internal.loadingState === 1 ? a.queued-- : e.internal.loadingState === 2 ? a.downloading-- : e.internal.loadingState === 3 ? a.parsing-- : e.internal.loadingState === 4 && a.loaded--, a.failed++, console.error(`TilesRenderer : Failed to load tile at url "${e.content.uri}".`), console.error(t), e.internal.loadingState = -1, l.delete(e), o.setLoaded(e, true), this.dispatchEvent({
				type: "load-error",
				tile: e,
				error: t,
				url: i
			})));
		});
	}
};
function q$1(e) {
	if (e === null || e.byteLength < 4) return "";
	let t;
	if (t = e instanceof DataView ? e : new DataView(e), String.fromCharCode(t.getUint8(0)) === "{") return null;
	let n = "";
	for (let e = 0; e < 4; e++) n += String.fromCharCode(t.getUint8(e));
	return n;
}
var oe = new TextDecoder();
function J$1(e) {
	return oe.decode(e);
}
function Y$1(e) {
	return e.replace(/[\\/][^\\/]+$/, "") + "/";
}
//#endregion
//#region src/core/renderer/loaders/LoaderBase.js
var X$1 = class X {
	constructor() {
		this.fetchOptions = {}, this.workingPath = "";
	}
	loadAsync(e) {
		return fetch(e, this.fetchOptions).then((t) => {
			if (!t.ok) throw Error(`Failed to load file "${e}" with status ${t.status} : ${t.statusText}`);
			return t.arrayBuffer();
		}).then((t) => (this.workingPath === "" && (this.workingPath = Y$1(e)), this.parse(t)));
	}
	resolveExternalURL(e) {
		return new URL(e, this.workingPath).href;
	}
	parse(e) {
		throw Error("LoaderBase: Parse not implemented.");
	}
};
//#endregion
//#region src/core/renderer/utilities/FeatureTable.js
function Z$1(e, t, n, r, i, a) {
	let o;
	switch (r) {
		case "SCALAR":
			o = 1;
			break;
		case "VEC2":
			o = 2;
			break;
		case "VEC3":
			o = 3;
			break;
		case "VEC4":
			o = 4;
			break;
		default: throw Error(`FeatureTable : Feature type not provided for "${a}".`);
	}
	let s, c = n * o;
	switch (i) {
		case "BYTE":
			s = new Int8Array(e, t, c);
			break;
		case "UNSIGNED_BYTE":
			s = new Uint8Array(e, t, c);
			break;
		case "SHORT":
			s = new Int16Array(e, t, c);
			break;
		case "UNSIGNED_SHORT":
			s = new Uint16Array(e, t, c);
			break;
		case "INT":
			s = new Int32Array(e, t, c);
			break;
		case "UNSIGNED_INT":
			s = new Uint32Array(e, t, c);
			break;
		case "FLOAT":
			s = new Float32Array(e, t, c);
			break;
		case "DOUBLE":
			s = new Float64Array(e, t, c);
			break;
		default: throw Error(`FeatureTable : Feature component type not provided for "${a}".`);
	}
	return s;
}
var Q$1 = class Q {
	constructor(e, t, n, r) {
		this.buffer = e, this.binOffset = t + n, this.binLength = r;
		let i = null;
		if (n !== 0) {
			let r = new Uint8Array(e, t, n);
			i = JSON.parse(J$1(r));
		} else i = {};
		this.header = i;
	}
	getKeys() {
		return Object.keys(this.header).filter((e) => e !== "extensions");
	}
	getData(e, t, n = null, r = null) {
		let i = this.header;
		if (!(e in i)) return null;
		let a = i[e];
		if (!(a instanceof Object) || Array.isArray(a)) return a;
		{
			let { buffer: i, binOffset: o, binLength: s } = this, c = a.byteOffset || 0, l = a.type || r, u = a.componentType || n;
			if ("type" in a && r && a.type !== r) throw Error("FeatureTable: Specified type does not match expected type.");
			let d = o + c, f = Z$1(i, d, t, l, u, e);
			if (d + f.byteLength > o + s) throw Error("FeatureTable: Feature data read outside binary body length.");
			return f;
		}
	}
	getBuffer(e, t) {
		let { buffer: n, binOffset: r } = this;
		return n.slice(r + e, r + e + t);
	}
}, se = class {
	constructor(e) {
		this.batchTable = e;
		let t = e.header.extensions["3DTILES_batch_table_hierarchy"];
		this.classes = t.classes;
		for (let e of this.classes) {
			let t = e.instances;
			for (let n in t) e.instances[n] = this._parseProperty(t[n], e.length, n);
		}
		if (this.instancesLength = t.instancesLength, this.classIds = this._parseProperty(t.classIds, this.instancesLength, "classIds"), t.parentCounts ? this.parentCounts = this._parseProperty(t.parentCounts, this.instancesLength, "parentCounts") : this.parentCounts = Array(this.instancesLength).fill(1), t.parentIds) {
			let e = this.parentCounts.reduce((e, t) => e + t, 0);
			this.parentIds = this._parseProperty(t.parentIds, e, "parentIds");
		} else this.parentIds = null;
		this.instancesIds = [];
		let n = {};
		for (let e of this.classIds) n[e] = n[e] ?? 0, this.instancesIds.push(n[e]), n[e]++;
	}
	_parseProperty(e, t, n) {
		if (Array.isArray(e)) return e;
		{
			let { buffer: r, binOffset: i } = this.batchTable, a = e.byteOffset, o = e.componentType || "UNSIGNED_SHORT";
			return Z$1(r, i + a, t, "SCALAR", o, n);
		}
	}
	getDataFromId(e, t = {}) {
		let n = this.parentCounts[e];
		if (this.parentIds && n > 0) {
			let r = 0;
			for (let t = 0; t < e; t++) r += this.parentCounts[t];
			for (let i = 0; i < n; i++) {
				let n = this.parentIds[r + i];
				n !== e && this.getDataFromId(n, t);
			}
		}
		let r = this.classIds[e], i = this.classes[r].instances, a = this.classes[r].name, o = this.instancesIds[e];
		for (let e in i) t[a] = t[a] || {}, t[a][e] = i[e][o];
		return t;
	}
}, $$1 = class $ extends Q$1 {
	constructor(e, t, n, r, i) {
		super(e, n, r, i), this.count = t, this.extensions = {};
		let a = this.header.extensions;
		a && a["3DTILES_batch_table_hierarchy"] && (this.extensions["3DTILES_batch_table_hierarchy"] = new se(this));
	}
	getDataFromId(e, t = {}) {
		if (e < 0 || e >= this.count) throw Error(`BatchTable: id value "${e}" out of bounds for "${this.count}" features number.`);
		for (let n of this.getKeys()) t[n] = super.getData(n, this.count)[e];
		for (let n in this.extensions) {
			let r = this.extensions[n];
			r.getDataFromId instanceof Function && (t[n] = t[n] || {}, r.getDataFromId(e, t[n]));
		}
		return t;
	}
	getPropertyArray(e) {
		return super.getData(e, this.count);
	}
}, ce = class extends X$1 {
	parse(e) {
		let t = new DataView(e), n = q$1(t);
		console.assert(n === "b3dm");
		let r = t.getUint32(4, true);
		console.assert(r === 1);
		let i = t.getUint32(8, true);
		console.assert(i === e.byteLength);
		let a = t.getUint32(12, true), o = t.getUint32(16, true), s = t.getUint32(20, true), c = t.getUint32(24, true), l = new Q$1(e.slice(28, 28 + a + o), 0, a, o), u = 28 + a + o, d = new $$1(e.slice(u, u + s + c), l.getData("BATCH_LENGTH"), 0, s, c), f = u + s + c;
		return {
			version: r,
			featureTable: l,
			batchTable: d,
			glbBytes: new Uint8Array(e, f, i - f)
		};
	}
}, le = class extends X$1 {
	parse(e) {
		let t = new DataView(e), n = q$1(t);
		console.assert(n === "i3dm");
		let r = t.getUint32(4, true);
		console.assert(r === 1);
		let i = t.getUint32(8, true);
		console.assert(i === e.byteLength);
		let a = t.getUint32(12, true), o = t.getUint32(16, true), s = t.getUint32(20, true), c = t.getUint32(24, true), l = t.getUint32(28, true), u = new Q$1(e.slice(32, 32 + a + o), 0, a, o), d = 32 + a + o, f = new $$1(e.slice(d, d + s + c), u.getData("INSTANCES_LENGTH"), 0, s, c), p = d + s + c, m = new Uint8Array(e, p, i - p), h = null, g = null, _ = null;
		if (l) h = m, g = Promise.resolve();
		else {
			let e = this.resolveExternalURL(J$1(m));
			_ = Y$1(e), g = fetch(e, this.fetchOptions).then((t) => {
				if (!t.ok) throw Error(`I3DMLoaderBase : Failed to load file "${e}" with status ${t.status} : ${t.statusText}`);
				return t.arrayBuffer();
			}).then((e) => {
				h = new Uint8Array(e);
			});
		}
		return g.then(() => ({
			version: r,
			featureTable: u,
			batchTable: f,
			glbBytes: h,
			gltfWorkingPath: _
		}));
	}
}, ue = class extends X$1 {
	parse(e) {
		let t = new DataView(e), n = q$1(t);
		console.assert(n === "pnts");
		let r = t.getUint32(4, true);
		console.assert(r === 1);
		let i = t.getUint32(8, true);
		console.assert(i === e.byteLength);
		let a = t.getUint32(12, true), o = t.getUint32(16, true), s = t.getUint32(20, true), c = t.getUint32(24, true), l = new Q$1(e.slice(28, 28 + a + o), 0, a, o), u = 28 + a + o, d = new $$1(e.slice(u, u + s + c), l.getData("BATCH_LENGTH") || l.getData("POINTS_LENGTH"), 0, s, c);
		return Promise.resolve({
			version: r,
			featureTable: l,
			batchTable: d
		});
	}
}, de = class extends X$1 {
	parse(e) {
		let t = new DataView(e), n = q$1(t);
		console.assert(n === "cmpt", "CMPTLoader: The magic bytes equal \"cmpt\".");
		let r = t.getUint32(4, true);
		console.assert(r === 1, "CMPTLoader: The version listed in the header is \"1\".");
		let i = t.getUint32(8, true);
		console.assert(i === e.byteLength, "CMPTLoader: The contents buffer length listed in the header matches the file.");
		let a = t.getUint32(12, true), o = [], s = 16;
		for (let t = 0; t < a; t++) {
			let t = new DataView(e, s, 12), n = q$1(t), r = t.getUint32(4, true), i = t.getUint32(8, true), a = new Uint8Array(e, s, i);
			o.push({
				type: n,
				buffer: a,
				version: r
			}), s += i;
		}
		return {
			version: r,
			tiles: o
		};
	}
};

//#region src/three/renderer/loaders/B3DMLoader.js
var _e = class extends ce {
	constructor(e = DefaultLoadingManager) {
		super(), this.manager = e, this.adjustmentTransform = new Matrix4();
	}
	parse(e) {
		let t = super.parse(e), n = t.glbBytes.slice().buffer;
		return new Promise((e, r) => {
			let i = this.manager, a = this.fetchOptions, o = i.getHandler("path.gltf") || new GLTFLoader(i);
			a.credentials === "include" && a.mode === "cors" && o.setCrossOrigin("use-credentials"), "credentials" in a && o.setWithCredentials(a.credentials === "include"), a.headers && o.setRequestHeader(a.headers);
			let s = this.workingPath;
			!/[\\/]$/.test(s) && s.length && (s += "/");
			let c = this.adjustmentTransform;
			o.parse(n, s, (n) => {
				let { batchTable: r, featureTable: i } = t, { scene: a } = n, o = i.getData("RTC_CENTER", 1, "FLOAT", "VEC3");
				o && (a.position.x += o[0], a.position.y += o[1], a.position.z += o[2]), n.scene.updateMatrix(), n.scene.matrix.multiply(c), n.scene.matrix.decompose(n.scene.position, n.scene.quaternion, n.scene.scale), n.batchTable = r, n.featureTable = i, a.batchTable = r, a.featureTable = i, e(n);
			}, r);
		});
	}
};
//#endregion
//#region src/three/renderer/loaders/rgb565torgb.js
function ve(e) {
	let t = e >> 11, n = e >> 5 & 63, r = e & 31;
	return [
		Math.round(t / 31 * 255),
		Math.round(n / 63 * 255),
		Math.round(r / 31 * 255)
	];
}
//#endregion
//#region src/three/renderer/loaders/decodeOctNormal.js
var ye = /* @__PURE__ */ new Vector2();
function be(e, t, n = new Vector3()) {
	ye.set(e, t).divideScalar(256).multiplyScalar(2).subScalar(1), n.set(ye.x, ye.y, 1 - Math.abs(ye.x) - Math.abs(ye.y));
	let r = MathUtils.clamp(-n.z, 0, 1);
	return n.x >= 0 ? n.setX(n.x - r) : n.setX(n.x + r), n.y >= 0 ? n.setY(n.y - r) : n.setY(n.y + r), n.normalize(), n;
}
//#endregion
//#region src/three/renderer/loaders/PNTSLoader.js
var xe = {
	RGB: "color",
	POSITION: "position"
}, Se = class extends ue {
	constructor(e = DefaultLoadingManager) {
		super(), this.manager = e;
	}
	parse(e) {
		return super.parse(e).then(async (e) => {
			let { featureTable: t, batchTable: n } = e, r = new PointsMaterial(), i = t.header.extensions, a = new Vector3(), o;
			if (i && i["3DTILES_draco_point_compression"]) {
				let { byteOffset: e, byteLength: n, properties: a } = i["3DTILES_draco_point_compression"], s = this.manager.getHandler("draco.drc");
				if (s == null) throw Error("PNTSLoader: dracoLoader not available.");
				let c = {};
				for (let e in a) if (e in xe && e in a) {
					let t = xe[e];
					c[t] = a[e];
				}
				let l = {
					attributeIDs: c,
					attributeTypes: {
						position: "Float32Array",
						color: "Uint8Array"
					},
					useUniqueIDs: true
				}, u = t.getBuffer(e, n);
				o = await s.decodeGeometry(u, l), o.attributes.color && (r.vertexColors = true);
			} else {
				let e = t.getData("POINTS_LENGTH"), n = t.getData("POSITION", e, "FLOAT", "VEC3"), i = t.getData("NORMAL", e, "FLOAT", "VEC3"), s = t.getData("NORMAL", e, "UNSIGNED_BYTE", "VEC2"), c = t.getData("RGB", e, "UNSIGNED_BYTE", "VEC3"), l = t.getData("RGBA", e, "UNSIGNED_BYTE", "VEC4"), u = t.getData("RGB565", e, "UNSIGNED_SHORT", "SCALAR"), p = t.getData("CONSTANT_RGBA", e, "UNSIGNED_BYTE", "VEC4"), h = t.getData("POSITION_QUANTIZED", e, "UNSIGNED_SHORT", "VEC3"), g = t.getData("QUANTIZED_VOLUME_SCALE", e, "FLOAT", "VEC3"), _ = t.getData("QUANTIZED_VOLUME_OFFSET", e, "FLOAT", "VEC3");
				if (o = new BufferGeometry(), h) {
					let t = new Float32Array(e * 3);
					for (let n = 0; n < e; n++) for (let e = 0; e < 3; e++) {
						let r = 3 * n + e;
						t[r] = h[r] / 65535 * g[e];
					}
					a.x = _[0], a.y = _[1], a.z = _[2], o.setAttribute("position", new BufferAttribute(t, 3, false));
				} else o.setAttribute("position", new BufferAttribute(n, 3, false));
				if (i !== null) o.setAttribute("normal", new BufferAttribute(i, 3, false));
				else if (s !== null) {
					let t = new Float32Array(e * 3), n = new Vector3();
					for (let r = 0; r < e; r++) {
						let e = s[r * 2], i = s[r * 2 + 1], a = be(e, i, n);
						t[r * 3] = a.x, t[r * 3 + 1] = a.y, t[r * 3 + 2] = a.z;
					}
					o.setAttribute("normal", new BufferAttribute(t, 3, false));
				}
				if (l !== null) o.setAttribute("color", new BufferAttribute(l, 4, true)), r.vertexColors = true, r.transparent = true, r.depthWrite = false;
				else if (c !== null) o.setAttribute("color", new BufferAttribute(c, 3, true)), r.vertexColors = true;
				else if (u !== null) {
					let t = new Uint8Array(e * 3);
					for (let n = 0; n < e; n++) {
						let e = ve(u[n]);
						for (let r = 0; r < 3; r++) {
							let i = 3 * n + r;
							t[i] = e[r];
						}
					}
					o.setAttribute("color", new BufferAttribute(t, 3, true)), r.vertexColors = true;
				} else if (p !== null) {
					r.color = new Color(p[0], p[1], p[2]);
					let e = p[3] / 255;
					e < 1 && (r.opacity = e, r.transparent = true, r.depthWrite = false);
				}
			}
			let s = new Points(o, r);
			s.position.copy(a), e.scene = s, e.scene.featureTable = t, e.scene.batchTable = n;
			let c = t.getData("RTC_CENTER", 1, "FLOAT", "VEC3");
			return c && (e.scene.position.x += c[0], e.scene.position.y += c[1], e.scene.position.z += c[2]), e;
		});
	}
}, Ce = /* @__PURE__ */ t({
	latitudeToSphericalPhi: () => Ae,
	sphericalPhiToLatitude: () => ke,
	swapToGeoFrame: () => De,
	swapToThreeFrame: () => Oe,
	toLatLonString: () => Ne
}), we = /* @__PURE__ */ new Spherical(), Te = /* @__PURE__ */ new Vector3(), Ee = {};
function De(e) {
	let { x: t, y: n, z: r } = e;
	e.x = r, e.y = t, e.z = n;
}
function Oe(e) {
	let { x: t, y: n, z: r } = e;
	e.z = t, e.x = n, e.y = r;
}
function ke(e) {
	return -(e - Math.PI / 2);
}
function Ae(e) {
	return -e + Math.PI / 2;
}
function je(e, t, n = {}) {
	return we.theta = t, we.phi = Ae(e), Te.setFromSpherical(we), we.setFromVector3(Te), n.lat = ke(we.phi), n.lon = we.theta, n;
}
function Me(e, t = "E", n = "W") {
	let r = e < 0 ? n : t;
	e = Math.abs(e);
	let i = ~~e, a = (e - i) * 60, o = ~~a;
	return `${i}° ${o}' ${~~((a - o) * 60)}" ${r}`;
}
function Ne(e, t, n = false) {
	let r = je(e, t, Ee), i, a;
	return n ? (i = `${(MathUtils.RAD2DEG * r.lat).toFixed(4)}°`, a = `${(MathUtils.RAD2DEG * r.lon).toFixed(4)}°`) : (i = Me(MathUtils.RAD2DEG * r.lat, "N", "S"), a = Me(MathUtils.RAD2DEG * r.lon, "E", "W")), `${i} ${a}`;
}
//#endregion
//#region src/three/renderer/math/Ellipsoid.js
var Pe = /* @__PURE__ */ new Spherical(), Fe = /* @__PURE__ */ new Vector3(), E = /* @__PURE__ */ new Vector3(), Ie = /* @__PURE__ */ new Vector3(), D = /* @__PURE__ */ new Matrix4(), O = /* @__PURE__ */ new Matrix4(), Le = /* @__PURE__ */ new Sphere(), k = /* @__PURE__ */ new Euler(), Re = /* @__PURE__ */ new Vector3(), ze = /* @__PURE__ */ new Vector3(), Be = /* @__PURE__ */ new Vector3(), Ve = /* @__PURE__ */ new Vector3(), He = /* @__PURE__ */ new Ray(), Ue = 1e-12, We = .1, Ge = 0, Ke = 1, qe = 2, Je = class {
	constructor(e = 1, t = 1, n = 1) {
		this.isEllipsoid = true, this.name = "", this.radius = new Vector3(e, t, n);
	}
	intersectRay(e, t) {
		return D.makeScale(...this.radius).invert(), Le.center.set(0, 0, 0), Le.radius = 1, He.copy(e).applyMatrix4(D), He.intersectSphere(Le, t) ? (D.makeScale(...this.radius), t.applyMatrix4(D), t) : null;
	}
	getEastNorthUpFrame(e, t, n, r) {
		return n.isMatrix4 && (r = n, n = 0, console.warn("Ellipsoid: The signature for \"getEastNorthUpFrame\" has changed.")), this.getEastNorthUpAxes(e, t, Re, ze, Be), this.getCartographicToPosition(e, t, n, Ve), r.makeBasis(Re, ze, Be).setPosition(Ve);
	}
	getOrientedEastNorthUpFrame(e, t, n, r, i, a, o) {
		return this.getObjectFrame(e, t, n, r, i, a, o, 0);
	}
	getObjectFrame(e, t, n, r, i, a, o, s = 2) {
		return this.getEastNorthUpFrame(e, t, n, D), k.set(i, a, -r, "ZXY"), o.makeRotationFromEuler(k).premultiply(D), s === 1 ? (k.set(Math.PI / 2, 0, 0, "XYZ"), O.makeRotationFromEuler(k), o.multiply(O)) : s === 2 && (k.set(-Math.PI / 2, 0, Math.PI, "XYZ"), O.makeRotationFromEuler(k), o.multiply(O)), o;
	}
	getCartographicFromObjectFrame(e, t, n = 2) {
		return n === 1 ? (k.set(-Math.PI / 2, 0, 0, "XYZ"), O.makeRotationFromEuler(k).premultiply(e)) : n === 2 ? (k.set(-Math.PI / 2, 0, Math.PI, "XYZ"), O.makeRotationFromEuler(k).premultiply(e)) : O.copy(e), Ve.setFromMatrixPosition(O), this.getPositionToCartographic(Ve, t), this.getEastNorthUpFrame(t.lat, t.lon, 0, D).invert(), O.premultiply(D), k.setFromRotationMatrix(O, "ZXY"), t.azimuth = -k.z, t.elevation = k.x, t.roll = k.y, t;
	}
	getEastNorthUpAxes(e, t, n, r, i, a = Ve) {
		this.getCartographicToPosition(e, t, 0, a), this.getCartographicToNormal(e, t, i), n.set(-a.y, a.x, 0).normalize(), r.crossVectors(i, n).normalize();
	}
	getCartographicToPosition(e, t, n, r) {
		this.getCartographicToNormal(e, t, Fe);
		let i = this.radius;
		E.copy(Fe), E.x *= i.x ** 2, E.y *= i.y ** 2, E.z *= i.z ** 2;
		let a = Math.sqrt(Fe.dot(E));
		return E.divideScalar(a), r.copy(E).addScaledVector(Fe, n);
	}
	getPositionToCartographic(e, t) {
		this.getPositionToSurfacePoint(e, E), this.getPositionToNormal(E, Fe);
		let n = Ie.subVectors(e, E);
		return t.lon = Math.atan2(Fe.y, Fe.x), t.lat = Math.asin(Fe.z), t.height = Math.sign(n.dot(e)) * n.length(), t;
	}
	getCartographicToNormal(e, t, n) {
		return Pe.set(1, Ae(e), t), n.setFromSpherical(Pe).normalize(), De(n), n;
	}
	getPositionToNormal(e, t) {
		let n = this.radius;
		return t.copy(e), t.x /= n.x ** 2, t.y /= n.y ** 2, t.z /= n.z ** 2, t.normalize(), t;
	}
	getPositionToSurfacePoint(e, t) {
		let n = this.radius, r = 1 / n.x ** 2, i = 1 / n.y ** 2, a = 1 / n.z ** 2, o = e.x * e.x * r, s = e.y * e.y * i, c = e.z * e.z * a, l = o + s + c, u = Math.sqrt(1 / l), d = E.copy(e).multiplyScalar(u);
		if (l < We) return isFinite(u) ? t.copy(d) : null;
		let f = Ie.set(d.x * r * 2, d.y * i * 2, d.z * a * 2), p = (1 - u) * e.length() / (.5 * f.length()), m = 0, h, g, _, v, y, ee, b, x, te, S, ne;
		do {
			p -= m, _ = 1 / (1 + p * r), v = 1 / (1 + p * i), y = 1 / (1 + p * a), ee = _ * _, b = v * v, x = y * y, te = ee * _, S = b * v, ne = x * y, h = o * ee + s * b + c * x - 1, g = o * te * r + s * S * i + c * ne * a;
			let e = -2 * g;
			m = h / e;
		} while (Math.abs(h) > Ue);
		return t.set(e.x * _, e.y * v, e.z * y);
	}
	calculateHorizonDistance(e, t) {
		let n = this.calculateEffectiveRadius(e);
		return Math.sqrt(2 * n * t + t ** 2);
	}
	calculateEffectiveRadius(e) {
		let t = this.radius.x, n = 1 - this.radius.z ** 2 / t ** 2, r = e * MathUtils.DEG2RAD, i = Math.sin(r) ** 2;
		return t / Math.sqrt(1 - n * i);
	}
	getPositionElevation(e) {
		this.getPositionToSurfacePoint(e, E);
		let t = Ie.subVectors(e, E);
		return Math.sign(t.dot(e)) * t.length();
	}
	closestPointToRayEstimate(e, t) {
		return this.intersectRay(e, t) ? t : (D.makeScale(...this.radius).invert(), He.copy(e).applyMatrix4(D), E.set(0, 0, 0), He.closestPointToPoint(E, t).normalize(), D.makeScale(...this.radius), t.applyMatrix4(D));
	}
	copy(e) {
		return this.radius.copy(e.radius), this;
	}
	clone() {
		return new this.constructor().copy(this);
	}
}, Ye = new Je(g, g, v);
Ye.name = "WGS84 Earth";
//#endregion
//#region src/three/renderer/loaders/I3DMLoader.js
var Xe = /* @__PURE__ */ new Vector3(), Ze = /* @__PURE__ */ new Vector3(), Qe = /* @__PURE__ */ new Vector3(), $e = /* @__PURE__ */ new Vector3(), et = /* @__PURE__ */ new Quaternion(), tt = /* @__PURE__ */ new Vector3(), nt = /* @__PURE__ */ new Matrix4(), rt = /* @__PURE__ */ new Matrix4(), it = /* @__PURE__ */ new Vector3(), at = /* @__PURE__ */ new Matrix4(), ot = /* @__PURE__ */ new Quaternion(), st = {};
function ct(e, t, n, r) {
	if (e = e / n * 2 - 1, t = t / n * 2 - 1, r.x = e, r.y = t, r.z = 1 - Math.abs(e) - Math.abs(t), r.z < 0) {
		let e = r.x;
		r.x = (1 - Math.abs(r.y)) * (e >= 0 ? 1 : -1), r.y = (1 - Math.abs(e)) * (r.y >= 0 ? 1 : -1);
	}
	return r.normalize(), r;
}
var lt = class extends le {
	constructor(e = DefaultLoadingManager) {
		super(), this.manager = e, this.adjustmentTransform = new Matrix4(), this.ellipsoid = Ye.clone();
	}
	resolveExternalURL(e) {
		return this.manager.resolveURL(super.resolveExternalURL(e));
	}
	parse(e) {
		return super.parse(e).then((e) => {
			let { featureTable: t, batchTable: n } = e, r = e.glbBytes.slice().buffer;
			return new Promise((i, a) => {
				let o = this.fetchOptions, s = this.manager, c = s.getHandler("path.gltf") || new GLTFLoader(s);
				o.credentials === "include" && o.mode === "cors" && c.setCrossOrigin("use-credentials"), "credentials" in o && c.setWithCredentials(o.credentials === "include"), o.headers && c.setRequestHeader(o.headers);
				let l = e.gltfWorkingPath ?? this.workingPath;
				/[\\/]$/.test(l) || (l += "/");
				let u = this.adjustmentTransform;
				c.parse(r, l, (e) => {
					let r = t.getData("INSTANCES_LENGTH"), a = t.getData("POSITION", r, "FLOAT", "VEC3"), o = t.getData("POSITION_QUANTIZED", r, "UNSIGNED_SHORT", "VEC3"), s = t.getData("QUANTIZED_VOLUME_OFFSET", 1, "FLOAT", "VEC3"), c = t.getData("QUANTIZED_VOLUME_SCALE", 1, "FLOAT", "VEC3"), l = t.getData("NORMAL_UP", r, "FLOAT", "VEC3"), d = t.getData("NORMAL_RIGHT", r, "FLOAT", "VEC3"), f = t.getData("NORMAL_UP_OCT32P", r, "UNSIGNED_SHORT", "VEC2"), p = t.getData("NORMAL_RIGHT_OCT32P", r, "UNSIGNED_SHORT", "VEC2"), m = t.getData("SCALE_NON_UNIFORM", r, "FLOAT", "VEC3"), h = t.getData("SCALE", r, "FLOAT", "SCALAR"), g = t.getData("RTC_CENTER", 1, "FLOAT", "VEC3"), _ = t.getData("EAST_NORTH_UP");
					if (!a && o) {
						a = new Float32Array(r * 3);
						for (let e = 0; e < r; e++) a[e * 3 + 0] = s[0] + o[e * 3 + 0] / 65535 * c[0], a[e * 3 + 1] = s[1] + o[e * 3 + 1] / 65535 * c[1], a[e * 3 + 2] = s[2] + o[e * 3 + 2] / 65535 * c[2];
					}
					let v = new Vector3();
					for (let e = 0; e < r; e++) v.x += a[e * 3 + 0] / r, v.y += a[e * 3 + 1] / r, v.z += a[e * 3 + 2] / r;
					let y = [], b = [];
					e.scene.updateMatrixWorld(), e.scene.traverse((e) => {
						if (e.isMesh) {
							b.push(e);
							let { geometry: t, material: n } = e, i = new InstancedMesh(t, n, r);
							i.position.copy(v), g && (i.position.x += g[0], i.position.y += g[1], i.position.z += g[2]), y.push(i);
						}
					});
					for (let e = 0; e < r; e++) {
						$e.set(a[e * 3 + 0] - v.x, a[e * 3 + 1] - v.y, a[e * 3 + 2] - v.z), et.identity(), l && d ? (Ze.set(l[e * 3 + 0], l[e * 3 + 1], l[e * 3 + 2]), Qe.set(d[e * 3 + 0], d[e * 3 + 1], d[e * 3 + 2]), Xe.crossVectors(Qe, Ze).normalize(), nt.makeBasis(Qe, Ze, Xe), et.setFromRotationMatrix(nt)) : f && p && (ct(f[e * 2 + 0], f[e * 2 + 1], 65535, Ze), ct(p[e * 2 + 0], p[e * 2 + 1], 65535, Qe), Xe.crossVectors(Qe, Ze).normalize(), nt.makeBasis(Qe, Ze, Xe), et.setFromRotationMatrix(nt)), tt.set(1, 1, 1), m && tt.set(m[e * 3 + 0], m[e * 3 + 1], m[e * 3 + 2]), h && tt.multiplyScalar(h[e]);
						for (let t = 0, n = y.length; t < n; t++) {
							let n = y[t];
							ot.copy(et), _ && (n.updateMatrixWorld(), it.copy($e).applyMatrix4(n.matrixWorld), this.ellipsoid.getPositionToCartographic(it, st), this.ellipsoid.getEastNorthUpFrame(st.lat, st.lon, at), ot.setFromRotationMatrix(at)), nt.compose($e, ot, tt).multiply(u);
							let r = b[t];
							rt.multiplyMatrices(nt, r.matrixWorld), n.setMatrixAt(e, rt);
						}
					}
					e.scene.clear(), e.scene.add(...y), e.batchTable = n, e.featureTable = t, e.scene.batchTable = n, e.scene.featureTable = t, i(e);
				}, a);
			});
		});
	}
}, ut = class extends de {
	constructor(e = DefaultLoadingManager) {
		super(), this.manager = e, this.adjustmentTransform = new Matrix4(), this.ellipsoid = Ye.clone();
	}
	parse(e) {
		let t = super.parse(e), { manager: n, ellipsoid: r, adjustmentTransform: i } = this, a = [];
		for (let e in t.tiles) {
			let { type: o, buffer: s } = t.tiles[e];
			switch (o) {
				case "b3dm": {
					let e = s.slice(), t = new _e(n);
					t.workingPath = this.workingPath, t.fetchOptions = this.fetchOptions, t.adjustmentTransform.copy(i);
					let r = t.parse(e.buffer);
					a.push(r);
					break;
				}
				case "pnts": {
					let e = s.slice(), t = new Se(n);
					t.workingPath = this.workingPath, t.fetchOptions = this.fetchOptions;
					let r = t.parse(e.buffer);
					a.push(r);
					break;
				}
				case "i3dm": {
					let e = s.slice(), t = new lt(n);
					t.workingPath = this.workingPath, t.fetchOptions = this.fetchOptions, t.ellipsoid.copy(r), t.adjustmentTransform.copy(i);
					let o = t.parse(e.buffer);
					a.push(o);
					break;
				}
			}
		}
		return Promise.all(a).then((e) => {
			let t = new Group();
			return e.forEach((e) => {
				t.add(e.scene);
			}), {
				tiles: e,
				scene: t
			};
		});
	}
}, dt = /* @__PURE__ */ new Matrix4(), ft = class extends Group {
	constructor(e) {
		super(), this.isTilesGroup = true, this.name = "TilesRenderer.TilesGroup", this.tilesRenderer = e, this.matrixWorldInverse = new Matrix4();
	}
	raycast(e, t) {
		return this.tilesRenderer.raycast(e, t), false;
	}
	updateMatrixWorld(e) {
		if (this.matrixAutoUpdate && this.updateMatrix(), this.matrixWorldNeedsUpdate || e) {
			this.parent === null ? dt.copy(this.matrix) : dt.multiplyMatrices(this.parent.matrixWorld, this.matrix), this.matrixWorldNeedsUpdate = false;
			let e = dt.elements, t = this.matrixWorld.elements, n = false;
			for (let r = 0; r < 16; r++) {
				let i = e[r], a = t[r];
				if (Math.abs(i - a) > 2 ** -52) {
					n = true;
					break;
				}
			}
			if (n) {
				this.matrixWorld.copy(dt), this.matrixWorldInverse.copy(dt).invert();
				let e = this.children;
				for (let t = 0, n = e.length; t < n; t++) e[t].updateMatrixWorld();
				let { tilesRenderer: t } = this, { activeTiles: n, visibleTiles: r } = t;
				n.forEach((e) => {
					r.has(e) || e.engineData.scene.updateMatrixWorld(true);
				});
			}
		}
	}
	updateWorldMatrix(e, t) {
		this.parent && e && this.parent.updateWorldMatrix(e, false), this.updateMatrixWorld(true);
	}
}, pt = /* @__PURE__ */ new Ray();
function mt(e, t, n, r) {
	let { scene: i } = e.engineData;
	n.invokeOnePlugin((n) => n.raycastTile && n.raycastTile(e, i, t, r)) || t.intersectObject(i, true, r);
}
function ht(e) {
	return "traversal" in e;
}
function gt(e, t, n, r, i = null) {
	if (!ht(t)) return;
	let { group: a, activeTiles: o } = e, { boundingVolume: s } = t.engineData;
	if (i === null && (i = pt, i.copy(n.ray).applyMatrix4(a.matrixWorldInverse)), !t.traversal.used || !s.intersectsRay(i)) return;
	o.has(t) && mt(t, n, e, r);
	let c = t.children;
	for (let t = 0, a = c.length; t < a; t++) gt(e, c[t], n, r, i);
}
//#endregion
//#region src/three/renderer/math/OBB.js
var _t = /* @__PURE__ */ new Vector3(), vt = /* @__PURE__ */ new Vector3(), A = /* @__PURE__ */ new Vector3(), yt = /* @__PURE__ */ new Ray(), bt = class {
	constructor(e = new Box3(), t = new Matrix4()) {
		this.box = e.clone(), this.transform = t.clone(), this.inverseTransform = new Matrix4(), this.points = Array(8).fill().map(() => new Vector3()), this.planes = [
			,
			,
			,
			,
			,
			,
		].fill().map(() => new Plane());
	}
	copy(e) {
		return this.box.copy(e.box), this.transform.copy(e.transform), this.update(), this;
	}
	clone() {
		return new this.constructor().copy(this);
	}
	clampPoint(e, t) {
		return t.copy(e).applyMatrix4(this.inverseTransform).clamp(this.box.min, this.box.max).applyMatrix4(this.transform);
	}
	distanceToPoint(e) {
		return this.clampPoint(e, A).distanceTo(e);
	}
	containsPoint(e) {
		return A.copy(e).applyMatrix4(this.inverseTransform), this.box.containsPoint(A);
	}
	intersectsRay(e) {
		return yt.copy(e).applyMatrix4(this.inverseTransform), yt.intersectsBox(this.box);
	}
	intersectRay(e, t) {
		return yt.copy(e).applyMatrix4(this.inverseTransform), yt.intersectBox(this.box, t) ? (t.applyMatrix4(this.transform), t) : null;
	}
	update() {
		let { points: e, inverseTransform: t, transform: n, box: r } = this;
		t.copy(n).invert();
		let { min: i, max: a } = r, o = 0;
		for (let t = -1; t <= 1; t += 2) for (let r = -1; r <= 1; r += 2) for (let s = -1; s <= 1; s += 2) e[o].set(t < 0 ? i.x : a.x, r < 0 ? i.y : a.y, s < 0 ? i.z : a.z).applyMatrix4(n), o++;
		this.updatePlanes();
	}
	updatePlanes() {
		_t.copy(this.box.min).applyMatrix4(this.transform), vt.copy(this.box.max).applyMatrix4(this.transform), A.set(0, 0, 1).transformDirection(this.transform), this.planes[0].setFromNormalAndCoplanarPoint(A, _t), this.planes[1].setFromNormalAndCoplanarPoint(A, vt).negate(), A.set(0, 1, 0).transformDirection(this.transform), this.planes[2].setFromNormalAndCoplanarPoint(A, _t), this.planes[3].setFromNormalAndCoplanarPoint(A, vt).negate(), A.set(1, 0, 0).transformDirection(this.transform), this.planes[4].setFromNormalAndCoplanarPoint(A, _t), this.planes[5].setFromNormalAndCoplanarPoint(A, vt).negate();
	}
	intersectsSphere(e) {
		return this.clampPoint(e.center, A), A.distanceToSquared(e.center) <= e.radius * e.radius;
	}
	intersectsFrustum(e) {
		return this._intersectsPlaneShape(e.planes, e.points);
	}
	intersectsOBB(e) {
		return this._intersectsPlaneShape(e.planes, e.points);
	}
	_intersectsPlaneShape(e, t) {
		let n = this.points, r = this.planes;
		for (let t = 0; t < 6; t++) {
			let r = e[t], i = -Infinity;
			for (let e = 0; e < 8; e++) {
				let t = n[e], a = r.distanceToPoint(t);
				i = i < a ? a : i;
			}
			if (i < 0) return false;
		}
		for (let e = 0; e < 6; e++) {
			let n = r[e], i = -Infinity;
			for (let e = 0; e < 8; e++) {
				let r = t[e], a = n.distanceToPoint(r);
				i = i < a ? a : i;
			}
			if (i < 0) return false;
		}
		return true;
	}
}, xt = Math.PI, St = xt / 2, Ct = /* @__PURE__*/ new Vector3(), wt = /* @__PURE__*/ new Vector3(), j = /* @__PURE__*/ new Vector3(), M = /* @__PURE__*/ new Vector3(), N = /* @__PURE__*/ new Matrix4(), Tt = /* @__PURE__*/ new Box3(), Et = /* @__PURE__*/ new Matrix4();
function Dt(e, t) {
	t.radius = Math.max(t.radius, e.distanceToSquared(t.center));
}
function Ot(e) {
	return e.x !== e.y;
}
var kt = class extends Je {
	constructor(e = 1, t = 1, n = 1, r = -St, i = St, a = 0, o = 2 * xt, s = 0, c = 0) {
		super(e, t, n), this.latStart = r, this.latEnd = i, this.lonStart = a, this.lonEnd = o, this.heightStart = s, this.heightEnd = c;
	}
	getBoundingBox(e, t) {
		Ot(this.radius) && console.warn("EllipsoidRegion: Triaxial ellipsoids are not supported.");
		let { latStart: n, latEnd: r, lonStart: i, lonEnd: a, heightStart: o, heightEnd: s } = this, c = (n + r) * .5, l = (i + a) * .5, u = n > 0, d = r < 0, f;
		f = u ? n : d ? r : 0;
		let { min: p, max: m } = e;
		p.setScalar(Infinity), m.setScalar(-Infinity), a - i <= xt ? (this.getCartographicToNormal(c, l, j), wt.set(0, 0, 1), Ct.crossVectors(wt, j).normalize(), wt.crossVectors(j, Ct).normalize(), t.makeBasis(Ct, wt, j), N.copy(t).invert(), this.getCartographicToPosition(f, i, s, M).applyMatrix4(N), m.x = Math.abs(M.x), p.x = -m.x, this.getCartographicToPosition(r, i, s, M).applyMatrix4(N), m.y = M.y, this.getCartographicToPosition(r, l, s, M).applyMatrix4(N), m.y = Math.max(M.y, m.y), this.getCartographicToPosition(n, i, s, M).applyMatrix4(N), p.y = M.y, this.getCartographicToPosition(n, l, s, M).applyMatrix4(N), p.y = Math.min(M.y, p.y), this.getCartographicToPosition(c, l, s, M).applyMatrix4(N), m.z = M.z, this.getCartographicToPosition(n, i, o, M).applyMatrix4(N), p.z = M.z, this.getCartographicToPosition(r, i, o, M).applyMatrix4(N), p.z = Math.min(M.z, p.z)) : (this.getCartographicToPosition(f, l, s, j), j.z = 0, j.length() < 1e-10 ? j.set(1, 0, 0) : j.normalize(), wt.set(0, 0, 1), Ct.crossVectors(j, wt).normalize(), t.makeBasis(Ct, wt, j), N.copy(t).invert(), this.getCartographicToPosition(f, l + St, s, M).applyMatrix4(N), m.x = Math.abs(M.x), p.x = -m.x, this.getCartographicToPosition(r, 0, d ? o : s, M).applyMatrix4(N), m.y = M.y, this.getCartographicToPosition(n, 0, u ? o : s, M).applyMatrix4(N), p.y = M.y, this.getCartographicToPosition(f, l, s, M).applyMatrix4(N), m.z = M.z, this.getCartographicToPosition(f, a, s, M).applyMatrix4(N), p.z = M.z), e.getCenter(M), e.min.sub(M).multiplyScalar(1.0000000000001), e.max.sub(M).multiplyScalar(1.0000000000001), M.applyMatrix4(t), t.setPosition(M);
	}
	getBoundingSphere(e) {
		Ot(this.radius) && console.warn("EllipsoidRegion: Triaxial ellipsoids are not supported."), this.getBoundingBox(Tt, Et), e.center.setFromMatrixPosition(Et), e.radius = 0;
		let { latStart: t, latEnd: n, lonStart: r, lonEnd: i, heightStart: a, heightEnd: o } = this, s = (t + n) * .5, c = (r + i) * .5, l = t > 0, u = n < 0, d;
		d = l ? t : u ? n : 0, this.getCartographicToPosition(d, r, o, M), Dt(M, e), this.getCartographicToPosition(n, r, o, M), Dt(M, e), this.getCartographicToPosition(n, c, o, M), Dt(M, e), this.getCartographicToPosition(t, r, o, M), Dt(M, e), this.getCartographicToPosition(t, c, o, M), Dt(M, e), this.getCartographicToPosition(s, c, o, M), Dt(M, e), this.getCartographicToPosition(t, r, a, M), Dt(M, e), i - r > xt && (this.getCartographicToPosition(d, c + xt, o, M), Dt(M, e)), e.radius = Math.sqrt(e.radius) * 1.0000000000001;
	}
}, P = /* @__PURE__ */ new Vector3(), F = /* @__PURE__ */ new Vector3(), I = /* @__PURE__ */ new Vector3(), At = /* @__PURE__ */ new Vector3(), jt = /* @__PURE__ */ new Vector3(), Mt = class {
	constructor() {
		this.sphere = null, this.obb = null, this.region = null, this.regionObb = null;
	}
	intersectsRay(e) {
		let t = this.sphere, n = this.obb || this.regionObb;
		return !(t && !e.intersectsSphere(t) || n && !n.intersectsRay(e));
	}
	intersectRay(e, t = null) {
		let n = this.sphere, r = this.obb || this.regionObb, i = -Infinity, a = -Infinity;
		n && e.intersectSphere(n, At) && (i = n.containsPoint(e.origin) ? 0 : e.origin.distanceToSquared(At)), r && r.intersectRay(e, jt) && (a = r.containsPoint(e.origin) ? 0 : e.origin.distanceToSquared(jt));
		let o = Math.max(i, a);
		return o === -Infinity ? null : (e.at(Math.sqrt(o), t), t);
	}
	distanceToPoint(e) {
		let t = this.sphere, n = this.obb || this.regionObb, r = -Infinity, i = -Infinity;
		return t && (r = Math.max(t.distanceToPoint(e), 0)), n && (i = n.distanceToPoint(e)), r > i ? r : i;
	}
	intersectsFrustum(e) {
		let t = this.obb || this.regionObb, n = this.sphere;
		return n && !e.intersectsSphere(n) || t && !t.intersectsFrustum(e) ? false : !!(n || t);
	}
	intersectsSphere(e) {
		let t = this.obb || this.regionObb, n = this.sphere;
		return n && !n.intersectsSphere(e) || t && !t.intersectsSphere(e) ? false : !!(n || t);
	}
	intersectsOBB(e) {
		let t = this.obb || this.regionObb, n = this.sphere;
		return n && !e.intersectsSphere(n) || t && !t.intersectsOBB(e) ? false : !!(n || t);
	}
	getOBB(e, t) {
		let n = this.obb || this.regionObb;
		n ? (e.copy(n.box), t.copy(n.transform)) : (this.getAABB(e), t.identity());
	}
	getAABB(e) {
		if (this.sphere) this.sphere.getBoundingBox(e);
		else {
			let t = this.obb || this.regionObb;
			e.copy(t.box).applyMatrix4(t.transform);
		}
	}
	getSphere(e) {
		if (this.sphere) e.copy(this.sphere);
		else if (this.region) this.region.getBoundingSphere(e);
		else {
			let t = this.obb || this.regionObb;
			t.box.getBoundingSphere(e), e.applyMatrix4(t.transform);
		}
	}
	setObbData(e, t) {
		let n = new bt();
		P.set(e[3], e[4], e[5]), F.set(e[6], e[7], e[8]), I.set(e[9], e[10], e[11]);
		let r = P.length(), i = F.length(), a = I.length();
		P.normalize(), F.normalize(), I.normalize(), r === 0 && P.crossVectors(F, I), i === 0 && F.crossVectors(P, I), a === 0 && I.crossVectors(P, F), n.transform.set(P.x, F.x, I.x, e[0], P.y, F.y, I.y, e[1], P.z, F.z, I.z, e[2], 0, 0, 0, 1).premultiply(t), n.box.min.set(-r, -i, -a), n.box.max.set(r, i, a), n.update(), this.obb = n;
	}
	setSphereData(e, t, n, r, i) {
		let a = new Sphere();
		a.center.set(e, t, n), a.radius = r, a.applyMatrix4(i), this.sphere = a;
	}
	setRegionData(e, t, n, r, i, a, o) {
		let s = new kt(...e.radius, n, i, t, r, a, o), c = new bt();
		s.getBoundingBox(c.box, c.transform), c.update(), this.region = s, this.regionObb = c;
	}
}, Nt = /* @__PURE__ */ new Matrix3();
function Pt(e, t, n, r) {
	let i = Nt.set(e.normal.x, e.normal.y, e.normal.z, t.normal.x, t.normal.y, t.normal.z, n.normal.x, n.normal.y, n.normal.z);
	return r.set(-e.constant, -t.constant, -n.constant), r.applyMatrix3(i.invert()), r;
}
var Ft = class extends Frustum {
	constructor() {
		super(), this.points = Array(8).fill().map(() => new Vector3());
	}
	setFromProjectionMatrix(...e) {
		return super.setFromProjectionMatrix(...e), this.calculateFrustumPoints(), this;
	}
	calculateFrustumPoints() {
		let { planes: e, points: t } = this;
		[
			[
				e[0],
				e[3],
				e[4]
			],
			[
				e[1],
				e[3],
				e[4]
			],
			[
				e[0],
				e[2],
				e[4]
			],
			[
				e[1],
				e[2],
				e[4]
			],
			[
				e[0],
				e[3],
				e[5]
			],
			[
				e[1],
				e[3],
				e[5]
			],
			[
				e[0],
				e[2],
				e[5]
			],
			[
				e[1],
				e[2],
				e[5]
			]
		].forEach((e, n) => {
			Pt(e[0], e[1], e[2], t[n]);
		});
	}
}, It = /* @__PURE__ */ t({
	estimateBytesUsed: () => Bt,
	getTextureByteLength: () => zt
}), Lt = 0;
function Rt(e, t, n, r) {
	try {
		return TextureUtils.getByteLength(e, t, n, r);
	} catch {
		return Lt;
	}
}
function zt(e) {
	if (!e) return 0;
	if (e.isExternalTexture) return e.userData?.byteLength ?? Lt;
	let { format: t, type: n, image: r, mipmaps: i } = e;
	if (e.isCompressedTexture && Array.isArray(i) && i.length > 0) {
		let e = 0;
		for (let r of i) r?.data?.byteLength ? e += r.data.byteLength : e += Rt(r.width, r.height, t, n);
		return e;
	}
	if (!r) return Lt;
	let a = Rt(r.width, r.height, t, n);
	return a *= e.generateMipmaps ? 4 / 3 : 1, a;
}
function Bt(e) {
	let t = /* @__PURE__ */ new Set(), n = 0;
	return e.traverse((e) => {
		if (e.geometry && !t.has(e.geometry) && (n += estimateBytesUsed(e.geometry), t.add(e.geometry)), e.material) {
			let r = e.material;
			for (let e in r) {
				let i = r[e];
				i && i.isTexture && !t.has(i) && (n += zt(i), t.add(i));
			}
		}
	}), n;
}
//#endregion
//#region src/three/renderer/tiles/TilesRenderer.js
var Vt = Symbol("INITIAL_FRUSTUM_CULLED"), Ht = /* @__PURE__ */ new Matrix4(), Ut = /* @__PURE__ */ new Vector3(), Wt = /* @__PURE__ */ new Vector2(), Gt = /* @__PURE__ */ new Vector3(1, 0, 0), Kt = /* @__PURE__ */ new Vector3(0, 1, 0), qt = () => null;
function Jt(e, t) {
	e.traverse((e) => {
		e.frustumCulled = e[Vt] && t;
	});
}
var Yt = class extends ie {
	get autoDisableRendererCulling() {
		return this._autoDisableRendererCulling;
	}
	set autoDisableRendererCulling(e) {
		this._autoDisableRendererCulling !== e && (super._autoDisableRendererCulling = e, this.forEachLoadedModel((t) => {
			Jt(t, !e);
		}));
	}
	constructor(...e) {
		super(...e), this.accelerateRaycast = true, this.group = new ft(this), this.ellipsoid = Ye.clone(), this.surface = this.ellipsoid, this.cameras = [], this.cameraMap = /* @__PURE__ */ new Map(), this.cameraInfo = [], this._upRotationMatrix = new Matrix4(), this._bytesUsed = /* @__PURE__ */ new WeakMap(), this._autoDisableRendererCulling = true, this.manager = new LoadingManager(), this._listeners = {};
	}
	addEventListener(e, t) {
		EventDispatcher.prototype.addEventListener.call(this, e, t);
	}
	hasEventListener(e, t) {
		return EventDispatcher.prototype.hasEventListener.call(this, e, t);
	}
	removeEventListener(e, t) {
		EventDispatcher.prototype.removeEventListener.call(this, e, t);
	}
	dispatchEvent(e) {
		EventDispatcher.prototype.dispatchEvent.call(this, e);
	}
	getBoundingBox(e) {
		if (!this.root) return false;
		let t = this.root.engineData.boundingVolume;
		return t ? (t.getAABB(e), true) : false;
	}
	getOrientedBoundingBox(e, t) {
		if (!this.root) return false;
		let n = this.root.engineData.boundingVolume;
		return n ? (n.getOBB(e, t), true) : false;
	}
	getBoundingSphere(e) {
		if (!this.root) return false;
		let t = this.root.engineData.boundingVolume;
		return t ? (t.getSphere(e), true) : false;
	}
	forEachLoadedModel(e) {
		this.traverse((t) => {
			let n = t.engineData && t.engineData.scene;
			n && e(n, t);
		}, null, false);
	}
	raycast(e, t) {
		if (this.root) if (this.accelerateRaycast) gt(this, this.root, e, t);
		else {
			let n = e.firstHitOnly ? [] : t;
			for (let t of this.activeTiles) {
				let { scene: r } = t.engineData;
				this.invokeOnePlugin((i) => i.raycastTile && i.raycastTile(t, r, e, n)) || e.intersectObject(r, true, n);
			}
			e.firstHitOnly && n.length > 0 && (n.sort((e, t) => e.distance - t.distance), t.push(n[0]));
		}
	}
	hasCamera(e) {
		return this.cameraMap.has(e);
	}
	setCamera(e) {
		let t = this.cameras, n = this.cameraMap;
		return n.has(e) ? false : (n.set(e, new Vector2()), t.push(e), this.dispatchEvent({
			type: "add-camera",
			camera: e
		}), true);
	}
	setResolution(e, t, n) {
		let r = this.cameraMap;
		if (!r.has(e)) return false;
		let i = t.isVector2 ? t.x : t, a = t.isVector2 ? t.y : n, o = r.get(e);
		return (o.width !== i || o.height !== a) && (o.set(i, a), this.dispatchEvent({ type: "camera-resolution-change" })), true;
	}
	getResolution(e, t) {
		let n = this.cameraMap.get(e);
		return n ? t.copy(n) : null;
	}
	setResolutionFromRenderer(e, t) {
		return t.getSize(Wt), this.setResolution(e, Wt.x, Wt.y);
	}
	deleteCamera(e) {
		let t = this.cameras, n = this.cameraMap;
		if (n.has(e)) {
			let r = t.indexOf(e);
			return t.splice(r, 1), n.delete(e), this.dispatchEvent({
				type: "delete-camera",
				camera: e
			}), true;
		}
		return false;
	}
	loadRootTileset(...e) {
		return super.loadRootTileset(...e).then((e) => {
			let { asset: t, extensions: n = {} } = e;
			switch ((t && t.gltfUpAxis || "y").toLowerCase()) {
				case "x":
					this._upRotationMatrix.makeRotationAxis(Kt, -Math.PI / 2);
					break;
				case "y":
					this._upRotationMatrix.makeRotationAxis(Gt, Math.PI / 2);
					break;
			}
			if ("3DTILES_ellipsoid" in n) {
				let e = n["3DTILES_ellipsoid"], { ellipsoid: t } = this;
				t.name = e.body, e.radii ? t.radius.set(...e.radii) : t.radius.set(1, 1, 1);
			}
			return e;
		});
	}
	prepareForTraversal() {
		let e = this.group, t = this.cameras, n = this.cameraMap, r = this.cameraInfo;
		for (; r.length > t.length;) r.pop();
		for (; r.length < t.length;) r.push({
			frustum: new Ft(),
			isOrthographic: false,
			sseDenominator: -1,
			position: new Vector3(),
			invScale: -1,
			pixelSize: 0
		});
		Ut.setFromMatrixScale(e.matrixWorldInverse), Math.abs(Math.max(Ut.x - Ut.y, Ut.x - Ut.z)) > 1e-6 && console.warn("ThreeTilesRenderer : Non uniform scale used for tile which may cause issues when calculating screen space error.");
		for (let i = 0, a = r.length; i < a; i++) {
			let a = t[i], o = r[i], s = o.frustum, c = o.position, l = n.get(a);
			(l.width === 0 || l.height === 0) && console.warn("TilesRenderer: resolution for camera error calculation is not set.");
			let u = a.projectionMatrix.elements;
			if (o.isOrthographic = u[15] === 1, o.isOrthographic) {
				let e = 2 / u[0], t = 2 / u[5];
				o.pixelSize = Math.max(t / l.height, e / l.width);
			} else o.sseDenominator = 2 / u[5] / l.height;
			Ht.copy(e.matrixWorld), Ht.premultiply(a.matrixWorldInverse), Ht.premultiply(a.projectionMatrix), s.setFromProjectionMatrix(Ht, a.coordinateSystem, a.reversedDepth), c.set(0, 0, 0), c.applyMatrix4(a.matrixWorld), c.applyMatrix4(e.matrixWorldInverse);
		}
	}
	update() {
		if (super.update(), this.cameras.length === 0 && this.root) {
			let e = false;
			this.invokeAllPlugins((t) => e ||= !!(t !== this && t.calculateTileViewError)), e === false && console.warn("TilesRenderer: no cameras defined. Cannot update 3d tiles.");
		}
	}
	preprocessNode(e, t, n = null) {
		super.preprocessNode(e, t, n);
		let r = new Matrix4();
		if (e.transform) {
			let t = e.transform;
			for (let e = 0; e < 16; e++) r.elements[e] = t[e];
		}
		n && r.premultiply(n.engineData.transform);
		let i = new Matrix4().copy(r).invert(), a = new Mt();
		"sphere" in e.boundingVolume && a.setSphereData(...e.boundingVolume.sphere, r), "box" in e.boundingVolume && a.setObbData(e.boundingVolume.box, r), "region" in e.boundingVolume && a.setRegionData(this.ellipsoid, ...e.boundingVolume.region), e.engineData.transform = r, e.engineData.transformInverse = i, e.engineData.boundingVolume = a, e.engineData.geometry = null, e.engineData.materials = null, e.engineData.textures = null, e.toJSON = qt;
	}
	async parseTile(e, t, n, a, o) {
		let s = t.engineData, c = Y$1(a), l = this.fetchOptions, u = this.manager, d = null, f = s.transform, p = this._upRotationMatrix, m = (q$1(e) || n).toLowerCase();
		switch (m) {
			case "b3dm": {
				let t = new _e(u);
				t.workingPath = c, t.fetchOptions = l, t.adjustmentTransform.copy(p), d = t.parse(e);
				break;
			}
			case "pnts": {
				let t = new Se(u);
				t.workingPath = c, t.fetchOptions = l, d = t.parse(e);
				break;
			}
			case "i3dm": {
				let t = new lt(u);
				t.workingPath = c, t.fetchOptions = l, t.adjustmentTransform.copy(p), t.ellipsoid.copy(this.ellipsoid), d = t.parse(e);
				break;
			}
			case "cmpt": {
				let t = new ut(u);
				t.workingPath = c, t.fetchOptions = l, t.adjustmentTransform.copy(p), t.ellipsoid.copy(this.ellipsoid), d = t.parse(e).then((e) => e.scene);
				break;
			}
			case "gltf":
			case "glb": {
				let t = u.getHandler("path.gltf") || u.getHandler("path.glb") || new GLTFLoader(u);
				t.setWithCredentials(l.credentials === "include"), t.setRequestHeader(l.headers || {}), l.credentials === "include" && l.mode === "cors" && t.setCrossOrigin("use-credentials");
				let n = t.resourcePath || t.path || c;
				!/[\\/]$/.test(n) && n.length && (n += "/"), d = t.parseAsync(e, n).then((e) => {
					e.scene = e.scene || new Group();
					let { scene: t } = e;
					return t.updateMatrix(), t.matrix.multiply(p).decompose(t.position, t.quaternion, t.scale), e;
				});
				break;
			}
			default:
				d = this.invokeOnePlugin((r) => r.parseToMesh && r.parseToMesh(e, t, n, a, o));
				break;
		}
		let h = await d;
		if (h === null) throw Error(`TilesRenderer: Content type "${m}" not supported.`);
		let g, _;
		h.isObject3D ? (g = h, _ = null) : (g = h.scene, _ = h), g.updateMatrix(), g.matrix.premultiply(f), g.matrix.decompose(g.position, g.quaternion, g.scale), await this.invokeAllPlugins((e) => e.processTileModel && e.processTileModel(g, t)), g.traverse((e) => {
			e[Vt] = e.frustumCulled, e.userData.tile = t;
		}), Jt(g, !this.autoDisableRendererCulling);
		let v = [], ee = [], b = [];
		if (g.traverse((e) => {
			if (e.geometry && ee.push(e.geometry), e.material) {
				let t = e.material;
				v.push(e.material);
				for (let e in t) {
					let n = t[e];
					n && n.isTexture && b.push(n);
				}
			}
		}), o.aborted) {
			for (let e = 0, t = b.length; e < t; e++) {
				let t = b[e];
				t.image instanceof ImageBitmap && t.image.close(), t.dispose();
			}
			return;
		}
		s.materials = v, s.geometry = ee, s.textures = b, s.scene = g, s.metadata = _;
	}
	disposeTile(e) {
		super.disposeTile(e);
		let t = e.engineData;
		if (t.scene) {
			let e = t.materials, n = t.geometry, r = t.textures, i = t.scene.parent;
			t.scene.traverse((e) => {
				e.userData.meshFeatures && e.userData.meshFeatures.dispose(), e.userData.structuralMetadata && e.userData.structuralMetadata.dispose();
			});
			for (let e = 0, t = n.length; e < t; e++) n[e].dispose();
			for (let t = 0, n = e.length; t < n; t++) e[t].dispose();
			for (let e = 0, t = r.length; e < t; e++) {
				let t = r[e];
				t.image instanceof ImageBitmap && t.image.close(), t.dispose();
			}
			i && i.remove(t.scene), t.scene = null, t.materials = null, t.textures = null, t.geometry = null, t.metadata = null;
		}
	}
	setTileActive(e, t) {
		super.setTileActive(e, t);
		let n = e.engineData.scene;
		n && (t ? (n.parent = this.group, n.updateMatrixWorld(true)) : this.visibleTiles.has(e) || (n.parent = null));
	}
	setTileVisible(e, t) {
		let n = e.engineData.scene, { activeTiles: r, group: i } = this;
		n && (t ? i.add(n) : (i.remove(n), r.has(e) && (n.parent = i))), super.setTileVisible(e, t);
	}
	calculateBytesUsed(e, t) {
		let n = this._bytesUsed;
		return !n.has(e) && t && n.set(e, Bt(t)), n.get(e) ?? null;
	}
	calculateTileViewError(e, t) {
		let n = e.engineData, r = this.cameras, i = this.cameraInfo, a = n.boundingVolume, o = false, s = 0, c = Infinity, l = 0, u = Infinity;
		for (let t = 0, n = r.length; t < n; t++) {
			let n = i[t], r, d;
			if (n.isOrthographic) {
				let t = n.pixelSize;
				r = e.geometricError / t, d = Infinity;
			} else {
				let t = n.sseDenominator;
				d = a.distanceToPoint(n.position), r = d === 0 ? Infinity : e.geometricError / (d * t);
			}
			let f = i[t].frustum;
			a.intersectsFrustum(f) && (o = true, s = Math.max(s, r), c = Math.min(c, d)), l = Math.max(l, r), u = Math.min(u, d);
		}
		o ? (t.inView = true, t.error = s, t.distanceFromCamera = c) : (t.inView = false, t.error = l, t.distanceFromCamera = u);
	}
	dispose() {
		super.dispose(), this.group.removeFromParent();
	}
}, Xt = class extends Mesh {
	constructor() {
		super(new PlaneGeometry(0, 0), new Zt()), this.renderOrder = Infinity;
	}
	onBeforeRender(e) {
		let t = this.material.uniforms;
		e.getSize(t.resolution.value);
	}
	updateMatrixWorld() {
		this.matrixWorld.makeTranslation(this.position);
	}
	dispose() {
		this.geometry.dispose(), this.material.dispose();
	}
}, Zt = class extends ShaderMaterial {
	constructor() {
		super({
			depthWrite: false,
			depthTest: false,
			transparent: true,
			uniforms: {
				resolution: { value: new Vector2() },
				size: { value: 15 },
				thickness: { value: 2 },
				opacity: { value: 1 }
			},
			vertexShader: "\n\n				uniform float size;\n				uniform float thickness;\n				uniform vec2 resolution;\n				varying vec2 vUv;\n\n				void main() {\n\n					vUv = uv;\n\n					float aspect = resolution.x / resolution.y;\n					vec2 offset = uv * 2.0 - vec2( 1.0 );\n					offset.y *= aspect;\n\n					vec4 screenPoint = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n					screenPoint.xy += offset * ( size + thickness ) * screenPoint.w / resolution.x;\n\n					gl_Position = screenPoint;\n\n				}\n			",
			fragmentShader: "\n\n				uniform float size;\n				uniform float thickness;\n				uniform float opacity;\n\n				varying vec2 vUv;\n				void main() {\n\n					float ht = 0.5 * thickness;\n					float planeDim = size + thickness;\n					float offset = ( planeDim - ht - 2.0 ) / planeDim;\n					float texelThickness = ht / planeDim;\n\n					vec2 vec = vUv * 2.0 - vec2( 1.0 );\n					float dist = abs( length( vec ) - offset );\n					float fw = fwidth( dist ) * 0.5;\n					float a = smoothstep( texelThickness - fw, texelThickness + fw, dist );\n\n					gl_FragColor = vec4( 1, 1, 1, opacity * ( 1.0 - a ) );\n\n				}\n			"
		});
	}
}, Qt = /* @__PURE__ */ new Vector2(), $t = /* @__PURE__ */ new Vector2(), en = class {
	constructor() {
		this.domElement = null, this.buttons = 0, this.pointerType = null, this.pointerOrder = [], this.previousPositions = {}, this.pointerPositions = {}, this.startPositions = {}, this.pointerSetThisFrame = {}, this.hoverPosition = new Vector2(), this.hoverSet = false;
	}
	reset() {
		this.buttons = 0, this.pointerType = null, this.pointerOrder = [], this.previousPositions = {}, this.pointerPositions = {}, this.startPositions = {}, this.pointerSetThisFrame = {}, this.hoverPosition = new Vector2(), this.hoverSet = false;
	}
	updateFrame() {
		let { previousPositions: e, pointerPositions: t } = this;
		for (let n in t) e[n].copy(t[n]);
	}
	setHoverEvent(e) {
		(e.pointerType === "mouse" || e.type === "wheel") && (this.getAdjustedPointer(e, this.hoverPosition), this.hoverSet = true);
	}
	getLatestPoint(e) {
		return this.pointerType === null ? this.hoverSet ? (e.copy(this.hoverPosition), e) : null : (this.getCenterPoint(e), e);
	}
	getAdjustedPointer(e, t) {
		let n = (this.domElement ? this.domElement : e.target).getBoundingClientRect(), r = e.clientX - n.left, i = e.clientY - n.top;
		t.set(r, i);
	}
	addPointer(e) {
		let t = e.pointerId, n = new Vector2();
		this.getAdjustedPointer(e, n), this.pointerOrder.push(t), this.pointerPositions[t] = n, this.previousPositions[t] = n.clone(), this.startPositions[t] = n.clone(), this.getPointerCount() === 1 && (this.pointerType = e.pointerType, this.buttons = e.buttons);
	}
	updatePointer(e) {
		let t = e.pointerId;
		return t in this.pointerPositions ? (this.getAdjustedPointer(e, this.pointerPositions[t]), true) : false;
	}
	deletePointer(e) {
		let t = e.pointerId, n = this.pointerOrder;
		n.splice(n.indexOf(t), 1), delete this.pointerPositions[t], delete this.previousPositions[t], delete this.startPositions[t], this.getPointerCount() === 0 && (this.buttons = 0, this.pointerType = null);
	}
	getPointerCount() {
		return this.pointerOrder.length;
	}
	getCenterPoint(e, t = this.pointerPositions) {
		let n = this.pointerOrder;
		if (this.getPointerCount() === 1 || this.getPointerType() === "mouse") {
			let r = n[0];
			return e.copy(t[r]), e;
		} else if (this.getPointerCount() === 2) {
			let n = this.pointerOrder[0], r = this.pointerOrder[1], i = t[n], a = t[r];
			return e.addVectors(i, a).multiplyScalar(.5), e;
		}
		return null;
	}
	getPreviousCenterPoint(e) {
		return this.getCenterPoint(e, this.previousPositions);
	}
	getStartCenterPoint(e) {
		return this.getCenterPoint(e, this.startPositions);
	}
	getMoveDistance() {
		return this.getCenterPoint(Qt), this.getPreviousCenterPoint($t), Qt.sub($t).length();
	}
	getTouchPointerDistance(e = this.pointerPositions) {
		if (this.getPointerCount() <= 1 || this.getPointerType() === "mouse") return 0;
		let { pointerOrder: t } = this, n = t[0], r = t[1], i = e[n], a = e[r];
		return i.distanceTo(a);
	}
	getPreviousTouchPointerDistance() {
		return this.getTouchPointerDistance(this.previousPositions);
	}
	getStartTouchPointerDistance() {
		return this.getTouchPointerDistance(this.startPositions);
	}
	getPointerType() {
		return this.pointerType;
	}
	isPointerTouch() {
		return this.getPointerType() === "touch";
	}
	getPointerButtons() {
		return this.buttons;
	}
	isLeftClicked() {
		return !!(this.buttons & 1);
	}
	isRightClicked() {
		return !!(this.buttons & 2);
	}
}, tn = /* @__PURE__ */ new Matrix4();
function nn(e, t, n) {
	return n.makeTranslation(-e.x, -e.y, -e.z), tn.makeRotationFromQuaternion(t), n.premultiply(tn), tn.makeTranslation(e.x, e.y, e.z), n.premultiply(tn), n;
}
function rn(e, t, n) {
	n.x = e.x / t.clientWidth * 2 - 1, n.y = -(e.y / t.clientHeight) * 2 + 1, n.isVector3 && (n.z = 0);
}
function L(e, t, n) {
	let { origin: r, direction: i } = e instanceof Ray ? e : e.ray;
	r.set(t.x, t.y, -1).unproject(n), i.set(t.x, t.y, 1).unproject(n).sub(r), e.isRay || (e.near = 0, e.far = i.length(), e.camera = n), i.normalize();
}
var an = .05, on = .025, R = /* @__PURE__ */ new Matrix4(), sn = /* @__PURE__ */ new Matrix4(), z = /* @__PURE__ */ new Vector3(), B = /* @__PURE__ */ new Vector3(), cn = /* @__PURE__ */ new Vector3(), ln = /* @__PURE__ */ new Vector3(), V = /* @__PURE__ */ new Vector3(), H = /* @__PURE__ */ new Vector3(), un = /* @__PURE__ */ new Vector3(), dn = /* @__PURE__ */ new Vector3(), U = /* @__PURE__ */ new Quaternion(), fn = /* @__PURE__ */ new Plane(), W = /* @__PURE__ */ new Vector3(), pn = /* @__PURE__ */ new Vector3(), mn = /* @__PURE__ */ new Vector3(), hn = /* @__PURE__ */ new Quaternion(), G = /* @__PURE__ */ new Ray(), gn = /* @__PURE__ */ new Vector3(), _n = /* @__PURE__ */ new Vector2(), K = /* @__PURE__ */ new Vector2(), vn = /* @__PURE__ */ new Vector2(), yn = /* @__PURE__ */ new Vector2(), bn = /* @__PURE__ */ new Vector2(), xn = /* @__PURE__ */ new Vector2(), Sn = { type: "change" }, Cn = { type: "start" }, wn = { type: "end" }, Tn = 300, En = 30, Dn = 5, On = .0025, kn = class extends EventDispatcher {
	get enabled() {
		return this._enabled;
	}
	set enabled(e) {
		e !== this.enabled && (this._enabled = e, this.resetState(), this.pointerTracker.reset(), this.enabled || (this.dragInertia.set(0, 0, 0), this.rotationInertia.set(0, 0)));
	}
	constructor(e = null, t = null, n = null) {
		super(), this.isEnvironmentControls = true, this.domElement = null, this.camera = null, this.scene = null, this.tilesRenderer = null, this._enabled = true, this.cameraRadius = 5, this.rotationSpeed = 1, this.minAltitude = 0, this.maxAltitude = .45 * Math.PI, this.minDistance = 10, this.maxDistance = Infinity, this.minZoom = 0, this.maxZoom = Infinity, this.zoomSpeed = 1, this.adjustHeight = true, this.enableDamping = false, this.dampingFactor = .15, this.enableDoubleTapZoom = true, this.doubleTapZoomScale = 2, this.doubleTapZoomDuration = .25, this.fallbackPlane = new Plane(new Vector3(0, 1, 0), 0), this.useFallbackPlane = true, this.enableFlight = false, this.flightSpeed = 10, this.flightSpeedMultiplier = 4, this.scaleZoomOrientationAtEdges = false, this.autoAdjustCameraRotation = true, this.state = 0, this.pointerTracker = new en(), this.needsUpdate = false, this.actionHeightOffset = 0, this.pivotPoint = new Vector3(), this.zoomDirectionSet = false, this.zoomPointSet = false, this.zoomDirection = new Vector3(), this.zoomPoint = new Vector3(), this.zoomDelta = 0, this.rotationInertiaPivot = new Vector3(), this.rotationInertia = new Vector2(), this.dragInertia = new Vector3(), this.inertiaTargetDistance = Infinity, this.inertiaStableFrames = 0, this.pivotMesh = new Xt(), this.pivotMesh.raycast = () => {}, this.pivotMesh.scale.setScalar(.25), this.raycaster = new Raycaster(), this.raycaster.firstHitOnly = true, this.up = new Vector3(0, 1, 0), this._lastTime = performance.now(), this._keysDown = /* @__PURE__ */ new Set(), this._detachCallback = null, this._upInitialized = false, this._lastUsedState = 0, this._zoomPointWasSet = false, this._doubleTapZoomActive = false, this._doubleTapZoomElapsed = 0, this._doubleTapPoint = new Vector2(), this._lastTapTime = -Infinity, this._lastTapPoint = new Vector2(), this._tilesOnChangeCallback = () => this.zoomPointSet = false, n && this.attach(n), t && this.setCamera(t), e && this.setScene(e);
	}
	_getDeltaTime() {
		let e = performance.now(), t = e - this._lastTime;
		return this._lastTime = e, t * .001;
	}
	setScene(e) {
		this.scene = e;
	}
	setCamera(e) {
		this.camera = e, this._upInitialized = false, this.zoomDirectionSet = false, this.zoomPointSet = false, this.needsUpdate = true, this.raycaster.camera = e, this.resetState();
	}
	attach(e) {
		if (this.domElement) throw Error("EnvironmentControls: Controls already attached to element");
		this.domElement = e, this.pointerTracker.domElement = e, e.style.touchAction = "none", e.hasAttribute("tabindex") || (e.tabIndex = -1);
		let t = (e) => {
			this.enabled && e.preventDefault();
		}, n = (e) => {
			let { camera: t, raycaster: n, domElement: r, up: i, pivotMesh: a, pointerTracker: o, scene: s, pivotPoint: c, enabled: l, enableFlight: u, _keysDown: d } = this;
			if (!this.enabled) return;
			if (e.preventDefault(), r.focus(), o.addPointer(e), this.needsUpdate = true, this._cancelDoubleTapZoom(), o.isPointerTouch()) {
				if (a.visible = false, o.getPointerCount() === 0) r.setPointerCapture(e.pointerId);
				else if (o.getPointerCount() > 2) {
					this.resetState();
					return;
				}
			}
			o.getCenterPoint(K), rn(K, r, K), L(n, K, t);
			let f = Math.abs(n.ray.direction.dot(i));
			if (f < an || f < on) return;
			let p = d.has("w") || d.has("s") || d.has("a") || d.has("d") || d.has("q") || d.has("e") || d.has("arrowup") || d.has("arrowdown") || d.has("arrowleft") || d.has("arrowright") || d.has("shift");
			if (u && p && !o.isPointerTouch() && (o.isRightClicked() || o.isLeftClicked())) {
				c.copy(t.position), this.setState(5);
				return;
			}
			let m = this._raycast(n);
			m && (o.getPointerCount() === 2 || o.isRightClicked() || o.isLeftClicked() && e.shiftKey ? (c.copy(m.point), a.position.copy(m.point), a.visible = o.isPointerTouch() ? false : l, a.updateMatrixWorld(), s.add(a), this.setState(o.isPointerTouch() ? 4 : 2)) : o.isLeftClicked() && (c.copy(m.point), a.position.copy(m.point), a.updateMatrixWorld(), s.add(a), this.setState(1)));
		}, r = false, i = (e) => {
			let { pointerTracker: t } = this;
			if (!this.enabled) return;
			e.preventDefault();
			let { pivotMesh: n, enabled: i } = this;
			this.zoomDirectionSet = false, this.zoomPointSet = false, this.state !== 0 && (this.needsUpdate = true), t.setHoverEvent(e), t.updatePointer(e) && (t.isPointerTouch() && t.getPointerCount() === 2 && (r || (r = true, queueMicrotask(() => {
				r = false, t.getCenterPoint(bn);
				let e = t.getStartTouchPointerDistance(), a = t.getTouchPointerDistance(), o = a - e;
				if (this.state === 0 || this.state === 4) {
					t.getCenterPoint(bn), t.getStartCenterPoint(xn);
					let e = 2 * window.devicePixelRatio, n = bn.distanceTo(xn);
					(Math.abs(o) > e || n > e) && (Math.abs(o) > n ? (this.setState(3), this.zoomDirectionSet = false) : this.setState(2));
				}
				if (this.state === 3) {
					let e = t.getPreviousTouchPointerDistance();
					this.zoomDelta += a - e, n.visible = false;
				} else this.state === 2 && (n.visible = i);
			}))), this.dispatchEvent(Sn));
		}, a = (t) => {
			let { pointerTracker: n } = this;
			if (!(!this.enabled || n.getPointerCount() === 0)) {
				if (this.enableDoubleTapZoom && t.button === 0 && n.getPointerCount() === 1 && (n.getCenterPoint(K), n.getStartCenterPoint(bn), K.distanceTo(bn) < Dn * window.devicePixelRatio)) {
					let e = performance.now();
					e - this._lastTapTime < Tn && K.distanceTo(this._lastTapPoint) < En * window.devicePixelRatio ? (this._lastTapTime = -Infinity, this._beginDoubleTapZoom(K)) : (this._lastTapTime = e, this._lastTapPoint.copy(K));
				}
				n.deletePointer(t), n.getPointerType() === "touch" && n.getPointerCount() === 0 && e.releasePointerCapture(t.pointerId), this.resetState(), this.needsUpdate = true;
			}
		}, o = (e) => {
			if (!this.enabled) return;
			e.preventDefault(), this._cancelDoubleTapZoom();
			let { pointerTracker: t } = this;
			t.setHoverEvent(e), t.updatePointer(e), this.dispatchEvent(Cn);
			let n;
			switch (e.deltaMode) {
				case 2:
					n = e.deltaY * 800;
					break;
				case 1:
					n = e.deltaY * 40;
					break;
				case 0:
					n = e.deltaY;
					break;
			}
			let r = Math.sign(n), i = Math.abs(n);
			this.zoomDelta -= .25 * r * i, this.needsUpdate = true, this._lastUsedState = 3, this.dispatchEvent(wn);
		}, s = (e) => {
			this.enabled && this.resetState();
		};
		e.addEventListener("contextmenu", t), e.addEventListener("pointerdown", n), e.addEventListener("wheel", o, { passive: false });
		let c = e.getRootNode();
		c.addEventListener("pointermove", i), c.addEventListener("pointerup", a), c.addEventListener("pointerleave", s);
		let l = (e) => {
			let { _keysDown: t, state: n } = this;
			t.add(e.key.toLowerCase()), (t.has("w") || t.has("s") || t.has("a") || t.has("d") || t.has("q") || t.has("e") || t.has("arrowup") || t.has("arrowdown") || t.has("arrowleft") || t.has("arrowright")) && n !== 5 && this.resetState();
		}, u = (e) => {
			this._keysDown.delete(e.key.toLowerCase());
		}, d = () => {
			this._keysDown.clear();
		};
		e.addEventListener("keydown", l), window.addEventListener("keyup", u), window.addEventListener("blur", d), this._detachCallback = () => {
			e.removeEventListener("contextmenu", t), e.removeEventListener("pointerdown", n), e.removeEventListener("wheel", o), c.removeEventListener("pointermove", i), c.removeEventListener("pointerup", a), c.removeEventListener("pointerleave", s), e.removeEventListener("keydown", l), window.removeEventListener("keyup", u), window.removeEventListener("blur", d);
		};
	}
	detach() {
		this.domElement = null, this._detachCallback && (this._detachCallback(), this._detachCallback = null, this.pointerTracker.reset());
	}
	getUpDirection(e, t) {
		t.copy(this.up);
	}
	getCameraUpDirection(e) {
		this.getUpDirection(this.camera.position, e);
	}
	getPivotPoint(e) {
		let t = null;
		this._lastUsedState === 3 ? this._zoomPointWasSet && (t = e.copy(this.zoomPoint)) : (this._lastUsedState === 2 || this._lastUsedState === 1) && (t = e.copy(this.pivotPoint));
		let { camera: n, raycaster: r } = this;
		t !== null && (B.copy(t).project(n), (B.x < -1 || B.x > 1 || B.y < -1 || B.y > 1) && (t = null)), L(r, {
			x: 0,
			y: 0
		}, n);
		let i = this._raycast(r);
		return i && (t === null || i.distance < t.distanceTo(r.ray.origin)) && (t = e.copy(i.point)), t;
	}
	resetState() {
		this.state !== 0 && this.dispatchEvent(wn), this.state = 0, this.pivotMesh.removeFromParent(), this.pivotMesh.visible = this.enabled, this.actionHeightOffset = 0, this.pointerTracker.reset();
	}
	setState(e = this.state, t = true) {
		this.state !== e && (this.state === 0 && t && this.dispatchEvent(Cn), this.pivotMesh.visible = this.enabled, this.dragInertia.set(0, 0, 0), this.rotationInertia.set(0, 0), this.inertiaStableFrames = 0, this.state = e, e !== 0 && e !== 4 && (this._lastUsedState = e));
	}
	update(e = Math.min(this._getDeltaTime(), 64 / 1e3)) {
		if (!this.enabled || !this.camera || e === 0) return;
		let { camera: t, cameraRadius: n, pivotPoint: r, up: i, state: a, adjustHeight: o, autoAdjustCameraRotation: s } = this;
		t.updateMatrixWorld(), this.getCameraUpDirection(W), this._upInitialized || (this._upInitialized = true, this.up.copy(W)), this.zoomPointSet = false, this._updateDoubleTapZoom(e);
		let c = this._inertiaNeedsUpdate(), l = this.needsUpdate || c;
		if (this.needsUpdate || c) {
			let n = this.zoomDelta;
			this._updateZoom(), this._updatePosition(e), this._updateRotation(e), a === 1 || a === 2 || a === 5 ? (V.set(0, 0, -1).transformDirection(t.matrixWorld), this.inertiaTargetDistance = B.copy(r).sub(t.position).dot(V)) : a === 0 && this._updateInertia(e), (a !== 0 || n !== 0 || c) && this.dispatchEvent(Sn), this.needsUpdate = false;
		}
		let u = this._updateFlight(e);
		u && (this.dragInertia.set(0, 0, 0), this.rotationInertia.set(0, 0, 0), this.dispatchEvent(Sn));
		let d = t.isOrthographicCamera ? null : o && !u && this._getPointBelowCamera() || null;
		if (this.getCameraUpDirection(W), this._setFrame(W), (this.state === 1 || this.state === 2 || this.state === 5) && this.actionHeightOffset !== 0) {
			let { actionHeightOffset: e } = this;
			t.position.addScaledVector(i, -e), r.addScaledVector(i, -e), d && (d.distance -= e);
		}
		if (this.actionHeightOffset = 0, d) {
			let e = d.distance;
			if (e < n) {
				let a = n - e;
				t.position.addScaledVector(i, a), r.addScaledVector(i, a), this.actionHeightOffset = a;
			}
		}
		this.pointerTracker.updateFrame(), (l && s || u) && (this.getCameraUpDirection(W), this._alignCameraUp(W, 1), this.getCameraUpDirection(W), this._clampRotation(W));
	}
	adjustCamera(e) {
		let { adjustHeight: t, cameraRadius: n } = this;
		if (e.isPerspectiveCamera) {
			this.getUpDirection(e.position, W);
			let r = t && this._getPointBelowCamera(e.position, W) || null;
			if (r) {
				let t = r.distance;
				t < n && e.position.addScaledVector(W, n - t);
			}
		}
	}
	dispose() {
		this.detach();
	}
	_updateInertia(e) {
		let { rotationInertia: t, pivotPoint: n, dragInertia: r, enableDamping: i, dampingFactor: a, camera: o, cameraRadius: s, minDistance: c, inertiaTargetDistance: l } = this;
		if (!this.enableDamping || this.inertiaStableFrames > 1) {
			r.set(0, 0, 0), t.set(0, 0, 0);
			return;
		}
		let u = 2 ** (-e / a), d = Math.max(o.near, s, c, l), f = 2 / (2 * 1e3) * .25;
		if (t.lengthSq() > 0) {
			L(G, B.set(0, 0, -1), o), G.applyMatrix4(o.matrixWorldInverse), G.direction.normalize(), G.recast(-G.direction.dot(G.origin)).at(d / G.direction.z, B), B.applyMatrix4(o.matrixWorld), L(G, z.set(f, f, -1), o), G.applyMatrix4(o.matrixWorldInverse), G.direction.normalize(), G.recast(-G.direction.dot(G.origin)).at(d / G.direction.z, z), z.applyMatrix4(o.matrixWorld), B.sub(n).normalize(), z.sub(n).normalize();
			let r = B.angleTo(z) / e;
			t.multiplyScalar(u), (t.lengthSq() < r ** 2 || !i) && t.set(0, 0);
		}
		if (r.lengthSq() > 0) {
			L(G, B.set(0, 0, -1), o), G.applyMatrix4(o.matrixWorldInverse), G.direction.normalize(), G.recast(-G.direction.dot(G.origin)).at(d / G.direction.z, B), B.applyMatrix4(o.matrixWorld), L(G, z.set(f, f, -1), o), G.applyMatrix4(o.matrixWorldInverse), G.direction.normalize(), G.recast(-G.direction.dot(G.origin)).at(d / G.direction.z, z), z.applyMatrix4(o.matrixWorld);
			let t = B.distanceTo(z) / e;
			r.multiplyScalar(u), (r.lengthSq() < t ** 2 || !i) && r.set(0, 0, 0);
		}
		t.lengthSq() > 0 && this._applyRotation(t.x * e, t.y * e, n), r.lengthSq() > 0 && (o.position.addScaledVector(r, e), o.updateMatrixWorld());
	}
	_inertiaNeedsUpdate() {
		let { rotationInertia: e, dragInertia: t } = this;
		return e.lengthSq() !== 0 || t.lengthSq() !== 0;
	}
	_getFlightSpeedScale() {
		return 1;
	}
	_updateFlight(e) {
		let { camera: t, enableFlight: n, flightSpeed: r, flightSpeedMultiplier: i, _keysDown: a } = this;
		if (!n || t.isOrthographicCamera) return false;
		let o = a.has("w") || a.has("arrowup"), s = a.has("s") || a.has("arrowdown"), c = a.has("a") || a.has("arrowleft"), l = a.has("d") || a.has("arrowright"), u = a.has("q"), d = a.has("e"), f = (a.has("shift") ? i : 1) * r * this._getFlightSpeedScale() * e;
		return gn.set(!!l - +!!c, !!u - +!!d, !!s - +!!o), gn.lengthSq() === 0 ? false : (gn.normalize().transformDirection(t.matrixWorld), t.position.addScaledVector(gn, f), t.updateMatrixWorld(), true);
	}
	_updateZoom() {
		let { zoomPoint: e, zoomDirection: t, camera: n, minDistance: r, maxDistance: i, pointerTracker: a, domElement: o, minZoom: s, maxZoom: c, zoomSpeed: l, state: u } = this, d = this.zoomDelta;
		if (this.zoomDelta = 0, !(!a.getLatestPoint(K) || d === 0 && u !== 3)) if (this.rotationInertia.set(0, 0), this.dragInertia.set(0, 0, 0), n.isOrthographicCamera) {
			this._updateZoomDirection();
			let e = this.zoomPointSet || this._updateZoomPoint();
			rn(K, o, pn), pn.unproject(n);
			let t = .95 ** (-l * d * .05);
			t > 1 ? c < n.zoom * t && (t = 1) : s > n.zoom * t && (t = 1), n.zoom *= t, n.updateProjectionMatrix(), e && (rn(K, o, mn), mn.unproject(n), n.position.sub(mn).add(pn), n.updateMatrixWorld());
		} else {
			this._updateZoomDirection();
			let a = B.copy(t);
			if (this.zoomPointSet || this._updateZoomPoint()) {
				let a = e.distanceTo(n.position);
				if (d < 0) {
					let e = Math.min(0, a - i);
					d = d * a * l * On, d = Math.max(d, e);
				} else {
					let e = Math.max(0, a - r);
					d = d * Math.max(a - r, 0) * l * On, d = Math.min(d, e);
				}
				n.position.addScaledVector(t, d), n.updateMatrixWorld();
			} else {
				let e = this._getPointBelowCamera();
				if (e) {
					let t = e.distance;
					a.set(0, 0, -1).transformDirection(n.matrixWorld), n.position.addScaledVector(a, d * t * .01), n.updateMatrixWorld();
				} else n.position.addScaledVector(t, d), n.updateMatrixWorld();
			}
		}
	}
	_beginDoubleTapZoom(e) {
		let { camera: t, raycaster: n, domElement: r } = this;
		rn(e, r, bn), L(n, bn, t);
		let i = this._raycast(n);
		i !== null && (this.zoomPoint.copy(i.point), this.zoomPointSet = true, this.zoomDirection.copy(n.ray.direction).normalize(), this.zoomDirectionSet = true, this._doubleTapPoint.copy(e), this._doubleTapZoomActive = true, this._doubleTapZoomElapsed = 0, this.needsUpdate = true, this.dispatchEvent(Cn));
	}
	_updateDoubleTapZoom(e) {
		if (!this._doubleTapZoomActive) return;
		let { doubleTapZoomDuration: t, doubleTapZoomScale: n, zoomSpeed: r, pointerTracker: i } = this;
		i.getLatestPoint(K) === null && (i.hoverPosition.copy(this._doubleTapPoint), i.hoverSet = true);
		let a = Math.log(n) / (On * r), o = (e) => 1 - (1 - MathUtils.clamp(e, 0, 1)) ** 3, s = o(this._doubleTapZoomElapsed / t);
		this._doubleTapZoomElapsed += e;
		let c = o(this._doubleTapZoomElapsed / t);
		this.zoomDelta += a * (c - s), this.needsUpdate = true, this._doubleTapZoomElapsed >= t && (this._doubleTapZoomActive = false, this.dispatchEvent(wn));
	}
	_cancelDoubleTapZoom() {
		this._doubleTapZoomActive && (this._doubleTapZoomActive = false, this.dispatchEvent(wn));
	}
	_updateZoomDirection() {
		if (this.zoomDirectionSet) return;
		let { domElement: e, raycaster: t, camera: n, zoomDirection: r, pointerTracker: i } = this;
		i.getLatestPoint(K), rn(K, e, pn), L(t, pn, n), r.copy(t.ray.direction).normalize(), this.zoomDirectionSet = true;
	}
	_updateZoomPoint() {
		let { camera: e, zoomDirectionSet: t, zoomDirection: n, raycaster: r, zoomPoint: i, pointerTracker: a, domElement: o } = this;
		if (this._zoomPointWasSet = false, !t) return false;
		e.isOrthographicCamera && a.getLatestPoint(_n) ? (rn(_n, o, _n), L(r, _n, e)) : (r.ray.origin.copy(e.position), r.ray.direction.copy(n), r.near = 0, r.far = Infinity);
		let s = this._raycast(r);
		return s ? (i.copy(s.point), this.zoomPointSet = true, this._zoomPointWasSet = true, true) : false;
	}
	_getPointBelowCamera(e = this.camera.position, t = this.up) {
		let { raycaster: n } = this;
		n.ray.direction.copy(t).multiplyScalar(-1), n.ray.origin.copy(e).addScaledVector(t, 1e5), n.near = 0, n.far = Infinity;
		let r = this._raycast(n);
		return r && (r.distance -= 1e5), r;
	}
	_updatePosition(e) {
		let { raycaster: t, camera: n, pivotPoint: r, up: i, pointerTracker: a, domElement: o, state: s, dragInertia: c } = this;
		if (s === 1) {
			if (a.getCenterPoint(K), rn(K, o, K), fn.setFromNormalAndCoplanarPoint(i, r), L(t, K, n), Math.abs(t.ray.direction.dot(i)) < an) {
				let e = Math.acos(an);
				dn.crossVectors(t.ray.direction, i).normalize(), t.ray.direction.copy(i).applyAxisAngle(dn, e).multiplyScalar(-1);
			}
			if (this.getUpDirection(r, W), Math.abs(t.ray.direction.dot(W)) < on) {
				let e = Math.acos(on);
				dn.crossVectors(t.ray.direction, W).normalize(), t.ray.direction.copy(W).applyAxisAngle(dn, e).multiplyScalar(-1);
			}
			t.ray.intersectPlane(fn, B) && (z.subVectors(r, B), n.position.add(z), n.updateMatrixWorld(), z.multiplyScalar(1 / e), a.getMoveDistance() / e < 2 * window.devicePixelRatio ? this.inertiaStableFrames++ : (c.copy(z), this.inertiaStableFrames = 0));
		}
	}
	_updateRotation(e) {
		let { pivotPoint: t, pointerTracker: n, domElement: r, state: i, rotationInertia: a } = this;
		(i === 2 || i === 5) && (i === 5 && t.copy(this.camera.position), n.getCenterPoint(K), n.getPreviousCenterPoint(vn), yn.subVectors(K, vn).multiplyScalar(2 * Math.PI / r.clientHeight), this._applyRotation(yn.x, yn.y, t), yn.multiplyScalar(1 / e), n.getMoveDistance() / e < 2 * window.devicePixelRatio ? this.inertiaStableFrames++ : (a.copy(yn), this.inertiaStableFrames = 0));
	}
	_applyRotation(e, t, n) {
		if (e === 0 && t === 0) return;
		let { camera: r, minAltitude: i, maxAltitude: a, rotationSpeed: o } = this, s = -e * o, c = t * o;
		V.set(0, 0, 1).transformDirection(r.matrixWorld), H.set(1, 0, 0).transformDirection(r.matrixWorld), this.getUpDirection(n, W);
		let l;
		W.dot(V) > .9999999999 ? l = 0 : (B.crossVectors(W, V).normalize(), l = Math.sign(B.dot(H)) * W.angleTo(V)), c > 0 ? (c = Math.min(l - i, c), c = Math.max(0, c)) : (c = Math.max(l - a, c), c = Math.min(0, c)), U.setFromAxisAngle(W, s), nn(n, U, R), r.matrixWorld.premultiply(R), H.set(1, 0, 0).transformDirection(r.matrixWorld), U.setFromAxisAngle(H, -c), nn(n, U, R), r.matrixWorld.premultiply(R), r.matrixWorld.decompose(r.position, r.quaternion, B);
	}
	_setFrame(e) {
		let { up: t, camera: n, zoomPoint: r, zoomDirectionSet: i, zoomPointSet: a, scaleZoomOrientationAtEdges: o } = this;
		if (i && (a || this._updateZoomPoint())) {
			if (U.setFromUnitVectors(t, e), o) {
				this.getUpDirection(r, B);
				let e = Math.max(B.dot(t) - .6, 0) / .4;
				e = MathUtils.mapLinear(e, 0, .5, 0, 1), e = Math.min(e, 1), n.isOrthographicCamera && (e *= .1), U.slerp(hn, 1 - e);
			}
			nn(r, U, R), n.updateMatrixWorld(), n.matrixWorld.premultiply(R), n.matrixWorld.decompose(n.position, n.quaternion, B), this.zoomDirectionSet = false, this._updateZoomDirection();
		}
		t.copy(e), n.updateMatrixWorld();
	}
	_raycast(e) {
		let { scene: t, useFallbackPlane: n, fallbackPlane: r } = this, i = e.intersectObject(t)[0] || null;
		if (i) return i;
		if (n) {
			let t = r;
			if (e.ray.intersectPlane(t, B)) return {
				point: B.clone(),
				distance: e.ray.origin.distanceTo(B)
			};
		}
		return null;
	}
	_alignCameraUp(e, t = 1) {
		let { camera: n, state: r, pivotPoint: i, zoomPoint: a, zoomPointSet: o } = this;
		n.updateMatrixWorld(), V.set(0, 0, -1).transformDirection(n.matrixWorld), H.set(-1, 0, 0).transformDirection(n.matrixWorld);
		let s = MathUtils.mapLinear(1 - Math.abs(V.dot(e)), 0, .2, 0, 1);
		s = MathUtils.clamp(s, 0, 1), t *= s, un.crossVectors(e, V), un.lerp(H, 1 - t).normalize(), U.setFromUnitVectors(H, un), n.quaternion.premultiply(U);
		let c = null;
		r === 1 || r === 2 || r === 5 ? c = cn.copy(i) : o && (c = cn.copy(a)), c && (sn.copy(n.matrixWorld).invert(), B.copy(c).applyMatrix4(sn), n.updateMatrixWorld(), B.applyMatrix4(n.matrixWorld), ln.subVectors(c, B), n.position.add(ln)), n.updateMatrixWorld();
	}
	_clampRotation(e) {
		let { camera: t, minAltitude: n, maxAltitude: r, state: i, pivotPoint: a, zoomPoint: o, zoomPointSet: s } = this;
		t.updateMatrixWorld(), V.set(0, 0, 1).transformDirection(t.matrixWorld), H.set(1, 0, 0).transformDirection(t.matrixWorld);
		let c;
		e.dot(V) > .9999999999 ? c = 0 : (B.crossVectors(e, V), c = Math.sign(B.dot(H)) * e.angleTo(V));
		let l;
		if (c > r) l = r;
		else if (c < n) l = n;
		else return;
		V.copy(e), U.setFromAxisAngle(H, l), V.applyQuaternion(U).normalize(), B.crossVectors(V, H).normalize(), R.makeBasis(H, B, V), t.quaternion.setFromRotationMatrix(R);
		let u = null;
		i === 1 || i === 2 || i === 5 ? u = cn.copy(a) : s && (u = cn.copy(o)), u && (sn.copy(t.matrixWorld).invert(), B.copy(u).applyMatrix4(sn), t.updateMatrixWorld(), B.applyMatrix4(t.matrixWorld), ln.subVectors(u, B), t.position.add(ln)), t.updateMatrixWorld();
	}
}, An = /* @__PURE__ */ new Matrix4(), jn = /* @__PURE__ */ new Matrix4(), q = /* @__PURE__ */ new Vector3(), J = /* @__PURE__ */ new Vector3(), Y = /* @__PURE__ */ new Vector3(), X = /* @__PURE__ */ new Vector3(), Mn = /* @__PURE__ */ new Vector3(), Nn = /* @__PURE__ */ new Vector3(), Z = /* @__PURE__ */ new Quaternion(), Pn = /* @__PURE__ */ new Quaternion(), Fn = /* @__PURE__ */ new Vector3(), In = /* @__PURE__ */ new Vector3(), Q = /* @__PURE__ */ new Ray(), Ln = /* @__PURE__ */ new Je(), Rn = /* @__PURE__ */ new Vector2(), zn = {}, Bn = 2550, Vn = class extends kn {
	get ellipsoidFrame() {
		return this.ellipsoidGroup.matrixWorld;
	}
	get ellipsoidFrameInverse() {
		let { ellipsoidGroup: e, ellipsoidFrame: t, _ellipsoidFrameInverse: n } = this;
		return e.matrixWorldInverse ? e.matrixWorldInverse : n.copy(t).invert();
	}
	constructor(e = null, t = null, n = null) {
		super(e, t, n), this.isGlobeControls = true, this._dragMode = 0, this._rotationMode = 0, this.maxZoom = .01, this._dragBaselineMatrix = new Matrix4(), this._dragBaselineRotation = new Quaternion(), this._dragBaselineSet = false, this.nearMargin = .25, this.farMargin = 0, this.useFallbackPlane = false, this.autoAdjustCameraRotation = false, this.globeInertia = new Quaternion(), this.globeInertiaFactor = 0, this.ellipsoid = Ye.clone(), this.ellipsoidGroup = new Group(), this._ellipsoidFrameInverse = new Matrix4();
	}
	setEllipsoid(e, t) {
		this.ellipsoid = e || Ye.clone(), this.ellipsoidGroup = t || new Group();
	}
	getPivotPoint(e) {
		let { camera: t, ellipsoidFrame: n, ellipsoidFrameInverse: r, ellipsoid: i } = this;
		return X.set(0, 0, -1).transformDirection(t.matrixWorld), Q.origin.copy(t.position), Q.direction.copy(X), Q.applyMatrix4(r), i.closestPointToRayEstimate(Q, J).applyMatrix4(n), (super.getPivotPoint(e) === null || q.subVectors(e, Q.origin).dot(Q.direction) > q.subVectors(J, Q.origin).dot(Q.direction)) && e.copy(J), e;
	}
	getVectorToCenter(e) {
		let { ellipsoidFrame: t, camera: n } = this;
		return e.setFromMatrixPosition(t).sub(n.position);
	}
	getDistanceToCenter() {
		return this.getVectorToCenter(J).length();
	}
	getUpDirection(e, t) {
		let { ellipsoidFrame: n, ellipsoidFrameInverse: r, ellipsoid: i } = this;
		J.copy(e).applyMatrix4(r), i.getPositionToNormal(J, t), t.transformDirection(n);
	}
	getCameraUpDirection(e) {
		let { ellipsoidFrame: t, ellipsoidFrameInverse: n, ellipsoid: r, camera: i } = this;
		i.isOrthographicCamera ? (this._getVirtualOrthoCameraPosition(J), J.applyMatrix4(n), r.getPositionToNormal(J, e), e.transformDirection(t)) : this.getUpDirection(i.position, e);
	}
	update(e = Math.min(this._getDeltaTime(), 64 / 1e3)) {
		if (!this.enabled || !this.camera || e === 0) return;
		let { camera: t, pivotMesh: n } = this;
		this._isNearControls() ? this.scaleZoomOrientationAtEdges = this.zoomDelta < 0 : (this.state !== 0 && this._dragMode !== 1 && this._rotationMode !== 1 && (n.visible = false), this.scaleZoomOrientationAtEdges = false);
		let r = this.needsUpdate || this._inertiaNeedsUpdate();
		super.update(e), this.adjustCamera(t), r && (this._isNearControls() || this.state === 5) && (this.getCameraUpDirection(Nn), this._alignCameraUp(Nn, 1), this.getCameraUpDirection(Nn), this._clampRotation(Nn));
	}
	adjustCamera(e) {
		super.adjustCamera(e);
		let { ellipsoidFrame: t, ellipsoidFrameInverse: n, ellipsoid: r, nearMargin: i, farMargin: a } = this, o = this._getMaxWorldRadius();
		if (e.isPerspectiveCamera) {
			let s = J.setFromMatrixPosition(t).sub(e.position).length(), c = i * o, l = MathUtils.clamp((s - o) / c, 0, 1), u = MathUtils.lerp(1, 1e3, l);
			e.near = Math.max(u, s - o - c), q.copy(e.position).applyMatrix4(n), r.getPositionToCartographic(q, zn);
			let d = Math.max(r.getPositionElevation(q), Bn);
			e.far = r.calculateHorizonDistance(zn.lat, d) + .1 + o * a, e.updateProjectionMatrix();
		} else {
			this._getVirtualOrthoCameraPosition(e.position, e), e.updateMatrixWorld(), An.copy(e.matrixWorld).invert(), J.setFromMatrixPosition(t).applyMatrix4(An);
			let n = -J.z;
			e.near = n - o * (1 + i), e.far = n + .1 + o * a, e.position.addScaledVector(X, e.near), e.far -= e.near, e.near = 0, e.updateProjectionMatrix(), e.updateMatrixWorld();
		}
	}
	setState(...e) {
		super.setState(...e), this._dragMode = 0, this._rotationMode = 0, this._dragBaselineSet = false;
	}
	_updateInertia(e) {
		super._updateInertia(e);
		let { globeInertia: t, enableDamping: n, dampingFactor: r, camera: i, cameraRadius: a, minDistance: o, inertiaTargetDistance: s, ellipsoidFrame: c } = this;
		if (!this.enableDamping || this.inertiaStableFrames > 1) {
			this.globeInertiaFactor = 0, this.globeInertia.identity();
			return;
		}
		let l = 2 ** (-e / r), u = Math.max(i.near, a, o, s), d = 2 / (2 * 1e3) * .25;
		if (Y.setFromMatrixPosition(c), this.globeInertiaFactor !== 0) {
			L(Q, J.set(0, 0, -1), i), Q.applyMatrix4(i.matrixWorldInverse), Q.direction.normalize(), Q.recast(-Q.direction.dot(Q.origin)).at(u / Q.direction.z, J), J.applyMatrix4(i.matrixWorld), L(Q, q.set(d, d, -1), i), Q.applyMatrix4(i.matrixWorldInverse), Q.direction.normalize(), Q.recast(-Q.direction.dot(Q.origin)).at(u / Q.direction.z, q), q.applyMatrix4(i.matrixWorld), J.sub(Y).normalize(), q.sub(Y).normalize(), this.globeInertiaFactor *= l;
			let r = J.angleTo(q) / e;
			(2 * Math.acos(t.w) * this.globeInertiaFactor < r || !n) && (this.globeInertiaFactor = 0, t.identity());
		}
		this.globeInertiaFactor !== 0 && (t.w === 1 && (t.x !== 0 || t.y !== 0 || t.z !== 0) && (t.w = Math.min(t.w, .999999999)), Y.setFromMatrixPosition(c), Z.identity().slerp(t, this.globeInertiaFactor * e), nn(Y, Z, jn), i.matrixWorld.premultiply(jn), i.matrixWorld.decompose(i.position, i.quaternion, J));
	}
	_inertiaNeedsUpdate() {
		return super._inertiaNeedsUpdate() || this.globeInertiaFactor !== 0;
	}
	_getFlightSpeedScale() {
		let e = this.getDistanceToCenter() - this._getMaxWorldRadius();
		return 2 * Math.max(e, 1e3);
	}
	_updateFlight(e) {
		let { camera: t } = this, n = super._updateFlight(e);
		if (n) {
			this._dragBaselineSet = false;
			let e = this._getMaxPerspectiveDistance(), n = this.getDistanceToCenter();
			if (n > e && (this.getVectorToCenter(J).normalize(), t.position.addScaledVector(J, n - e), t.updateMatrixWorld()), !this._isNearControls()) {
				let t = MathUtils.clamp(MathUtils.mapLinear(this.getDistanceToCenter(), this._getPerspectiveTransitionDistance(), e, 0, 1), 0, 1);
				this._tiltTowardsCenter(.02 * t), this._alignCameraUpToNorth(.01 * t);
			}
		}
		return n;
	}
	_updatePosition(e) {
		if (this.state === 1) {
			this._dragMode === 0 && (this._dragMode = this._isNearControls() ? 1 : -1);
			let { raycaster: t, camera: n, pivotPoint: r, pointerTracker: i, domElement: a, ellipsoidFrame: o, ellipsoidFrameInverse: s } = this, c = q, l = Mn;
			this._dragBaselineSet ||= (this._dragBaselineMatrix.copy(n.matrixWorld), this._dragBaselineRotation.identity(), true), i.getCenterPoint(Rn), rn(Rn, a, Rn), An.copy(n.matrixWorld), n.matrixWorld.copy(this._dragBaselineMatrix), L(t, Rn, n), n.matrixWorld.copy(An), t.ray.applyMatrix4(s);
			let u = J.copy(r).applyMatrix4(s).length();
			if (Ln.radius.setScalar(u), !Ln.intersectRay(t.ray, J)) {
				let { origin: e, direction: n } = t.ray, r = c.copy(e).normalize(), i = l.copy(n).addScaledVector(r, -r.dot(n)).normalize(), a = e.length(), o = u * Math.sqrt(Math.max(1 - (u / a) ** 2, 0));
				J.copy(r).multiplyScalar(u * u / a).addScaledVector(i, o);
			}
			J.applyMatrix4(o), Y.setFromMatrixPosition(o), c.subVectors(r, Y).normalize(), l.subVectors(J, Y).normalize(), Z.setFromUnitVectors(l, c), Pn.copy(this._dragBaselineRotation).invert().premultiply(Z), this._dragBaselineRotation.copy(Z), nn(Y, Z, jn), n.matrixWorld.copy(this._dragBaselineMatrix).premultiply(jn), n.matrixWorld.decompose(n.position, n.quaternion, J), i.getMoveDistance() / e < 2 * window.devicePixelRatio ? this.inertiaStableFrames++ : (this.globeInertia.copy(Pn), this.globeInertiaFactor = 1 / e, this.inertiaStableFrames = 0);
		}
	}
	_updateRotation(...e) {
		if (this.state === 5) {
			super._updateRotation(...e);
			return;
		}
		this._rotationMode === 1 || this._isNearControls() ? (this._rotationMode = 1, super._updateRotation(...e)) : (this.pivotMesh.visible = false, this._rotationMode = -1);
	}
	_updateZoom() {
		let { zoomDelta: e, zoomSpeed: t, zoomPoint: n, camera: r, maxZoom: i, state: a } = this;
		if (a !== 3 && e === 0) return;
		this.rotationInertia.set(0, 0), this.dragInertia.set(0, 0, 0), this.globeInertia.identity(), this.globeInertiaFactor = 0, this._dragBaselineSet = false;
		let o = MathUtils.clamp(MathUtils.mapLinear(Math.abs(e), 0, 20, 0, 1), 0, 1);
		if (this._isNearControls() || e > 0) {
			if (this._updateZoomDirection(), e < 0 && (this.zoomPointSet || this._updateZoomPoint())) {
				X.set(0, 0, -1).transformDirection(r.matrixWorld).normalize(), In.copy(this.up).multiplyScalar(-1), this.getUpDirection(n, Fn);
				let e = MathUtils.clamp(MathUtils.mapLinear(-Fn.dot(In), 1, .95, 0, 1), 0, 1), t = 1 - X.dot(In), i = r.isOrthographicCamera ? .05 : 1, a = MathUtils.clamp(o * 3, 0, 1), s = Math.min(e * t * i * a, .1);
				In.lerpVectors(X, In, s).normalize(), Z.setFromUnitVectors(X, In), nn(n, Z, jn), r.matrixWorld.premultiply(jn), r.matrixWorld.decompose(r.position, r.quaternion, In), this.zoomDirection.subVectors(n, r.position).normalize();
			}
			super._updateZoom();
		} else if (r.isPerspectiveCamera) {
			let n = this._getPerspectiveTransitionDistance(), r = this._getMaxPerspectiveDistance(), i = MathUtils.mapLinear(this.getDistanceToCenter(), n, r, 0, 1);
			this._tiltTowardsCenter(MathUtils.lerp(0, .4, i * o)), this._alignCameraUpToNorth(MathUtils.lerp(0, .2, i * o));
			let a = e * (this.getDistanceToCenter() - this._getMaxWorldRadius()) * t * On, s = Math.max(a, Math.min(this.getDistanceToCenter() - r, 0));
			this.getVectorToCenter(J).normalize(), this.camera.position.addScaledVector(J, s), this.camera.updateMatrixWorld(), this.zoomDelta = 0;
		} else {
			let e = this._getOrthographicTransitionZoom(), n = this._getMinOrthographicZoom(), a = MathUtils.mapLinear(r.zoom, e, n, 0, 1);
			this._tiltTowardsCenter(MathUtils.lerp(0, .4, a * o)), this._alignCameraUpToNorth(MathUtils.lerp(0, .2, a * o));
			let s = this.zoomDelta, c = .95 ** (-t * s * .05), l = n / r.zoom, u = Math.max(c, Math.min(l, 1));
			r.zoom = Math.min(i, r.zoom * u), r.updateProjectionMatrix(), this.zoomDelta = 0, this.zoomDirectionSet = false;
		}
	}
	_alignCameraUpToNorth(e) {
		let { ellipsoidFrame: t } = this;
		Nn.set(0, 0, 1).transformDirection(t), this._alignCameraUp(Nn, e);
	}
	_tiltTowardsCenter(e) {
		let { camera: t, ellipsoidFrame: n } = this;
		X.set(0, 0, -1).transformDirection(t.matrixWorld).normalize(), J.setFromMatrixPosition(n).sub(t.position).normalize(), J.lerp(X, 1 - e).normalize(), Z.setFromUnitVectors(X, J), t.quaternion.premultiply(Z), t.updateMatrixWorld();
	}
	_getPerspectiveTransitionDistance() {
		let { camera: e } = this;
		if (!e.isPerspectiveCamera) throw Error();
		let t = this._getMaxWorldRadius(), n = 2 * Math.atan(Math.tan(MathUtils.DEG2RAD * e.fov * .5) * e.aspect), r = t / Math.tan(MathUtils.DEG2RAD * e.fov * .5), i = t / Math.tan(n * .5);
		return Math.max(r, i);
	}
	_getMaxPerspectiveDistance() {
		let { camera: e } = this;
		if (!e.isPerspectiveCamera) throw Error();
		let t = this._getMaxWorldRadius(), n = 2 * Math.atan(Math.tan(MathUtils.DEG2RAD * e.fov * .5) * e.aspect), r = t / Math.tan(MathUtils.DEG2RAD * e.fov * .5), i = t / Math.tan(n * .5);
		return 2 * Math.max(r, i);
	}
	_getOrthographicTransitionZoom() {
		let { camera: e } = this;
		if (!e.isOrthographicCamera) throw Error();
		let t = e.top - e.bottom, n = e.right - e.left, r = Math.max(t, n), i = 2 * this._getMaxWorldRadius();
		return 2 * r / i;
	}
	_getMinOrthographicZoom() {
		let { camera: e } = this;
		if (!e.isOrthographicCamera) throw Error();
		let t = e.top - e.bottom, n = e.right - e.left, r = Math.min(t, n), i = 2 * this._getMaxWorldRadius();
		return .7 * r / i;
	}
	_getVirtualOrthoCameraPosition(e, t = this.camera) {
		let { ellipsoidFrame: n, ellipsoidFrameInverse: r, ellipsoid: i } = this;
		if (!t.isOrthographicCamera) throw Error();
		Q.origin.copy(t.position), Q.direction.set(0, 0, -1).transformDirection(t.matrixWorld), Q.applyMatrix4(r), i.closestPointToRayEstimate(Q, q).applyMatrix4(n);
		let a = t.top - t.bottom, o = t.right - t.left, s = Math.max(a, o) / t.zoom;
		X.set(0, 0, -1).transformDirection(t.matrixWorld);
		let c = q.sub(t.position).dot(X);
		e.copy(t.position).addScaledVector(X, c - s * 4);
	}
	_isNearControls() {
		let { camera: e } = this;
		return e.isPerspectiveCamera ? this.getDistanceToCenter() < this._getPerspectiveTransitionDistance() : e.zoom > this._getOrthographicTransitionZoom();
	}
	_raycast(e) {
		let t = super._raycast(e);
		if (t === null) {
			let { ellipsoid: t, ellipsoidFrame: n, ellipsoidFrameInverse: r } = this;
			Q.copy(e.ray).applyMatrix4(r);
			let i = t.intersectRay(Q, J);
			return i === null ? null : (i.applyMatrix4(n), {
				point: i.clone(),
				distance: i.distanceTo(e.ray.origin)
			});
		} else return t;
	}
	_getMaxWorldRadius() {
		let { ellipsoid: e, ellipsoidFrame: t } = this;
		return Math.max(...e.radius) * t.getMaxScaleOnAxis();
	}
}, $ = /* @__PURE__ */ new Vector3(), Hn = /* @__PURE__ */ new Vector3(), Un = /* @__PURE__ */ new OrthographicCamera(), Wn = /* @__PURE__ */ new Vector3(), Gn = /* @__PURE__ */ new Vector3(), Kn = /* @__PURE__ */ new Vector3(), qn = /* @__PURE__ */ new Quaternion(), Jn = /* @__PURE__ */ new Quaternion(), Yn = class extends EventDispatcher {
	get animating() {
		return this._alpha !== 0 && this._alpha !== 1;
	}
	get alpha() {
		return this._target === 0 ? 1 - this._alpha : this._alpha;
	}
	get camera() {
		return this._alpha === 0 ? this.perspectiveCamera : this._alpha === 1 ? this.orthographicCamera : this.transitionCamera;
	}
	get mode() {
		return this._target === 0 ? "perspective" : "orthographic";
	}
	set mode(e) {
		if (e === this.mode) return;
		let t = this.camera;
		e === "perspective" ? (this._target = 0, this._alpha = 0) : (this._target = 1, this._alpha = 1), this.dispatchEvent({
			type: "camera-change",
			camera: this.camera,
			prevCamera: t
		});
	}
	constructor(e = new PerspectiveCamera(), t = new OrthographicCamera()) {
		super(), this.perspectiveCamera = e, this.orthographicCamera = t, this.transitionCamera = new PerspectiveCamera(), this.orthographicPositionalZoom = true, this.orthographicOffset = 50, this.fixedPoint = new Vector3(), this.duration = 200, this.autoSync = true, this.easeFunction = (e) => e, this._target = 0, this._alpha = 0, this._clock = new Clock();
	}
	toggle() {
		this._target = this._target === 1 ? 0 : 1, this._clock.getDelta(), this.dispatchEvent({ type: "toggle" });
	}
	update(e = Math.min(this._clock.getDelta(), 64 / 1e3)) {
		this.autoSync && this.syncCameras();
		let { perspectiveCamera: t, orthographicCamera: n, transitionCamera: r, camera: i } = this, a = e * 1e3;
		if (this._alpha !== this._target) {
			let e = Math.sign(this._target - this._alpha) * a / this.duration;
			this._alpha = MathUtils.clamp(this._alpha + e, 0, 1), this.dispatchEvent({
				type: "change",
				alpha: this.alpha
			});
		}
		let o = i, s = null;
		this._alpha === 0 ? s = t : this._alpha === 1 ? s = n : (s = r, this._updateTransitionCamera()), o !== s && (s === r && this.dispatchEvent({ type: "transition-start" }), this.dispatchEvent({
			type: "camera-change",
			camera: s,
			prevCamera: o
		}), o === r && this.dispatchEvent({ type: "transition-end" }));
	}
	syncCameras() {
		let e = this._getFromCamera(), { perspectiveCamera: t, orthographicCamera: n, transitionCamera: r, fixedPoint: i } = this;
		if ($.set(0, 0, -1).transformDirection(e.matrixWorld).normalize(), e.isPerspectiveCamera) {
			if (this.orthographicPositionalZoom) n.position.copy(t.position).addScaledVector($, -this.orthographicOffset), n.rotation.copy(t.rotation), n.updateMatrixWorld();
			else {
				let e = Hn.subVectors(i, n.position).dot($), r = Hn.subVectors(i, t.position).dot($);
				Hn.copy(t.position).addScaledVector($, r), n.rotation.copy(t.rotation), n.position.copy(Hn).addScaledVector($, -e), n.updateMatrixWorld();
			}
			let e = Math.abs(Hn.subVectors(t.position, i).dot($)), r = 2 * Math.tan(MathUtils.DEG2RAD * t.fov * .5) * e;
			n.zoom = (n.top - n.bottom) / r, n.updateProjectionMatrix();
		} else {
			let e = Math.abs(Hn.subVectors(n.position, i).dot($)), r = (n.top - n.bottom) / n.zoom * .5 / Math.tan(MathUtils.DEG2RAD * t.fov * .5);
			t.rotation.copy(n.rotation), t.position.copy(n.position).addScaledVector($, e).addScaledVector($, -r), t.updateMatrixWorld(), this.orthographicPositionalZoom && (n.position.copy(t.position).addScaledVector($, -this.orthographicOffset), n.updateMatrixWorld());
		}
		r.position.copy(t.position), r.rotation.copy(t.rotation);
	}
	_getTransitionDirection() {
		return Math.sign(this._target - this._alpha);
	}
	_getToCamera() {
		let e = this._getTransitionDirection();
		return e === 0 ? this._target === 0 ? this.perspectiveCamera : this.orthographicCamera : e > 0 ? this.orthographicCamera : this.perspectiveCamera;
	}
	_getFromCamera() {
		let e = this._getTransitionDirection();
		return e === 0 ? this._target === 0 ? this.perspectiveCamera : this.orthographicCamera : e > 0 ? this.perspectiveCamera : this.orthographicCamera;
	}
	_updateTransitionCamera() {
		let { perspectiveCamera: e, orthographicCamera: t, transitionCamera: n, fixedPoint: r } = this, i = this.easeFunction(this._alpha);
		$.set(0, 0, -1).transformDirection(t.matrixWorld).normalize(), Un.copy(t), Un.position.addScaledVector($, t.near), t.far -= t.near, t.near = 0, $.set(0, 0, -1).transformDirection(e.matrixWorld).normalize();
		let a = Math.abs(Hn.subVectors(e.position, r).dot($)), o = 2 * Math.tan(MathUtils.DEG2RAD * e.fov * .5) * a, s = Jn.slerpQuaternions(e.quaternion, Un.quaternion, i), c = MathUtils.lerp(e.fov, 1, i), l = o * .5 / Math.tan(MathUtils.DEG2RAD * c * .5), u = Kn.copy(Un.position).sub(r).applyQuaternion(qn.copy(Un.quaternion).invert()), d = Gn.copy(e.position).sub(r).applyQuaternion(qn.copy(e.quaternion).invert()), f = Wn.lerpVectors(d, u, i);
		f.z -= Math.abs(f.z) - l;
		let p = -(d.z - f.z), m = -(u.z - f.z), h = MathUtils.lerp(p + e.near, m + Un.near, i), g = MathUtils.lerp(p + e.far, m + Un.far, i), _ = Math.max(g, 0) - Math.max(h, 0);
		n.aspect = e.aspect, n.fov = c, n.near = Math.max(h, _ * 1e-5), n.far = g, n.position.copy(f).applyQuaternion(s).add(r), n.quaternion.copy(s), n.updateProjectionMatrix(), n.updateMatrixWorld();
	}
};

var index_three = /*#__PURE__*/Object.freeze({
	__proto__: null,
	B3DMLoader: _e,
	CAMERA_FRAME: Ke,
	CMPTLoader: ut,
	CameraTransitionManager: Yn,
	ENU_FRAME: Ge,
	Ellipsoid: Je,
	EllipsoidRegion: kt,
	EnvironmentControls: kn,
	GeoUtils: Ce,
	GlobeControls: Vn,
	I3DMLoader: lt,
	MemoryUtils: It,
	OBB: bt,
	OBJECT_FRAME: qe,
	PNTSLoader: Se,
	TilesRenderer: Yt,
	WGS84_ELLIPSOID: Ye
});

export { F$1 as F, H$1 as H, I$1 as I, Je as J, W$1 as W, X$1 as X, Ye as Y, bt as b, c, g, index_three as i, kt as k, o, zt as z };
//# sourceMappingURL=index.three.js.map
