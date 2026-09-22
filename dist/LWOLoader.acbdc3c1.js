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
})({"1RMTw":[function(require,module,exports,__globalThis) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SERVER_PORT = 1234;
var HMR_SECURE = false;
var HMR_ENV_HASH = "439701173a9199ea";
var HMR_USE_SSE = false;
module.bundle.HMR_BUNDLE_ID = "328aa0eeacbdc3c1";
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

},{}],"2Mn2K":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "LWOLoader", ()=>LWOLoader);
var _three = require("three");
var _iffparserJs = require("./lwo/IFFParser.js");
let _lwoTree;
/**
 * A loader for the LWO format.
 *
 * LWO3 and LWO2 formats are supported.
 *
 * References:
 * - [LWO3 format specification](https://static.lightwave3d.com/sdk/2019/html/filefmts/lwo3.html)
 * - [LWO2 format specification](https://static.lightwave3d.com/sdk/2019/html/filefmts/lwo2.html)
 *
 * ```js
 * const loader = new LWOLoader();
 * const lwoData = await loader.loadAsync( 'models/lwo/Objects/LWO3/Demo.lwo' );
 *
 * const mesh = object.meshes[ 0 ];
 * scene.add( mesh );
 * ```
 *
 * @augments Loader
 * @three_import import { LWOLoader } from 'three/addons/loaders/LWOLoader.js';
 */ class LWOLoader extends (0, _three.Loader) {
    /**
	 * Constructs a new LWO loader.
	 *
	 * @param {LoadingManager} [manager] - The loading manager.
	 */ constructor(manager){
        super(manager);
    }
    /**
	 * Starts loading from the given URL and passes the loaded LWO asset
	 * to the `onLoad()` callback.
	 *
	 * @param {string} url - The path/URL of the file to be loaded. This can also be a data URI.
	 * @param {function({meshes:Array<Mesh>,materials:Array<Material>})} onLoad - Executed when the loading process has been finished.
	 * @param {onProgressCallback} onProgress - Executed while the loading is in progress.
	 * @param {onErrorCallback} onError - Executed when errors occur.
	 */ load(url, onLoad, onProgress, onError) {
        const scope = this;
        const path = scope.path === '' ? extractParentUrl(url, 'Objects') : scope.path;
        // give the mesh a default name based on the filename
        const modelName = url.split(path).pop().split('.')[0];
        const loader = new (0, _three.FileLoader)(this.manager);
        loader.setPath(scope.path);
        loader.setResponseType('arraybuffer');
        loader.load(url, function(buffer) {
            // console.time( 'Total parsing: ' );
            try {
                onLoad(scope.parse(buffer, path, modelName));
            } catch (e) {
                if (onError) onError(e);
                else console.error(e);
                scope.manager.itemError(url);
            }
        // console.timeEnd( 'Total parsing: ' );
        }, onProgress, onError);
    }
    /**
	 * Parses the given LWO data and returns the resulting meshes and materials.
	 *
	 * @param {ArrayBuffer} iffBuffer - The raw LWO data as an array buffer.
	 * @param {string} path - The URL base path.
	 * @param {string} modelName - The model name.
	 * @return {{meshes:Array<Mesh>,materials:Array<Material>}} An object holding the parse meshes and materials.
	 */ parse(iffBuffer, path, modelName) {
        _lwoTree = new (0, _iffparserJs.IFFParser)().parse(iffBuffer);
        // console.log( 'lwoTree', lwoTree );
        const textureLoader = new (0, _three.TextureLoader)(this.manager).setPath(this.resourcePath || path).setCrossOrigin(this.crossOrigin);
        return new LWOTreeParser(textureLoader).parse(modelName);
    }
}
// Parse the lwoTree object
class LWOTreeParser {
    constructor(textureLoader){
        this.textureLoader = textureLoader;
    }
    parse(modelName) {
        this.materials = new MaterialParser(this.textureLoader).parse();
        this.defaultLayerName = modelName;
        this.meshes = this.parseLayers();
        return {
            materials: this.materials,
            meshes: this.meshes
        };
    }
    parseLayers() {
        // array of all meshes for building hierarchy
        const meshes = [];
        // final array containing meshes with scene graph hierarchy set up
        const finalMeshes = [];
        const geometryParser = new GeometryParser();
        const scope = this;
        _lwoTree.layers.forEach(function(layer) {
            const geometry = geometryParser.parse(layer.geometry, layer);
            const mesh = scope.parseMesh(geometry, layer);
            meshes[layer.number] = mesh;
            if (layer.parent === -1) finalMeshes.push(mesh);
            else meshes[layer.parent].add(mesh);
        });
        return finalMeshes;
    }
    parseMesh(geometry, layer) {
        let mesh;
        const materials = this.getMaterials(geometry.userData.matNames, layer.geometry.type);
        if (layer.geometry.type === 'points') mesh = new (0, _three.Points)(geometry, materials);
        else if (layer.geometry.type === 'lines') mesh = new (0, _three.LineSegments)(geometry, materials);
        else mesh = new (0, _three.Mesh)(geometry, materials);
        if (layer.name) mesh.name = layer.name;
        else mesh.name = this.defaultLayerName + '_layer_' + layer.number;
        const pivot = layer.pivot;
        if (pivot[0] !== 0 || pivot[1] !== 0 || pivot[2] !== 0) mesh.pivot = new (0, _three.Vector3)(pivot[0], pivot[1], pivot[2]);
        return mesh;
    }
    getMaterials(namesArray, type) {
        const materials = [];
        const scope = this;
        namesArray.forEach(function(name, i) {
            materials[i] = scope.getMaterialByName(name);
        });
        // convert materials to line or point mats if required
        if (type === 'points' || type === 'lines') materials.forEach(function(mat, i) {
            const spec = {
                color: mat.color
            };
            if (type === 'points') {
                spec.size = 0.1;
                spec.map = mat.map;
                materials[i] = new (0, _three.PointsMaterial)(spec);
            } else if (type === 'lines') materials[i] = new (0, _three.LineBasicMaterial)(spec);
        });
        // if there is only one material, return that directly instead of array
        const filtered = materials.filter(Boolean);
        if (filtered.length === 1) return filtered[0];
        return materials;
    }
    getMaterialByName(name) {
        return this.materials.filter(function(m) {
            return m.name === name;
        })[0];
    }
}
class MaterialParser {
    constructor(textureLoader){
        this.textureLoader = textureLoader;
    }
    parse() {
        const materials = [];
        this.textures = {};
        for(const name in _lwoTree.materials){
            if (_lwoTree.format === 'LWO3') materials.push(this.parseMaterial(_lwoTree.materials[name], name, _lwoTree.textures));
            else if (_lwoTree.format === 'LWO2') materials.push(this.parseMaterialLwo2(_lwoTree.materials[name], name, _lwoTree.textures));
        }
        return materials;
    }
    parseMaterial(materialData, name, textures) {
        let params = {
            name: name,
            side: this.getSide(materialData.attributes),
            flatShading: this.getSmooth(materialData.attributes)
        };
        const connections = this.parseConnections(materialData.connections, materialData.nodes);
        const maps = this.parseTextureNodes(connections.maps);
        this.parseAttributeImageMaps(connections.attributes, textures, maps);
        const attributes = this.parseAttributes(connections.attributes, maps);
        this.parseEnvMap(connections, maps, attributes);
        params = Object.assign(maps, params);
        params = Object.assign(params, attributes);
        const materialType = this.getMaterialType(connections.attributes);
        if (materialType !== (0, _three.MeshPhongMaterial)) delete params.refractionRatio; // PBR materials do not support "refractionRatio"
        return new materialType(params);
    }
    parseMaterialLwo2(materialData, name /*, textures*/ ) {
        let params = {
            name: name,
            side: this.getSide(materialData.attributes),
            flatShading: this.getSmooth(materialData.attributes)
        };
        const attributes = this.parseAttributes(materialData.attributes, {});
        params = Object.assign(params, attributes);
        return new (0, _three.MeshPhongMaterial)(params);
    }
    // Note: converting from left to right handed coords by switching x -> -x in vertices, and
    // then switching mat FrontSide -> BackSide
    // NB: this means that FrontSide and BackSide have been switched!
    getSide(attributes) {
        if (!attributes.side) return 0, _three.BackSide;
        switch(attributes.side){
            case 0:
            case 1:
                return 0, _three.BackSide;
            case 2:
                return 0, _three.FrontSide;
            case 3:
                return 0, _three.DoubleSide;
        }
    }
    getSmooth(attributes) {
        if (!attributes.smooth) return true;
        return !attributes.smooth;
    }
    parseConnections(connections, nodes) {
        const materialConnections = {
            maps: {}
        };
        const inputName = connections.inputName;
        const inputNodeName = connections.inputNodeName;
        const nodeName = connections.nodeName;
        const scope = this;
        inputName.forEach(function(name, index) {
            if (name === 'Material') {
                const matNode = scope.getNodeByRefName(inputNodeName[index], nodes);
                materialConnections.attributes = matNode.attributes;
                materialConnections.envMap = matNode.fileName;
                materialConnections.name = inputNodeName[index];
            }
        });
        nodeName.forEach(function(name, index) {
            if (name === materialConnections.name) materialConnections.maps[inputName[index]] = scope.getNodeByRefName(inputNodeName[index], nodes);
        });
        return materialConnections;
    }
    getNodeByRefName(refName, nodes) {
        for(const name in nodes){
            if (nodes[name].refName === refName) return nodes[name];
        }
    }
    parseTextureNodes(textureNodes) {
        const maps = {};
        for(const name in textureNodes){
            const node = textureNodes[name];
            const path = node.fileName;
            if (!path) return;
            const texture = this.loadTexture(path);
            if (node.widthWrappingMode !== undefined) texture.wrapS = this.getWrappingType(node.widthWrappingMode);
            if (node.heightWrappingMode !== undefined) texture.wrapT = this.getWrappingType(node.heightWrappingMode);
            switch(name){
                case 'Color':
                    maps.map = texture;
                    maps.map.colorSpace = (0, _three.SRGBColorSpace);
                    break;
                case 'Roughness':
                    maps.roughnessMap = texture;
                    maps.roughness = 1;
                    break;
                case 'Specular':
                    maps.specularMap = texture;
                    maps.specularMap.colorSpace = (0, _three.SRGBColorSpace);
                    maps.specular = 0xffffff;
                    break;
                case 'Luminous':
                    maps.emissiveMap = texture;
                    maps.emissiveMap.colorSpace = (0, _three.SRGBColorSpace);
                    maps.emissive = 0x808080;
                    break;
                case 'Luminous Color':
                    maps.emissive = 0x808080;
                    break;
                case 'Metallic':
                    maps.metalnessMap = texture;
                    maps.metalness = 1;
                    break;
                case 'Transparency':
                case 'Alpha':
                    maps.alphaMap = texture;
                    maps.transparent = true;
                    break;
                case 'Normal':
                    maps.normalMap = texture;
                    if (node.amplitude !== undefined) maps.normalScale = new (0, _three.Vector2)(node.amplitude, node.amplitude);
                    break;
                case 'Bump':
                    maps.bumpMap = texture;
                    break;
            }
        }
        // LWO BSDF materials can have both spec and rough, but this is not valid in three
        if (maps.roughnessMap && maps.specularMap) delete maps.specularMap;
        return maps;
    }
    // maps can also be defined on individual material attributes, parse those here
    // This occurs on Standard (Phong) surfaces
    parseAttributeImageMaps(attributes, textures, maps) {
        for(const name in attributes){
            const attribute = attributes[name];
            if (attribute.maps) {
                const mapData = attribute.maps[0];
                const path = this.getTexturePathByIndex(mapData.imageIndex);
                if (!path) return;
                const texture = this.loadTexture(path);
                if (mapData.wrap !== undefined) texture.wrapS = this.getWrappingType(mapData.wrap.w);
                if (mapData.wrap !== undefined) texture.wrapT = this.getWrappingType(mapData.wrap.h);
                switch(name){
                    case 'Color':
                        maps.map = texture;
                        maps.map.colorSpace = (0, _three.SRGBColorSpace);
                        break;
                    case 'Diffuse':
                        maps.aoMap = texture;
                        break;
                    case 'Roughness':
                        maps.roughnessMap = texture;
                        maps.roughness = 1;
                        break;
                    case 'Specular':
                        maps.specularMap = texture;
                        maps.specularMap.colorSpace = (0, _three.SRGBColorSpace);
                        maps.specular = 0xffffff;
                        break;
                    case 'Luminosity':
                        maps.emissiveMap = texture;
                        maps.emissiveMap.colorSpace = (0, _three.SRGBColorSpace);
                        maps.emissive = 0x808080;
                        break;
                    case 'Metallic':
                        maps.metalnessMap = texture;
                        maps.metalness = 1;
                        break;
                    case 'Transparency':
                    case 'Alpha':
                        maps.alphaMap = texture;
                        maps.transparent = true;
                        break;
                    case 'Normal':
                        maps.normalMap = texture;
                        break;
                    case 'Bump':
                        maps.bumpMap = texture;
                        break;
                }
            }
        }
    }
    parseAttributes(attributes, maps) {
        const params = {};
        // don't use color data if color map is present
        if (attributes.Color && !maps.map) params.color = new (0, _three.Color)().fromArray(attributes.Color.value);
        else params.color = new (0, _three.Color)();
        if (attributes.Transparency && attributes.Transparency.value !== 0) {
            params.opacity = 1 - attributes.Transparency.value;
            params.transparent = true;
        }
        if (attributes['Bump Height']) params.bumpScale = attributes['Bump Height'].value * 0.1;
        this.parsePhysicalAttributes(params, attributes, maps);
        this.parseStandardAttributes(params, attributes, maps);
        this.parsePhongAttributes(params, attributes, maps);
        return params;
    }
    parsePhysicalAttributes(params, attributes /*, maps*/ ) {
        if (attributes.Clearcoat && attributes.Clearcoat.value > 0) {
            params.clearcoat = attributes.Clearcoat.value;
            if (attributes['Clearcoat Gloss']) params.clearcoatRoughness = 0.5 * (1 - attributes['Clearcoat Gloss'].value);
        }
    }
    parseStandardAttributes(params, attributes, maps) {
        if (attributes.Luminous) {
            params.emissiveIntensity = attributes.Luminous.value;
            if (attributes['Luminous Color'] && !maps.emissive) params.emissive = new (0, _three.Color)().fromArray(attributes['Luminous Color'].value);
            else params.emissive = new (0, _three.Color)(0x808080);
        }
        if (attributes.Roughness && !maps.roughnessMap) params.roughness = attributes.Roughness.value;
        if (attributes.Metallic && !maps.metalnessMap) params.metalness = attributes.Metallic.value;
    }
    parsePhongAttributes(params, attributes, maps) {
        if (attributes['Refraction Index']) params.refractionRatio = 0.98 / attributes['Refraction Index'].value;
        if (attributes.Diffuse) params.color.multiplyScalar(attributes.Diffuse.value);
        if (attributes.Reflection) {
            params.reflectivity = attributes.Reflection.value;
            params.combine = (0, _three.AddOperation);
        }
        if (attributes.Luminosity) {
            params.emissiveIntensity = attributes.Luminosity.value;
            if (!maps.emissiveMap && !maps.map) params.emissive = params.color;
            else params.emissive = new (0, _three.Color)(0x808080);
        }
        // parse specular if there is no roughness - we will interpret the material as 'Phong' in this case
        if (!attributes.Roughness && attributes.Specular && !maps.specularMap) {
            if (attributes['Color Highlight']) params.specular = new (0, _three.Color)().setScalar(attributes.Specular.value).lerp(params.color.clone().multiplyScalar(attributes.Specular.value), attributes['Color Highlight'].value);
            else params.specular = new (0, _three.Color)().setScalar(attributes.Specular.value);
        }
        if (params.specular && attributes.Glossiness) params.shininess = 7 + Math.pow(2, attributes.Glossiness.value * 12 + 2);
    }
    parseEnvMap(connections, maps, attributes) {
        if (connections.envMap) {
            const envMap = this.loadTexture(connections.envMap);
            if (attributes.transparent && attributes.opacity < 0.999) {
                envMap.mapping = (0, _three.EquirectangularRefractionMapping);
                // Reflectivity and refraction mapping don't work well together in Phong materials
                if (attributes.reflectivity !== undefined) {
                    delete attributes.reflectivity;
                    delete attributes.combine;
                }
                if (attributes.metalness !== undefined) attributes.metalness = 1; // For most transparent materials metalness should be set to 1 if not otherwise defined. If set to 0 no refraction will be visible
                attributes.opacity = 1; // transparency fades out refraction, forcing opacity to 1 ensures a closer visual match to the material in Lightwave.
            } else envMap.mapping = (0, _three.EquirectangularReflectionMapping);
            maps.envMap = envMap;
        }
    }
    // get texture defined at top level by its index
    getTexturePathByIndex(index) {
        let fileName = '';
        if (!_lwoTree.textures) return fileName;
        _lwoTree.textures.forEach(function(texture) {
            if (texture.index === index) fileName = texture.fileName;
        });
        return fileName;
    }
    loadTexture(path) {
        if (!path) return null;
        const texture = this.textureLoader.load(path, undefined, undefined, function() {
            console.warn('LWOLoader: non-standard resource hierarchy. Use \`resourcePath\` parameter to specify root content directory.');
        });
        return texture;
    }
    // 0 = Reset, 1 = Repeat, 2 = Mirror, 3 = Edge
    getWrappingType(num) {
        switch(num){
            case 0:
                console.warn('LWOLoader: "Reset" texture wrapping type is not supported in three.js');
                return 0, _three.ClampToEdgeWrapping;
            case 1:
                return 0, _three.RepeatWrapping;
            case 2:
                return 0, _three.MirroredRepeatWrapping;
            case 3:
                return 0, _three.ClampToEdgeWrapping;
        }
    }
    getMaterialType(nodeData) {
        if (nodeData.Clearcoat && nodeData.Clearcoat.value > 0) return 0, _three.MeshPhysicalMaterial;
        if (nodeData.Roughness) return 0, _three.MeshStandardMaterial;
        return 0, _three.MeshPhongMaterial;
    }
}
class GeometryParser {
    parse(geoData, layer) {
        const geometry = new (0, _three.BufferGeometry)();
        geometry.setAttribute('position', new (0, _three.Float32BufferAttribute)(geoData.points, 3));
        const indices = this.splitIndices(geoData.vertexIndices, geoData.polygonDimensions);
        geometry.setIndex(indices);
        this.parseGroups(geometry, geoData);
        geometry.computeVertexNormals();
        this.parseUVs(geometry, layer);
        this.parseMorphTargets(geometry, layer);
        return geometry;
    }
    // split quads into tris
    splitIndices(indices, polygonDimensions) {
        const remappedIndices = [];
        let i = 0;
        polygonDimensions.forEach(function(dim) {
            if (dim < 4) for(let k = 0; k < dim; k++)remappedIndices.push(indices[i + k]);
            else if (dim === 4) remappedIndices.push(indices[i], indices[i + 1], indices[i + 2], indices[i], indices[i + 2], indices[i + 3]);
            else if (dim > 4) {
                for(let k = 1; k < dim - 1; k++)remappedIndices.push(indices[i], indices[i + k], indices[i + k + 1]);
                console.warn('LWOLoader: polygons with greater than 4 sides are not supported');
            }
            i += dim;
        });
        return remappedIndices;
    }
    // NOTE: currently ignoring poly indices and assuming that they are intelligently ordered
    parseGroups(geometry, geoData) {
        const tags = _lwoTree.tags;
        const matNames = [];
        let elemSize = 3;
        if (geoData.type === 'lines') elemSize = 2;
        if (geoData.type === 'points') elemSize = 1;
        const remappedIndices = this.splitMaterialIndices(geoData.polygonDimensions, geoData.materialIndices);
        let indexNum = 0; // create new indices in numerical order
        const indexPairs = {}; // original indices mapped to numerical indices
        let prevMaterialIndex;
        let materialIndex;
        let prevStart = 0;
        let currentCount = 0;
        for(let i = 0; i < remappedIndices.length; i += 2){
            materialIndex = remappedIndices[i + 1];
            if (i === 0) matNames[indexNum] = tags[materialIndex];
            if (prevMaterialIndex === undefined) prevMaterialIndex = materialIndex;
            if (materialIndex !== prevMaterialIndex) {
                let currentIndex;
                if (indexPairs[tags[prevMaterialIndex]]) currentIndex = indexPairs[tags[prevMaterialIndex]];
                else {
                    currentIndex = indexNum;
                    indexPairs[tags[prevMaterialIndex]] = indexNum;
                    matNames[indexNum] = tags[prevMaterialIndex];
                    indexNum++;
                }
                geometry.addGroup(prevStart, currentCount, currentIndex);
                prevStart += currentCount;
                prevMaterialIndex = materialIndex;
                currentCount = 0;
            }
            currentCount += elemSize;
        }
        // the loop above doesn't add the last group, do that here.
        if (geometry.groups.length > 0) {
            let currentIndex;
            if (indexPairs[tags[materialIndex]]) currentIndex = indexPairs[tags[materialIndex]];
            else {
                currentIndex = indexNum;
                indexPairs[tags[materialIndex]] = indexNum;
                matNames[indexNum] = tags[materialIndex];
            }
            geometry.addGroup(prevStart, currentCount, currentIndex);
        }
        // Mat names from TAGS chunk, used to build up an array of materials for this geometry
        geometry.userData.matNames = matNames;
    }
    splitMaterialIndices(polygonDimensions, indices) {
        const remappedIndices = [];
        polygonDimensions.forEach(function(dim, i) {
            if (dim <= 3) remappedIndices.push(indices[i * 2], indices[i * 2 + 1]);
            else if (dim === 4) remappedIndices.push(indices[i * 2], indices[i * 2 + 1], indices[i * 2], indices[i * 2 + 1]);
            else // ignore > 4 for now
            for(let k = 0; k < dim - 2; k++)remappedIndices.push(indices[i * 2], indices[i * 2 + 1]);
        });
        return remappedIndices;
    }
    // UV maps:
    // 1: are defined via index into an array of points, not into a geometry
    // - the geometry is also defined by an index into this array, but the indexes may not match
    // 2: there can be any number of UV maps for a single geometry. Here these are combined,
    // 	with preference given to the first map encountered
    // 3: UV maps can be partial - that is, defined for only a part of the geometry
    // 4: UV maps can be VMAP or VMAD (discontinuous, to allow for seams). In practice, most
    // UV maps are defined as partially VMAP and partially VMAD
    // VMADs are currently not supported
    parseUVs(geometry, layer) {
        // start by creating a UV map set to zero for the whole geometry
        const remappedUVs = Array.from(Array(geometry.attributes.position.count * 2), function() {
            return 0;
        });
        for(const name in layer.uvs){
            const uvs = layer.uvs[name].uvs;
            const uvIndices = layer.uvs[name].uvIndices;
            uvIndices.forEach(function(i, j) {
                remappedUVs[i * 2] = uvs[j * 2];
                remappedUVs[i * 2 + 1] = uvs[j * 2 + 1];
            });
        }
        geometry.setAttribute('uv', new (0, _three.Float32BufferAttribute)(remappedUVs, 2));
    }
    parseMorphTargets(geometry, layer) {
        let num = 0;
        for(const name in layer.morphTargets){
            const remappedPoints = geometry.attributes.position.array.slice();
            if (!geometry.morphAttributes.position) geometry.morphAttributes.position = [];
            const morphPoints = layer.morphTargets[name].points;
            const morphIndices = layer.morphTargets[name].indices;
            const type = layer.morphTargets[name].type;
            morphIndices.forEach(function(i, j) {
                if (type === 'relative') {
                    remappedPoints[i * 3] += morphPoints[j * 3];
                    remappedPoints[i * 3 + 1] += morphPoints[j * 3 + 1];
                    remappedPoints[i * 3 + 2] += morphPoints[j * 3 + 2];
                } else {
                    remappedPoints[i * 3] = morphPoints[j * 3];
                    remappedPoints[i * 3 + 1] = morphPoints[j * 3 + 1];
                    remappedPoints[i * 3 + 2] = morphPoints[j * 3 + 2];
                }
            });
            geometry.morphAttributes.position[num] = new (0, _three.Float32BufferAttribute)(remappedPoints, 3);
            geometry.morphAttributes.position[num].name = name;
            num++;
        }
        geometry.morphTargetsRelative = false;
    }
}
// ************** UTILITY FUNCTIONS **************
function extractParentUrl(url, dir) {
    const index = url.indexOf(dir);
    if (index === -1) return './';
    return url.slice(0, index);
}

},{"three":"hJIVG","./lwo/IFFParser.js":"4dnUW","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"4dnUW":[function(require,module,exports,__globalThis) {
/**
 * === IFFParser ===
 * - Parses data from the IFF buffer.
 * - LWO3 files are in IFF format and can contain the following data types, referred to by shorthand codes
 *
 * ATOMIC DATA TYPES
 *  ID Tag - 4x 7 bit uppercase ASCII chars: ID4
 *  signed integer, 1, 2, or 4 byte length: I1, I2, I4
 *  unsigned integer, 1, 2, or 4 byte length: U1, U2, U4
 *  float, 4 byte length: F4
 *  string, series of ASCII chars followed by null byte (If the length of the string including the null terminating byte is odd, an extra null is added so that the data that follows will begin on an even byte boundary): S0
 *
 * COMPOUND DATA TYPES
 *  Variable-length Index (index into an array or collection): U2 or U4 : VX
 *  Color (RGB): F4 + F4 + F4: COL12
 *  Coordinate (x, y, z): F4 + F4 + F4: VEC12
 *  Percentage F4 data type from 0->1 with 1 = 100%: FP4
 *  Angle in radian F4: ANG4
 *  Filename (string) S0: FNAM0
 *  XValue F4 + index (VX) + optional envelope( ENVL ): XVAL
 *  XValue vector VEC12 + index (VX) + optional envelope( ENVL ): XVAL3
 *
 *  The IFF file is arranged in chunks:
 *  CHUNK = ID4 + length (U4) + length X bytes of data + optional 0 pad byte
 *  optional 0 pad byte is there to ensure chunk ends on even boundary, not counted in size
 *
 * COMPOUND DATA TYPES
 * - Chunks are combined in Forms (collections of chunks)
 * - FORM = string 'FORM' (ID4) + length (U4) + type (ID4) + optional ( CHUNK | FORM )
 * - CHUNKS and FORMS are collectively referred to as blocks
 * - The entire file is contained in one top level FORM
 *
 **/ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "IFFParser", ()=>IFFParser);
var _lwo2ParserJs = require("./LWO2Parser.js");
var _lwo3ParserJs = require("./LWO3Parser.js");
class IFFParser {
    constructor(){
        this.debugger = new Debugger();
    // this.debugger.enable(); // un-comment to log IFF hierarchy.
    }
    parse(buffer) {
        this.reader = new DataViewReader(buffer);
        this.tree = {
            materials: {},
            layers: [],
            tags: [],
            textures: []
        };
        // start out at the top level to add any data before first layer is encountered
        this.currentLayer = this.tree;
        this.currentForm = this.tree;
        this.parseTopForm();
        if (this.tree.format === undefined) return;
        if (this.tree.format === 'LWO2') {
            this.parser = new (0, _lwo2ParserJs.LWO2Parser)(this);
            while(!this.reader.endOfFile())this.parser.parseBlock();
        } else if (this.tree.format === 'LWO3') {
            this.parser = new (0, _lwo3ParserJs.LWO3Parser)(this);
            while(!this.reader.endOfFile())this.parser.parseBlock();
        }
        this.debugger.offset = this.reader.offset;
        this.debugger.closeForms();
        return this.tree;
    }
    parseTopForm() {
        this.debugger.offset = this.reader.offset;
        const topForm = this.reader.getIDTag();
        if (topForm !== 'FORM') {
            console.warn('LWOLoader: Top-level FORM missing.');
            return;
        }
        const length = this.reader.getUint32();
        this.debugger.dataOffset = this.reader.offset;
        this.debugger.length = length;
        const type = this.reader.getIDTag();
        if (type === 'LWO2') this.tree.format = type;
        else if (type === 'LWO3') this.tree.format = type;
        this.debugger.node = 0;
        this.debugger.nodeID = type;
        this.debugger.log();
        return;
    }
    ///
    // FORM PARSING METHODS
    ///
    // Forms are organisational and can contain any number of sub chunks and sub forms
    // FORM ::= 'FORM'[ID4], length[U4], type[ID4], ( chunk[CHUNK] | form[FORM] ) * }
    parseForm(length) {
        const type = this.reader.getIDTag();
        switch(type){
            // SKIPPED FORMS
            // if skipForm( length ) is called, the entire form and any sub forms and chunks are skipped
            case 'ISEQ':
            case 'ANIM':
            case 'STCC':
            case 'VPVL':
            case 'VPRM':
            case 'NROT':
            case 'WRPW':
            case 'WRPH':
            case 'FUNC':
            case 'FALL':
            case 'OPAC':
            case 'GRAD':
            case 'ENVS':
            case 'VMOP':
            case 'VMBG':
            // Car Material FORMS
            case 'OMAX':
            case 'STEX':
            case 'CKBG':
            case 'CKEY':
            case 'VMLA':
            case 'VMLB':
                this.debugger.skipped = true;
                this.skipForm(length); // not currently supported
                break;
            // if break; is called directly, the position in the lwoTree is not created
            // any sub chunks and forms are added to the parent form instead
            case 'META':
            case 'NNDS':
            case 'NODS':
            case 'NDTA':
            case 'ADAT':
            case 'AOVS':
            case 'BLOK':
            // used by texture nodes
            case 'IBGC':
            case 'IOPC':
            case 'IIMG':
            case 'TXTR':
                // this.setupForm( type, length );
                this.debugger.length = 4;
                this.debugger.skipped = true;
                break;
            case 'IFAL':
            case 'ISCL':
            case 'IPOS':
            case 'IROT':
            case 'IBMP':
            case 'IUTD':
            case 'IVTD':
                this.parseTextureNodeAttribute(type);
                break;
            case 'ENVL':
                this.parseEnvelope(length);
                break;
            // CLIP FORM AND SUB FORMS
            case 'CLIP':
                if (this.tree.format === 'LWO2') this.parseForm(length);
                else this.parseClip(length);
                break;
            case 'STIL':
                this.parseImage();
                break;
            case 'XREF':
                this.reader.skip(8); // unknown
                this.currentForm.referenceTexture = {
                    index: this.reader.getUint32(),
                    refName: this.reader.getString() // internal unique ref
                };
                break;
            // Not in spec, used by texture nodes
            case 'IMST':
                this.parseImageStateForm(length);
                break;
            // SURF FORM AND SUB FORMS
            case 'SURF':
                this.parseSurfaceForm(length);
                break;
            case 'VALU':
                this.parseValueForm(length);
                break;
            case 'NTAG':
                this.parseSubNode(length);
                break;
            case 'ATTR':
            case 'SATR':
                this.setupForm('attributes', length);
                break;
            case 'NCON':
                this.parseConnections(length);
                break;
            case 'SSHA':
                this.parentForm = this.currentForm;
                this.currentForm = this.currentSurface;
                this.setupForm('surfaceShader', length);
                break;
            case 'SSHD':
                this.setupForm('surfaceShaderData', length);
                break;
            case 'ENTR':
                this.parseEntryForm(length);
                break;
            // Image Map Layer
            case 'IMAP':
                this.parseImageMap(length);
                break;
            case 'TAMP':
                this.parseXVAL('amplitude', length);
                break;
            //Texture Mapping Form
            case 'TMAP':
                this.setupForm('textureMap', length);
                break;
            case 'CNTR':
                this.parseXVAL3('center', length);
                break;
            case 'SIZE':
                this.parseXVAL3('scale', length);
                break;
            case 'ROTA':
                this.parseXVAL3('rotation', length);
                break;
            default:
                this.parseUnknownForm(type, length);
        }
        this.debugger.node = 0;
        this.debugger.nodeID = type;
        this.debugger.log();
    }
    setupForm(type, length) {
        if (!this.currentForm) this.currentForm = this.currentNode;
        this.currentFormEnd = this.reader.offset + length;
        this.parentForm = this.currentForm;
        if (!this.currentForm[type]) {
            this.currentForm[type] = {};
            this.currentForm = this.currentForm[type];
        } else {
            // should never see this unless there's a bug in the reader
            console.warn('LWOLoader: form already exists on parent: ', type, this.currentForm);
            this.currentForm = this.currentForm[type];
        }
    }
    skipForm(length) {
        this.reader.skip(length - 4);
    }
    parseUnknownForm(type, length) {
        console.warn('LWOLoader: unknown FORM encountered: ' + type, length);
        printBuffer(this.reader.dv.buffer, this.reader.offset, length - 4);
        this.reader.skip(length - 4);
    }
    parseSurfaceForm(length) {
        this.reader.skip(8); // unknown Uint32 x2
        const name = this.reader.getString();
        const surface = {
            attributes: {},
            connections: {},
            name: name,
            inputName: name,
            nodes: {},
            source: this.reader.getString()
        };
        this.tree.materials[name] = surface;
        this.currentSurface = surface;
        this.parentForm = this.tree.materials;
        this.currentForm = surface;
        this.currentFormEnd = this.reader.offset + length;
    }
    parseSurfaceLwo2(length) {
        const name = this.reader.getString();
        const surface = {
            attributes: {},
            connections: {},
            name: name,
            nodes: {},
            source: this.reader.getString()
        };
        this.tree.materials[name] = surface;
        this.currentSurface = surface;
        this.parentForm = this.tree.materials;
        this.currentForm = surface;
        this.currentFormEnd = this.reader.offset + length;
    }
    parseSubNode(length) {
        // parse the NRNM CHUNK of the subnode FORM to get
        // a meaningful name for the subNode
        // some subnodes can be renamed, but Input and Surface cannot
        this.reader.skip(8); // NRNM + length
        const name = this.reader.getString();
        const node = {
            name: name
        };
        this.currentForm = node;
        this.currentNode = node;
        this.currentFormEnd = this.reader.offset + length;
    }
    // collect attributes from all nodes at the top level of a surface
    parseConnections(length) {
        this.currentFormEnd = this.reader.offset + length;
        this.parentForm = this.currentForm;
        this.currentForm = this.currentSurface.connections;
    }
    // surface node attribute data, e.g. specular, roughness etc
    parseEntryForm(length) {
        this.reader.skip(8); // NAME + length
        const name = this.reader.getString();
        this.currentForm = this.currentNode.attributes;
        this.setupForm(name, length);
    }
    // parse values from material - doesn't match up to other LWO3 data types
    // sub form of entry form
    parseValueForm() {
        this.reader.skip(8); // unknown + length
        const valueType = this.reader.getString();
        if (valueType === 'double') this.currentForm.value = this.reader.getUint64();
        else if (valueType === 'int') this.currentForm.value = this.reader.getUint32();
        else if (valueType === 'vparam') {
            this.reader.skip(24);
            this.currentForm.value = this.reader.getFloat64();
        } else if (valueType === 'vparam3') {
            this.reader.skip(24);
            this.currentForm.value = this.reader.getFloat64Array(3);
        }
    }
    // holds various data about texture node image state
    // Data other than mipMapLevel unknown
    parseImageStateForm() {
        this.reader.skip(8); // unknown
        this.currentForm.mipMapLevel = this.reader.getFloat32();
    }
    // LWO2 style image data node OR LWO3 textures defined at top level in editor (not as SURF node)
    parseImageMap(length) {
        this.currentFormEnd = this.reader.offset + length;
        this.parentForm = this.currentForm;
        if (!this.currentForm.maps) this.currentForm.maps = [];
        const map = {};
        this.currentForm.maps.push(map);
        this.currentForm = map;
        this.reader.skip(10); // unknown, could be an issue if it contains a VX
    }
    parseTextureNodeAttribute(type) {
        this.reader.skip(28); // FORM + length + VPRM + unknown + Uint32 x2 + float32
        this.reader.skip(20); // FORM + length + VPVL + float32 + Uint32
        switch(type){
            case 'ISCL':
                this.currentNode.scale = this.reader.getFloat32Array(3);
                break;
            case 'IPOS':
                this.currentNode.position = this.reader.getFloat32Array(3);
                break;
            case 'IROT':
                this.currentNode.rotation = this.reader.getFloat32Array(3);
                break;
            case 'IFAL':
                this.currentNode.falloff = this.reader.getFloat32Array(3);
                break;
            case 'IBMP':
                this.currentNode.amplitude = this.reader.getFloat32();
                break;
            case 'IUTD':
                this.currentNode.uTiles = this.reader.getFloat32();
                break;
            case 'IVTD':
                this.currentNode.vTiles = this.reader.getFloat32();
                break;
        }
        this.reader.skip(2); // unknown
    }
    // ENVL forms are currently ignored
    parseEnvelope(length) {
        this.reader.skip(length - 4); // skipping  entirely for now
    }
    ///
    // CHUNK PARSING METHODS
    ///
    // clips can either be defined inside a surface node, or at the top
    // level and they have a different format in each case
    parseClip(length) {
        const tag = this.reader.getIDTag();
        // inside surface node
        if (tag === 'FORM') {
            this.reader.skip(16);
            this.currentNode.fileName = this.reader.getString();
            return;
        }
        // otherwise top level
        this.reader.setOffset(this.reader.offset - 4);
        this.currentFormEnd = this.reader.offset + length;
        this.parentForm = this.currentForm;
        this.reader.skip(8); // unknown
        const texture = {
            index: this.reader.getUint32()
        };
        this.tree.textures.push(texture);
        this.currentForm = texture;
    }
    parseClipLwo2(length) {
        const texture = {
            index: this.reader.getUint32(),
            fileName: ''
        };
        // search STIL block
        while(true){
            const tag = this.reader.getIDTag();
            const n_length = this.reader.getUint16();
            if (tag === 'STIL') {
                texture.fileName = this.reader.getString();
                break;
            }
            if (n_length >= length) break;
        }
        this.tree.textures.push(texture);
        this.currentForm = texture;
    }
    parseImage() {
        this.reader.skip(8); // unknown
        this.currentForm.fileName = this.reader.getString();
    }
    parseXVAL(type, length) {
        const endOffset = this.reader.offset + length - 4;
        this.reader.skip(8);
        this.currentForm[type] = this.reader.getFloat32();
        this.reader.setOffset(endOffset); // set end offset directly to skip optional envelope
    }
    parseXVAL3(type, length) {
        const endOffset = this.reader.offset + length - 4;
        this.reader.skip(8);
        this.currentForm[type] = {
            x: this.reader.getFloat32(),
            y: this.reader.getFloat32(),
            z: this.reader.getFloat32()
        };
        this.reader.setOffset(endOffset);
    }
    // Tags associated with an object
    // OTAG { type[ID4], tag-string[S0] }
    parseObjectTag() {
        if (!this.tree.objectTags) this.tree.objectTags = {};
        this.tree.objectTags[this.reader.getIDTag()] = {
            tagString: this.reader.getString()
        };
    }
    // Signals the start of a new layer. All the data chunks which follow will be included in this layer until another layer chunk is encountered.
    // LAYR: number[U2], flags[U2], pivot[VEC12], name[S0], parent[U2]
    parseLayer(length) {
        const number = this.reader.getUint16();
        const flags = this.reader.getUint16(); // If the least significant bit of flags is set, the layer is hidden.
        const pivot = this.reader.getFloat32Array(3); // Note: this seems to be superfluous, as the geometry is translated when pivot is present
        const layer = {
            number: number,
            flags: flags,
            pivot: [
                -pivot[0],
                pivot[1],
                pivot[2]
            ],
            name: this.reader.getString()
        };
        this.tree.layers.push(layer);
        this.currentLayer = layer;
        const parsedLength = 16 + stringOffset(this.currentLayer.name); // index ( 2 ) + flags( 2 ) + pivot( 12 ) + stringlength
        // if we have not reached then end of the layer block, there must be a parent defined
        this.currentLayer.parent = parsedLength < length ? this.reader.getUint16() : -1; // omitted or -1 for no parent
    }
    // VEC12 * ( F4 + F4 + F4 ) array of x,y,z vectors
    // Converting from left to right handed coordinate system:
    // x -> -x and switch material FrontSide -> BackSide
    parsePoints(length) {
        this.currentPoints = [];
        for(let i = 0; i < length / 4; i += 3)// x -> -x to match three.js right handed coords
        this.currentPoints.push(-this.reader.getFloat32(), this.reader.getFloat32(), this.reader.getFloat32());
    }
    // parse VMAP or VMAD
    // Associates a set of floating-point vectors with a set of points.
    // VMAP: { type[ID4], dimension[U2], name[S0], ( vert[VX], value[F4] # dimension ) * }
    // VMAD Associates a set of floating-point vectors with the vertices of specific polygons.
    // Similar to VMAP UVs, but associates with polygon vertices rather than points
    // to solve to problem of UV seams:  VMAD chunks are paired with VMAPs of the same name,
    // if they exist. The vector values in the VMAD will then replace those in the
    // corresponding VMAP, but only for calculations involving the specified polygons.
    // VMAD { type[ID4], dimension[U2], name[S0], ( vert[VX], poly[VX], value[F4] # dimension ) * }
    parseVertexMapping(length, discontinuous) {
        const finalOffset = this.reader.offset + length;
        const channelName = this.reader.getString();
        if (this.reader.offset === finalOffset) {
            // then we are in a texture node and the VMAP chunk is just a reference to a UV channel name
            this.currentForm.UVChannel = channelName;
            return;
        }
        // otherwise reset to initial length and parse normal VMAP CHUNK
        this.reader.setOffset(this.reader.offset - stringOffset(channelName));
        const type = this.reader.getIDTag();
        this.reader.getUint16(); // dimension
        const name = this.reader.getString();
        const remainingLength = length - 6 - stringOffset(name);
        switch(type){
            case 'TXUV':
                this.parseUVMapping(name, finalOffset, discontinuous);
                break;
            case 'MORF':
            case 'SPOT':
                this.parseMorphTargets(name, finalOffset, type); // can't be discontinuous
                break;
            // unsupported VMAPs
            case 'APSL':
            case 'NORM':
            case 'WGHT':
            case 'MNVW':
            case 'PICK':
            case 'RGB ':
            case 'RGBA':
                this.reader.skip(remainingLength);
                break;
            default:
                console.warn('LWOLoader: unknown vertex map type: ' + type);
                this.reader.skip(remainingLength);
        }
    }
    parseUVMapping(name, finalOffset, discontinuous) {
        const uvIndices = [];
        const polyIndices = [];
        const uvs = [];
        while(this.reader.offset < finalOffset){
            uvIndices.push(this.reader.getVariableLengthIndex());
            if (discontinuous) polyIndices.push(this.reader.getVariableLengthIndex());
            uvs.push(this.reader.getFloat32(), this.reader.getFloat32());
        }
        if (discontinuous) {
            if (!this.currentLayer.discontinuousUVs) this.currentLayer.discontinuousUVs = {};
            this.currentLayer.discontinuousUVs[name] = {
                uvIndices: uvIndices,
                polyIndices: polyIndices,
                uvs: uvs
            };
        } else {
            if (!this.currentLayer.uvs) this.currentLayer.uvs = {};
            this.currentLayer.uvs[name] = {
                uvIndices: uvIndices,
                uvs: uvs
            };
        }
    }
    parseMorphTargets(name, finalOffset, type) {
        const indices = [];
        const points = [];
        type = type === 'MORF' ? 'relative' : 'absolute';
        while(this.reader.offset < finalOffset){
            indices.push(this.reader.getVariableLengthIndex());
            // z -> -z to match three.js right handed coords
            points.push(this.reader.getFloat32(), this.reader.getFloat32(), -this.reader.getFloat32());
        }
        if (!this.currentLayer.morphTargets) this.currentLayer.morphTargets = {};
        this.currentLayer.morphTargets[name] = {
            indices: indices,
            points: points,
            type: type
        };
    }
    // A list of polygons for the current layer.
    // POLS { type[ID4], ( numvert+flags[U2], vert[VX] # numvert ) * }
    parsePolygonList(length) {
        const finalOffset = this.reader.offset + length;
        const type = this.reader.getIDTag();
        const indices = [];
        // hold a list of polygon sizes, to be split up later
        const polygonDimensions = [];
        while(this.reader.offset < finalOffset){
            let numverts = this.reader.getUint16();
            //const flags = numverts & 64512; // 6 high order bits are flags - ignoring for now
            numverts = numverts & 1023; // remaining ten low order bits are vertex num
            polygonDimensions.push(numverts);
            for(let j = 0; j < numverts; j++)indices.push(this.reader.getVariableLengthIndex());
        }
        const geometryData = {
            type: type,
            vertexIndices: indices,
            polygonDimensions: polygonDimensions,
            points: this.currentPoints
        };
        // Note: assuming that all polys will be lines or points if the first is
        if (polygonDimensions[0] === 1) geometryData.type = 'points';
        else if (polygonDimensions[0] === 2) geometryData.type = 'lines';
        this.currentLayer.geometry = geometryData;
    }
    // Lists the tag strings that can be associated with polygons by the PTAG chunk.
    // TAGS { tag-string[S0] * }
    parseTagStrings(length) {
        this.tree.tags = this.reader.getStringArray(length);
    }
    // Associates tags of a given type with polygons in the most recent POLS chunk.
    // PTAG { type[ID4], ( poly[VX], tag[U2] ) * }
    parsePolygonTagMapping(length) {
        const finalOffset = this.reader.offset + length;
        const type = this.reader.getIDTag();
        if (type === 'SURF') this.parseMaterialIndices(finalOffset);
        else this.reader.skip(length - 4);
    }
    parseMaterialIndices(finalOffset) {
        // array holds polygon index followed by material index
        this.currentLayer.geometry.materialIndices = [];
        while(this.reader.offset < finalOffset){
            const polygonIndex = this.reader.getVariableLengthIndex();
            const materialIndex = this.reader.getUint16();
            this.currentLayer.geometry.materialIndices.push(polygonIndex, materialIndex);
        }
    }
    parseUnknownCHUNK(blockID, length) {
        console.warn('LWOLoader: unknown chunk type: ' + blockID + ' length: ' + length);
        // print the chunk plus some bytes padding either side
        // printBuffer( this.reader.dv.buffer, this.reader.offset - 20, length + 40 );
        const data = this.reader.getString(length);
        this.currentForm[blockID] = data;
    }
}
class DataViewReader {
    constructor(buffer){
        this.dv = new DataView(buffer);
        this.offset = 0;
        this._textDecoder = new TextDecoder();
        this._bytes = new Uint8Array(buffer);
    }
    size() {
        return this.dv.buffer.byteLength;
    }
    setOffset(offset) {
        if (offset > 0 && offset < this.dv.buffer.byteLength) this.offset = offset;
        else console.error('LWOLoader: invalid buffer offset');
    }
    endOfFile() {
        if (this.offset >= this.size()) return true;
        return false;
    }
    skip(length) {
        this.offset += length;
    }
    getUint8() {
        const value = this.dv.getUint8(this.offset);
        this.offset += 1;
        return value;
    }
    getUint16() {
        const value = this.dv.getUint16(this.offset);
        this.offset += 2;
        return value;
    }
    getInt32() {
        const value = this.dv.getInt32(this.offset, false);
        this.offset += 4;
        return value;
    }
    getUint32() {
        const value = this.dv.getUint32(this.offset, false);
        this.offset += 4;
        return value;
    }
    getUint64() {
        const low = this.getUint32();
        const high = this.getUint32();
        return high * 0x100000000 + low;
    }
    getFloat32() {
        const value = this.dv.getFloat32(this.offset, false);
        this.offset += 4;
        return value;
    }
    getFloat32Array(size) {
        const a = [];
        for(let i = 0; i < size; i++)a.push(this.getFloat32());
        return a;
    }
    getFloat64() {
        const value = this.dv.getFloat64(this.offset);
        this.offset += 8;
        return value;
    }
    getFloat64Array(size) {
        const a = [];
        for(let i = 0; i < size; i++)a.push(this.getFloat64());
        return a;
    }
    // get variable-length index data type
    // VX ::= index[U2] | (index + 0xFF000000)[U4]
    // If the index value is less than 65,280 (0xFF00),then VX === U2
    // otherwise VX === U4 with bits 24-31 set
    // When reading an index, if the first byte encountered is 255 (0xFF), then
    // the four-byte form is being used and the first byte should be discarded or masked out.
    getVariableLengthIndex() {
        const firstByte = this.getUint8();
        if (firstByte === 255) return this.getUint8() * 65536 + this.getUint8() * 256 + this.getUint8();
        return firstByte * 256 + this.getUint8();
    }
    // An ID tag is a sequence of 4 bytes containing 7-bit ASCII values
    getIDTag() {
        return this.getString(4);
    }
    getString(size) {
        if (size === 0) return;
        const start = this.offset;
        let result;
        let length;
        if (size) {
            length = size;
            result = this._textDecoder.decode(new Uint8Array(this.dv.buffer, start, size));
        } else {
            // use 1:1 mapping of buffer to avoid redundant new array creation.
            length = this._bytes.indexOf(0, start) - start;
            result = this._textDecoder.decode(new Uint8Array(this.dv.buffer, start, length));
            // account for null byte in length
            length++;
            // if string with terminating nullbyte is uneven, extra nullbyte is added, skip that too
            length += length % 2;
        }
        this.skip(length);
        return result;
    }
    getStringArray(size) {
        let a = this.getString(size);
        a = a.split('\0');
        return a.filter(Boolean); // return array with any empty strings removed
    }
}
// ************** DEBUGGER  **************
class Debugger {
    constructor(){
        this.active = false;
        this.depth = 0;
        this.formList = [];
        this.offset = 0;
        this.node = 0; // 0 = FORM, 1 = CHUNK, 2 = SUBNODE
        this.nodeID = 'FORM';
        this.dataOffset = 0;
        this.length = 0;
        this.skipped = false;
    }
    enable() {
        this.active = true;
    }
    log() {
        if (!this.active) return;
        let nodeType;
        switch(this.node){
            case 0:
                nodeType = 'FORM';
                break;
            case 1:
                nodeType = 'CHK';
                break;
            case 2:
                nodeType = 'S-CHK';
                break;
        }
        console.log('| '.repeat(this.depth) + nodeType, this.nodeID, `( ${this.offset} ) -> ( ${this.dataOffset + this.length} )`, this.node == 0 ? ' {' : '', this.skipped ? 'SKIPPED' : '', this.node == 0 && this.skipped ? '}' : '');
        if (this.node == 0 && !this.skipped) {
            this.depth += 1;
            this.formList.push(this.dataOffset + this.length);
        }
        this.skipped = false;
    }
    closeForms() {
        if (!this.active) return;
        for(let i = this.formList.length - 1; i >= 0; i--)if (this.offset >= this.formList[i]) {
            this.depth -= 1;
            console.log('| '.repeat(this.depth) + '}');
            this.formList.splice(-1, 1);
        }
    }
}
// ************** UTILITY FUNCTIONS **************
// calculate the length of the string in the buffer
// this will be string.length + nullbyte + optional padbyte to make the length even
function stringOffset(string) {
    return string.length + 1 + (string.length + 1) % 2;
}
// for testing purposes, dump buffer to console
// printBuffer( this.reader.dv.buffer, this.reader.offset, length );
function printBuffer(buffer, from, to) {
    console.log(new TextDecoder().decode(new Uint8Array(buffer, from, to)));
}

},{"./LWO2Parser.js":"eCnif","./LWO3Parser.js":"7wkiM","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"eCnif":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "LWO2Parser", ()=>LWO2Parser);
class LWO2Parser {
    constructor(IFFParser){
        this.IFF = IFFParser;
    }
    parseBlock() {
        this.IFF.debugger.offset = this.IFF.reader.offset;
        this.IFF.debugger.closeForms();
        const blockID = this.IFF.reader.getIDTag();
        let length = this.IFF.reader.getUint32(); // size of data in bytes
        if (length > this.IFF.reader.dv.byteLength - this.IFF.reader.offset) {
            this.IFF.reader.offset -= 4;
            length = this.IFF.reader.getUint16();
        }
        this.IFF.debugger.dataOffset = this.IFF.reader.offset;
        this.IFF.debugger.length = length;
        // Data types may be found in either LWO2 OR LWO3 spec
        switch(blockID){
            case 'FORM':
                this.IFF.parseForm(length);
                break;
            // SKIPPED CHUNKS
            // if break; is called directly, the position in the lwoTree is not created
            // any sub chunks and forms are added to the parent form instead
            // MISC skipped
            case 'ICON':
            case 'VMPA':
            case 'BBOX':
            // case 'VMMD':
            // case 'VTYP':
            // normal maps can be specified, normally on models imported from other applications. Currently ignored
            case 'NORM':
            // ENVL FORM skipped
            case 'PRE ':
            case 'POST':
            case 'KEY ':
            case 'SPAN':
            // CLIP FORM skipped
            case 'TIME':
            case 'CLRS':
            case 'CLRA':
            case 'FILT':
            case 'DITH':
            case 'CONT':
            case 'BRIT':
            case 'SATR':
            case 'HUE ':
            case 'GAMM':
            case 'NEGA':
            case 'IFLT':
            case 'PFLT':
            // Image Map Layer skipped
            case 'PROJ':
            case 'AXIS':
            case 'AAST':
            case 'PIXB':
            case 'AUVO':
            case 'STCK':
            // Procedural Textures skipped
            case 'PROC':
            case 'VALU':
            case 'FUNC':
            // Gradient Textures skipped
            case 'PNAM':
            case 'INAM':
            case 'GRST':
            case 'GREN':
            case 'GRPT':
            case 'FKEY':
            case 'IKEY':
            // Texture Mapping Form skipped
            case 'CSYS':
            // Surface CHUNKs skipped
            case 'OPAQ':
            case 'CMAP':
            // Surface node CHUNKS skipped
            // These mainly specify the node editor setup in LW
            case 'NLOC':
            case 'NZOM':
            case 'NVER':
            case 'NSRV':
            case 'NVSK':
            case 'NCRD':
            case 'WRPW':
            case 'WRPH':
            case 'NMOD':
            case 'NSEL':
            case 'NPRW':
            case 'NPLA':
            case 'NODS':
            case 'VERS':
            case 'ENUM':
            case 'TAG ':
            case 'OPAC':
            // Car Material CHUNKS
            case 'CGMD':
            case 'CGTY':
            case 'CGST':
            case 'CGEN':
            case 'CGTS':
            case 'CGTE':
            case 'OSMP':
            case 'OMDE':
            case 'OUTR':
            case 'FLAG':
            case 'TRNL':
            case 'GLOW':
            case 'GVAL':
            case 'SHRP':
            case 'RFOP':
            case 'RSAN':
            case 'TROP':
            case 'RBLR':
            case 'TBLR':
            case 'CLRH':
            case 'CLRF':
            case 'ADTR':
            case 'LINE':
            case 'ALPH':
            case 'VCOL':
            case 'ENAB':
                this.IFF.debugger.skipped = true;
                this.IFF.reader.skip(length);
                break;
            case 'SURF':
                this.IFF.parseSurfaceLwo2(length);
                break;
            case 'CLIP':
                this.IFF.parseClipLwo2(length);
                break;
            // Texture node chunks (not in spec)
            case 'IPIX':
            case 'IMIP':
            case 'IMOD':
            case 'AMOD':
            case 'IINV':
            case 'INCR':
            case 'IAXS':
            case 'IFOT':
            case 'ITIM':
            case 'IWRL':
            case 'IUTI':
            case 'IINX':
            case 'IINY':
            case 'IINZ':
            case 'IREF':
                if (length === 4) this.IFF.currentNode[blockID] = this.IFF.reader.getInt32();
                else this.IFF.reader.skip(length);
                break;
            case 'OTAG':
                this.IFF.parseObjectTag();
                break;
            case 'LAYR':
                this.IFF.parseLayer(length);
                break;
            case 'PNTS':
                this.IFF.parsePoints(length);
                break;
            case 'VMAP':
                this.IFF.parseVertexMapping(length);
                break;
            case 'AUVU':
            case 'AUVN':
                this.IFF.reader.skip(length - 1);
                this.IFF.reader.getVariableLengthIndex(); // VX
                break;
            case 'POLS':
                this.IFF.parsePolygonList(length);
                break;
            case 'TAGS':
                this.IFF.parseTagStrings(length);
                break;
            case 'PTAG':
                this.IFF.parsePolygonTagMapping(length);
                break;
            case 'VMAD':
                this.IFF.parseVertexMapping(length, true);
                break;
            // Misc CHUNKS
            case 'DESC':
                this.IFF.currentForm.description = this.IFF.reader.getString();
                break;
            case 'TEXT':
            case 'CMNT':
            case 'NCOM':
                this.IFF.currentForm.comment = this.IFF.reader.getString();
                break;
            // Envelope Form
            case 'NAME':
                this.IFF.currentForm.channelName = this.IFF.reader.getString();
                break;
            // Image Map Layer
            case 'WRAP':
                this.IFF.currentForm.wrap = {
                    w: this.IFF.reader.getUint16(),
                    h: this.IFF.reader.getUint16()
                };
                break;
            case 'IMAG':
                const index = this.IFF.reader.getVariableLengthIndex();
                this.IFF.currentForm.imageIndex = index;
                break;
            // Texture Mapping Form
            case 'OREF':
                this.IFF.currentForm.referenceObject = this.IFF.reader.getString();
                break;
            case 'ROID':
                this.IFF.currentForm.referenceObjectID = this.IFF.reader.getUint32();
                break;
            // Surface Blocks
            case 'SSHN':
                this.IFF.currentSurface.surfaceShaderName = this.IFF.reader.getString();
                break;
            case 'AOVN':
                this.IFF.currentSurface.surfaceCustomAOVName = this.IFF.reader.getString();
                break;
            // Nodal Blocks
            case 'NSTA':
                this.IFF.currentForm.disabled = this.IFF.reader.getUint16();
                break;
            case 'NRNM':
                this.IFF.currentForm.realName = this.IFF.reader.getString();
                break;
            case 'NNME':
                this.IFF.currentForm.refName = this.IFF.reader.getString();
                this.IFF.currentSurface.nodes[this.IFF.currentForm.refName] = this.IFF.currentForm;
                break;
            // Nodal Blocks : connections
            case 'INME':
                if (!this.IFF.currentForm.nodeName) this.IFF.currentForm.nodeName = [];
                this.IFF.currentForm.nodeName.push(this.IFF.reader.getString());
                break;
            case 'IINN':
                if (!this.IFF.currentForm.inputNodeName) this.IFF.currentForm.inputNodeName = [];
                this.IFF.currentForm.inputNodeName.push(this.IFF.reader.getString());
                break;
            case 'IINM':
                if (!this.IFF.currentForm.inputName) this.IFF.currentForm.inputName = [];
                this.IFF.currentForm.inputName.push(this.IFF.reader.getString());
                break;
            case 'IONM':
                if (!this.IFF.currentForm.inputOutputName) this.IFF.currentForm.inputOutputName = [];
                this.IFF.currentForm.inputOutputName.push(this.IFF.reader.getString());
                break;
            case 'FNAM':
                this.IFF.currentForm.fileName = this.IFF.reader.getString();
                break;
            case 'CHAN':
                if (length === 4) this.IFF.currentForm.textureChannel = this.IFF.reader.getIDTag();
                else this.IFF.reader.skip(length);
                break;
            // LWO2 Spec chunks: these are needed since the SURF FORMs are often in LWO2 format
            case 'SMAN':
                const maxSmoothingAngle = this.IFF.reader.getFloat32();
                this.IFF.currentSurface.attributes.smooth = maxSmoothingAngle < 0 ? false : true;
                break;
            // LWO2: Basic Surface Parameters
            case 'COLR':
                this.IFF.currentSurface.attributes.Color = {
                    value: this.IFF.reader.getFloat32Array(3)
                };
                this.IFF.reader.skip(2); // VX: envelope
                break;
            case 'LUMI':
                this.IFF.currentSurface.attributes.Luminosity = {
                    value: this.IFF.reader.getFloat32()
                };
                this.IFF.reader.skip(2);
                break;
            case 'SPEC':
                this.IFF.currentSurface.attributes.Specular = {
                    value: this.IFF.reader.getFloat32()
                };
                this.IFF.reader.skip(2);
                break;
            case 'DIFF':
                this.IFF.currentSurface.attributes.Diffuse = {
                    value: this.IFF.reader.getFloat32()
                };
                this.IFF.reader.skip(2);
                break;
            case 'REFL':
                this.IFF.currentSurface.attributes.Reflection = {
                    value: this.IFF.reader.getFloat32()
                };
                this.IFF.reader.skip(2);
                break;
            case 'GLOS':
                this.IFF.currentSurface.attributes.Glossiness = {
                    value: this.IFF.reader.getFloat32()
                };
                this.IFF.reader.skip(2);
                break;
            case 'TRAN':
                this.IFF.currentSurface.attributes.opacity = this.IFF.reader.getFloat32();
                this.IFF.reader.skip(2);
                break;
            case 'BUMP':
                this.IFF.currentSurface.attributes.bumpStrength = this.IFF.reader.getFloat32();
                this.IFF.reader.skip(2);
                break;
            case 'SIDE':
                this.IFF.currentSurface.attributes.side = this.IFF.reader.getUint16();
                break;
            case 'RIMG':
                this.IFF.currentSurface.attributes.reflectionMap = this.IFF.reader.getVariableLengthIndex();
                break;
            case 'RIND':
                this.IFF.currentSurface.attributes.refractiveIndex = this.IFF.reader.getFloat32();
                this.IFF.reader.skip(2);
                break;
            case 'TIMG':
                this.IFF.currentSurface.attributes.refractionMap = this.IFF.reader.getVariableLengthIndex();
                break;
            case 'IMAP':
                this.IFF.reader.skip(2);
                break;
            case 'TMAP':
                this.IFF.debugger.skipped = true;
                this.IFF.reader.skip(length); // needs implementing
                break;
            case 'IUVI':
                this.IFF.currentNode.UVChannel = this.IFF.reader.getString(length);
                break;
            case 'IUTL':
                this.IFF.currentNode.widthWrappingMode = this.IFF.reader.getUint32();
                break;
            case 'IVTL':
                this.IFF.currentNode.heightWrappingMode = this.IFF.reader.getUint32();
                break;
            // LWO2 USE
            case 'BLOK':
                break;
            default:
                this.IFF.parseUnknownCHUNK(blockID, length);
        }
        if (blockID != 'FORM') {
            this.IFF.debugger.node = 1;
            this.IFF.debugger.nodeID = blockID;
            this.IFF.debugger.log();
        }
        if (this.IFF.reader.offset >= this.IFF.currentFormEnd) this.IFF.currentForm = this.IFF.parentForm;
    }
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"7wkiM":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "LWO3Parser", ()=>LWO3Parser);
class LWO3Parser {
    constructor(IFFParser){
        this.IFF = IFFParser;
    }
    parseBlock() {
        this.IFF.debugger.offset = this.IFF.reader.offset;
        this.IFF.debugger.closeForms();
        const blockID = this.IFF.reader.getIDTag();
        const length = this.IFF.reader.getUint32(); // size of data in bytes
        this.IFF.debugger.dataOffset = this.IFF.reader.offset;
        this.IFF.debugger.length = length;
        // Data types may be found in either LWO2 OR LWO3 spec
        switch(blockID){
            case 'FORM':
                this.IFF.parseForm(length);
                break;
            // SKIPPED CHUNKS
            // MISC skipped
            case 'ICON':
            case 'VMPA':
            case 'BBOX':
            // case 'VMMD':
            // case 'VTYP':
            // normal maps can be specified, normally on models imported from other applications. Currently ignored
            case 'NORM':
            // ENVL FORM skipped
            case 'PRE ':
            case 'POST':
            case 'KEY ':
            case 'SPAN':
            // CLIP FORM skipped
            case 'TIME':
            case 'CLRS':
            case 'CLRA':
            case 'FILT':
            case 'DITH':
            case 'CONT':
            case 'BRIT':
            case 'SATR':
            case 'HUE ':
            case 'GAMM':
            case 'NEGA':
            case 'IFLT':
            case 'PFLT':
            // Image Map Layer skipped
            case 'PROJ':
            case 'AXIS':
            case 'AAST':
            case 'PIXB':
            case 'STCK':
            // Procedural Textures skipped
            case 'VALU':
            // Gradient Textures skipped
            case 'PNAM':
            case 'INAM':
            case 'GRST':
            case 'GREN':
            case 'GRPT':
            case 'FKEY':
            case 'IKEY':
            // Texture Mapping Form skipped
            case 'CSYS':
            // Surface CHUNKs skipped
            case 'OPAQ':
            case 'CMAP':
            // Surface node CHUNKS skipped
            // These mainly specify the node editor setup in LW
            case 'NLOC':
            case 'NZOM':
            case 'NVER':
            case 'NSRV':
            case 'NCRD':
            case 'NMOD':
            case 'NSEL':
            case 'NPRW':
            case 'NPLA':
            case 'VERS':
            case 'ENUM':
            case 'TAG ':
            // Car Material CHUNKS
            case 'CGMD':
            case 'CGTY':
            case 'CGST':
            case 'CGEN':
            case 'CGTS':
            case 'CGTE':
            case 'OSMP':
            case 'OMDE':
            case 'OUTR':
            case 'FLAG':
            case 'TRNL':
            case 'SHRP':
            case 'RFOP':
            case 'RSAN':
            case 'TROP':
            case 'RBLR':
            case 'TBLR':
            case 'CLRH':
            case 'CLRF':
            case 'ADTR':
            case 'GLOW':
            case 'LINE':
            case 'ALPH':
            case 'VCOL':
            case 'ENAB':
                this.IFF.debugger.skipped = true;
                this.IFF.reader.skip(length);
                break;
            // Texture node chunks (not in spec)
            case 'IPIX':
            case 'IMIP':
            case 'IMOD':
            case 'AMOD':
            case 'IINV':
            case 'INCR':
            case 'IAXS':
            case 'IFOT':
            case 'ITIM':
            case 'IWRL':
            case 'IUTI':
            case 'IINX':
            case 'IINY':
            case 'IINZ':
            case 'IREF':
                if (length === 4) this.IFF.currentNode[blockID] = this.IFF.reader.getInt32();
                else this.IFF.reader.skip(length);
                break;
            case 'OTAG':
                this.IFF.parseObjectTag();
                break;
            case 'LAYR':
                this.IFF.parseLayer(length);
                break;
            case 'PNTS':
                this.IFF.parsePoints(length);
                break;
            case 'VMAP':
                this.IFF.parseVertexMapping(length);
                break;
            case 'POLS':
                this.IFF.parsePolygonList(length);
                break;
            case 'TAGS':
                this.IFF.parseTagStrings(length);
                break;
            case 'PTAG':
                this.IFF.parsePolygonTagMapping(length);
                break;
            case 'VMAD':
                this.IFF.parseVertexMapping(length, true);
                break;
            // Misc CHUNKS
            case 'DESC':
                this.IFF.currentForm.description = this.IFF.reader.getString();
                break;
            case 'TEXT':
            case 'CMNT':
            case 'NCOM':
                this.IFF.currentForm.comment = this.IFF.reader.getString();
                break;
            // Envelope Form
            case 'NAME':
                this.IFF.currentForm.channelName = this.IFF.reader.getString();
                break;
            // Image Map Layer
            case 'WRAP':
                this.IFF.currentForm.wrap = {
                    w: this.IFF.reader.getUint16(),
                    h: this.IFF.reader.getUint16()
                };
                break;
            case 'IMAG':
                const index = this.IFF.reader.getVariableLengthIndex();
                this.IFF.currentForm.imageIndex = index;
                break;
            // Texture Mapping Form
            case 'OREF':
                this.IFF.currentForm.referenceObject = this.IFF.reader.getString();
                break;
            case 'ROID':
                this.IFF.currentForm.referenceObjectID = this.IFF.reader.getUint32();
                break;
            // Surface Blocks
            case 'SSHN':
                this.IFF.currentSurface.surfaceShaderName = this.IFF.reader.getString();
                break;
            case 'AOVN':
                this.IFF.currentSurface.surfaceCustomAOVName = this.IFF.reader.getString();
                break;
            // Nodal Blocks
            case 'NSTA':
                this.IFF.currentForm.disabled = this.IFF.reader.getUint16();
                break;
            case 'NRNM':
                this.IFF.currentForm.realName = this.IFF.reader.getString();
                break;
            case 'NNME':
                this.IFF.currentForm.refName = this.IFF.reader.getString();
                this.IFF.currentSurface.nodes[this.IFF.currentForm.refName] = this.IFF.currentForm;
                break;
            // Nodal Blocks : connections
            case 'INME':
                if (!this.IFF.currentForm.nodeName) this.IFF.currentForm.nodeName = [];
                this.IFF.currentForm.nodeName.push(this.IFF.reader.getString());
                break;
            case 'IINN':
                if (!this.IFF.currentForm.inputNodeName) this.IFF.currentForm.inputNodeName = [];
                this.IFF.currentForm.inputNodeName.push(this.IFF.reader.getString());
                break;
            case 'IINM':
                if (!this.IFF.currentForm.inputName) this.IFF.currentForm.inputName = [];
                this.IFF.currentForm.inputName.push(this.IFF.reader.getString());
                break;
            case 'IONM':
                if (!this.IFF.currentForm.inputOutputName) this.IFF.currentForm.inputOutputName = [];
                this.IFF.currentForm.inputOutputName.push(this.IFF.reader.getString());
                break;
            case 'FNAM':
                this.IFF.currentForm.fileName = this.IFF.reader.getString();
                break;
            case 'CHAN':
                if (length === 4) this.IFF.currentForm.textureChannel = this.IFF.reader.getIDTag();
                else this.IFF.reader.skip(length);
                break;
            // LWO2 Spec chunks: these are needed since the SURF FORMs are often in LWO2 format
            case 'SMAN':
                const maxSmoothingAngle = this.IFF.reader.getFloat32();
                this.IFF.currentSurface.attributes.smooth = maxSmoothingAngle < 0 ? false : true;
                break;
            // LWO2: Basic Surface Parameters
            case 'COLR':
                this.IFF.currentSurface.attributes.Color = {
                    value: this.IFF.reader.getFloat32Array(3)
                };
                this.IFF.reader.skip(2); // VX: envelope
                break;
            case 'LUMI':
                this.IFF.currentSurface.attributes.Luminosity = {
                    value: this.IFF.reader.getFloat32()
                };
                this.IFF.reader.skip(2);
                break;
            case 'SPEC':
                this.IFF.currentSurface.attributes.Specular = {
                    value: this.IFF.reader.getFloat32()
                };
                this.IFF.reader.skip(2);
                break;
            case 'DIFF':
                this.IFF.currentSurface.attributes.Diffuse = {
                    value: this.IFF.reader.getFloat32()
                };
                this.IFF.reader.skip(2);
                break;
            case 'REFL':
                this.IFF.currentSurface.attributes.Reflection = {
                    value: this.IFF.reader.getFloat32()
                };
                this.IFF.reader.skip(2);
                break;
            case 'GLOS':
                this.IFF.currentSurface.attributes.Glossiness = {
                    value: this.IFF.reader.getFloat32()
                };
                this.IFF.reader.skip(2);
                break;
            case 'TRAN':
                this.IFF.currentSurface.attributes.opacity = this.IFF.reader.getFloat32();
                this.IFF.reader.skip(2);
                break;
            case 'BUMP':
                this.IFF.currentSurface.attributes.bumpStrength = this.IFF.reader.getFloat32();
                this.IFF.reader.skip(2);
                break;
            case 'SIDE':
                this.IFF.currentSurface.attributes.side = this.IFF.reader.getUint16();
                break;
            case 'RIMG':
                this.IFF.currentSurface.attributes.reflectionMap = this.IFF.reader.getVariableLengthIndex();
                break;
            case 'RIND':
                this.IFF.currentSurface.attributes.refractiveIndex = this.IFF.reader.getFloat32();
                this.IFF.reader.skip(2);
                break;
            case 'TIMG':
                this.IFF.currentSurface.attributes.refractionMap = this.IFF.reader.getVariableLengthIndex();
                break;
            case 'IMAP':
                this.IFF.currentSurface.attributes.imageMapIndex = this.IFF.reader.getUint32();
                break;
            case 'IUVI':
                this.IFF.currentNode.UVChannel = this.IFF.reader.getString(length);
                break;
            case 'IUTL':
                this.IFF.currentNode.widthWrappingMode = this.IFF.reader.getUint32();
                break;
            case 'IVTL':
                this.IFF.currentNode.heightWrappingMode = this.IFF.reader.getUint32();
                break;
            default:
                this.IFF.parseUnknownCHUNK(blockID, length);
        }
        if (blockID != 'FORM') {
            this.IFF.debugger.node = 1;
            this.IFF.debugger.nodeID = blockID;
            this.IFF.debugger.log();
        }
        if (this.IFF.reader.offset >= this.IFF.currentFormEnd) this.IFF.currentForm = this.IFF.parentForm;
    }
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}]},["1RMTw"], null, "parcelRequire6840", {})

//# sourceMappingURL=LWOLoader.acbdc3c1.js.map
