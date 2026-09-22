// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function (
  modules,
  entry,
  mainEntry,
  parcelRequireName,
  externals,
  distDir,
  publicUrl,
  devServer
) {
  /* eslint-disable no-undef */
  var globalObject =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : {};
  /* eslint-enable no-undef */

  // Save the require from previous bundle to this closure if any
  var previousRequire =
    typeof globalObject[parcelRequireName] === 'function' &&
    globalObject[parcelRequireName];

  var importMap = previousRequire.i || {};
  var cache = previousRequire.cache || {};
  // Do not use `require` to prevent Webpack from trying to bundle this call
  var nodeRequire =
    typeof module !== 'undefined' &&
    typeof module.require === 'function' &&
    module.require.bind(module);

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        if (externals[name]) {
          return externals[name];
        }
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire =
          typeof globalObject[parcelRequireName] === 'function' &&
          globalObject[parcelRequireName];
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error("Cannot find module '" + name + "'");
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = (cache[name] = new newRequire.Module(name));

      modules[name][0].call(
        module.exports,
        localRequire,
        module,
        module.exports,
        globalObject
      );
    }

    return cache[name].exports;

    function localRequire(x) {
      var res = localRequire.resolve(x);
      if (res === false) {
        return {};
      }
      // Synthesize a module to follow re-exports.
      if (Array.isArray(res)) {
        var m = {__esModule: true};
        res.forEach(function (v) {
          var key = v[0];
          var id = v[1];
          var exp = v[2] || v[0];
          var x = newRequire(id);
          if (key === '*') {
            Object.keys(x).forEach(function (key) {
              if (
                key === 'default' ||
                key === '__esModule' ||
                Object.prototype.hasOwnProperty.call(m, key)
              ) {
                return;
              }

              Object.defineProperty(m, key, {
                enumerable: true,
                get: function () {
                  return x[key];
                },
              });
            });
          } else if (exp === '*') {
            Object.defineProperty(m, key, {
              enumerable: true,
              value: x,
            });
          } else {
            Object.defineProperty(m, key, {
              enumerable: true,
              get: function () {
                if (exp === 'default') {
                  return x.__esModule ? x.default : x;
                }
                return x[exp];
              },
            });
          }
        });
        return m;
      }
      return newRequire(res);
    }

    function resolve(x) {
      var id = modules[name][1][x];
      return id != null ? id : x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.require = nodeRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.distDir = distDir;
  newRequire.publicUrl = publicUrl;
  newRequire.devServer = devServer;
  newRequire.i = importMap;
  newRequire.register = function (id, exports) {
    modules[id] = [
      function (require, module) {
        module.exports = exports;
      },
      {},
    ];
  };

  // Only insert newRequire.load when it is actually used.
  // The code in this file is linted against ES5, so dynamic import is not allowed.
  // INSERT_LOAD_HERE

  Object.defineProperty(newRequire, 'root', {
    get: function () {
      return globalObject[parcelRequireName];
    },
  });

  globalObject[parcelRequireName] = newRequire;

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  if (mainEntry) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(mainEntry);

    // CommonJS
    if (typeof exports === 'object' && typeof module !== 'undefined') {
      module.exports = mainExports;

      // RequireJS
    } else if (typeof define === 'function' && define.amd) {
      define(function () {
        return mainExports;
      });
    }
  }
})({"6sLmr":[function(require,module,exports,__globalThis) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SERVER_PORT = 1234;
var HMR_SECURE = false;
var HMR_ENV_HASH = "439701173a9199ea";
var HMR_USE_SSE = false;
module.bundle.HMR_BUNDLE_ID = "8068d34f1507159e";
"use strict";
/* global HMR_HOST, HMR_PORT, HMR_SERVER_PORT, HMR_ENV_HASH, HMR_SECURE, HMR_USE_SSE, chrome, browser, __parcel__import__, __parcel__importScripts__, ServiceWorkerGlobalScope */ /*::
import type {
  HMRAsset,
  HMRMessage,
} from '@parcel/reporter-dev-server/src/HMRServer.js';
interface ParcelRequire {
  (string): mixed;
  cache: {|[string]: ParcelModule|};
  hotData: {|[string]: mixed|};
  Module: any;
  parent: ?ParcelRequire;
  isParcelRequire: true;
  modules: {|[string]: [Function, {|[string]: string|}]|};
  HMR_BUNDLE_ID: string;
  root: ParcelRequire;
}
interface ParcelModule {
  hot: {|
    data: mixed,
    accept(cb: (Function) => void): void,
    dispose(cb: (mixed) => void): void,
    // accept(deps: Array<string> | string, cb: (Function) => void): void,
    // decline(): void,
    _acceptCallbacks: Array<(Function) => void>,
    _disposeCallbacks: Array<(mixed) => void>,
  |};
}
interface ExtensionContext {
  runtime: {|
    reload(): void,
    getURL(url: string): string;
    getManifest(): {manifest_version: number, ...};
  |};
}
declare var module: {bundle: ParcelRequire, ...};
declare var HMR_HOST: string;
declare var HMR_PORT: string;
declare var HMR_SERVER_PORT: string;
declare var HMR_ENV_HASH: string;
declare var HMR_SECURE: boolean;
declare var HMR_USE_SSE: boolean;
declare var chrome: ExtensionContext;
declare var browser: ExtensionContext;
declare var __parcel__import__: (string) => Promise<void>;
declare var __parcel__importScripts__: (string) => Promise<void>;
declare var globalThis: typeof self;
declare var ServiceWorkerGlobalScope: Object;
*/ var OVERLAY_ID = '__parcel__error__overlay__';
var OldModule = module.bundle.Module;
function Module(moduleName) {
    OldModule.call(this, moduleName);
    this.hot = {
        data: module.bundle.hotData[moduleName],
        _acceptCallbacks: [],
        _disposeCallbacks: [],
        accept: function(fn) {
            this._acceptCallbacks.push(fn || function() {});
        },
        dispose: function(fn) {
            this._disposeCallbacks.push(fn);
        }
    };
    module.bundle.hotData[moduleName] = undefined;
}
module.bundle.Module = Module;
module.bundle.hotData = {};
var checkedAssets /*: {|[string]: boolean|} */ , disposedAssets /*: {|[string]: boolean|} */ , assetsToDispose /*: Array<[ParcelRequire, string]> */ , assetsToAccept /*: Array<[ParcelRequire, string]> */ , bundleNotFound = false;
function getHostname() {
    return HMR_HOST || (typeof location !== 'undefined' && location.protocol.indexOf('http') === 0 ? location.hostname : 'localhost');
}
function getPort() {
    return HMR_PORT || (typeof location !== 'undefined' ? location.port : HMR_SERVER_PORT);
}
// eslint-disable-next-line no-redeclare
let WebSocket = globalThis.WebSocket;
if (!WebSocket && typeof module.bundle.root === 'function') try {
    // eslint-disable-next-line no-global-assign
    WebSocket = module.bundle.root('ws');
} catch  {
// ignore.
}
var hostname = getHostname();
var port = getPort();
var protocol = HMR_SECURE || typeof location !== 'undefined' && location.protocol === 'https:' && ![
    'localhost',
    '127.0.0.1',
    '0.0.0.0'
].includes(hostname) ? 'wss' : 'ws';
// eslint-disable-next-line no-redeclare
var parent = module.bundle.parent;
if (!parent || !parent.isParcelRequire) {
    // Web extension context
    var extCtx = typeof browser === 'undefined' ? typeof chrome === 'undefined' ? null : chrome : browser;
    // Safari doesn't support sourceURL in error stacks.
    // eval may also be disabled via CSP, so do a quick check.
    var supportsSourceURL = false;
    try {
        (0, eval)('throw new Error("test"); //# sourceURL=test.js');
    } catch (err) {
        supportsSourceURL = err.stack.includes('test.js');
    }
    var ws;
    if (HMR_USE_SSE) ws = new EventSource('/__parcel_hmr');
    else try {
        // If we're running in the dev server's node runner, listen for messages on the parent port.
        let { workerData, parentPort } = module.bundle.root('node:worker_threads') /*: any*/ ;
        if (workerData !== null && workerData !== void 0 && workerData.__parcel) {
            parentPort.on('message', async (message)=>{
                try {
                    await handleMessage(message);
                    parentPort.postMessage('updated');
                } catch  {
                    parentPort.postMessage('restart');
                }
            });
            // After the bundle has finished running, notify the dev server that the HMR update is complete.
            queueMicrotask(()=>parentPort.postMessage('ready'));
        }
    } catch  {
        if (typeof WebSocket !== 'undefined') try {
            ws = new WebSocket(protocol + '://' + hostname + (port ? ':' + port : '') + '/');
        } catch (err) {
            // Ignore cloudflare workers error.
            if (err.message && !err.message.includes('Disallowed operation called within global scope')) console.error(err.message);
        }
    }
    if (ws) {
        // $FlowFixMe
        ws.onmessage = async function(event /*: {data: string, ...} */ ) {
            var data /*: HMRMessage */  = JSON.parse(event.data);
            await handleMessage(data);
        };
        if (ws instanceof WebSocket) {
            ws.onerror = function(e) {
                if (e.message) console.error(e.message);
            };
            ws.onclose = function() {
                console.warn("[parcel] \uD83D\uDEA8 Connection to the HMR server was lost");
            };
        }
    }
}
async function handleMessage(data /*: HMRMessage */ ) {
    checkedAssets = {} /*: {|[string]: boolean|} */ ;
    disposedAssets = {} /*: {|[string]: boolean|} */ ;
    assetsToAccept = [];
    assetsToDispose = [];
    bundleNotFound = false;
    if (data.type === 'reload') fullReload();
    else if (data.type === 'update') {
        // Remove error overlay if there is one
        if (typeof document !== 'undefined') removeErrorOverlay();
        let assets = data.assets;
        // Handle HMR Update
        let handled = assets.every((asset)=>{
            return asset.type === 'css' || asset.type === 'js' && hmrAcceptCheck(module.bundle.root, asset.id, asset.depsByBundle);
        });
        // Dispatch a custom event in case a bundle was not found. This might mean
        // an asset on the server changed and we should reload the page. This event
        // gives the client an opportunity to refresh without losing state
        // (e.g. via React Server Components). If e.preventDefault() is not called,
        // we will trigger a full page reload.
        if (handled && bundleNotFound && assets.some((a)=>a.envHash !== HMR_ENV_HASH) && typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') handled = !window.dispatchEvent(new CustomEvent('parcelhmrreload', {
            cancelable: true
        }));
        if (handled) {
            console.clear();
            // Dispatch custom event so other runtimes (e.g React Refresh) are aware.
            if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent('parcelhmraccept'));
            await hmrApplyUpdates(assets);
            hmrDisposeQueue();
            // Run accept callbacks. This will also re-execute other disposed assets in topological order.
            let processedAssets = {};
            for(let i = 0; i < assetsToAccept.length; i++){
                let id = assetsToAccept[i][1];
                if (!processedAssets[id]) {
                    hmrAccept(assetsToAccept[i][0], id);
                    processedAssets[id] = true;
                }
            }
        } else fullReload();
    }
    if (data.type === 'error') {
        // Log parcel errors to console
        for (let ansiDiagnostic of data.diagnostics.ansi){
            let stack = ansiDiagnostic.codeframe ? ansiDiagnostic.codeframe : ansiDiagnostic.stack;
            console.error("\uD83D\uDEA8 [parcel]: " + ansiDiagnostic.message + '\n' + stack + '\n\n' + ansiDiagnostic.hints.join('\n'));
        }
        if (typeof document !== 'undefined') {
            // Render the fancy html overlay
            removeErrorOverlay();
            var overlay = createErrorOverlay(data.diagnostics.html);
            // $FlowFixMe
            document.body.appendChild(overlay);
        }
    }
}
function removeErrorOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        overlay.remove();
        console.log("[parcel] \u2728 Error resolved");
    }
}
function createErrorOverlay(diagnostics) {
    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    let errorHTML = '<div style="background: black; opacity: 0.85; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; font-family: Menlo, Consolas, monospace; z-index: 9999;">';
    for (let diagnostic of diagnostics){
        let stack = diagnostic.frames.length ? diagnostic.frames.reduce((p, frame)=>{
            return `${p}
<a href="${protocol === 'wss' ? 'https' : 'http'}://${hostname}:${port}/__parcel_launch_editor?file=${encodeURIComponent(frame.location)}" style="text-decoration: underline; color: #888" onclick="fetch(this.href); return false">${frame.location}</a>
${frame.code}`;
        }, '') : diagnostic.stack;
        errorHTML += `
      <div>
        <div style="font-size: 18px; font-weight: bold; margin-top: 20px;">
          \u{1F6A8} ${diagnostic.message}
        </div>
        <pre>${stack}</pre>
        <div>
          ${diagnostic.hints.map((hint)=>"<div>\uD83D\uDCA1 " + hint + '</div>').join('')}
        </div>
        ${diagnostic.documentation ? `<div>\u{1F4DD} <a style="color: violet" href="${diagnostic.documentation}" target="_blank">Learn more</a></div>` : ''}
      </div>
    `;
    }
    errorHTML += '</div>';
    overlay.innerHTML = errorHTML;
    return overlay;
}
function fullReload() {
    if (typeof location !== 'undefined' && 'reload' in location) location.reload();
    else if (typeof extCtx !== 'undefined' && extCtx && extCtx.runtime && extCtx.runtime.reload) extCtx.runtime.reload();
    else try {
        let { workerData, parentPort } = module.bundle.root('node:worker_threads') /*: any*/ ;
        if (workerData !== null && workerData !== void 0 && workerData.__parcel) parentPort.postMessage('restart');
    } catch (err) {
        console.error("[parcel] \u26A0\uFE0F An HMR update was not accepted. Please restart the process.");
    }
}
function getParents(bundle, id) /*: Array<[ParcelRequire, string]> */ {
    var modules = bundle.modules;
    if (!modules) return [];
    var parents = [];
    var k, d, dep;
    for(k in modules)for(d in modules[k][1]){
        dep = modules[k][1][d];
        if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) parents.push([
            bundle,
            k
        ]);
    }
    if (bundle.parent) parents = parents.concat(getParents(bundle.parent, id));
    return parents;
}
function updateLink(link) {
    var href = link.getAttribute('href');
    if (!href) return;
    var newLink = link.cloneNode();
    newLink.onload = function() {
        if (link.parentNode !== null) // $FlowFixMe
        link.parentNode.removeChild(link);
    };
    newLink.setAttribute('href', // $FlowFixMe
    href.split('?')[0] + '?' + Date.now());
    // $FlowFixMe
    link.parentNode.insertBefore(newLink, link.nextSibling);
}
var cssTimeout = null;
function reloadCSS() {
    if (cssTimeout || typeof document === 'undefined') return;
    cssTimeout = setTimeout(function() {
        var links = document.querySelectorAll('link[rel="stylesheet"]');
        for(var i = 0; i < links.length; i++){
            // $FlowFixMe[incompatible-type]
            var href /*: string */  = links[i].getAttribute('href');
            var hostname = getHostname();
            var servedFromHMRServer = hostname === 'localhost' ? new RegExp('^(https?:\\/\\/(0.0.0.0|127.0.0.1)|localhost):' + getPort()).test(href) : href.indexOf(hostname + ':' + getPort());
            var absolute = /^https?:\/\//i.test(href) && href.indexOf(location.origin) !== 0 && !servedFromHMRServer;
            if (!absolute) updateLink(links[i]);
        }
        cssTimeout = null;
    }, 50);
}
function hmrDownload(asset) {
    if (asset.type === 'js') {
        if (typeof document !== 'undefined') {
            let script = document.createElement('script');
            script.src = asset.url + '?t=' + Date.now();
            if (asset.outputFormat === 'esmodule') script.type = 'module';
            return new Promise((resolve, reject)=>{
                var _document$head;
                script.onload = ()=>resolve(script);
                script.onerror = reject;
                (_document$head = document.head) === null || _document$head === void 0 || _document$head.appendChild(script);
            });
        } else if (typeof importScripts === 'function') {
            // Worker scripts
            if (asset.outputFormat === 'esmodule') return import(asset.url + '?t=' + Date.now());
            else return new Promise((resolve, reject)=>{
                try {
                    importScripts(asset.url + '?t=' + Date.now());
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        }
    }
}
async function hmrApplyUpdates(assets) {
    global.parcelHotUpdate = Object.create(null);
    let scriptsToRemove;
    try {
        // If sourceURL comments aren't supported in eval, we need to load
        // the update from the dev server over HTTP so that stack traces
        // are correct in errors/logs. This is much slower than eval, so
        // we only do it if needed (currently just Safari).
        // https://bugs.webkit.org/show_bug.cgi?id=137297
        // This path is also taken if a CSP disallows eval.
        if (!supportsSourceURL) {
            let promises = assets.map((asset)=>{
                var _hmrDownload;
                return (_hmrDownload = hmrDownload(asset)) === null || _hmrDownload === void 0 ? void 0 : _hmrDownload.catch((err)=>{
                    // Web extension fix
                    if (extCtx && extCtx.runtime && extCtx.runtime.getManifest().manifest_version == 3 && typeof ServiceWorkerGlobalScope != 'undefined' && global instanceof ServiceWorkerGlobalScope) {
                        extCtx.runtime.reload();
                        return;
                    }
                    throw err;
                });
            });
            scriptsToRemove = await Promise.all(promises);
        }
        assets.forEach(function(asset) {
            hmrApply(module.bundle.root, asset);
        });
    } finally{
        delete global.parcelHotUpdate;
        if (scriptsToRemove) scriptsToRemove.forEach((script)=>{
            if (script) {
                var _document$head2;
                (_document$head2 = document.head) === null || _document$head2 === void 0 || _document$head2.removeChild(script);
            }
        });
    }
}
function hmrApply(bundle /*: ParcelRequire */ , asset /*:  HMRAsset */ ) {
    var modules = bundle.modules;
    if (!modules) return;
    if (asset.type === 'css') reloadCSS();
    else if (asset.type === 'js') {
        let deps = asset.depsByBundle[bundle.HMR_BUNDLE_ID];
        if (deps) {
            if (modules[asset.id]) {
                // Remove dependencies that are removed and will become orphaned.
                // This is necessary so that if the asset is added back again, the cache is gone, and we prevent a full page reload.
                let oldDeps = modules[asset.id][1];
                for(let dep in oldDeps)if (!deps[dep] || deps[dep] !== oldDeps[dep]) {
                    let id = oldDeps[dep];
                    let parents = getParents(module.bundle.root, id);
                    if (parents.length === 1) hmrDelete(module.bundle.root, id);
                }
            }
            if (supportsSourceURL) // Global eval. We would use `new Function` here but browser
            // support for source maps is better with eval.
            (0, eval)(asset.output);
            // $FlowFixMe
            let fn = global.parcelHotUpdate[asset.id];
            modules[asset.id] = [
                fn,
                deps
            ];
        }
        // Always traverse to the parent bundle, even if we already replaced the asset in this bundle.
        // This is required in case modules are duplicated. We need to ensure all instances have the updated code.
        if (bundle.parent) hmrApply(bundle.parent, asset);
    }
}
function hmrDelete(bundle, id) {
    let modules = bundle.modules;
    if (!modules) return;
    if (modules[id]) {
        // Collect dependencies that will become orphaned when this module is deleted.
        let deps = modules[id][1];
        let orphans = [];
        for(let dep in deps){
            let parents = getParents(module.bundle.root, deps[dep]);
            if (parents.length === 1) orphans.push(deps[dep]);
        }
        // Delete the module. This must be done before deleting dependencies in case of circular dependencies.
        delete modules[id];
        delete bundle.cache[id];
        // Now delete the orphans.
        orphans.forEach((id)=>{
            hmrDelete(module.bundle.root, id);
        });
    } else if (bundle.parent) hmrDelete(bundle.parent, id);
}
function hmrAcceptCheck(bundle /*: ParcelRequire */ , id /*: string */ , depsByBundle /*: ?{ [string]: { [string]: string } }*/ ) {
    checkedAssets = {};
    if (hmrAcceptCheckOne(bundle, id, depsByBundle)) return true;
    // Traverse parents breadth first. All possible ancestries must accept the HMR update, or we'll reload.
    let parents = getParents(module.bundle.root, id);
    let accepted = false;
    while(parents.length > 0){
        let v = parents.shift();
        let a = hmrAcceptCheckOne(v[0], v[1], null);
        if (a) // If this parent accepts, stop traversing upward, but still consider siblings.
        accepted = true;
        else if (a !== null) {
            // Otherwise, queue the parents in the next level upward.
            let p = getParents(module.bundle.root, v[1]);
            if (p.length === 0) {
                // If there are no parents, then we've reached an entry without accepting. Reload.
                accepted = false;
                break;
            }
            parents.push(...p);
        }
    }
    return accepted;
}
function hmrAcceptCheckOne(bundle /*: ParcelRequire */ , id /*: string */ , depsByBundle /*: ?{ [string]: { [string]: string } }*/ ) {
    var modules = bundle.modules;
    if (!modules) return;
    if (depsByBundle && !depsByBundle[bundle.HMR_BUNDLE_ID]) {
        // If we reached the root bundle without finding where the asset should go,
        // there's nothing to do. Mark as "accepted" so we don't reload the page.
        if (!bundle.parent) {
            bundleNotFound = true;
            return true;
        }
        return hmrAcceptCheckOne(bundle.parent, id, depsByBundle);
    }
    if (checkedAssets[id]) return null;
    checkedAssets[id] = true;
    var cached = bundle.cache[id];
    if (!cached) return true;
    assetsToDispose.push([
        bundle,
        id
    ]);
    if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
        assetsToAccept.push([
            bundle,
            id
        ]);
        return true;
    }
    return false;
}
function hmrDisposeQueue() {
    // Dispose all old assets.
    for(let i = 0; i < assetsToDispose.length; i++){
        let id = assetsToDispose[i][1];
        if (!disposedAssets[id]) {
            hmrDispose(assetsToDispose[i][0], id);
            disposedAssets[id] = true;
        }
    }
    assetsToDispose = [];
}
function hmrDispose(bundle /*: ParcelRequire */ , id /*: string */ ) {
    var cached = bundle.cache[id];
    bundle.hotData[id] = {};
    if (cached && cached.hot) cached.hot.data = bundle.hotData[id];
    if (cached && cached.hot && cached.hot._disposeCallbacks.length) cached.hot._disposeCallbacks.forEach(function(cb) {
        cb(bundle.hotData[id]);
    });
    delete bundle.cache[id];
}
function hmrAccept(bundle /*: ParcelRequire */ , id /*: string */ ) {
    // Execute the module.
    bundle(id);
    // Run the accept callbacks in the new version of the module.
    var cached = bundle.cache[id];
    if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
        let assetsToAlsoAccept = [];
        cached.hot._acceptCallbacks.forEach(function(cb) {
            let additionalAssets = cb(function() {
                return getParents(module.bundle.root, id);
            });
            if (Array.isArray(additionalAssets) && additionalAssets.length) assetsToAlsoAccept.push(...additionalAssets);
        });
        if (assetsToAlsoAccept.length) {
            let handled = assetsToAlsoAccept.every(function(a) {
                return hmrAcceptCheck(a[0], a[1]);
            });
            if (!handled) return fullReload();
            hmrDisposeQueue();
        }
    }
}

},{}],"8tQgY":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "VTKLoader", ()=>VTKLoader);
var _three = require("three");
var _fflateModuleJs = require("../libs/fflate.module.js");
/**
 * A loader for the VTK format.
 *
 * This loader only supports the `POLYDATA` dataset format so far. Other formats
 * (structured points, structured grid, rectilinear grid, unstructured grid, appended)
 * are not supported.
 *
 * ```js
 * const loader = new VTKLoader();
 * const geometry = await loader.loadAsync( 'models/vtk/liver.vtk' );
 * geometry.computeVertexNormals();
 *
 * const mesh = new THREE.Mesh( geometry, new THREE.MeshLambertMaterial() );
 * scene.add( mesh );
 * ```
 *
 * @augments Loader
 * @three_import import { VTKLoader } from 'three/addons/loaders/VTKLoader.js';
 * @deprecated since r184.
 */ class VTKLoader extends (0, _three.Loader) {
    /**
	 * Constructs a new VTK loader.
	 *
	 * @param {LoadingManager} [manager] - The loading manager.
	 * @deprecated since r184.
	 */ constructor(manager){
        super(manager);
        console.warn('THREE.VTKLoader: The loader has been deprecated and will be removed with r194. Export your VTK files to glTF before using them on the web.'); // @deprecated, r184
    }
    /**
	 * Starts loading from the given URL and passes the loaded VTK asset
	 * to the `onLoad()` callback.
	 *
	 * @param {string} url - The path/URL of the file to be loaded. This can also be a data URI.
	 * @param {function(BufferGeometry)} onLoad - Executed when the loading process has been finished.
	 * @param {onProgressCallback} onProgress - Executed while the loading is in progress.
	 * @param {onErrorCallback} onError - Executed when errors occur.
	 */ load(url, onLoad, onProgress, onError) {
        const scope = this;
        const loader = new (0, _three.FileLoader)(scope.manager);
        loader.setPath(scope.path);
        loader.setResponseType('arraybuffer');
        loader.setRequestHeader(scope.requestHeader);
        loader.setWithCredentials(scope.withCredentials);
        loader.load(url, function(text) {
            try {
                onLoad(scope.parse(text));
            } catch (e) {
                if (onError) onError(e);
                else console.error(e);
                scope.manager.itemError(url);
            }
        }, onProgress, onError);
    }
    /**
	 * Parses the given VTK data and returns the resulting geometry.
	 *
	 * @param {ArrayBuffer} data - The raw VTK data as an array buffer
	 * @return {BufferGeometry} The parsed geometry.
	 */ parse(data) {
        function parseASCII(data) {
            // connectivity of the triangles
            const indices = [];
            // triangles vertices
            const positions = [];
            // red, green, blue colors in the range 0 to 1
            const colors = [];
            // normal vector, one per vertex
            const normals = [];
            let result;
            // pattern for detecting the end of a number sequence
            const patWord = /^[^\d.\s-]+/;
            function parseFloats(line) {
                const result = [];
                const parts = line.split(/\s+/);
                for(let i = 0; i < parts.length; i++)if (parts[i] !== '') result.push(parseFloat(parts[i]));
                return result;
            }
            // pattern for connectivity, an integer followed by any number of ints
            // the first integer is the number of polygon nodes
            const patConnectivity = /^(\d+)\s+([\s\d]*)/;
            // indicates start of vertex data section
            const patPOINTS = /^POINTS /;
            // indicates start of polygon connectivity section
            const patPOLYGONS = /^POLYGONS /;
            // indicates start of triangle strips section
            const patTRIANGLE_STRIPS = /^TRIANGLE_STRIPS /;
            // POINT_DATA number_of_values
            const patPOINT_DATA = /^POINT_DATA[ ]+(\d+)/;
            // CELL_DATA number_of_polys
            const patCELL_DATA = /^CELL_DATA[ ]+(\d+)/;
            // Start of color section
            const patCOLOR_SCALARS = /^COLOR_SCALARS[ ]+(\w+)[ ]+3/;
            // NORMALS Normals float
            const patNORMALS = /^NORMALS[ ]+(\w+)[ ]+(\w+)/;
            let inPointsSection = false;
            let inPolygonsSection = false;
            let inTriangleStripSection = false;
            let inPointDataSection = false;
            let inCellDataSection = false;
            let inColorSection = false;
            let inNormalsSection = false;
            const color = new (0, _three.Color)();
            const lines = data.split('\n');
            for(const i in lines){
                const line = lines[i].trim();
                if (line.indexOf('DATASET') === 0) {
                    const dataset = line.split(' ')[1];
                    if (dataset !== 'POLYDATA') throw new Error('Unsupported DATASET type: ' + dataset);
                } else if (inPointsSection) // get the vertices
                {
                    if (patWord.exec(line) === null) {
                        const values = parseFloats(line);
                        for(let k = 0; k + 2 < values.length; k += 3)positions.push(values[k], values[k + 1], values[k + 2]);
                    }
                } else if (inPolygonsSection) {
                    if ((result = patConnectivity.exec(line)) !== null) {
                        // numVertices i0 i1 i2 ...
                        const numVertices = parseInt(result[1]);
                        const inds = result[2].split(/\s+/);
                        if (numVertices >= 3) {
                            const i0 = parseInt(inds[0]);
                            let k = 1;
                            // split the polygon in numVertices - 2 triangles
                            for(let j = 0; j < numVertices - 2; ++j){
                                const i1 = parseInt(inds[k]);
                                const i2 = parseInt(inds[k + 1]);
                                indices.push(i0, i1, i2);
                                k++;
                            }
                        }
                    }
                } else if (inTriangleStripSection) {
                    if ((result = patConnectivity.exec(line)) !== null) {
                        // numVertices i0 i1 i2 ...
                        const numVertices = parseInt(result[1]);
                        const inds = result[2].split(/\s+/);
                        if (numVertices >= 3) {
                            // split the polygon in numVertices - 2 triangles
                            for(let j = 0; j < numVertices - 2; j++)if (j % 2 === 1) {
                                const i0 = parseInt(inds[j]);
                                const i1 = parseInt(inds[j + 2]);
                                const i2 = parseInt(inds[j + 1]);
                                indices.push(i0, i1, i2);
                            } else {
                                const i0 = parseInt(inds[j]);
                                const i1 = parseInt(inds[j + 1]);
                                const i2 = parseInt(inds[j + 2]);
                                indices.push(i0, i1, i2);
                            }
                        }
                    }
                } else if (inPointDataSection || inCellDataSection) {
                    if (inColorSection) // Get the colors
                    {
                        if (patWord.exec(line) === null) {
                            const values = parseFloats(line);
                            for(let k = 0; k + 2 < values.length; k += 3){
                                color.setRGB(values[k], values[k + 1], values[k + 2], (0, _three.SRGBColorSpace));
                                colors.push(color.r, color.g, color.b);
                            }
                        }
                    } else if (inNormalsSection) // Get the normal vectors
                    {
                        if (patWord.exec(line) === null) {
                            const values = parseFloats(line);
                            for(let k = 0; k + 2 < values.length; k += 3)normals.push(values[k], values[k + 1], values[k + 2]);
                        }
                    }
                }
                if (patPOLYGONS.exec(line) !== null) {
                    inPolygonsSection = true;
                    inPointsSection = false;
                    inTriangleStripSection = false;
                } else if (patPOINTS.exec(line) !== null) {
                    inPolygonsSection = false;
                    inPointsSection = true;
                    inTriangleStripSection = false;
                } else if (patTRIANGLE_STRIPS.exec(line) !== null) {
                    inPolygonsSection = false;
                    inPointsSection = false;
                    inTriangleStripSection = true;
                } else if (patPOINT_DATA.exec(line) !== null) {
                    inPointDataSection = true;
                    inPointsSection = false;
                    inPolygonsSection = false;
                    inTriangleStripSection = false;
                } else if (patCELL_DATA.exec(line) !== null) {
                    inCellDataSection = true;
                    inPointsSection = false;
                    inPolygonsSection = false;
                    inTriangleStripSection = false;
                } else if (patCOLOR_SCALARS.exec(line) !== null) {
                    inColorSection = true;
                    inNormalsSection = false;
                    inPointsSection = false;
                    inPolygonsSection = false;
                    inTriangleStripSection = false;
                } else if (patNORMALS.exec(line) !== null) {
                    inNormalsSection = true;
                    inColorSection = false;
                    inPointsSection = false;
                    inPolygonsSection = false;
                    inTriangleStripSection = false;
                }
            }
            let geometry = new (0, _three.BufferGeometry)();
            geometry.setIndex(indices);
            geometry.setAttribute('position', new (0, _three.Float32BufferAttribute)(positions, 3));
            if (normals.length === positions.length) geometry.setAttribute('normal', new (0, _three.Float32BufferAttribute)(normals, 3));
            if (colors.length !== indices.length) // stagger
            {
                if (colors.length === positions.length) geometry.setAttribute('color', new (0, _three.Float32BufferAttribute)(colors, 3));
            } else {
                // cell
                geometry = geometry.toNonIndexed();
                const numTriangles = geometry.attributes.position.count / 3;
                if (colors.length === numTriangles * 3) {
                    const newColors = [];
                    for(let i = 0; i < numTriangles; i++){
                        const r = colors[3 * i + 0];
                        const g = colors[3 * i + 1];
                        const b = colors[3 * i + 2];
                        color.setRGB(r, g, b, (0, _three.SRGBColorSpace));
                        newColors.push(color.r, color.g, color.b);
                        newColors.push(color.r, color.g, color.b);
                        newColors.push(color.r, color.g, color.b);
                    }
                    geometry.setAttribute('color', new (0, _three.Float32BufferAttribute)(newColors, 3));
                }
            }
            return geometry;
        }
        function parseBinary(data) {
            const buffer = new Uint8Array(data);
            const dataView = new DataView(data);
            // Points and normals, by default, are empty
            let points = [];
            let normals = [];
            let indices = [];
            let index = 0;
            function findString(buffer, start) {
                let index = start;
                let c = buffer[index];
                const s = [];
                while(c !== 10 && index < buffer.length){
                    s.push(String.fromCharCode(c));
                    index++;
                    c = buffer[index];
                }
                return {
                    start: start,
                    end: index,
                    next: index + 1,
                    parsedString: s.join('')
                };
            }
            let state, line;
            while(true){
                // Get a string
                state = findString(buffer, index);
                line = state.parsedString;
                if (line.indexOf('DATASET') === 0) {
                    const dataset = line.split(' ')[1];
                    if (dataset !== 'POLYDATA') throw new Error('Unsupported DATASET type: ' + dataset);
                } else if (line.indexOf('POINTS') === 0) {
                    // Add the points
                    const numberOfPoints = parseInt(line.split(' ')[1], 10);
                    // Each point is 3 4-byte floats
                    const count = numberOfPoints * 12;
                    points = new Float32Array(numberOfPoints * 3);
                    let pointIndex = state.next;
                    for(let i = 0; i < numberOfPoints; i++){
                        points[3 * i] = dataView.getFloat32(pointIndex, false);
                        points[3 * i + 1] = dataView.getFloat32(pointIndex + 4, false);
                        points[3 * i + 2] = dataView.getFloat32(pointIndex + 8, false);
                        pointIndex = pointIndex + 12;
                    }
                    // increment our next pointer
                    state.next = state.next + count + 1;
                } else if (line.indexOf('TRIANGLE_STRIPS') === 0) {
                    const numberOfStrips = parseInt(line.split(' ')[1], 10);
                    const size = parseInt(line.split(' ')[2], 10);
                    // 4 byte integers
                    const count = size * 4;
                    indices = new Uint32Array(3 * size - 9 * numberOfStrips);
                    let indicesIndex = 0;
                    let pointIndex = state.next;
                    for(let i = 0; i < numberOfStrips; i++){
                        // For each strip, read the first value, then record that many more points
                        const indexCount = dataView.getInt32(pointIndex, false);
                        const strip = [];
                        pointIndex += 4;
                        for(let s = 0; s < indexCount; s++){
                            strip.push(dataView.getInt32(pointIndex, false));
                            pointIndex += 4;
                        }
                        // retrieves the n-2 triangles from the triangle strip
                        for(let j = 0; j < indexCount - 2; j++)if (j % 2) {
                            indices[indicesIndex++] = strip[j];
                            indices[indicesIndex++] = strip[j + 2];
                            indices[indicesIndex++] = strip[j + 1];
                        } else {
                            indices[indicesIndex++] = strip[j];
                            indices[indicesIndex++] = strip[j + 1];
                            indices[indicesIndex++] = strip[j + 2];
                        }
                    }
                    // increment our next pointer
                    state.next = state.next + count + 1;
                } else if (line.indexOf('POLYGONS') === 0) {
                    const numberOfStrips = parseInt(line.split(' ')[1], 10);
                    const size = parseInt(line.split(' ')[2], 10);
                    // 4 byte integers
                    const count = size * 4;
                    indices = new Uint32Array(3 * size - 9 * numberOfStrips);
                    let indicesIndex = 0;
                    let pointIndex = state.next;
                    for(let i = 0; i < numberOfStrips; i++){
                        // For each strip, read the first value, then record that many more points
                        const indexCount = dataView.getInt32(pointIndex, false);
                        const strip = [];
                        pointIndex += 4;
                        for(let s = 0; s < indexCount; s++){
                            strip.push(dataView.getInt32(pointIndex, false));
                            pointIndex += 4;
                        }
                        // divide the polygon in n-2 triangle
                        for(let j = 1; j < indexCount - 1; j++){
                            indices[indicesIndex++] = strip[0];
                            indices[indicesIndex++] = strip[j];
                            indices[indicesIndex++] = strip[j + 1];
                        }
                    }
                    // increment our next pointer
                    state.next = state.next + count + 1;
                } else if (line.indexOf('POINT_DATA') === 0) {
                    const numberOfPoints = parseInt(line.split(' ')[1], 10);
                    // Grab the next line
                    state = findString(buffer, state.next);
                    // Now grab the binary data
                    const count = numberOfPoints * 12;
                    normals = new Float32Array(numberOfPoints * 3);
                    let pointIndex = state.next;
                    for(let i = 0; i < numberOfPoints; i++){
                        normals[3 * i] = dataView.getFloat32(pointIndex, false);
                        normals[3 * i + 1] = dataView.getFloat32(pointIndex + 4, false);
                        normals[3 * i + 2] = dataView.getFloat32(pointIndex + 8, false);
                        pointIndex += 12;
                    }
                    // Increment past our data
                    state.next = state.next + count;
                }
                // Increment index
                index = state.next;
                if (index >= buffer.byteLength) break;
            }
            const geometry = new (0, _three.BufferGeometry)();
            geometry.setIndex(new (0, _three.BufferAttribute)(indices, 1));
            geometry.setAttribute('position', new (0, _three.BufferAttribute)(points, 3));
            if (normals.length === points.length) geometry.setAttribute('normal', new (0, _three.BufferAttribute)(normals, 3));
            return geometry;
        }
        function Float32Concat(first, second) {
            const firstLength = first.length, result = new Float32Array(firstLength + second.length);
            result.set(first);
            result.set(second, firstLength);
            return result;
        }
        function Int32Concat(first, second) {
            const firstLength = first.length, result = new Int32Array(firstLength + second.length);
            result.set(first);
            result.set(second, firstLength);
            return result;
        }
        function parseXML(stringFile) {
            // Changes XML to JSON, based on https://davidwalsh.name/convert-xml-json
            function xmlToJson(xml) {
                // Create the return object
                let obj = {};
                if (xml.nodeType === 1) {
                    // do attributes
                    if (xml.attributes) {
                        if (xml.attributes.length > 0) {
                            obj['attributes'] = {};
                            for(let j = 0; j < xml.attributes.length; j++){
                                const attribute = xml.attributes.item(j);
                                obj['attributes'][attribute.nodeName] = attribute.nodeValue.trim();
                            }
                        }
                    }
                } else if (xml.nodeType === 3) obj = xml.nodeValue.trim();
                // do children
                if (xml.hasChildNodes()) for(let i = 0; i < xml.childNodes.length; i++){
                    const item = xml.childNodes.item(i);
                    const nodeName = item.nodeName;
                    if (typeof obj[nodeName] === 'undefined') {
                        const tmp = xmlToJson(item);
                        if (tmp !== '') {
                            if (Array.isArray(tmp['#text'])) tmp['#text'] = tmp['#text'][0];
                            obj[nodeName] = tmp;
                        }
                    } else {
                        if (typeof obj[nodeName].push === 'undefined') {
                            const old = obj[nodeName];
                            obj[nodeName] = [
                                old
                            ];
                        }
                        const tmp = xmlToJson(item);
                        if (tmp !== '') {
                            if (Array.isArray(tmp['#text'])) tmp['#text'] = tmp['#text'][0];
                            obj[nodeName].push(tmp);
                        }
                    }
                }
                return obj;
            }
            // Taken from Base64-js
            function Base64toByteArray(b64) {
                const Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
                const revLookup = [];
                const code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                for(let i = 0, l = code.length; i < l; ++i)revLookup[code.charCodeAt(i)] = i;
                revLookup['-'.charCodeAt(0)] = 62;
                revLookup['_'.charCodeAt(0)] = 63;
                const len = b64.length;
                if (len % 4 > 0) throw new Error('Invalid string. Length must be a multiple of 4');
                const placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;
                const arr = new Arr(len * 3 / 4 - placeHolders);
                const l = placeHolders > 0 ? len - 4 : len;
                let L = 0;
                let i, j;
                for(i = 0, j = 0; i < l; i += 4, j += 3){
                    const tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
                    arr[L++] = (tmp & 0xFF0000) >> 16;
                    arr[L++] = (tmp & 0xFF00) >> 8;
                    arr[L++] = tmp & 0xFF;
                }
                if (placeHolders === 2) {
                    const tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
                    arr[L++] = tmp & 0xFF;
                } else if (placeHolders === 1) {
                    const tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
                    arr[L++] = tmp >> 8 & 0xFF;
                    arr[L++] = tmp & 0xFF;
                }
                return arr;
            }
            function parseDataArray(ele, compressed) {
                let numBytes = 0;
                if (json.attributes.header_type === 'UInt64') numBytes = 8;
                else if (json.attributes.header_type === 'UInt32') numBytes = 4;
                let txt, content;
                // Check the format
                if (ele.attributes.format === 'binary' && compressed) {
                    if (ele.attributes.type === 'Float32') txt = new Float32Array();
                    else if (ele.attributes.type === 'Int32' || ele.attributes.type === 'Int64') txt = new Int32Array();
                    // VTP data with the header has the following structure:
                    // [#blocks][#u-size][#p-size][#c-size-1][#c-size-2]...[#c-size-#blocks][DATA]
                    //
                    // Each token is an integer value whose type is specified by "header_type" at the top of the file (UInt32 if no type specified). The token meanings are:
                    // [#blocks] = Number of blocks
                    // [#u-size] = Block size before compression
                    // [#p-size] = Size of last partial block (zero if it not needed)
                    // [#c-size-i] = Size in bytes of block i after compression
                    //
                    // The [DATA] portion stores contiguously every block appended together. The offset from the beginning of the data section to the beginning of a block is
                    // computed by summing the compressed block sizes from preceding blocks according to the header.
                    const textNode = ele['#text'];
                    const rawData = Array.isArray(textNode) ? textNode[0] : textNode;
                    const byteData = Base64toByteArray(rawData);
                    // Each data point consists of 8 bits regardless of the header type
                    const dataPointSize = 8;
                    let blocks = byteData[0];
                    for(let i = 1; i < numBytes - 1; i++)blocks = blocks | byteData[i] << i * dataPointSize;
                    let headerSize = (blocks + 3) * numBytes;
                    const padding = headerSize % 3 > 0 ? 3 - headerSize % 3 : 0;
                    headerSize = headerSize + padding;
                    const dataOffsets = [];
                    let currentOffset = headerSize;
                    dataOffsets.push(currentOffset);
                    // Get the blocks sizes after the compression.
                    // There are three blocks before c-size-i, so we skip 3*numBytes
                    const cSizeStart = 3 * numBytes;
                    for(let i = 0; i < blocks; i++){
                        let currentBlockSize = byteData[i * numBytes + cSizeStart];
                        for(let j = 1; j < numBytes - 1; j++)currentBlockSize = currentBlockSize | byteData[i * numBytes + cSizeStart + j] << j * dataPointSize;
                        currentOffset = currentOffset + currentBlockSize;
                        dataOffsets.push(currentOffset);
                    }
                    for(let i = 0; i < dataOffsets.length - 1; i++){
                        const data = (0, _fflateModuleJs.unzlibSync)(byteData.slice(dataOffsets[i], dataOffsets[i + 1]));
                        content = data.buffer;
                        if (ele.attributes.type === 'Float32') {
                            content = new Float32Array(content);
                            txt = Float32Concat(txt, content);
                        } else if (ele.attributes.type === 'Int32' || ele.attributes.type === 'Int64') {
                            content = new Int32Array(content);
                            txt = Int32Concat(txt, content);
                        }
                    }
                    delete ele['#text'];
                    if (ele.attributes.type === 'Int64') {
                        if (ele.attributes.format === 'binary') txt = txt.filter(function(el, idx) {
                            if (idx % 2 !== 1) return true;
                        });
                    }
                } else {
                    if (ele.attributes.format === 'binary' && !compressed) {
                        content = Base64toByteArray(ele['#text']);
                        //  VTP data for the uncompressed case has the following structure:
                        // [#bytes][DATA]
                        // where "[#bytes]" is an integer value specifying the number of bytes in the block of data following it.
                        content = content.slice(numBytes).buffer;
                    } else if (ele['#text']) content = ele['#text'].split(/\s+/).filter(function(el) {
                        if (el !== '') return el;
                    });
                    else content = new Int32Array(0).buffer;
                    delete ele['#text'];
                    // Get the content and optimize it
                    if (ele.attributes.type === 'Float32') txt = new Float32Array(content);
                    else if (ele.attributes.type === 'Int32') txt = new Int32Array(content);
                    else if (ele.attributes.type === 'Int64') {
                        txt = new Int32Array(content);
                        if (ele.attributes.format === 'binary') txt = txt.filter(function(el, idx) {
                            if (idx % 2 !== 1) return true;
                        });
                    }
                } // endif ( ele.attributes.format === 'binary' && compressed )
                return txt;
            }
            // Main part
            // Get Dom
            const dom = new DOMParser().parseFromString(stringFile, 'application/xml');
            // Get the doc
            const doc = dom.documentElement;
            // Convert to json
            const json = xmlToJson(doc);
            let points = [];
            let normals = [];
            let indices = [];
            if (json.AppendedData) {
                const appendedData = json.AppendedData['#text'].slice(1);
                const piece = json.PolyData.Piece;
                const sections = [
                    'PointData',
                    'CellData',
                    'Points',
                    'Verts',
                    'Lines',
                    'Strips',
                    'Polys'
                ];
                let sectionIndex = 0;
                const offsets = sections.map((s)=>{
                    const sect = piece[s];
                    if (sect && sect.DataArray) {
                        const arr = Array.isArray(sect.DataArray) ? sect.DataArray : [
                            sect.DataArray
                        ];
                        return arr.map((a)=>a.attributes.offset);
                    }
                    return [];
                }).flat();
                for (const sect of sections){
                    const section = piece[sect];
                    if (section && section.DataArray) {
                        if (Array.isArray(section.DataArray)) for (const sectionEle of section.DataArray){
                            sectionEle['#text'] = appendedData.slice(offsets[sectionIndex], offsets[sectionIndex + 1]);
                            sectionEle.attributes.format = 'binary';
                            sectionIndex++;
                        }
                        else {
                            section.DataArray['#text'] = appendedData.slice(offsets[sectionIndex], offsets[sectionIndex + 1]);
                            section.DataArray.attributes.format = 'binary';
                            sectionIndex++;
                        }
                    }
                }
            }
            if (json.PolyData) {
                const piece = json.PolyData.Piece;
                const compressed = json.attributes.hasOwnProperty('compressor');
                // Can be optimized
                // Loop through the sections
                const sections = [
                    'PointData',
                    'Points',
                    'Strips',
                    'Polys'
                ]; // +['CellData', 'Verts', 'Lines'];
                let sectionIndex = 0;
                const numberOfSections = sections.length;
                while(sectionIndex < numberOfSections){
                    const section = piece[sections[sectionIndex]];
                    // If it has a DataArray in it
                    if (section && section.DataArray) {
                        // Depending on the number of DataArrays
                        let arr;
                        if (Array.isArray(section.DataArray)) arr = section.DataArray;
                        else arr = [
                            section.DataArray
                        ];
                        let dataArrayIndex = 0;
                        const numberOfDataArrays = arr.length;
                        while(dataArrayIndex < numberOfDataArrays){
                            // Parse the DataArray
                            if ('#text' in arr[dataArrayIndex] && arr[dataArrayIndex]['#text'].length > 0) arr[dataArrayIndex].text = parseDataArray(arr[dataArrayIndex], compressed);
                            dataArrayIndex++;
                        }
                        switch(sections[sectionIndex]){
                            // if iti is point data
                            case 'PointData':
                                {
                                    const numberOfPoints = parseInt(piece.attributes.NumberOfPoints);
                                    const normalsName = section.attributes.Normals;
                                    if (numberOfPoints > 0) {
                                        for(let i = 0, len = arr.length; i < len; i++)if (normalsName === arr[i].attributes.Name) {
                                            const components = arr[i].attributes.NumberOfComponents;
                                            normals = new Float32Array(numberOfPoints * components);
                                            normals.set(arr[i].text, 0);
                                        }
                                    }
                                }
                                break;
                            // if it is points
                            case 'Points':
                                {
                                    const numberOfPoints = parseInt(piece.attributes.NumberOfPoints);
                                    if (numberOfPoints > 0) {
                                        const components = section.DataArray.attributes.NumberOfComponents;
                                        points = new Float32Array(numberOfPoints * components);
                                        points.set(section.DataArray.text, 0);
                                    }
                                }
                                break;
                            // if it is strips
                            case 'Strips':
                                {
                                    const numberOfStrips = parseInt(piece.attributes.NumberOfStrips);
                                    if (numberOfStrips > 0) {
                                        const connectivity = new Int32Array(section.DataArray[0].text.length);
                                        const offset = new Int32Array(section.DataArray[1].text.length);
                                        connectivity.set(section.DataArray[0].text, 0);
                                        offset.set(section.DataArray[1].text, 0);
                                        const size = numberOfStrips + connectivity.length;
                                        indices = new Uint32Array(3 * size - 9 * numberOfStrips);
                                        let indicesIndex = 0;
                                        for(let i = 0, len = numberOfStrips; i < len; i++){
                                            const strip = [];
                                            for(let s = 0, len1 = offset[i], len0 = 0; s < len1 - len0; s++){
                                                strip.push(connectivity[s]);
                                                if (i > 0) len0 = offset[i - 1];
                                            }
                                            for(let j = 0, len1 = offset[i], len0 = 0; j < len1 - len0 - 2; j++){
                                                if (j % 2) {
                                                    indices[indicesIndex++] = strip[j];
                                                    indices[indicesIndex++] = strip[j + 2];
                                                    indices[indicesIndex++] = strip[j + 1];
                                                } else {
                                                    indices[indicesIndex++] = strip[j];
                                                    indices[indicesIndex++] = strip[j + 1];
                                                    indices[indicesIndex++] = strip[j + 2];
                                                }
                                                if (i > 0) len0 = offset[i - 1];
                                            }
                                        }
                                    }
                                }
                                break;
                            // if it is polys
                            case 'Polys':
                                {
                                    const numberOfPolys = parseInt(piece.attributes.NumberOfPolys);
                                    if (numberOfPolys > 0) {
                                        const connectivity = new Int32Array(section.DataArray[0].text.length);
                                        const offset = new Int32Array(section.DataArray[1].text.length);
                                        connectivity.set(section.DataArray[0].text, 0);
                                        offset.set(section.DataArray[1].text, 0);
                                        const size = numberOfPolys + connectivity.length;
                                        indices = new Uint32Array(3 * size - 9 * numberOfPolys);
                                        let indicesIndex = 0, connectivityIndex = 0;
                                        let i = 0, len0 = 0;
                                        const len = numberOfPolys;
                                        while(i < len){
                                            const poly = [];
                                            let s = 0;
                                            const len1 = offset[i];
                                            while(s < len1 - len0){
                                                poly.push(connectivity[connectivityIndex++]);
                                                s++;
                                            }
                                            let j = 1;
                                            while(j < len1 - len0 - 1){
                                                indices[indicesIndex++] = poly[0];
                                                indices[indicesIndex++] = poly[j];
                                                indices[indicesIndex++] = poly[j + 1];
                                                j++;
                                            }
                                            i++;
                                            len0 = offset[i - 1];
                                        }
                                    }
                                }
                                break;
                            default:
                                break;
                        }
                    }
                    sectionIndex++;
                }
                const geometry = new (0, _three.BufferGeometry)();
                geometry.setIndex(new (0, _three.BufferAttribute)(indices, 1));
                geometry.setAttribute('position', new (0, _three.BufferAttribute)(points, 3));
                if (normals.length === points.length) geometry.setAttribute('normal', new (0, _three.BufferAttribute)(normals, 3));
                return geometry;
            } else throw new Error('Unsupported DATASET type');
        }
        const textDecoder = new TextDecoder();
        // get the 5 first lines of the files to check if there is the key word binary
        const meta = textDecoder.decode(new Uint8Array(data, 0, 250)).split('\n');
        if (meta[0].indexOf('xml') !== -1) return parseXML(textDecoder.decode(data));
        else if (meta[2].includes('ASCII')) return parseASCII(textDecoder.decode(data));
        else return parseBinary(data);
    }
}

},{"three":"hJIVG","../libs/fflate.module.js":"4fbyW","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}]},["6sLmr"], null, "parcelRequire6840", {})

//# sourceMappingURL=VTKLoader.1507159e.js.map
