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
})({"hDYvs":[function(require,module,exports,__globalThis) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SERVER_PORT = 1234;
var HMR_SECURE = false;
var HMR_ENV_HASH = "439701173a9199ea";
var HMR_USE_SSE = false;
module.bundle.HMR_BUNDLE_ID = "4e8b86cada86d394";
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

},{}],"dDIX9":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "FBXLoader", ()=>FBXLoader);
var _three = require("three");
var _fflateModuleJs = require("../libs/fflate.module.js");
var _nurbscurveJs = require("../curves/NURBSCurve.js");
let fbxTree;
let connections;
let sceneGraph;
/**
 * A loader for the FBX format.
 *
 * Requires FBX file to be >= 7.0 and in ASCII or >= 6400 in Binary format.
 * Versions lower than this may load but will probably have errors.
 *
 * Needs Support:
 * - Morph normals / blend shape normals
 *
 * FBX format references:
 * - [C++ SDK reference](https://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref_index_html)
 *
 * Binary format specification:
 * - [FBX binary file format specification](https://code.blender.org/2013/08/fbx-binary-file-format-specification/)
 *
 * ```js
 * const loader = new FBXLoader();
 * const object = await loader.loadAsync( 'models/fbx/stanford-bunny.fbx' );
 * scene.add( object );
 * ```
 *
 * @augments Loader
 * @three_import import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
 */ class FBXLoader extends (0, _three.Loader) {
    /**
	 * Constructs a new FBX loader.
	 *
	 * @param {LoadingManager} [manager] - The loading manager.
	 */ constructor(manager){
        super(manager);
    }
    /**
	 * Starts loading from the given URL and passes the loaded FBX asset
	 * to the `onLoad()` callback.
	 *
	 * @param {string} url - The path/URL of the file to be loaded. This can also be a data URI.
	 * @param {function(Group)} onLoad - Executed when the loading process has been finished.
	 * @param {onProgressCallback} onProgress - Executed while the loading is in progress.
	 * @param {onErrorCallback} onError - Executed when errors occur.
	 */ load(url, onLoad, onProgress, onError) {
        const scope = this;
        const path = scope.path === '' ? (0, _three.LoaderUtils).extractUrlBase(url) : scope.path;
        const loader = new (0, _three.FileLoader)(this.manager);
        loader.setPath(scope.path);
        loader.setResponseType('arraybuffer');
        loader.setRequestHeader(scope.requestHeader);
        loader.setWithCredentials(scope.withCredentials);
        loader.load(url, function(buffer) {
            try {
                onLoad(scope.parse(buffer, path));
            } catch (e) {
                if (onError) onError(e);
                else console.error(e);
                scope.manager.itemError(url);
            }
        }, onProgress, onError);
    }
    /**
	 * Parses the given FBX data and returns the resulting group.
	 *
	 * @param {ArrayBuffer} FBXBuffer - The raw FBX data as an array buffer.
	 * @param {string} path - The URL base path.
	 * @return {Group} An object representing the parsed asset.
	 */ parse(FBXBuffer, path) {
        if (isFbxFormatBinary(FBXBuffer)) fbxTree = new BinaryParser().parse(FBXBuffer);
        else {
            const FBXText = convertArrayBufferToString(FBXBuffer);
            if (!isFbxFormatASCII(FBXText)) throw new Error('THREE.FBXLoader: Unknown format.');
            if (getFbxVersion(FBXText) < 7000) throw new Error('THREE.FBXLoader: FBX version not supported, FileVersion: ' + getFbxVersion(FBXText));
            fbxTree = new TextParser().parse(FBXText);
        }
        // console.log( fbxTree );
        const textureLoader = new (0, _three.TextureLoader)(this.manager).setPath(this.resourcePath || path).setCrossOrigin(this.crossOrigin);
        return new FBXTreeParser(textureLoader, this.manager).parse(fbxTree);
    }
}
// Parse the FBXTree object returned by the BinaryParser or TextParser and return a Group
class FBXTreeParser {
    constructor(textureLoader, manager){
        this.textureLoader = textureLoader;
        this.manager = manager;
    }
    parse() {
        connections = this.parseConnections();
        const images = this.parseImages();
        const textures = this.parseTextures(images);
        const materials = this.parseMaterials(textures);
        const deformers = this.parseDeformers();
        const geometryMap = new GeometryParser().parse(deformers);
        this.parseScene(deformers, geometryMap, materials);
        return sceneGraph;
    }
    // Parses FBXTree.Connections which holds parent-child connections between objects (e.g. material -> texture, model->geometry )
    // and details the connection type
    parseConnections() {
        const connectionMap = new Map();
        if ('Connections' in fbxTree) {
            const rawConnections = fbxTree.Connections.connections;
            rawConnections.forEach(function(rawConnection) {
                const fromID = rawConnection[0];
                const toID = rawConnection[1];
                const relationship = rawConnection[2];
                if (!connectionMap.has(fromID)) connectionMap.set(fromID, {
                    parents: [],
                    children: []
                });
                const parentRelationship = {
                    ID: toID,
                    relationship: relationship
                };
                connectionMap.get(fromID).parents.push(parentRelationship);
                if (!connectionMap.has(toID)) connectionMap.set(toID, {
                    parents: [],
                    children: []
                });
                const childRelationship = {
                    ID: fromID,
                    relationship: relationship
                };
                connectionMap.get(toID).children.push(childRelationship);
            });
        }
        return connectionMap;
    }
    // Parse FBXTree.Objects.Video for embedded image data
    // These images are connected to textures in FBXTree.Objects.Textures
    // via FBXTree.Connections.
    parseImages() {
        const images = {};
        const blobs = {};
        if ('Video' in fbxTree.Objects) {
            const videoNodes = fbxTree.Objects.Video;
            for(const nodeID in videoNodes){
                const videoNode = videoNodes[nodeID];
                const id = parseInt(nodeID);
                images[id] = videoNode.RelativeFilename || videoNode.Filename;
                // raw image data is in videoNode.Content
                if ('Content' in videoNode) {
                    const arrayBufferContent = videoNode.Content instanceof ArrayBuffer && videoNode.Content.byteLength > 0;
                    const base64Content = typeof videoNode.Content === 'string' && videoNode.Content !== '';
                    if (arrayBufferContent || base64Content) {
                        const image = this.parseImage(videoNodes[nodeID]);
                        blobs[videoNode.RelativeFilename || videoNode.Filename] = image;
                    }
                }
            }
        }
        for(const id in images){
            const filename = images[id];
            if (blobs[filename] !== undefined) images[id] = blobs[filename];
            else images[id] = images[id].split('\\').pop();
        }
        return images;
    }
    // Parse embedded image data in FBXTree.Video.Content
    parseImage(videoNode) {
        const content = videoNode.Content;
        const fileName = videoNode.RelativeFilename || videoNode.Filename;
        const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
        let type;
        switch(extension){
            case 'bmp':
                type = 'image/bmp';
                break;
            case 'jpg':
            case 'jpeg':
                type = 'image/jpeg';
                break;
            case 'png':
                type = 'image/png';
                break;
            case 'tif':
                type = 'image/tiff';
                break;
            case 'tga':
                if (this.manager.getHandler('.tga') === null) console.warn('FBXLoader: TGA loader not found, skipping ', fileName);
                type = 'image/tga';
                break;
            case 'webp':
                type = 'image/webp';
                break;
            default:
                console.warn('FBXLoader: Image type "' + extension + '" is not supported.');
                return;
        }
        if (typeof content === 'string') return 'data:' + type + ';base64,' + content;
        else {
            const array = new Uint8Array(content);
            return window.URL.createObjectURL(new Blob([
                array
            ], {
                type: type
            }));
        }
    }
    // Parse nodes in FBXTree.Objects.Texture
    // These contain details such as UV scaling, cropping, rotation etc and are connected
    // to images in FBXTree.Objects.Video
    parseTextures(images) {
        const textureMap = new Map();
        if ('Texture' in fbxTree.Objects) {
            const textureNodes = fbxTree.Objects.Texture;
            for(const nodeID in textureNodes){
                const texture = this.parseTexture(textureNodes[nodeID], images);
                textureMap.set(parseInt(nodeID), texture);
            }
        }
        return textureMap;
    }
    // Parse individual node in FBXTree.Objects.Texture
    parseTexture(textureNode, images) {
        const texture = this.loadTexture(textureNode, images);
        texture.ID = textureNode.id;
        texture.name = textureNode.attrName;
        const wrapModeU = textureNode.WrapModeU;
        const wrapModeV = textureNode.WrapModeV;
        const valueU = wrapModeU !== undefined ? wrapModeU.value : 0;
        const valueV = wrapModeV !== undefined ? wrapModeV.value : 0;
        // http://download.autodesk.com/us/fbx/SDKdocs/FBX_SDK_Help/files/fbxsdkref/class_k_fbx_texture.html#889640e63e2e681259ea81061b85143a
        // 0: repeat(default), 1: clamp
        texture.wrapS = valueU === 0 ? (0, _three.RepeatWrapping) : (0, _three.ClampToEdgeWrapping);
        texture.wrapT = valueV === 0 ? (0, _three.RepeatWrapping) : (0, _three.ClampToEdgeWrapping);
        if ('Scaling' in textureNode) {
            const values = textureNode.Scaling.value;
            texture.repeat.x = values[0];
            texture.repeat.y = values[1];
        }
        if ('Translation' in textureNode) {
            const values = textureNode.Translation.value;
            texture.offset.x = values[0];
            texture.offset.y = values[1];
        }
        return texture;
    }
    // load a texture specified as a blob or data URI, or via an external URL using TextureLoader
    loadTexture(textureNode, images) {
        const extension = textureNode.FileName.split('.').pop().toLowerCase();
        let loader = this.manager.getHandler(`.${extension}`);
        if (loader === null) loader = this.textureLoader;
        const loaderPath = loader.path;
        if (!loaderPath) loader.setPath(this.textureLoader.path);
        const children = connections.get(textureNode.id).children;
        let fileName;
        if (children !== undefined && children.length > 0 && images[children[0].ID] !== undefined) {
            fileName = images[children[0].ID];
            if (fileName.indexOf('blob:') === 0 || fileName.indexOf('data:') === 0) loader.setPath(undefined);
        }
        if (fileName === undefined) {
            console.warn('FBXLoader: Undefined filename, creating placeholder texture.');
            return new (0, _three.Texture)();
        }
        const texture = loader.load(fileName);
        // revert to initial path
        loader.setPath(loaderPath);
        return texture;
    }
    // Parse nodes in FBXTree.Objects.Material
    parseMaterials(textureMap) {
        const materialMap = new Map();
        if ('Material' in fbxTree.Objects) {
            const materialNodes = fbxTree.Objects.Material;
            for(const nodeID in materialNodes){
                const material = this.parseMaterial(materialNodes[nodeID], textureMap);
                if (material !== null) materialMap.set(parseInt(nodeID), material);
            }
        }
        return materialMap;
    }
    // Parse single node in FBXTree.Objects.Material
    // Materials are connected to texture maps in FBXTree.Objects.Textures
    // FBX format currently only supports Lambert and Phong shading models
    parseMaterial(materialNode, textureMap) {
        const ID = materialNode.id;
        const name = materialNode.attrName;
        let type = materialNode.ShadingModel;
        // Case where FBX wraps shading model in property object.
        if (typeof type === 'object') type = type.value;
        // Ignore unused materials which don't have any connections.
        if (!connections.has(ID)) return null;
        const parameters = this.parseParameters(materialNode, textureMap, ID);
        let material;
        switch(type.toLowerCase()){
            case 'phong':
                material = new (0, _three.MeshPhongMaterial)();
                break;
            case 'lambert':
                material = new (0, _three.MeshLambertMaterial)();
                break;
            default:
                console.warn('THREE.FBXLoader: unknown material type "%s". Defaulting to MeshPhongMaterial.', type);
                material = new (0, _three.MeshPhongMaterial)();
                break;
        }
        material.setValues(parameters);
        material.name = name;
        return material;
    }
    // Parse FBX material and return parameters suitable for a three.js material
    // Also parse the texture map and return any textures associated with the material
    parseParameters(materialNode, textureMap, ID) {
        const parameters = {};
        if (materialNode.BumpFactor) parameters.bumpScale = materialNode.BumpFactor.value;
        if (materialNode.Diffuse) parameters.color = (0, _three.ColorManagement).colorSpaceToWorking(new (0, _three.Color)().fromArray(materialNode.Diffuse.value), (0, _three.SRGBColorSpace));
        else if (materialNode.DiffuseColor && (materialNode.DiffuseColor.type === 'Color' || materialNode.DiffuseColor.type === 'ColorRGB')) // The blender exporter exports diffuse here instead of in materialNode.Diffuse
        parameters.color = (0, _three.ColorManagement).colorSpaceToWorking(new (0, _three.Color)().fromArray(materialNode.DiffuseColor.value), (0, _three.SRGBColorSpace));
        if (materialNode.DisplacementFactor) parameters.displacementScale = materialNode.DisplacementFactor.value;
        if (materialNode.Emissive) parameters.emissive = (0, _three.ColorManagement).colorSpaceToWorking(new (0, _three.Color)().fromArray(materialNode.Emissive.value), (0, _three.SRGBColorSpace));
        else if (materialNode.EmissiveColor && (materialNode.EmissiveColor.type === 'Color' || materialNode.EmissiveColor.type === 'ColorRGB')) // The blender exporter exports emissive color here instead of in materialNode.Emissive
        parameters.emissive = (0, _three.ColorManagement).colorSpaceToWorking(new (0, _three.Color)().fromArray(materialNode.EmissiveColor.value), (0, _three.SRGBColorSpace));
        if (materialNode.EmissiveFactor) parameters.emissiveIntensity = parseFloat(materialNode.EmissiveFactor.value);
        // the transparency handling is implemented based on Blender's approach:
        // https://github.com/blender/blender/blob/main/scripts/addons_core/io_scene_fbx/import_fbx.py
        parameters.opacity = 1 - (materialNode.TransparencyFactor ? parseFloat(materialNode.TransparencyFactor.value) : 0);
        if (parameters.opacity === 1 || parameters.opacity === 0) {
            parameters.opacity = materialNode.Opacity ? parseFloat(materialNode.Opacity.value) : null;
            if (parameters.opacity === null) // Default to opaque. Some exporters (e.g. 3ds Max) define TransparentColor
            // as white (1,1,1) without intending transparency, which makes the Unity-style
            // fallback of `1 - TransparentColor.r` produce incorrect zero opacity.
            parameters.opacity = 1;
        }
        if (parameters.opacity < 1.0) parameters.transparent = true;
        if (materialNode.ReflectionFactor) parameters.reflectivity = materialNode.ReflectionFactor.value;
        if (materialNode.Shininess) parameters.shininess = materialNode.Shininess.value;
        if (materialNode.Specular) parameters.specular = (0, _three.ColorManagement).colorSpaceToWorking(new (0, _three.Color)().fromArray(materialNode.Specular.value), (0, _three.SRGBColorSpace));
        else if (materialNode.SpecularColor && materialNode.SpecularColor.type === 'Color') // The blender exporter exports specular color here instead of in materialNode.Specular
        parameters.specular = (0, _three.ColorManagement).colorSpaceToWorking(new (0, _three.Color)().fromArray(materialNode.SpecularColor.value), (0, _three.SRGBColorSpace));
        const scope = this;
        connections.get(ID).children.forEach(function(child) {
            const type = child.relationship;
            switch(type){
                case 'Bump':
                    parameters.bumpMap = scope.getTexture(textureMap, child.ID);
                    break;
                case 'Maya|TEX_ao_map':
                    parameters.aoMap = scope.getTexture(textureMap, child.ID);
                    break;
                case 'DiffuseColor':
                case 'Maya|TEX_color_map':
                    parameters.map = scope.getTexture(textureMap, child.ID);
                    if (parameters.map !== undefined) parameters.map.colorSpace = (0, _three.SRGBColorSpace);
                    break;
                case 'DisplacementColor':
                    parameters.displacementMap = scope.getTexture(textureMap, child.ID);
                    break;
                case 'EmissiveColor':
                    parameters.emissiveMap = scope.getTexture(textureMap, child.ID);
                    if (parameters.emissiveMap !== undefined) parameters.emissiveMap.colorSpace = (0, _three.SRGBColorSpace);
                    break;
                case 'NormalMap':
                case 'Maya|TEX_normal_map':
                    parameters.normalMap = scope.getTexture(textureMap, child.ID);
                    break;
                case 'ReflectionColor':
                    parameters.envMap = scope.getTexture(textureMap, child.ID);
                    if (parameters.envMap !== undefined) {
                        parameters.envMap.mapping = (0, _three.EquirectangularReflectionMapping);
                        parameters.envMap.colorSpace = (0, _three.SRGBColorSpace);
                    }
                    break;
                case 'SpecularColor':
                    parameters.specularMap = scope.getTexture(textureMap, child.ID);
                    if (parameters.specularMap !== undefined) parameters.specularMap.colorSpace = (0, _three.SRGBColorSpace);
                    break;
                case 'TransparentColor':
                case 'TransparencyFactor':
                    parameters.alphaMap = scope.getTexture(textureMap, child.ID);
                    parameters.transparent = true;
                    break;
                case 'AmbientColor':
                case 'ShininessExponent':
                case 'SpecularFactor':
                case 'VectorDisplacementColor':
                default:
                    console.warn('THREE.FBXLoader: %s map is not supported in three.js, skipping texture.', type);
                    break;
            }
        });
        return parameters;
    }
    // get a texture from the textureMap for use by a material.
    getTexture(textureMap, id) {
        // if the texture is a layered texture, just use the first layer and issue a warning
        if ('LayeredTexture' in fbxTree.Objects && id in fbxTree.Objects.LayeredTexture) {
            console.warn('THREE.FBXLoader: layered textures are not supported in three.js. Discarding all but first layer.');
            id = connections.get(id).children[0].ID;
        }
        return textureMap.get(id);
    }
    // Parse nodes in FBXTree.Objects.Deformer
    // Deformer node can contain skinning or Vertex Cache animation data, however only skinning is supported here
    // Generates map of Skeleton-like objects for use later when generating and binding skeletons.
    parseDeformers() {
        const skeletons = {};
        const morphTargets = {};
        if ('Deformer' in fbxTree.Objects) {
            const DeformerNodes = fbxTree.Objects.Deformer;
            for(const nodeID in DeformerNodes){
                const deformerNode = DeformerNodes[nodeID];
                const relationships = connections.get(parseInt(nodeID));
                if (deformerNode.attrType === 'Skin') {
                    const skeleton = this.parseSkeleton(relationships, DeformerNodes);
                    skeleton.ID = nodeID;
                    if (relationships.parents.length > 1) console.warn('THREE.FBXLoader: skeleton attached to more than one geometry is not supported.');
                    skeleton.geometryID = relationships.parents[0].ID;
                    skeletons[nodeID] = skeleton;
                } else if (deformerNode.attrType === 'BlendShape') {
                    const morphTarget = {
                        id: nodeID
                    };
                    morphTarget.rawTargets = this.parseMorphTargets(relationships, DeformerNodes);
                    morphTarget.id = nodeID;
                    if (relationships.parents.length > 1) console.warn('THREE.FBXLoader: morph target attached to more than one geometry is not supported.');
                    morphTargets[nodeID] = morphTarget;
                }
            }
        }
        return {
            skeletons: skeletons,
            morphTargets: morphTargets
        };
    }
    // Parse single nodes in FBXTree.Objects.Deformer
    // The top level skeleton node has type 'Skin' and sub nodes have type 'Cluster'
    // Each skin node represents a skeleton and each cluster node represents a bone
    parseSkeleton(relationships, deformerNodes) {
        const rawBones = [];
        relationships.children.forEach(function(child) {
            const boneNode = deformerNodes[child.ID];
            if (boneNode.attrType !== 'Cluster') return;
            const rawBone = {
                ID: child.ID,
                indices: [],
                weights: [],
                transformLink: new (0, _three.Matrix4)().fromArray(boneNode.TransformLink.a)
            };
            if ('Indexes' in boneNode) {
                rawBone.indices = boneNode.Indexes.a;
                rawBone.weights = boneNode.Weights.a;
            }
            rawBones.push(rawBone);
        });
        return {
            rawBones: rawBones,
            bones: []
        };
    }
    // The top level morph deformer node has type "BlendShape" and sub nodes have type "BlendShapeChannel"
    parseMorphTargets(relationships, deformerNodes) {
        const rawMorphTargets = [];
        for(let i = 0; i < relationships.children.length; i++){
            const child = relationships.children[i];
            const morphTargetNode = deformerNodes[child.ID];
            const rawMorphTarget = {
                name: morphTargetNode.attrName,
                initialWeight: morphTargetNode.DeformPercent,
                id: morphTargetNode.id,
                fullWeights: morphTargetNode.FullWeights.a
            };
            if (morphTargetNode.attrType !== 'BlendShapeChannel') return;
            rawMorphTarget.geoID = connections.get(parseInt(child.ID)).children.filter(function(child) {
                return child.relationship === undefined;
            })[0].ID;
            rawMorphTargets.push(rawMorphTarget);
        }
        return rawMorphTargets;
    }
    // create the main Group() to be returned by the loader
    parseScene(deformers, geometryMap, materialMap) {
        sceneGraph = new (0, _three.Group)();
        const modelMap = this.parseModels(deformers.skeletons, geometryMap, materialMap);
        const modelNodes = fbxTree.Objects.Model;
        const scope = this;
        modelMap.forEach(function(model) {
            const modelNode = modelNodes[model.ID];
            scope.setLookAtProperties(model, modelNode);
            const parentConnections = connections.get(model.ID).parents;
            parentConnections.forEach(function(connection) {
                const parent = modelMap.get(connection.ID);
                if (parent !== undefined) parent.add(model);
            });
            if (model.parent === null) sceneGraph.add(model);
        });
        this.addGlobalSceneSettings();
        sceneGraph.traverse(function(node) {
            if (node.userData.transformData) {
                if (node.parent) {
                    node.userData.transformData.parentMatrix = node.parent.matrix;
                    node.userData.transformData.parentMatrixWorld = node.parent.matrixWorld;
                }
                const transform = generateTransform(node.userData.transformData);
                node.applyMatrix4(transform);
                node.updateWorldMatrix();
            }
        });
        // Like Blender's FBX importer, use the BindPose section to set the
        // rest pose for bones that are not part of a skin cluster. The BindPose
        // provides a more authoritative rest pose than the Lcl properties which
        // may represent an animation frame rather than the true rest state.
        // Bones WITH clusters will get their bind pose from TransformLink
        // (set via bindSkeleton below), which takes priority.
        const bindPoseMatrices = this.parsePoseNodes();
        const clusterBoneIDs = new Set();
        for(const ID in deformers.skeletons)deformers.skeletons[ID].rawBones.forEach(function(_, i) {
            const bone = deformers.skeletons[ID].bones[i];
            if (bone) clusterBoneIDs.add(bone.ID);
        });
        const tempMatrix = new (0, _three.Matrix4)();
        sceneGraph.traverse(function(node) {
            if (node.isBone && node.ID !== undefined && !clusterBoneIDs.has(node.ID)) {
                const bindPose = bindPoseMatrices[node.ID];
                if (bindPose !== undefined) {
                    if (node.parent) {
                        tempMatrix.copy(node.parent.matrixWorld).invert();
                        tempMatrix.multiply(bindPose);
                    } else tempMatrix.copy(bindPose);
                    tempMatrix.decompose(node.position, node.quaternion, node.scale);
                    node.updateMatrix();
                    node.matrixWorld.copy(bindPose);
                }
            }
        });
        // Bind skeletons after transforms are applied so that bind matrices
        // are computed from the final scene state. This ensures the rest pose
        // is correct even when the FBX file's Cluster TransformLink matrices
        // differ from the reconstructed bone transforms (common in files
        // without a BindPose section).
        this.bindSkeleton(deformers.skeletons, geometryMap, modelMap);
        const animations = new AnimationParser().parse();
        // if all the models where already combined in a single group, just return that
        if (sceneGraph.children.length === 1 && sceneGraph.children[0].isGroup) {
            sceneGraph.children[0].animations = animations;
            sceneGraph = sceneGraph.children[0];
        }
        sceneGraph.animations = animations;
        // Apply coordinate system correction. FBX files can use different
        // up-axis conventions (Y-up or Z-up). Three.js uses Y-up, so rotate
        // the scene when the file uses Z-up (UpAxis === 2).
        if ('GlobalSettings' in fbxTree && 'UpAxis' in fbxTree.GlobalSettings) {
            const upAxis = fbxTree.GlobalSettings.UpAxis.value;
            if (upAxis === 2) {
                console.warn('THREE.FBXLoader: You are loading an asset with a Z-UP coordinate system. The loader just rotates the asset to transform it into Y-UP. The vertex data are not converted.');
                sceneGraph.rotation.set(-Math.PI / 2, 0, 0);
            }
        }
    }
    // parse nodes in FBXTree.Objects.Model
    parseModels(skeletons, geometryMap, materialMap) {
        const modelMap = new Map();
        const modelNodes = fbxTree.Objects.Model;
        for(const nodeID in modelNodes){
            const id = parseInt(nodeID);
            const node = modelNodes[nodeID];
            const relationships = connections.get(id);
            let model = this.buildSkeleton(relationships, skeletons, id, node.attrName);
            if (!model) {
                switch(node.attrType){
                    case 'Camera':
                        model = this.createCamera(relationships);
                        break;
                    case 'Light':
                        model = this.createLight(relationships);
                        break;
                    case 'Mesh':
                        model = this.createMesh(relationships, geometryMap, materialMap);
                        break;
                    case 'NurbsCurve':
                        model = this.createCurve(relationships, geometryMap);
                        break;
                    case 'LimbNode':
                    case 'Root':
                        model = new (0, _three.Bone)();
                        break;
                    case 'Null':
                    default:
                        model = new (0, _three.Group)();
                        break;
                }
                model.name = node.attrName ? (0, _three.PropertyBinding).sanitizeNodeName(node.attrName) : '';
                model.userData.originalName = node.attrName;
                model.ID = id;
            }
            this.getTransformData(model, node);
            modelMap.set(id, model);
        }
        return modelMap;
    }
    buildSkeleton(relationships, skeletons, id, name) {
        let bone = null;
        relationships.parents.forEach(function(parent) {
            for(const ID in skeletons){
                const skeleton = skeletons[ID];
                skeleton.rawBones.forEach(function(rawBone, i) {
                    if (rawBone.ID === parent.ID) {
                        const subBone = bone;
                        bone = new (0, _three.Bone)();
                        bone.matrixWorld.copy(rawBone.transformLink);
                        // set name and id here - otherwise in cases where "subBone" is created it will not have a name / id
                        bone.name = name ? (0, _three.PropertyBinding).sanitizeNodeName(name) : '';
                        bone.userData.originalName = name;
                        bone.ID = id;
                        skeleton.bones[i] = bone;
                        // In cases where a bone is shared between multiple meshes
                        // duplicate the bone here and add it as a child of the first bone
                        if (subBone !== null) bone.add(subBone);
                    }
                });
            }
        });
        return bone;
    }
    // create a PerspectiveCamera or OrthographicCamera
    createCamera(relationships) {
        let model;
        let cameraAttribute;
        relationships.children.forEach(function(child) {
            const attr = fbxTree.Objects.NodeAttribute[child.ID];
            if (attr !== undefined) cameraAttribute = attr;
        });
        if (cameraAttribute === undefined) model = new (0, _three.Object3D)();
        else {
            let type = 0;
            if (cameraAttribute.CameraProjectionType !== undefined && cameraAttribute.CameraProjectionType.value === 1) type = 1;
            let nearClippingPlane = 1;
            if (cameraAttribute.NearPlane !== undefined) nearClippingPlane = cameraAttribute.NearPlane.value / 1000;
            let farClippingPlane = 1000;
            if (cameraAttribute.FarPlane !== undefined) farClippingPlane = cameraAttribute.FarPlane.value / 1000;
            let width = window.innerWidth;
            let height = window.innerHeight;
            if (cameraAttribute.AspectWidth !== undefined && cameraAttribute.AspectHeight !== undefined) {
                width = cameraAttribute.AspectWidth.value;
                height = cameraAttribute.AspectHeight.value;
            }
            const aspect = width / height;
            let fov = 45;
            if (cameraAttribute.FieldOfView !== undefined) fov = cameraAttribute.FieldOfView.value;
            const focalLength = cameraAttribute.FocalLength ? cameraAttribute.FocalLength.value : null;
            switch(type){
                case 0:
                    model = new (0, _three.PerspectiveCamera)(fov, aspect, nearClippingPlane, farClippingPlane);
                    if (focalLength !== null) model.setFocalLength(focalLength);
                    break;
                case 1:
                    console.warn('THREE.FBXLoader: Orthographic cameras not supported yet.');
                    model = new (0, _three.Object3D)();
                    break;
                default:
                    console.warn('THREE.FBXLoader: Unknown camera type ' + type + '.');
                    model = new (0, _three.Object3D)();
                    break;
            }
        }
        return model;
    }
    // Create a DirectionalLight, PointLight or SpotLight
    createLight(relationships) {
        let model;
        let lightAttribute;
        relationships.children.forEach(function(child) {
            const attr = fbxTree.Objects.NodeAttribute[child.ID];
            if (attr !== undefined) lightAttribute = attr;
        });
        if (lightAttribute === undefined) model = new (0, _three.Object3D)();
        else {
            let type;
            // LightType can be undefined for Point lights
            if (lightAttribute.LightType === undefined) type = 0;
            else type = lightAttribute.LightType.value;
            let color = 0xffffff;
            if (lightAttribute.Color !== undefined) color = (0, _three.ColorManagement).colorSpaceToWorking(new (0, _three.Color)().fromArray(lightAttribute.Color.value), (0, _three.SRGBColorSpace));
            let intensity = lightAttribute.Intensity === undefined ? 1 : lightAttribute.Intensity.value / 100;
            // light disabled
            if (lightAttribute.CastLightOnObject !== undefined && lightAttribute.CastLightOnObject.value === 0) intensity = 0;
            let distance = 0;
            if (lightAttribute.FarAttenuationEnd !== undefined) {
                if (lightAttribute.EnableFarAttenuation !== undefined && lightAttribute.EnableFarAttenuation.value === 0) distance = 0;
                else distance = lightAttribute.FarAttenuationEnd.value;
            }
            // TODO: could this be calculated linearly from FarAttenuationStart to FarAttenuationEnd?
            const decay = 1;
            switch(type){
                case 0:
                    model = new (0, _three.PointLight)(color, intensity, distance, decay);
                    break;
                case 1:
                    model = new (0, _three.DirectionalLight)(color, intensity);
                    break;
                case 2:
                    let angle = Math.PI / 3;
                    let penumbra = 0;
                    if (lightAttribute.OuterAngle !== undefined) {
                        angle = (0, _three.MathUtils).degToRad(lightAttribute.OuterAngle.value);
                        if (lightAttribute.InnerAngle !== undefined) {
                            penumbra = 1 - lightAttribute.InnerAngle.value / lightAttribute.OuterAngle.value;
                            penumbra = Math.max(0, penumbra); // penumbra must be in the range [0,1]
                        }
                    } else if (lightAttribute.InnerAngle !== undefined) // fallback if only InnerAngle is defined
                    angle = (0, _three.MathUtils).degToRad(lightAttribute.InnerAngle.value);
                    model = new (0, _three.SpotLight)(color, intensity, distance, angle, penumbra, decay);
                    break;
                default:
                    console.warn('THREE.FBXLoader: Unknown light type ' + lightAttribute.LightType.value + ', defaulting to a PointLight.');
                    model = new (0, _three.PointLight)(color, intensity);
                    break;
            }
            if (lightAttribute.CastShadows !== undefined && lightAttribute.CastShadows.value === 1) model.castShadow = true;
        }
        return model;
    }
    createMesh(relationships, geometryMap, materialMap) {
        let model;
        let geometry = null;
        let material = null;
        const materials = [];
        // get geometry and materials(s) from connections
        relationships.children.forEach(function(child) {
            if (geometryMap.has(child.ID)) geometry = geometryMap.get(child.ID);
            if (materialMap.has(child.ID)) materials.push(materialMap.get(child.ID));
        });
        if (materials.length > 1) material = materials;
        else if (materials.length > 0) material = materials[0];
        else {
            material = new (0, _three.MeshPhongMaterial)({
                name: (0, _three.Loader).DEFAULT_MATERIAL_NAME,
                color: 0xcccccc
            });
            materials.push(material);
        }
        if ('color' in geometry.attributes) materials.forEach(function(material) {
            material.vertexColors = true;
        });
        // Sanitization: If geometry has groups, then it must match the provided material array.
        // If not, we need to clean up the `group.materialIndex` properties inside the groups and point at a (new) default material.
        // This isn't well defined; Unity creates default material, while Blender implicitly uses the previous material in the list.
        if (geometry.groups.length > 0) {
            let needsDefaultMaterial = false;
            for(let i = 0, il = geometry.groups.length; i < il; i++){
                const group = geometry.groups[i];
                if (group.materialIndex < 0 || group.materialIndex >= materials.length) {
                    group.materialIndex = materials.length;
                    needsDefaultMaterial = true;
                }
            }
            if (needsDefaultMaterial) {
                const defaultMaterial = new (0, _three.MeshPhongMaterial)();
                materials.push(defaultMaterial);
            }
        }
        if (geometry.FBX_Deformer) {
            model = new (0, _three.SkinnedMesh)(geometry, material);
            model.normalizeSkinWeights();
        } else model = new (0, _three.Mesh)(geometry, material);
        return model;
    }
    createCurve(relationships, geometryMap) {
        const geometry = relationships.children.reduce(function(geo, child) {
            if (geometryMap.has(child.ID)) geo = geometryMap.get(child.ID);
            return geo;
        }, null);
        // FBX does not list materials for Nurbs lines, so we'll just put our own in here.
        const material = new (0, _three.LineBasicMaterial)({
            name: (0, _three.Loader).DEFAULT_MATERIAL_NAME,
            color: 0x3300ff,
            linewidth: 1
        });
        return new (0, _three.Line)(geometry, material);
    }
    // parse the model node for transform data
    getTransformData(model, modelNode) {
        const transformData = {};
        if ('InheritType' in modelNode) transformData.inheritType = parseInt(modelNode.InheritType.value);
        if ('RotationOrder' in modelNode) transformData.eulerOrder = getEulerOrder(modelNode.RotationOrder.value);
        else transformData.eulerOrder = getEulerOrder(0);
        if ('Lcl_Translation' in modelNode) transformData.translation = modelNode.Lcl_Translation.value;
        if ('PreRotation' in modelNode) transformData.preRotation = modelNode.PreRotation.value;
        if ('Lcl_Rotation' in modelNode) transformData.rotation = modelNode.Lcl_Rotation.value;
        if ('PostRotation' in modelNode) transformData.postRotation = modelNode.PostRotation.value;
        if ('Lcl_Scaling' in modelNode) transformData.scale = modelNode.Lcl_Scaling.value;
        if ('ScalingOffset' in modelNode) transformData.scalingOffset = modelNode.ScalingOffset.value;
        if ('ScalingPivot' in modelNode) transformData.scalingPivot = modelNode.ScalingPivot.value;
        if ('RotationOffset' in modelNode) transformData.rotationOffset = modelNode.RotationOffset.value;
        if ('RotationPivot' in modelNode) transformData.rotationPivot = modelNode.RotationPivot.value;
        model.userData.transformData = transformData;
    }
    setLookAtProperties(model, modelNode) {
        if ('LookAtProperty' in modelNode) {
            const children = connections.get(model.ID).children;
            children.forEach(function(child) {
                if (child.relationship === 'LookAtProperty') {
                    const lookAtTarget = fbxTree.Objects.Model[child.ID];
                    if ('Lcl_Translation' in lookAtTarget) {
                        const pos = lookAtTarget.Lcl_Translation.value;
                        // DirectionalLight, SpotLight
                        if (model.target !== undefined) {
                            model.target.position.fromArray(pos);
                            sceneGraph.add(model.target);
                        } else model.lookAt(new (0, _three.Vector3)().fromArray(pos));
                    }
                }
            });
        }
    }
    bindSkeleton(skeletons, geometryMap, modelMap) {
        for(const ID in skeletons){
            const skeleton = skeletons[ID];
            // Compute bone inverses from TransformLink rather than from the
            // bones' current matrixWorld. The TransformLink matrices represent
            // each bone's global transform at the time the skin weights were
            // painted, which may differ from the scene-reconstructed transforms.
            const boneInverses = [];
            for(let i = 0, l = skeleton.bones.length; i < l; i++){
                const inverse = new (0, _three.Matrix4)();
                if (skeleton.bones[i] && skeleton.rawBones[i]) inverse.copy(skeleton.rawBones[i].transformLink).invert();
                boneInverses.push(inverse);
            }
            const parents = connections.get(parseInt(skeleton.ID)).parents;
            parents.forEach(function(parent) {
                if (geometryMap.has(parent.ID)) {
                    const geoID = parent.ID;
                    const geoRelationships = connections.get(geoID);
                    geoRelationships.parents.forEach(function(geoConnParent) {
                        if (modelMap.has(geoConnParent.ID)) {
                            const model = modelMap.get(geoConnParent.ID);
                            // Use the mesh's current matrixWorld as bind matrix.
                            // The BindPose section is intentionally not used here
                            // since it may contain scale/rotation from the model
                            // hierarchy that is inconsistent with the TransformLink-
                            // based bone inverses. Always provide a bind matrix to
                            // prevent bind() from calling calculateInverses() which
                            // would overwrite the bone inverses computed above.
                            model.updateMatrixWorld(true);
                            model.bind(new (0, _three.Skeleton)(skeleton.bones, boneInverses), model.matrixWorld);
                        }
                    });
                }
            });
        }
    }
    // Parse BindPose nodes and return a map of node ID to bind matrix.
    parsePoseNodes() {
        const bindMatrices = {};
        if ('Pose' in fbxTree.Objects) {
            const BindPoseNode = fbxTree.Objects.Pose;
            for(const nodeID in BindPoseNode)if (BindPoseNode[nodeID].attrType === 'BindPose' && BindPoseNode[nodeID].NbPoseNodes > 0) {
                const poseNodes = BindPoseNode[nodeID].PoseNode;
                if (Array.isArray(poseNodes)) poseNodes.forEach(function(poseNode) {
                    bindMatrices[poseNode.Node] = new (0, _three.Matrix4)().fromArray(poseNode.Matrix.a);
                });
                else bindMatrices[poseNodes.Node] = new (0, _three.Matrix4)().fromArray(poseNodes.Matrix.a);
            }
        }
        return bindMatrices;
    }
    addGlobalSceneSettings() {
        if ('GlobalSettings' in fbxTree) {
            if ('AmbientColor' in fbxTree.GlobalSettings) {
                // Parse ambient color - if it's not set to black (default), create an ambient light
                const ambientColor = fbxTree.GlobalSettings.AmbientColor.value;
                const r = ambientColor[0];
                const g = ambientColor[1];
                const b = ambientColor[2];
                if (r !== 0 || g !== 0 || b !== 0) {
                    const color = new (0, _three.Color)().setRGB(r, g, b, (0, _three.SRGBColorSpace));
                    sceneGraph.add(new (0, _three.AmbientLight)(color, 1));
                }
            }
            if ('UnitScaleFactor' in fbxTree.GlobalSettings) sceneGraph.userData.unitScaleFactor = fbxTree.GlobalSettings.UnitScaleFactor.value;
        }
    }
}
// parse Geometry data from FBXTree and return map of BufferGeometries
class GeometryParser {
    constructor(){
        this.negativeMaterialIndices = false;
    }
    // Parse nodes in FBXTree.Objects.Geometry
    parse(deformers) {
        const geometryMap = new Map();
        if ('Geometry' in fbxTree.Objects) {
            const geoNodes = fbxTree.Objects.Geometry;
            for(const nodeID in geoNodes){
                const relationships = connections.get(parseInt(nodeID));
                const geo = this.parseGeometry(relationships, geoNodes[nodeID], deformers);
                geometryMap.set(parseInt(nodeID), geo);
            }
        }
        // report warnings
        if (this.negativeMaterialIndices === true) console.warn('THREE.FBXLoader: The FBX file contains invalid (negative) material indices. The asset might not render as expected.');
        return geometryMap;
    }
    // Parse single node in FBXTree.Objects.Geometry
    parseGeometry(relationships, geoNode, deformers) {
        switch(geoNode.attrType){
            case 'Mesh':
                return this.parseMeshGeometry(relationships, geoNode, deformers);
            case 'NurbsCurve':
                return this.parseNurbsGeometry(geoNode);
        }
    }
    // Parse single node mesh geometry in FBXTree.Objects.Geometry
    parseMeshGeometry(relationships, geoNode, deformers) {
        const skeletons = deformers.skeletons;
        const morphTargets = [];
        const modelNodes = relationships.parents.map(function(parent) {
            return fbxTree.Objects.Model[parent.ID];
        });
        // don't create geometry if it is not associated with any models
        if (modelNodes.length === 0) return;
        const skeleton = relationships.children.reduce(function(skeleton, child) {
            if (skeletons[child.ID] !== undefined) skeleton = skeletons[child.ID];
            return skeleton;
        }, null);
        relationships.children.forEach(function(child) {
            if (deformers.morphTargets[child.ID] !== undefined) morphTargets.push(deformers.morphTargets[child.ID]);
        });
        // Assume one model and get the preRotation from that
        // if there is more than one model associated with the geometry this may cause problems
        const modelNode = modelNodes[0];
        const transformData = {};
        if ('RotationOrder' in modelNode) transformData.eulerOrder = getEulerOrder(modelNode.RotationOrder.value);
        if ('InheritType' in modelNode) transformData.inheritType = parseInt(modelNode.InheritType.value);
        if ('GeometricTranslation' in modelNode) transformData.translation = modelNode.GeometricTranslation.value;
        if ('GeometricRotation' in modelNode) transformData.rotation = modelNode.GeometricRotation.value;
        if ('GeometricScaling' in modelNode) transformData.scale = modelNode.GeometricScaling.value;
        const transform = generateTransform(transformData);
        return this.genGeometry(geoNode, skeleton, morphTargets, transform);
    }
    // Generate a BufferGeometry from a node in FBXTree.Objects.Geometry
    genGeometry(geoNode, skeleton, morphTargets, preTransform) {
        const geo = new (0, _three.BufferGeometry)();
        if (geoNode.attrName) geo.name = geoNode.attrName;
        const geoInfo = this.parseGeoNode(geoNode, skeleton);
        const buffers = this.genBuffers(geoInfo);
        const positionAttribute = new (0, _three.Float32BufferAttribute)(buffers.vertex, 3);
        positionAttribute.applyMatrix4(preTransform);
        geo.setAttribute('position', positionAttribute);
        if (buffers.colors.length > 0) geo.setAttribute('color', new (0, _three.Float32BufferAttribute)(buffers.colors, 3));
        if (skeleton) {
            geo.setAttribute('skinIndex', new (0, _three.Uint16BufferAttribute)(buffers.weightsIndices, 4));
            geo.setAttribute('skinWeight', new (0, _three.Float32BufferAttribute)(buffers.vertexWeights, 4));
            // used later to bind the skeleton to the model
            geo.FBX_Deformer = skeleton;
        }
        if (buffers.normal.length > 0) {
            const normalMatrix = new (0, _three.Matrix3)().getNormalMatrix(preTransform);
            const normalAttribute = new (0, _three.Float32BufferAttribute)(buffers.normal, 3);
            normalAttribute.applyNormalMatrix(normalMatrix);
            geo.setAttribute('normal', normalAttribute);
        }
        buffers.uvs.forEach(function(uvBuffer, i) {
            const name = i === 0 ? 'uv' : `uv${i}`;
            geo.setAttribute(name, new (0, _three.Float32BufferAttribute)(buffers.uvs[i], 2));
        });
        if (geoInfo.material && geoInfo.material.mappingType !== 'AllSame') {
            // Convert the material indices of each vertex into rendering groups on the geometry.
            let prevMaterialIndex = buffers.materialIndex[0];
            let startIndex = 0;
            buffers.materialIndex.forEach(function(currentIndex, i) {
                if (currentIndex !== prevMaterialIndex) {
                    geo.addGroup(startIndex, i - startIndex, prevMaterialIndex);
                    prevMaterialIndex = currentIndex;
                    startIndex = i;
                }
            });
            // the loop above doesn't add the last group, do that here.
            if (geo.groups.length > 0) {
                const lastGroup = geo.groups[geo.groups.length - 1];
                const lastIndex = lastGroup.start + lastGroup.count;
                if (lastIndex !== buffers.materialIndex.length) geo.addGroup(lastIndex, buffers.materialIndex.length - lastIndex, prevMaterialIndex);
            }
            // case where there are multiple materials but the whole geometry is only
            // using one of them
            if (geo.groups.length === 0) geo.addGroup(0, buffers.materialIndex.length, buffers.materialIndex[0]);
        }
        this.addMorphTargets(geo, geoNode, morphTargets, preTransform);
        return geo;
    }
    parseGeoNode(geoNode, skeleton) {
        const geoInfo = {};
        geoInfo.vertexPositions = geoNode.Vertices !== undefined ? geoNode.Vertices.a : [];
        geoInfo.vertexIndices = geoNode.PolygonVertexIndex !== undefined ? geoNode.PolygonVertexIndex.a : [];
        if (geoNode.LayerElementColor && geoNode.LayerElementColor[0].Colors) geoInfo.color = this.parseVertexColors(geoNode.LayerElementColor[0]);
        if (geoNode.LayerElementMaterial) geoInfo.material = this.parseMaterialIndices(geoNode.LayerElementMaterial[0]);
        if (geoNode.LayerElementNormal) geoInfo.normal = this.parseNormals(geoNode.LayerElementNormal[0]);
        if (geoNode.LayerElementUV) {
            geoInfo.uv = [];
            let i = 0;
            while(geoNode.LayerElementUV[i]){
                if (geoNode.LayerElementUV[i].UV) geoInfo.uv.push(this.parseUVs(geoNode.LayerElementUV[i]));
                i++;
            }
        }
        geoInfo.weightTable = {};
        if (skeleton !== null) {
            geoInfo.skeleton = skeleton;
            skeleton.rawBones.forEach(function(rawBone, i) {
                // loop over the bone's vertex indices and weights
                rawBone.indices.forEach(function(index, j) {
                    if (geoInfo.weightTable[index] === undefined) geoInfo.weightTable[index] = [];
                    geoInfo.weightTable[index].push({
                        id: i,
                        weight: rawBone.weights[j]
                    });
                });
            });
        }
        return geoInfo;
    }
    genBuffers(geoInfo) {
        const buffers = {
            vertex: [],
            normal: [],
            colors: [],
            uvs: [],
            materialIndex: [],
            vertexWeights: [],
            weightsIndices: []
        };
        let polygonIndex = 0;
        let faceLength = 0;
        let displayedWeightsWarning = false;
        // these will hold data for a single face
        let facePositionIndexes = [];
        let faceNormals = [];
        let faceColors = [];
        let faceUVs = [];
        let faceWeights = [];
        let faceWeightIndices = [];
        const scope = this;
        geoInfo.vertexIndices.forEach(function(vertexIndex, polygonVertexIndex) {
            let materialIndex;
            let endOfFace = false;
            // Face index and vertex index arrays are combined in a single array
            // A cube with quad faces looks like this:
            // PolygonVertexIndex: *24 {
            //  a: 0, 1, 3, -3, 2, 3, 5, -5, 4, 5, 7, -7, 6, 7, 1, -1, 1, 7, 5, -4, 6, 0, 2, -5
            //  }
            // Negative numbers mark the end of a face - first face here is 0, 1, 3, -3
            // to find index of last vertex bit shift the index: ^ - 1
            if (vertexIndex < 0) {
                vertexIndex = vertexIndex ^ -1; // equivalent to ( x * -1 ) - 1
                endOfFace = true;
            }
            let weightIndices = [];
            let weights = [];
            facePositionIndexes.push(vertexIndex * 3, vertexIndex * 3 + 1, vertexIndex * 3 + 2);
            if (geoInfo.color) {
                const data = getData(polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.color);
                faceColors.push(data[0], data[1], data[2]);
            }
            if (geoInfo.skeleton) {
                if (geoInfo.weightTable[vertexIndex] !== undefined) geoInfo.weightTable[vertexIndex].forEach(function(wt) {
                    weights.push(wt.weight);
                    weightIndices.push(wt.id);
                });
                if (weights.length > 4) {
                    if (!displayedWeightsWarning) {
                        console.warn('THREE.FBXLoader: Vertex has more than 4 skinning weights assigned to vertex. Deleting additional weights.');
                        displayedWeightsWarning = true;
                    }
                    const wIndex = [
                        0,
                        0,
                        0,
                        0
                    ];
                    const Weight = [
                        0,
                        0,
                        0,
                        0
                    ];
                    weights.forEach(function(weight, weightIndex) {
                        let currentWeight = weight;
                        let currentIndex = weightIndices[weightIndex];
                        Weight.forEach(function(comparedWeight, comparedWeightIndex, comparedWeightArray) {
                            if (currentWeight > comparedWeight) {
                                comparedWeightArray[comparedWeightIndex] = currentWeight;
                                currentWeight = comparedWeight;
                                const tmp = wIndex[comparedWeightIndex];
                                wIndex[comparedWeightIndex] = currentIndex;
                                currentIndex = tmp;
                            }
                        });
                    });
                    weightIndices = wIndex;
                    weights = Weight;
                }
                // if the weight array is shorter than 4 pad with 0s
                while(weights.length < 4){
                    weights.push(0);
                    weightIndices.push(0);
                }
                for(let i = 0; i < 4; ++i){
                    faceWeights.push(weights[i]);
                    faceWeightIndices.push(weightIndices[i]);
                }
            }
            if (geoInfo.normal) {
                const data = getData(polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.normal);
                faceNormals.push(data[0], data[1], data[2]);
            }
            if (geoInfo.material && geoInfo.material.mappingType !== 'AllSame') {
                materialIndex = getData(polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.material)[0];
                if (materialIndex < 0) {
                    scope.negativeMaterialIndices = true;
                    materialIndex = 0; // fallback
                }
            }
            if (geoInfo.uv) geoInfo.uv.forEach(function(uv, i) {
                const data = getData(polygonVertexIndex, polygonIndex, vertexIndex, uv);
                if (faceUVs[i] === undefined) faceUVs[i] = [];
                faceUVs[i].push(data[0]);
                faceUVs[i].push(data[1]);
            });
            faceLength++;
            if (endOfFace) {
                scope.genFace(buffers, geoInfo, facePositionIndexes, materialIndex, faceNormals, faceColors, faceUVs, faceWeights, faceWeightIndices, faceLength);
                polygonIndex++;
                faceLength = 0;
                // reset arrays for the next face
                facePositionIndexes = [];
                faceNormals = [];
                faceColors = [];
                faceUVs = [];
                faceWeights = [];
                faceWeightIndices = [];
            }
        });
        return buffers;
    }
    // See https://www.khronos.org/opengl/wiki/Calculating_a_Surface_Normal
    getNormalNewell(vertices) {
        const normal = new (0, _three.Vector3)(0.0, 0.0, 0.0);
        for(let i = 0; i < vertices.length; i++){
            const current = vertices[i];
            const next = vertices[(i + 1) % vertices.length];
            normal.x += (current.y - next.y) * (current.z + next.z);
            normal.y += (current.z - next.z) * (current.x + next.x);
            normal.z += (current.x - next.x) * (current.y + next.y);
        }
        normal.normalize();
        return normal;
    }
    getNormalTangentAndBitangent(vertices) {
        const normalVector = this.getNormalNewell(vertices);
        // Avoid up being equal or almost equal to normalVector
        const up = Math.abs(normalVector.z) > 0.5 ? new (0, _three.Vector3)(0.0, 1.0, 0.0) : new (0, _three.Vector3)(0.0, 0.0, 1.0);
        const tangent = up.cross(normalVector).normalize();
        const bitangent = normalVector.clone().cross(tangent).normalize();
        return {
            normal: normalVector,
            tangent: tangent,
            bitangent: bitangent
        };
    }
    flattenVertex(vertex, normalTangent, normalBitangent) {
        return new (0, _three.Vector2)(vertex.dot(normalTangent), vertex.dot(normalBitangent));
    }
    // Generate data for a single face in a geometry. If the face is a quad then split it into 2 tris
    genFace(buffers, geoInfo, facePositionIndexes, materialIndex, faceNormals, faceColors, faceUVs, faceWeights, faceWeightIndices, faceLength) {
        let triangles;
        if (faceLength > 3) {
            // Triangulate n-gon using earcut
            const vertices = [];
            // in morphing scenario vertexPositions represent morphPositions
            // while baseVertexPositions represent the original geometry's positions
            const positions = geoInfo.baseVertexPositions || geoInfo.vertexPositions;
            for(let i = 0; i < facePositionIndexes.length; i += 3)vertices.push(new (0, _three.Vector3)(positions[facePositionIndexes[i]], positions[facePositionIndexes[i + 1]], positions[facePositionIndexes[i + 2]]));
            const { tangent, bitangent } = this.getNormalTangentAndBitangent(vertices);
            const triangulationInput = [];
            for (const vertex of vertices)triangulationInput.push(this.flattenVertex(vertex, tangent, bitangent));
            // When vertices is an array of [0,0,0] elements (which is the case for vertices not participating in morph)
            // the triangulationInput will be an array of [0,0] elements
            // resulting in an array of 0 triangles being returned from ShapeUtils.triangulateShape
            // leading to not pushing into buffers.vertex the redundant vertices (the vertices that are not morphed).
            // That's why, in order to support morphing scenario, "positions" is looking first for baseVertexPositions,
            // so that we don't end up with an array of 0 triangles for the faces not participating in morph.
            triangles = (0, _three.ShapeUtils).triangulateShape(triangulationInput, []);
        } else // Regular triangle, skip earcut triangulation step
        triangles = [
            [
                0,
                1,
                2
            ]
        ];
        for (const [i0, i1, i2] of triangles){
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i0 * 3]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i0 * 3 + 1]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i0 * 3 + 2]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i1 * 3]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i1 * 3 + 1]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i1 * 3 + 2]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i2 * 3]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i2 * 3 + 1]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i2 * 3 + 2]]);
            if (geoInfo.skeleton) {
                buffers.vertexWeights.push(faceWeights[i0 * 4]);
                buffers.vertexWeights.push(faceWeights[i0 * 4 + 1]);
                buffers.vertexWeights.push(faceWeights[i0 * 4 + 2]);
                buffers.vertexWeights.push(faceWeights[i0 * 4 + 3]);
                buffers.vertexWeights.push(faceWeights[i1 * 4]);
                buffers.vertexWeights.push(faceWeights[i1 * 4 + 1]);
                buffers.vertexWeights.push(faceWeights[i1 * 4 + 2]);
                buffers.vertexWeights.push(faceWeights[i1 * 4 + 3]);
                buffers.vertexWeights.push(faceWeights[i2 * 4]);
                buffers.vertexWeights.push(faceWeights[i2 * 4 + 1]);
                buffers.vertexWeights.push(faceWeights[i2 * 4 + 2]);
                buffers.vertexWeights.push(faceWeights[i2 * 4 + 3]);
                buffers.weightsIndices.push(faceWeightIndices[i0 * 4]);
                buffers.weightsIndices.push(faceWeightIndices[i0 * 4 + 1]);
                buffers.weightsIndices.push(faceWeightIndices[i0 * 4 + 2]);
                buffers.weightsIndices.push(faceWeightIndices[i0 * 4 + 3]);
                buffers.weightsIndices.push(faceWeightIndices[i1 * 4]);
                buffers.weightsIndices.push(faceWeightIndices[i1 * 4 + 1]);
                buffers.weightsIndices.push(faceWeightIndices[i1 * 4 + 2]);
                buffers.weightsIndices.push(faceWeightIndices[i1 * 4 + 3]);
                buffers.weightsIndices.push(faceWeightIndices[i2 * 4]);
                buffers.weightsIndices.push(faceWeightIndices[i2 * 4 + 1]);
                buffers.weightsIndices.push(faceWeightIndices[i2 * 4 + 2]);
                buffers.weightsIndices.push(faceWeightIndices[i2 * 4 + 3]);
            }
            if (geoInfo.color) {
                buffers.colors.push(faceColors[i0 * 3]);
                buffers.colors.push(faceColors[i0 * 3 + 1]);
                buffers.colors.push(faceColors[i0 * 3 + 2]);
                buffers.colors.push(faceColors[i1 * 3]);
                buffers.colors.push(faceColors[i1 * 3 + 1]);
                buffers.colors.push(faceColors[i1 * 3 + 2]);
                buffers.colors.push(faceColors[i2 * 3]);
                buffers.colors.push(faceColors[i2 * 3 + 1]);
                buffers.colors.push(faceColors[i2 * 3 + 2]);
            }
            if (geoInfo.material && geoInfo.material.mappingType !== 'AllSame') {
                buffers.materialIndex.push(materialIndex);
                buffers.materialIndex.push(materialIndex);
                buffers.materialIndex.push(materialIndex);
            }
            if (geoInfo.normal) {
                buffers.normal.push(faceNormals[i0 * 3]);
                buffers.normal.push(faceNormals[i0 * 3 + 1]);
                buffers.normal.push(faceNormals[i0 * 3 + 2]);
                buffers.normal.push(faceNormals[i1 * 3]);
                buffers.normal.push(faceNormals[i1 * 3 + 1]);
                buffers.normal.push(faceNormals[i1 * 3 + 2]);
                buffers.normal.push(faceNormals[i2 * 3]);
                buffers.normal.push(faceNormals[i2 * 3 + 1]);
                buffers.normal.push(faceNormals[i2 * 3 + 2]);
            }
            if (geoInfo.uv) geoInfo.uv.forEach(function(uv, j) {
                if (buffers.uvs[j] === undefined) buffers.uvs[j] = [];
                buffers.uvs[j].push(faceUVs[j][i0 * 2]);
                buffers.uvs[j].push(faceUVs[j][i0 * 2 + 1]);
                buffers.uvs[j].push(faceUVs[j][i1 * 2]);
                buffers.uvs[j].push(faceUVs[j][i1 * 2 + 1]);
                buffers.uvs[j].push(faceUVs[j][i2 * 2]);
                buffers.uvs[j].push(faceUVs[j][i2 * 2 + 1]);
            });
        }
    }
    addMorphTargets(parentGeo, parentGeoNode, morphTargets, preTransform) {
        if (morphTargets.length === 0) return;
        parentGeo.morphTargetsRelative = true;
        parentGeo.morphAttributes.position = [];
        // parentGeo.morphAttributes.normal = []; // not implemented
        // Morph attribute positions are stored as deltas (morphTargetsRelative = true), so the
        // translation component of the geometric transform must not be applied to them — only the
        // rotation/scale part. Otherwise every delta gets the geometric translation added, which
        // shifts morphed vertices away from their intended position by `weight * translation` as
        // the influence increases.
        const morphPreTransform = preTransform.clone().setPosition(0, 0, 0);
        const scope = this;
        morphTargets.forEach(function(morphTarget) {
            morphTarget.rawTargets.forEach(function(rawTarget) {
                const morphGeoNode = fbxTree.Objects.Geometry[rawTarget.geoID];
                if (morphGeoNode !== undefined) scope.genMorphGeometry(parentGeo, parentGeoNode, morphGeoNode, morphPreTransform, rawTarget.name);
            });
        });
    }
    // a morph geometry node is similar to a standard  node, and the node is also contained
    // in FBXTree.Objects.Geometry, however it can only have attributes for position, normal
    // and a special attribute Index defining which vertices of the original geometry are affected
    // Normal and position attributes only have data for the vertices that are affected by the morph
    genMorphGeometry(parentGeo, parentGeoNode, morphGeoNode, preTransform, name) {
        const basePositions = parentGeoNode.Vertices !== undefined ? parentGeoNode.Vertices.a : [];
        const baseIndices = parentGeoNode.PolygonVertexIndex !== undefined ? parentGeoNode.PolygonVertexIndex.a : [];
        const morphPositionsSparse = morphGeoNode.Vertices !== undefined ? morphGeoNode.Vertices.a : [];
        const morphIndices = morphGeoNode.Indexes !== undefined ? morphGeoNode.Indexes.a : [];
        const length = parentGeo.attributes.position.count * 3;
        const morphPositions = new Float32Array(length);
        for(let i = 0; i < morphIndices.length; i++){
            const morphIndex = morphIndices[i] * 3;
            morphPositions[morphIndex] = morphPositionsSparse[i * 3];
            morphPositions[morphIndex + 1] = morphPositionsSparse[i * 3 + 1];
            morphPositions[morphIndex + 2] = morphPositionsSparse[i * 3 + 2];
        }
        // TODO: add morph normal support
        const morphGeoInfo = {
            vertexIndices: baseIndices,
            vertexPositions: morphPositions,
            baseVertexPositions: basePositions
        };
        const morphBuffers = this.genBuffers(morphGeoInfo);
        const positionAttribute = new (0, _three.Float32BufferAttribute)(morphBuffers.vertex, 3);
        positionAttribute.name = name || morphGeoNode.attrName;
        positionAttribute.applyMatrix4(preTransform);
        parentGeo.morphAttributes.position.push(positionAttribute);
    }
    // Parse normal from FBXTree.Objects.Geometry.LayerElementNormal if it exists
    parseNormals(NormalNode) {
        const mappingType = NormalNode.MappingInformationType;
        const referenceType = NormalNode.ReferenceInformationType;
        const buffer = NormalNode.Normals.a;
        let indexBuffer = [];
        if (referenceType === 'IndexToDirect') {
            if ('NormalIndex' in NormalNode) indexBuffer = NormalNode.NormalIndex.a;
            else if ('NormalsIndex' in NormalNode) indexBuffer = NormalNode.NormalsIndex.a;
        }
        return {
            dataSize: 3,
            buffer: buffer,
            indices: indexBuffer,
            mappingType: mappingType,
            referenceType: referenceType
        };
    }
    // Parse UVs from FBXTree.Objects.Geometry.LayerElementUV if it exists
    parseUVs(UVNode) {
        const mappingType = UVNode.MappingInformationType;
        const referenceType = UVNode.ReferenceInformationType;
        const buffer = UVNode.UV.a;
        let indexBuffer = [];
        if (referenceType === 'IndexToDirect') indexBuffer = UVNode.UVIndex.a;
        return {
            dataSize: 2,
            buffer: buffer,
            indices: indexBuffer,
            mappingType: mappingType,
            referenceType: referenceType
        };
    }
    // Parse Vertex Colors from FBXTree.Objects.Geometry.LayerElementColor if it exists
    parseVertexColors(ColorNode) {
        const mappingType = ColorNode.MappingInformationType;
        const referenceType = ColorNode.ReferenceInformationType;
        const buffer = ColorNode.Colors.a;
        let indexBuffer = [];
        if (referenceType === 'IndexToDirect') indexBuffer = ColorNode.ColorIndex.a;
        for(let i = 0, c = new (0, _three.Color)(); i < buffer.length; i += 4){
            c.fromArray(buffer, i);
            (0, _three.ColorManagement).colorSpaceToWorking(c, (0, _three.SRGBColorSpace));
            c.toArray(buffer, i);
        }
        return {
            dataSize: 4,
            buffer: buffer,
            indices: indexBuffer,
            mappingType: mappingType,
            referenceType: referenceType
        };
    }
    // Parse mapping and material data in FBXTree.Objects.Geometry.LayerElementMaterial if it exists
    parseMaterialIndices(MaterialNode) {
        const mappingType = MaterialNode.MappingInformationType;
        const referenceType = MaterialNode.ReferenceInformationType;
        if (mappingType === 'NoMappingInformation') return {
            dataSize: 1,
            buffer: [
                0
            ],
            indices: [
                0
            ],
            mappingType: 'AllSame',
            referenceType: referenceType
        };
        const materialIndexBuffer = MaterialNode.Materials.a;
        // Since materials are stored as indices, there's a bit of a mismatch between FBX and what
        // we expect.So we create an intermediate buffer that points to the index in the buffer,
        // for conforming with the other functions we've written for other data.
        const materialIndices = [];
        for(let i = 0; i < materialIndexBuffer.length; ++i)materialIndices.push(i);
        return {
            dataSize: 1,
            buffer: materialIndexBuffer,
            indices: materialIndices,
            mappingType: mappingType,
            referenceType: referenceType
        };
    }
    // Generate a NurbGeometry from a node in FBXTree.Objects.Geometry
    parseNurbsGeometry(geoNode) {
        const order = parseInt(geoNode.Order);
        if (isNaN(order)) {
            console.error('THREE.FBXLoader: Invalid Order %s given for geometry ID: %s', geoNode.Order, geoNode.id);
            return new (0, _three.BufferGeometry)();
        }
        const degree = order - 1;
        const knots = geoNode.KnotVector.a;
        const controlPoints = [];
        const pointsValues = geoNode.Points.a;
        for(let i = 0, l = pointsValues.length; i < l; i += 4)controlPoints.push(new (0, _three.Vector4)().fromArray(pointsValues, i));
        let startKnot, endKnot;
        if (geoNode.Form === 'Closed') controlPoints.push(controlPoints[0]);
        else if (geoNode.Form === 'Periodic') {
            startKnot = degree;
            endKnot = knots.length - 1 - startKnot;
            for(let i = 0; i < degree; ++i)controlPoints.push(controlPoints[i]);
        }
        const curve = new (0, _nurbscurveJs.NURBSCurve)(degree, knots, controlPoints, startKnot, endKnot);
        const points = curve.getPoints(controlPoints.length * 12);
        return new (0, _three.BufferGeometry)().setFromPoints(points);
    }
}
// parse animation data from FBXTree
class AnimationParser {
    // take raw animation clips and turn them into three.js animation clips
    parse() {
        const animationClips = [];
        const rawClips = this.parseClips();
        if (rawClips !== undefined) for(const key in rawClips){
            const rawClip = rawClips[key];
            const clip = this.addClip(rawClip);
            animationClips.push(clip);
        }
        return animationClips;
    }
    parseClips() {
        // since the actual transformation data is stored in FBXTree.Objects.AnimationCurve,
        // if this is undefined we can safely assume there are no animations
        if (fbxTree.Objects.AnimationCurve === undefined) return undefined;
        const curveNodesMap = this.parseAnimationCurveNodes();
        this.parseAnimationCurves(curveNodesMap);
        const layersMap = this.parseAnimationLayers(curveNodesMap);
        const rawClips = this.parseAnimStacks(layersMap);
        return rawClips;
    }
    // parse nodes in FBXTree.Objects.AnimationCurveNode
    // each AnimationCurveNode holds data for an animation transform for a model (e.g. left arm rotation )
    // and is referenced by an AnimationLayer
    parseAnimationCurveNodes() {
        const rawCurveNodes = fbxTree.Objects.AnimationCurveNode;
        const curveNodesMap = new Map();
        for(const nodeID in rawCurveNodes){
            const rawCurveNode = rawCurveNodes[nodeID];
            if (rawCurveNode.attrName.match(/S|R|T|DeformPercent/) !== null) {
                const curveNode = {
                    id: rawCurveNode.id,
                    attr: rawCurveNode.attrName,
                    curves: {}
                };
                curveNodesMap.set(curveNode.id, curveNode);
            }
        }
        return curveNodesMap;
    }
    // parse nodes in FBXTree.Objects.AnimationCurve and connect them up to
    // previously parsed AnimationCurveNodes. Each AnimationCurve holds data for a single animated
    // axis ( e.g. times and values of x rotation)
    parseAnimationCurves(curveNodesMap) {
        const rawCurves = fbxTree.Objects.AnimationCurve;
        // TODO: Many values are identical up to roundoff error, but won't be optimised
        // e.g. position times: [0, 0.4, 0. 8]
        // position values: [7.23538335023477e-7, 93.67518615722656, -0.9982695579528809, 7.23538335023477e-7, 93.67518615722656, -0.9982695579528809, 7.235384487103147e-7, 93.67520904541016, -0.9982695579528809]
        // clearly, this should be optimised to
        // times: [0], positions [7.23538335023477e-7, 93.67518615722656, -0.9982695579528809]
        // this shows up in nearly every FBX file, and generally time array is length > 100
        for(const nodeID in rawCurves){
            const animationCurve = {
                id: rawCurves[nodeID].id,
                times: rawCurves[nodeID].KeyTime.a.map(convertFBXTimeToSeconds),
                values: rawCurves[nodeID].KeyValueFloat.a
            };
            const relationships = connections.get(animationCurve.id);
            if (relationships !== undefined) {
                const animationCurveID = relationships.parents[0].ID;
                const animationCurveRelationship = relationships.parents[0].relationship;
                if (animationCurveRelationship.match(/X/)) curveNodesMap.get(animationCurveID).curves['x'] = animationCurve;
                else if (animationCurveRelationship.match(/Y/)) curveNodesMap.get(animationCurveID).curves['y'] = animationCurve;
                else if (animationCurveRelationship.match(/Z/)) curveNodesMap.get(animationCurveID).curves['z'] = animationCurve;
                else if (animationCurveRelationship.match(/DeformPercent/) && curveNodesMap.has(animationCurveID)) curveNodesMap.get(animationCurveID).curves['morph'] = animationCurve;
            }
        }
    }
    // parse nodes in FBXTree.Objects.AnimationLayer. Each layers holds references
    // to various AnimationCurveNodes and is referenced by an AnimationStack node
    // note: theoretically a stack can have multiple layers, however in practice there always seems to be one per stack
    parseAnimationLayers(curveNodesMap) {
        const rawLayers = fbxTree.Objects.AnimationLayer;
        const layersMap = new Map();
        for(const nodeID in rawLayers){
            const layerCurveNodes = [];
            const connection = connections.get(parseInt(nodeID));
            if (connection !== undefined) {
                // all the animationCurveNodes used in the layer
                const children = connection.children;
                children.forEach(function(child, i) {
                    if (curveNodesMap.has(child.ID)) {
                        const curveNode = curveNodesMap.get(child.ID);
                        // check that the curves are defined for at least one axis, otherwise ignore the curveNode
                        if (curveNode.curves.x !== undefined || curveNode.curves.y !== undefined || curveNode.curves.z !== undefined) {
                            if (layerCurveNodes[i] === undefined) {
                                const filteredParents = connections.get(child.ID).parents.filter(function(parent) {
                                    return parent.relationship !== undefined;
                                });
                                if (filteredParents.length === 0) return;
                                const modelID = filteredParents[0].ID;
                                if (modelID !== undefined) {
                                    const rawModel = fbxTree.Objects.Model[modelID.toString()];
                                    if (rawModel === undefined) {
                                        console.warn('THREE.FBXLoader: Encountered a unused curve.', child);
                                        return;
                                    }
                                    const node = {
                                        modelName: rawModel.attrName ? (0, _three.PropertyBinding).sanitizeNodeName(rawModel.attrName) : '',
                                        ID: rawModel.id,
                                        initialPosition: [
                                            0,
                                            0,
                                            0
                                        ],
                                        initialRotation: [
                                            0,
                                            0,
                                            0
                                        ],
                                        initialScale: [
                                            1,
                                            1,
                                            1
                                        ]
                                    };
                                    sceneGraph.traverse(function(child) {
                                        if (child.ID === rawModel.id) {
                                            node.transform = child.matrix;
                                            if (child.userData.transformData) {
                                                node.eulerOrder = child.userData.transformData.eulerOrder;
                                                if (child.userData.transformData.rotation) node.initialRotation = child.userData.transformData.rotation;
                                            }
                                        }
                                    });
                                    if (!node.transform) node.transform = new (0, _three.Matrix4)();
                                    // if the animated model is pre rotated, we'll have to apply the pre rotations to every
                                    // animation value as well
                                    if ('PreRotation' in rawModel) node.preRotation = rawModel.PreRotation.value;
                                    if ('PostRotation' in rawModel) node.postRotation = rawModel.PostRotation.value;
                                    layerCurveNodes[i] = node;
                                }
                            }
                            if (layerCurveNodes[i]) layerCurveNodes[i][curveNode.attr] = curveNode;
                        } else if (curveNode.curves.morph !== undefined) {
                            if (layerCurveNodes[i] === undefined) {
                                const filteredParents = connections.get(child.ID).parents.filter(function(parent) {
                                    return parent.relationship !== undefined;
                                });
                                if (filteredParents.length === 0) return;
                                const deformerID = filteredParents[0].ID;
                                const morpherID = connections.get(deformerID).parents[0].ID;
                                const geoID = connections.get(morpherID).parents[0].ID;
                                // assuming geometry is not used in more than one model
                                const modelID = connections.get(geoID).parents[0].ID;
                                const rawModel = fbxTree.Objects.Model[modelID];
                                const node = {
                                    modelName: rawModel.attrName ? (0, _three.PropertyBinding).sanitizeNodeName(rawModel.attrName) : '',
                                    morphName: fbxTree.Objects.Deformer[deformerID].attrName
                                };
                                layerCurveNodes[i] = node;
                            }
                            layerCurveNodes[i][curveNode.attr] = curveNode;
                        }
                    }
                });
                layersMap.set(parseInt(nodeID), layerCurveNodes);
            }
        }
        return layersMap;
    }
    // parse nodes in FBXTree.Objects.AnimationStack. These are the top level node in the animation
    // hierarchy. Each Stack node will be used to create an AnimationClip
    parseAnimStacks(layersMap) {
        const rawStacks = fbxTree.Objects.AnimationStack;
        // connect the stacks (clips) up to the layers
        const rawClips = {};
        for(const nodeID in rawStacks){
            const children = connections.get(parseInt(nodeID)).children;
            if (children.length > 1) // it seems like stacks will always be associated with a single layer. But just in case there are files
            // where there are multiple layers per stack, we'll display a warning
            console.warn('THREE.FBXLoader: Encountered an animation stack with multiple layers, this is currently not supported. Ignoring subsequent layers.');
            const layer = layersMap.get(children[0].ID);
            rawClips[nodeID] = {
                name: rawStacks[nodeID].attrName,
                layer: layer
            };
        }
        return rawClips;
    }
    addClip(rawClip) {
        let tracks = [];
        const scope = this;
        rawClip.layer.forEach(function(rawTracks) {
            tracks = tracks.concat(scope.generateTracks(rawTracks));
        });
        return new (0, _three.AnimationClip)(rawClip.name, -1, tracks);
    }
    generateTracks(rawTracks) {
        const tracks = [];
        let initialPosition = new (0, _three.Vector3)();
        let initialScale = new (0, _three.Vector3)();
        if (rawTracks.transform) rawTracks.transform.decompose(initialPosition, new (0, _three.Quaternion)(), initialScale);
        initialPosition = initialPosition.toArray();
        initialScale = initialScale.toArray();
        if (rawTracks.T !== undefined && Object.keys(rawTracks.T.curves).length > 0) {
            const positionTrack = this.generateVectorTrack(rawTracks.modelName, rawTracks.T.curves, initialPosition, 'position');
            if (positionTrack !== undefined) tracks.push(positionTrack);
        }
        if (rawTracks.R !== undefined && Object.keys(rawTracks.R.curves).length > 0) {
            const rotationTrack = this.generateRotationTrack(rawTracks.modelName, rawTracks.R.curves, rawTracks.preRotation, rawTracks.postRotation, rawTracks.eulerOrder, rawTracks.initialRotation);
            if (rotationTrack !== undefined) tracks.push(rotationTrack);
        }
        if (rawTracks.S !== undefined && Object.keys(rawTracks.S.curves).length > 0) {
            const scaleTrack = this.generateVectorTrack(rawTracks.modelName, rawTracks.S.curves, initialScale, 'scale');
            if (scaleTrack !== undefined) tracks.push(scaleTrack);
        }
        if (rawTracks.DeformPercent !== undefined) {
            const morphTrack = this.generateMorphTrack(rawTracks);
            if (morphTrack !== undefined) tracks.push(morphTrack);
        }
        return tracks;
    }
    generateVectorTrack(modelName, curves, initialValue, type) {
        const times = this.getTimesForAllAxes(curves);
        const values = this.getKeyframeTrackValues(times, curves, initialValue);
        return new (0, _three.VectorKeyframeTrack)(modelName + '.' + type, times, values);
    }
    generateRotationTrack(modelName, curves, preRotation, postRotation, eulerOrder, initialRotation) {
        let times;
        let values;
        if (curves.x !== undefined || curves.y !== undefined || curves.z !== undefined) {
            // Get merged, sorted, unique times from all available curves
            const mergedTimes = this.getTimesForAllAxes(curves);
            if (mergedTimes.length > 0) {
                const initialRot = initialRotation || [
                    0,
                    0,
                    0
                ];
                // Synchronize all curves to the merged time array.
                // Missing axes are filled with constant values from the initial rotation (Lcl Rotation).
                // Existing curves at different times are linearly interpolated.
                const syncX = this.synchronizeCurve(curves.x, mergedTimes, initialRot[0]);
                const syncY = this.synchronizeCurve(curves.y, mergedTimes, initialRot[1]);
                const syncZ = this.synchronizeCurve(curves.z, mergedTimes, initialRot[2]);
                const result = this.interpolateRotations(syncX, syncY, syncZ, eulerOrder);
                times = result[0];
                values = result[1];
            }
        }
        // For Maya models using "Joint Orient", Euler order only applies to rotation, not pre/post-rotations
        const defaultEulerOrder = getEulerOrder(0);
        if (preRotation !== undefined) {
            preRotation = preRotation.map((0, _three.MathUtils).degToRad);
            preRotation.push(defaultEulerOrder);
            preRotation = new (0, _three.Euler)().fromArray(preRotation);
            preRotation = new (0, _three.Quaternion)().setFromEuler(preRotation);
        }
        if (postRotation !== undefined) {
            postRotation = postRotation.map((0, _three.MathUtils).degToRad);
            postRotation.push(defaultEulerOrder);
            postRotation = new (0, _three.Euler)().fromArray(postRotation);
            postRotation = new (0, _three.Quaternion)().setFromEuler(postRotation).invert();
        }
        const quaternion = new (0, _three.Quaternion)();
        const euler = new (0, _three.Euler)();
        const quaternionValues = [];
        if (!values || !times) return undefined;
        for(let i = 0; i < values.length; i += 3){
            euler.set(values[i], values[i + 1], values[i + 2], eulerOrder);
            quaternion.setFromEuler(euler);
            if (preRotation !== undefined) quaternion.premultiply(preRotation);
            if (postRotation !== undefined) quaternion.multiply(postRotation);
            // Check unroll
            if (i > 2) {
                const prevQuat = new (0, _three.Quaternion)().fromArray(quaternionValues, (i - 3) / 3 * 4);
                if (prevQuat.dot(quaternion) < 0) quaternion.set(-quaternion.x, -quaternion.y, -quaternion.z, -quaternion.w);
            }
            quaternion.toArray(quaternionValues, i / 3 * 4);
        }
        return new (0, _three.QuaternionKeyframeTrack)(modelName + '.quaternion', times, quaternionValues);
    }
    generateMorphTrack(rawTracks) {
        const curves = rawTracks.DeformPercent.curves.morph;
        const values = curves.values.map(function(val) {
            return val / 100;
        });
        const morphNum = sceneGraph.getObjectByName(rawTracks.modelName).morphTargetDictionary[rawTracks.morphName];
        return new (0, _three.NumberKeyframeTrack)(rawTracks.modelName + '.morphTargetInfluences[' + morphNum + ']', curves.times, values);
    }
    // For all animated objects, times are defined separately for each axis
    // Here we'll combine the times into one sorted array without duplicates
    getTimesForAllAxes(curves) {
        let times = [];
        // first join together the times for each axis, if defined
        if (curves.x !== undefined) times = times.concat(curves.x.times);
        if (curves.y !== undefined) times = times.concat(curves.y.times);
        if (curves.z !== undefined) times = times.concat(curves.z.times);
        // then sort them
        times = times.sort(function(a, b) {
            return a - b;
        });
        // and remove duplicates
        if (times.length > 1) {
            let targetIndex = 1;
            let lastValue = times[0];
            for(let i = 1; i < times.length; i++){
                const currentValue = times[i];
                if (currentValue !== lastValue) {
                    times[targetIndex] = currentValue;
                    lastValue = currentValue;
                    targetIndex++;
                }
            }
            times = times.slice(0, targetIndex);
        }
        return times;
    }
    getKeyframeTrackValues(times, curves, initialValue) {
        const prevValue = initialValue;
        const values = [];
        let xIndex = -1;
        let yIndex = -1;
        let zIndex = -1;
        times.forEach(function(time) {
            if (curves.x) xIndex = curves.x.times.indexOf(time);
            if (curves.y) yIndex = curves.y.times.indexOf(time);
            if (curves.z) zIndex = curves.z.times.indexOf(time);
            // if there is an x value defined for this frame, use that
            if (xIndex !== -1) {
                const xValue = curves.x.values[xIndex];
                values.push(xValue);
                prevValue[0] = xValue;
            } else // otherwise use the x value from the previous frame
            values.push(prevValue[0]);
            if (yIndex !== -1) {
                const yValue = curves.y.values[yIndex];
                values.push(yValue);
                prevValue[1] = yValue;
            } else values.push(prevValue[1]);
            if (zIndex !== -1) {
                const zValue = curves.z.values[zIndex];
                values.push(zValue);
                prevValue[2] = zValue;
            } else values.push(prevValue[2]);
        });
        return values;
    }
    // Synchronize a curve to a target time array using linear interpolation.
    // If the curve is undefined (axis not animated), returns constant values from initialValue.
    synchronizeCurve(curve, targetTimes, initialValue) {
        if (curve === undefined) return {
            times: targetTimes,
            values: targetTimes.map(()=>initialValue)
        };
        // If the curve already has the same number of keyframes as the target, assume times match
        if (curve.times.length === targetTimes.length) return curve;
        // Linearly interpolate curve values at each target time
        const values = [];
        for(let i = 0; i < targetTimes.length; i++)values.push(this.sampleCurveValue(curve, targetTimes[i], initialValue));
        return {
            times: targetTimes,
            values: values
        };
    }
    // Sample a single value from a curve at a given time using linear interpolation
    sampleCurveValue(curve, time, initialValue) {
        const times = curve.times;
        const values = curve.values;
        // Before first keyframe
        if (time <= times[0]) return values[0];
        // After last keyframe
        if (time >= times[times.length - 1]) return values[values.length - 1];
        // Find surrounding keyframes and linearly interpolate
        for(let i = 0; i < times.length - 1; i++)if (time >= times[i] && time <= times[i + 1]) {
            if (times[i] === time) return values[i];
            const alpha = (time - times[i]) / (times[i + 1] - times[i]);
            return values[i] * (1 - alpha) + values[i + 1] * alpha;
        }
        return initialValue;
    }
    // Rotations are defined as Euler angles which can have values  of any size
    // These will be converted to quaternions which don't support values greater than
    // PI, so we'll interpolate large rotations
    interpolateRotations(curvex, curvey, curvez, eulerOrder) {
        const times = [];
        const values = [];
        // Add first frame
        times.push(curvex.times[0]);
        values.push((0, _three.MathUtils).degToRad(curvex.values[0]));
        values.push((0, _three.MathUtils).degToRad(curvey.values[0]));
        values.push((0, _three.MathUtils).degToRad(curvez.values[0]));
        for(let i = 1; i < curvex.values.length; i++){
            const initialValue = [
                curvex.values[i - 1],
                curvey.values[i - 1],
                curvez.values[i - 1]
            ];
            if (isNaN(initialValue[0]) || isNaN(initialValue[1]) || isNaN(initialValue[2])) continue;
            const initialValueRad = initialValue.map((0, _three.MathUtils).degToRad);
            const currentValue = [
                curvex.values[i],
                curvey.values[i],
                curvez.values[i]
            ];
            if (isNaN(currentValue[0]) || isNaN(currentValue[1]) || isNaN(currentValue[2])) continue;
            const currentValueRad = currentValue.map((0, _three.MathUtils).degToRad);
            const valuesSpan = [
                currentValue[0] - initialValue[0],
                currentValue[1] - initialValue[1],
                currentValue[2] - initialValue[2]
            ];
            const absoluteSpan = [
                Math.abs(valuesSpan[0]),
                Math.abs(valuesSpan[1]),
                Math.abs(valuesSpan[2])
            ];
            if (absoluteSpan[0] >= 180 || absoluteSpan[1] >= 180 || absoluteSpan[2] >= 180) {
                const maxAbsSpan = Math.max(...absoluteSpan);
                const numSubIntervals = maxAbsSpan / 180;
                const E1 = new (0, _three.Euler)(...initialValueRad, eulerOrder);
                const E2 = new (0, _three.Euler)(...currentValueRad, eulerOrder);
                const Q1 = new (0, _three.Quaternion)().setFromEuler(E1);
                const Q2 = new (0, _three.Quaternion)().setFromEuler(E2);
                // Check unroll
                if (Q1.dot(Q2) < 0) Q2.set(-Q2.x, -Q2.y, -Q2.z, -Q2.w);
                // Interpolate
                const initialTime = curvex.times[i - 1];
                const timeSpan = curvex.times[i] - initialTime;
                const Q = new (0, _three.Quaternion)();
                const E = new (0, _three.Euler)();
                for(let t = 0; t < 1; t += 1 / numSubIntervals){
                    Q.copy(Q1.clone().slerp(Q2.clone(), t));
                    times.push(initialTime + t * timeSpan);
                    E.setFromQuaternion(Q, eulerOrder);
                    values.push(E.x);
                    values.push(E.y);
                    values.push(E.z);
                }
            } else {
                times.push(curvex.times[i]);
                values.push((0, _three.MathUtils).degToRad(curvex.values[i]));
                values.push((0, _three.MathUtils).degToRad(curvey.values[i]));
                values.push((0, _three.MathUtils).degToRad(curvez.values[i]));
            }
        }
        return [
            times,
            values
        ];
    }
}
// parse an FBX file in ASCII format
class TextParser {
    getPrevNode() {
        return this.nodeStack[this.currentIndent - 2];
    }
    getCurrentNode() {
        return this.nodeStack[this.currentIndent - 1];
    }
    getCurrentProp() {
        return this.currentProp;
    }
    pushStack(node) {
        this.nodeStack.push(node);
        this.currentIndent += 1;
    }
    popStack() {
        this.nodeStack.pop();
        this.currentIndent -= 1;
    }
    setCurrentProp(val, name) {
        this.currentProp = val;
        this.currentPropName = name;
    }
    parse(text) {
        this.currentIndent = 0;
        this.allNodes = new FBXTree();
        this.nodeStack = [];
        this.currentProp = [];
        this.currentPropName = '';
        const scope = this;
        const split = text.split(/[\r\n]+/);
        split.forEach(function(line, i) {
            const matchComment = line.match(/^[\s\t]*;/);
            const matchEmpty = line.match(/^[\s\t]*$/);
            if (matchComment || matchEmpty) return;
            const matchBeginning = line.match('^\\t{' + scope.currentIndent + '}(\\w+):(.*){', '');
            const matchProperty = line.match('^\\t{' + scope.currentIndent + '}(\\w+):[\\s\\t\\r\\n](.*)');
            const matchEnd = line.match('^\\t{' + (scope.currentIndent - 1) + '}}');
            if (matchBeginning) scope.parseNodeBegin(line, matchBeginning);
            else if (matchProperty) scope.parseNodeProperty(line, matchProperty, split[++i]);
            else if (matchEnd) scope.popStack();
            else if (line.match(/^[^\s\t}]/)) // large arrays are split over multiple lines terminated with a ',' character
            // if this is encountered the line needs to be joined to the previous line
            scope.parseNodePropertyContinued(line);
        });
        return this.allNodes;
    }
    parseNodeBegin(line, property) {
        const nodeName = property[1].trim().replace(/^"/, '').replace(/"$/, '');
        const nodeAttrs = property[2].split(',').map(function(attr) {
            return attr.trim().replace(/^"/, '').replace(/"$/, '');
        });
        const node = {
            name: nodeName
        };
        const attrs = this.parseNodeAttr(nodeAttrs);
        const currentNode = this.getCurrentNode();
        // a top node
        if (this.currentIndent === 0) this.allNodes.add(nodeName, node);
        else {
            // if the subnode already exists, append it
            if (nodeName in currentNode) {
                // special case Pose needs PoseNodes as an array
                if (nodeName === 'PoseNode') currentNode.PoseNode.push(node);
                else if (currentNode[nodeName].id !== undefined) {
                    currentNode[nodeName] = {};
                    currentNode[nodeName][currentNode[nodeName].id] = currentNode[nodeName];
                }
                if (attrs.id !== '') currentNode[nodeName][attrs.id] = node;
            } else if (typeof attrs.id === 'number') {
                currentNode[nodeName] = {};
                currentNode[nodeName][attrs.id] = node;
            } else if (nodeName !== 'Properties70') {
                if (nodeName === 'PoseNode') currentNode[nodeName] = [
                    node
                ];
                else currentNode[nodeName] = node;
            }
        }
        if (typeof attrs.id === 'number') node.id = attrs.id;
        if (attrs.name !== '') node.attrName = attrs.name;
        if (attrs.type !== '') node.attrType = attrs.type;
        this.pushStack(node);
    }
    parseNodeAttr(attrs) {
        let id = attrs[0];
        if (attrs[0] !== '') {
            id = parseInt(attrs[0]);
            if (isNaN(id)) id = attrs[0];
        }
        let name = '', type = '';
        if (attrs.length > 1) {
            name = attrs[1].replace(/^(\w+)::/, '');
            type = attrs[2];
        }
        return {
            id: id,
            name: name,
            type: type
        };
    }
    parseNodeProperty(line, property, contentLine) {
        let propName = property[1].replace(/^"/, '').replace(/"$/, '').trim();
        let propValue = property[2].replace(/^"/, '').replace(/"$/, '').trim();
        // for special case: base64 image data follows "Content: ," line
        //	Content: ,
        //	 "/9j/4RDaRXhpZgAATU0A..."
        if (propName === 'Content' && propValue === ',') propValue = contentLine.replace(/"/g, '').replace(/,$/, '').trim();
        const currentNode = this.getCurrentNode();
        const parentName = currentNode.name;
        if (parentName === 'Properties70') {
            this.parseNodeSpecialProperty(line, propName, propValue);
            return;
        }
        // Connections
        if (propName === 'C') {
            const connProps = propValue.split(',').slice(1);
            const from = parseInt(connProps[0]);
            const to = parseInt(connProps[1]);
            let rest = propValue.split(',').slice(3);
            rest = rest.map(function(elem) {
                return elem.trim().replace(/^"/, '');
            });
            propName = 'connections';
            propValue = [
                from,
                to
            ];
            append(propValue, rest);
            if (currentNode[propName] === undefined) currentNode[propName] = [];
        }
        // Node
        if (propName === 'Node') currentNode.id = propValue;
        // connections
        if (propName in currentNode && Array.isArray(currentNode[propName])) currentNode[propName].push(propValue);
        else if (propName !== 'a') currentNode[propName] = propValue;
        else currentNode.a = propValue;
        this.setCurrentProp(currentNode, propName);
        // convert string to array, unless it ends in ',' in which case more will be added to it
        if (propName === 'a' && propValue.slice(-1) !== ',') currentNode.a = parseNumberArray(propValue);
    }
    parseNodePropertyContinued(line) {
        const currentNode = this.getCurrentNode();
        currentNode.a += line;
        // if the line doesn't end in ',' we have reached the end of the property value
        // so convert the string to an array
        if (line.slice(-1) !== ',') currentNode.a = parseNumberArray(currentNode.a);
    }
    // parse "Property70"
    parseNodeSpecialProperty(line, propName, propValue) {
        // split this
        // P: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
        // into array like below
        // ["Lcl Scaling", "Lcl Scaling", "", "A", "1,1,1" ]
        const props = propValue.split('",').map(function(prop) {
            return prop.trim().replace(/^\"/, '').replace(/\s/, '_');
        });
        const innerPropName = props[0];
        const innerPropType1 = props[1];
        const innerPropType2 = props[2];
        const innerPropFlag = props[3];
        let innerPropValue = props[4];
        // cast values where needed, otherwise leave as strings
        switch(innerPropType1){
            case 'int':
            case 'enum':
            case 'bool':
            case 'ULongLong':
            case 'double':
            case 'Number':
            case 'FieldOfView':
                innerPropValue = parseFloat(innerPropValue);
                break;
            case 'Color':
            case 'ColorRGB':
            case 'Vector3D':
            case 'Lcl_Translation':
            case 'Lcl_Rotation':
            case 'Lcl_Scaling':
                innerPropValue = parseNumberArray(innerPropValue);
                break;
        }
        // CAUTION: these props must append to parent's parent
        this.getPrevNode()[innerPropName] = {
            'type': innerPropType1,
            'type2': innerPropType2,
            'flag': innerPropFlag,
            'value': innerPropValue
        };
        this.setCurrentProp(this.getPrevNode(), innerPropName);
    }
}
// Parse an FBX file in Binary format
class BinaryParser {
    parse(buffer) {
        const reader = new BinaryReader(buffer);
        reader.skip(23); // skip magic 23 bytes
        const version = reader.getUint32();
        if (version < 6400) throw new Error('THREE.FBXLoader: FBX version not supported, FileVersion: ' + version);
        const allNodes = new FBXTree();
        while(!this.endOfContent(reader)){
            const node = this.parseNode(reader, version);
            if (node !== null) allNodes.add(node.name, node);
        }
        return allNodes;
    }
    // Check if reader has reached the end of content.
    endOfContent(reader) {
        // footer size: 160bytes + 16-byte alignment padding
        // - 16bytes: magic
        // - padding til 16-byte alignment (at least 1byte?)
        //	(seems like some exporters embed fixed 15 or 16bytes?)
        // - 4bytes: magic
        // - 4bytes: version
        // - 120bytes: zero
        // - 16bytes: magic
        if (reader.size() % 16 === 0) return (reader.getOffset() + 160 + 16 & -16) >= reader.size();
        else return reader.getOffset() + 160 + 16 >= reader.size();
    }
    // recursively parse nodes until the end of the file is reached
    parseNode(reader, version) {
        const node = {};
        // The first three data sizes depends on version.
        const endOffset = version >= 7500 ? reader.getUint64() : reader.getUint32();
        const numProperties = version >= 7500 ? reader.getUint64() : reader.getUint32();
        version >= 7500 ? reader.getUint64() : reader.getUint32(); // the returned propertyListLen is not used
        const nameLen = reader.getUint8();
        const name = reader.getString(nameLen);
        // Regards this node as NULL-record if endOffset is zero
        if (endOffset === 0) return null;
        const propertyList = [];
        for(let i = 0; i < numProperties; i++)propertyList.push(this.parseProperty(reader));
        // Regards the first three elements in propertyList as id, attrName, and attrType
        const id = propertyList.length > 0 ? propertyList[0] : '';
        const attrName = propertyList.length > 1 ? propertyList[1] : '';
        const attrType = propertyList.length > 2 ? propertyList[2] : '';
        // check if this node represents just a single property
        // like (name, 0) set or (name2, [0, 1, 2]) set of {name: 0, name2: [0, 1, 2]}
        node.singleProperty = numProperties === 1 && reader.getOffset() === endOffset ? true : false;
        while(endOffset > reader.getOffset()){
            const subNode = this.parseNode(reader, version);
            if (subNode !== null) this.parseSubNode(name, node, subNode);
        }
        node.propertyList = propertyList; // raw property list used by parent
        if (typeof id === 'number') node.id = id;
        if (attrName !== '') node.attrName = attrName;
        if (attrType !== '') node.attrType = attrType;
        if (name !== '') node.name = name;
        return node;
    }
    parseSubNode(name, node, subNode) {
        // special case: child node is single property
        if (subNode.singleProperty === true) {
            const value = subNode.propertyList[0];
            if (Array.isArray(value)) {
                node[subNode.name] = subNode;
                subNode.a = value;
            } else node[subNode.name] = value;
        } else if (name === 'Connections' && subNode.name === 'C') {
            const array = [];
            subNode.propertyList.forEach(function(property, i) {
                // first Connection is FBX type (OO, OP, etc.). We'll discard these
                if (i !== 0) array.push(property);
            });
            if (node.connections === undefined) node.connections = [];
            node.connections.push(array);
        } else if (subNode.name === 'Properties70') {
            const keys = Object.keys(subNode);
            keys.forEach(function(key) {
                node[key] = subNode[key];
            });
        } else if (name === 'Properties70' && subNode.name === 'P') {
            let innerPropName = subNode.propertyList[0];
            let innerPropType1 = subNode.propertyList[1];
            const innerPropType2 = subNode.propertyList[2];
            const innerPropFlag = subNode.propertyList[3];
            let innerPropValue;
            if (innerPropName.indexOf('Lcl ') === 0) innerPropName = innerPropName.replace('Lcl ', 'Lcl_');
            if (innerPropType1.indexOf('Lcl ') === 0) innerPropType1 = innerPropType1.replace('Lcl ', 'Lcl_');
            if (innerPropType1 === 'Color' || innerPropType1 === 'ColorRGB' || innerPropType1 === 'Vector' || innerPropType1 === 'Vector3D' || innerPropType1.indexOf('Lcl_') === 0) innerPropValue = [
                subNode.propertyList[4],
                subNode.propertyList[5],
                subNode.propertyList[6]
            ];
            else innerPropValue = subNode.propertyList[4];
            // this will be copied to parent, see above
            node[innerPropName] = {
                'type': innerPropType1,
                'type2': innerPropType2,
                'flag': innerPropFlag,
                'value': innerPropValue
            };
        } else if (node[subNode.name] === undefined) {
            if (typeof subNode.id === 'number') {
                node[subNode.name] = {};
                node[subNode.name][subNode.id] = subNode;
            } else node[subNode.name] = subNode;
        } else {
            if (subNode.name === 'PoseNode') {
                if (!Array.isArray(node[subNode.name])) node[subNode.name] = [
                    node[subNode.name]
                ];
                node[subNode.name].push(subNode);
            } else if (node[subNode.name][subNode.id] === undefined) node[subNode.name][subNode.id] = subNode;
        }
    }
    parseProperty(reader) {
        const type = reader.getString(1);
        let length;
        switch(type){
            case 'C':
                return reader.getBoolean();
            case 'D':
                return reader.getFloat64();
            case 'F':
                return reader.getFloat32();
            case 'I':
                return reader.getInt32();
            case 'L':
                return reader.getInt64();
            case 'R':
                length = reader.getUint32();
                return reader.getArrayBuffer(length);
            case 'S':
                length = reader.getUint32();
                return reader.getString(length);
            case 'Y':
                return reader.getInt16();
            case 'b':
            case 'c':
            case 'd':
            case 'f':
            case 'i':
            case 'l':
                const arrayLength = reader.getUint32();
                const encoding = reader.getUint32(); // 0: non-compressed, 1: compressed
                const compressedLength = reader.getUint32();
                if (encoding === 0) switch(type){
                    case 'b':
                    case 'c':
                        return reader.getBooleanArray(arrayLength);
                    case 'd':
                        return reader.getFloat64Array(arrayLength);
                    case 'f':
                        return reader.getFloat32Array(arrayLength);
                    case 'i':
                        return reader.getInt32Array(arrayLength);
                    case 'l':
                        return reader.getInt64Array(arrayLength);
                }
                const data = (0, _fflateModuleJs.unzlibSync)(new Uint8Array(reader.getArrayBuffer(compressedLength)));
                const reader2 = new BinaryReader(data.buffer);
                switch(type){
                    case 'b':
                    case 'c':
                        return reader2.getBooleanArray(arrayLength);
                    case 'd':
                        return reader2.getFloat64Array(arrayLength);
                    case 'f':
                        return reader2.getFloat32Array(arrayLength);
                    case 'i':
                        return reader2.getInt32Array(arrayLength);
                    case 'l':
                        return reader2.getInt64Array(arrayLength);
                }
                break; // cannot happen but is required by the DeepScan
            default:
                throw new Error('THREE.FBXLoader: Unknown property type ' + type);
        }
    }
}
class BinaryReader {
    constructor(buffer, littleEndian){
        this.dv = new DataView(buffer);
        this.offset = 0;
        this.littleEndian = littleEndian !== undefined ? littleEndian : true;
        this._textDecoder = new TextDecoder();
    }
    getOffset() {
        return this.offset;
    }
    size() {
        return this.dv.buffer.byteLength;
    }
    skip(length) {
        this.offset += length;
    }
    // seems like true/false representation depends on exporter.
    // true: 1 or 'Y'(=0x59), false: 0 or 'T'(=0x54)
    // then sees LSB.
    getBoolean() {
        return (this.getUint8() & 1) === 1;
    }
    getBooleanArray(size) {
        const a = [];
        for(let i = 0; i < size; i++)a.push(this.getBoolean());
        return a;
    }
    getUint8() {
        const value = this.dv.getUint8(this.offset);
        this.offset += 1;
        return value;
    }
    getInt16() {
        const value = this.dv.getInt16(this.offset, this.littleEndian);
        this.offset += 2;
        return value;
    }
    getInt32() {
        const value = this.dv.getInt32(this.offset, this.littleEndian);
        this.offset += 4;
        return value;
    }
    getInt32Array(size) {
        const a = [];
        for(let i = 0; i < size; i++)a.push(this.getInt32());
        return a;
    }
    getUint32() {
        const value = this.dv.getUint32(this.offset, this.littleEndian);
        this.offset += 4;
        return value;
    }
    // JavaScript doesn't support 64-bit integer so calculate this here
    // 1 << 32 will return 1 so using multiply operation instead here.
    // There's a possibility that this method returns wrong value if the value
    // is out of the range between Number.MAX_SAFE_INTEGER and Number.MIN_SAFE_INTEGER.
    // TODO: safely handle 64-bit integer
    getInt64() {
        let low, high;
        if (this.littleEndian) {
            low = this.getUint32();
            high = this.getUint32();
        } else {
            high = this.getUint32();
            low = this.getUint32();
        }
        // calculate negative value
        if (high & 0x80000000) {
            high = ~high & 0xFFFFFFFF;
            low = ~low & 0xFFFFFFFF;
            if (low === 0xFFFFFFFF) high = high + 1 & 0xFFFFFFFF;
            low = low + 1 & 0xFFFFFFFF;
            return -(high * 0x100000000 + low);
        }
        return high * 0x100000000 + low;
    }
    getInt64Array(size) {
        const a = [];
        for(let i = 0; i < size; i++)a.push(this.getInt64());
        return a;
    }
    // Note: see getInt64() comment
    getUint64() {
        let low, high;
        if (this.littleEndian) {
            low = this.getUint32();
            high = this.getUint32();
        } else {
            high = this.getUint32();
            low = this.getUint32();
        }
        return high * 0x100000000 + low;
    }
    getFloat32() {
        const value = this.dv.getFloat32(this.offset, this.littleEndian);
        this.offset += 4;
        return value;
    }
    getFloat32Array(size) {
        const a = [];
        for(let i = 0; i < size; i++)a.push(this.getFloat32());
        return a;
    }
    getFloat64() {
        const value = this.dv.getFloat64(this.offset, this.littleEndian);
        this.offset += 8;
        return value;
    }
    getFloat64Array(size) {
        const a = [];
        for(let i = 0; i < size; i++)a.push(this.getFloat64());
        return a;
    }
    getArrayBuffer(size) {
        const value = this.dv.buffer.slice(this.offset, this.offset + size);
        this.offset += size;
        return value;
    }
    getString(size) {
        const start = this.offset;
        let a = new Uint8Array(this.dv.buffer, start, size);
        this.skip(size);
        const nullByte = a.indexOf(0);
        if (nullByte >= 0) a = new Uint8Array(this.dv.buffer, start, nullByte);
        return this._textDecoder.decode(a);
    }
}
// FBXTree holds a representation of the FBX data, returned by the TextParser ( FBX ASCII format)
// and BinaryParser( FBX Binary format)
class FBXTree {
    add(key, val) {
        this[key] = val;
    }
}
// ************** UTILITY FUNCTIONS **************
function isFbxFormatBinary(buffer) {
    const CORRECT = 'Kaydara\u0020FBX\u0020Binary\u0020\u0020\0';
    return buffer.byteLength >= CORRECT.length && CORRECT === convertArrayBufferToString(buffer, 0, CORRECT.length);
}
function isFbxFormatASCII(text) {
    const CORRECT = [
        'K',
        'a',
        'y',
        'd',
        'a',
        'r',
        'a',
        '\\',
        'F',
        'B',
        'X',
        '\\',
        'B',
        'i',
        'n',
        'a',
        'r',
        'y',
        '\\',
        '\\'
    ];
    let cursor = 0;
    function read(offset) {
        const result = text[offset - 1];
        text = text.slice(cursor + offset);
        cursor++;
        return result;
    }
    for(let i = 0; i < CORRECT.length; ++i){
        const num = read(1);
        if (num === CORRECT[i]) return false;
    }
    return true;
}
function getFbxVersion(text) {
    const versionRegExp = /FBXVersion: (\d+)/;
    const match = text.match(versionRegExp);
    if (match) {
        const version = parseInt(match[1]);
        return version;
    }
    throw new Error('THREE.FBXLoader: Cannot find the version number for the file given.');
}
// Converts FBX ticks into real time seconds.
function convertFBXTimeToSeconds(time) {
    return time / 46186158000;
}
const dataArray = [];
// extracts the data from the correct position in the FBX array based on indexing type
function getData(polygonVertexIndex, polygonIndex, vertexIndex, infoObject) {
    let index;
    switch(infoObject.mappingType){
        case 'ByPolygonVertex':
            index = polygonVertexIndex;
            break;
        case 'ByPolygon':
            index = polygonIndex;
            break;
        case 'ByVertice':
            index = vertexIndex;
            break;
        case 'AllSame':
            index = infoObject.indices[0];
            break;
        default:
            console.warn('THREE.FBXLoader: unknown attribute mapping type ' + infoObject.mappingType);
    }
    if (infoObject.referenceType === 'IndexToDirect') index = infoObject.indices[index];
    const from = index * infoObject.dataSize;
    const to = from + infoObject.dataSize;
    return slice(dataArray, infoObject.buffer, from, to);
}
const tempEuler = new (0, _three.Euler)();
const tempVec = new (0, _three.Vector3)();
// generate transformation from FBX transform data
// ref: https://help.autodesk.com/view/FBX/2017/ENU/?guid=__files_GUID_10CDD63C_79C1_4F2D_BB28_AD2BE65A02ED_htm
// ref: http://docs.autodesk.com/FBX/2014/ENU/FBX-SDK-Documentation/index.html?url=cpp_ref/_transformations_2main_8cxx-example.html,topicNumber=cpp_ref__transformations_2main_8cxx_example_htmlfc10a1e1-b18d-4e72-9dc0-70d0f1959f5e
function generateTransform(transformData) {
    const lTranslationM = new (0, _three.Matrix4)();
    const lPreRotationM = new (0, _three.Matrix4)();
    const lRotationM = new (0, _three.Matrix4)();
    const lPostRotationM = new (0, _three.Matrix4)();
    const lScalingM = new (0, _three.Matrix4)();
    const lScalingPivotM = new (0, _three.Matrix4)();
    const lScalingOffsetM = new (0, _three.Matrix4)();
    const lRotationOffsetM = new (0, _three.Matrix4)();
    const lRotationPivotM = new (0, _three.Matrix4)();
    const lParentGX = new (0, _three.Matrix4)();
    const lParentLX = new (0, _three.Matrix4)();
    const lGlobalT = new (0, _three.Matrix4)();
    const inheritType = transformData.inheritType ? transformData.inheritType : 0;
    if (transformData.translation) lTranslationM.setPosition(tempVec.fromArray(transformData.translation));
    // For Maya models using "Joint Orient", Euler order only applies to rotation, not pre/post-rotations
    const defaultEulerOrder = getEulerOrder(0);
    if (transformData.preRotation) {
        const array = transformData.preRotation.map((0, _three.MathUtils).degToRad);
        array.push(defaultEulerOrder);
        lPreRotationM.makeRotationFromEuler(tempEuler.fromArray(array));
    }
    if (transformData.rotation) {
        const array = transformData.rotation.map((0, _three.MathUtils).degToRad);
        array.push(transformData.eulerOrder || defaultEulerOrder);
        lRotationM.makeRotationFromEuler(tempEuler.fromArray(array));
    }
    if (transformData.postRotation) {
        const array = transformData.postRotation.map((0, _three.MathUtils).degToRad);
        array.push(defaultEulerOrder);
        lPostRotationM.makeRotationFromEuler(tempEuler.fromArray(array));
        lPostRotationM.invert();
    }
    if (transformData.scale) lScalingM.scale(tempVec.fromArray(transformData.scale));
    // Pivots and offsets
    if (transformData.scalingOffset) lScalingOffsetM.setPosition(tempVec.fromArray(transformData.scalingOffset));
    if (transformData.scalingPivot) lScalingPivotM.setPosition(tempVec.fromArray(transformData.scalingPivot));
    if (transformData.rotationOffset) lRotationOffsetM.setPosition(tempVec.fromArray(transformData.rotationOffset));
    if (transformData.rotationPivot) lRotationPivotM.setPosition(tempVec.fromArray(transformData.rotationPivot));
    // parent transform
    if (transformData.parentMatrixWorld) {
        lParentLX.copy(transformData.parentMatrix);
        lParentGX.copy(transformData.parentMatrixWorld);
    }
    const lLRM = lPreRotationM.clone().multiply(lRotationM).multiply(lPostRotationM);
    // Global Rotation
    const lParentGRM = new (0, _three.Matrix4)();
    lParentGRM.extractRotation(lParentGX);
    // Global Shear*Scaling
    const lParentTM = new (0, _three.Matrix4)();
    lParentTM.copyPosition(lParentGX);
    const lParentGRSM = lParentTM.clone().invert().multiply(lParentGX);
    const lParentGSM = lParentGRM.clone().invert().multiply(lParentGRSM);
    const lLSM = lScalingM;
    const lGlobalRS = new (0, _three.Matrix4)();
    if (inheritType === 0) lGlobalRS.copy(lParentGRM).multiply(lLRM).multiply(lParentGSM).multiply(lLSM);
    else if (inheritType === 1) lGlobalRS.copy(lParentGRM).multiply(lParentGSM).multiply(lLRM).multiply(lLSM);
    else {
        const lParentLSM = new (0, _three.Matrix4)().scale(new (0, _three.Vector3)().setFromMatrixScale(lParentLX));
        const lParentLSM_inv = lParentLSM.clone().invert();
        const lParentGSM_noLocal = lParentGSM.clone().multiply(lParentLSM_inv);
        lGlobalRS.copy(lParentGRM).multiply(lLRM).multiply(lParentGSM_noLocal).multiply(lLSM);
    }
    const lRotationPivotM_inv = lRotationPivotM.clone().invert();
    const lScalingPivotM_inv = lScalingPivotM.clone().invert();
    // Calculate the local transform matrix
    let lTransform = lTranslationM.clone().multiply(lRotationOffsetM).multiply(lRotationPivotM).multiply(lPreRotationM).multiply(lRotationM).multiply(lPostRotationM).multiply(lRotationPivotM_inv).multiply(lScalingOffsetM).multiply(lScalingPivotM).multiply(lScalingM).multiply(lScalingPivotM_inv);
    const lLocalTWithAllPivotAndOffsetInfo = new (0, _three.Matrix4)().copyPosition(lTransform);
    const lGlobalTranslation = lParentGX.clone().multiply(lLocalTWithAllPivotAndOffsetInfo);
    lGlobalT.copyPosition(lGlobalTranslation);
    lTransform = lGlobalT.clone().multiply(lGlobalRS);
    // from global to local
    lTransform.premultiply(lParentGX.invert());
    return lTransform;
}
// Returns the three.js intrinsic Euler order corresponding to FBX extrinsic Euler order
// ref: http://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref_class_fbx_euler_html
function getEulerOrder(order) {
    order = order || 0;
    const enums = [
        'ZYX',
        'YZX',
        'XZY',
        'ZXY',
        'YXZ',
        'XYZ'
    ];
    if (order === 6) {
        console.warn('THREE.FBXLoader: unsupported Euler Order: Spherical XYZ. Animations and rotations may be incorrect.');
        return enums[0];
    }
    return enums[order];
}
// Parses comma separated list of numbers and returns them an array.
// Used internally by the TextParser
function parseNumberArray(value) {
    const array = value.split(',').map(function(val) {
        return parseFloat(val);
    });
    return array;
}
function convertArrayBufferToString(buffer, from, to) {
    if (from === undefined) from = 0;
    if (to === undefined) to = buffer.byteLength;
    return new TextDecoder().decode(new Uint8Array(buffer, from, to));
}
function append(a, b) {
    for(let i = 0, j = a.length, l = b.length; i < l; i++, j++)a[j] = b[i];
}
function slice(a, b, from, to) {
    for(let i = from, j = 0; i < to; i++, j++)a[j] = b[i];
    return a;
}

},{"three":"hJIVG","../libs/fflate.module.js":"4fbyW","../curves/NURBSCurve.js":"ipi02","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"ipi02":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "NURBSCurve", ()=>NURBSCurve);
var _three = require("three");
var _nurbsutilsJs = require("../curves/NURBSUtils.js");
/**
 * This class represents a NURBS curve.
 *
 * Implementation is based on `(x, y [, z=0 [, w=1]])` control points with `w=weight`.
 *
 * @augments Curve
 * @three_import import { NURBSCurve } from 'three/addons/curves/NURBSCurve.js';
 */ class NURBSCurve extends (0, _three.Curve) {
    /**
	 * Constructs a new NURBS curve.
	 *
	 * @param {number} degree - The NURBS degree.
	 * @param {Array<number>} knots - The knots as a flat array of numbers.
	 * @param {Array<Vector2|Vector3|Vector4>} controlPoints - An array holding control points.
	 * @param {number} [startKnot] - Index of the start knot into the `knots` array.
	 * @param {number} [endKnot] - Index of the end knot into the `knots` array.
	 */ constructor(degree, knots, controlPoints, startKnot, endKnot){
        super();
        const knotsLength = knots ? knots.length - 1 : 0;
        const pointsLength = controlPoints ? controlPoints.length : 0;
        /**
		 * The NURBS degree.
		 *
		 * @type {number}
		 */ this.degree = degree;
        /**
		 * The knots as a flat array of numbers.
		 *
		 * @type {Array<number>}
		 */ this.knots = knots;
        /**
		 * An array of control points.
		 *
		 * @type {Array<Vector4>}
		 */ this.controlPoints = [];
        /**
		 * Index of the start knot into the `knots` array.
		 *
		 * @type {number}
		 */ this.startKnot = startKnot || 0;
        /**
		 * Index of the end knot into the `knots` array.
		 *
		 * @type {number}
		 */ this.endKnot = endKnot || knotsLength;
        for(let i = 0; i < pointsLength; ++i){
            // ensure Vector4 for control points
            const point = controlPoints[i];
            this.controlPoints[i] = new (0, _three.Vector4)(point.x, point.y, point.z, point.w);
        }
    }
    /**
	 * This method returns a vector in 3D space for the given interpolation factor.
	 *
	 * @param {number} t - A interpolation factor representing a position on the curve. Must be in the range `[0,1]`.
	 * @param {Vector3} [optionalTarget] - The optional target vector the result is written to.
	 * @return {Vector3} The position on the curve.
	 */ getPoint(t, optionalTarget = new (0, _three.Vector3)()) {
        const point = optionalTarget;
        const u = this.knots[this.startKnot] + t * (this.knots[this.endKnot] - this.knots[this.startKnot]); // linear mapping t->u
        // following results in (wx, wy, wz, w) homogeneous point
        const hpoint = _nurbsutilsJs.calcBSplinePoint(this.degree, this.knots, this.controlPoints, u);
        if (hpoint.w !== 1.0) // project to 3D space: (wx, wy, wz, w) -> (x, y, z, 1)
        hpoint.divideScalar(hpoint.w);
        return point.set(hpoint.x, hpoint.y, hpoint.z);
    }
    /**
	 * Returns a unit vector tangent for the given interpolation factor.
	 *
	 * @param {number} t - The interpolation factor.
	 * @param {Vector3} [optionalTarget] - The optional target vector the result is written to.
	 * @return {Vector3} The tangent vector.
	 */ getTangent(t, optionalTarget = new (0, _three.Vector3)()) {
        const tangent = optionalTarget;
        const u = this.knots[0] + t * (this.knots[this.knots.length - 1] - this.knots[0]);
        const ders = _nurbsutilsJs.calcNURBSDerivatives(this.degree, this.knots, this.controlPoints, u, 1);
        tangent.copy(ders[1]).normalize();
        return tangent;
    }
    toJSON() {
        const data = super.toJSON();
        data.degree = this.degree;
        data.knots = [
            ...this.knots
        ];
        data.controlPoints = this.controlPoints.map((p)=>p.toArray());
        data.startKnot = this.startKnot;
        data.endKnot = this.endKnot;
        return data;
    }
    fromJSON(json) {
        super.fromJSON(json);
        this.degree = json.degree;
        this.knots = [
            ...json.knots
        ];
        this.controlPoints = json.controlPoints.map((p)=>new (0, _three.Vector4)(p[0], p[1], p[2], p[3]));
        this.startKnot = json.startKnot;
        this.endKnot = json.endKnot;
        return this;
    }
}

},{"three":"hJIVG","../curves/NURBSUtils.js":"kjx8O","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"kjx8O":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "findSpan", ()=>findSpan);
parcelHelpers.export(exports, "calcBasisFunctions", ()=>calcBasisFunctions);
parcelHelpers.export(exports, "calcBSplinePoint", ()=>calcBSplinePoint);
parcelHelpers.export(exports, "calcBasisFunctionDerivatives", ()=>calcBasisFunctionDerivatives);
parcelHelpers.export(exports, "calcBSplineDerivatives", ()=>calcBSplineDerivatives);
parcelHelpers.export(exports, "calcKoverI", ()=>calcKoverI);
parcelHelpers.export(exports, "calcRationalCurveDerivatives", ()=>calcRationalCurveDerivatives);
parcelHelpers.export(exports, "calcNURBSDerivatives", ()=>calcNURBSDerivatives);
parcelHelpers.export(exports, "calcSurfacePoint", ()=>calcSurfacePoint);
parcelHelpers.export(exports, "calcVolumePoint", ()=>calcVolumePoint);
var _three = require("three");
/**
 * @module NURBSUtils
 * @three_import import * as NURBSUtils from 'three/addons/curves/NURBSUtils.js';
 */ /**
 * Finds knot vector span.
 *
 * @param {number} p - The degree.
 * @param {number} u - The parametric value.
 * @param {Array<number>} U - The knot vector.
 * @return {number} The span.
 */ function findSpan(p, u, U) {
    const n = U.length - p - 1;
    if (u >= U[n]) return n - 1;
    if (u <= U[p]) return p;
    let low = p;
    let high = n;
    let mid = Math.floor((low + high) / 2);
    while(u < U[mid] || u >= U[mid + 1]){
        if (u < U[mid]) high = mid;
        else low = mid;
        mid = Math.floor((low + high) / 2);
    }
    return mid;
}
/**
 * Calculates basis functions. See The NURBS Book, page 70, algorithm A2.2.
 *
 * @param {number} span - The span in which `u` lies.
 * @param {number} u - The parametric value.
 * @param {number} p - The degree.
 * @param {Array<number>} U - The knot vector.
 * @return {Array<number>} Array[p+1] with basis functions values.
 */ function calcBasisFunctions(span, u, p, U) {
    const N = [];
    const left = [];
    const right = [];
    N[0] = 1.0;
    for(let j = 1; j <= p; ++j){
        left[j] = u - U[span + 1 - j];
        right[j] = U[span + j] - u;
        let saved = 0.0;
        for(let r = 0; r < j; ++r){
            const rv = right[r + 1];
            const lv = left[j - r];
            const temp = N[r] / (rv + lv);
            N[r] = saved + rv * temp;
            saved = lv * temp;
        }
        N[j] = saved;
    }
    return N;
}
/**
 * Calculates B-Spline curve points. See The NURBS Book, page 82, algorithm A3.1.
 *
 * @param {number} p - The degree of the B-Spline.
 * @param {Array<number>} U - The knot vector.
 * @param {Array<Vector4>} P - The control points
 * @param {number} u - The parametric point.
 * @return {Vector4} The point for given `u`.
 */ function calcBSplinePoint(p, U, P, u) {
    const span = findSpan(p, u, U);
    const N = calcBasisFunctions(span, u, p, U);
    const C = new (0, _three.Vector4)(0, 0, 0, 0);
    for(let j = 0; j <= p; ++j){
        const point = P[span - p + j];
        const Nj = N[j];
        const wNj = point.w * Nj;
        C.x += point.x * wNj;
        C.y += point.y * wNj;
        C.z += point.z * wNj;
        C.w += point.w * Nj;
    }
    return C;
}
/**
 * Calculates basis functions derivatives. See The NURBS Book, page 72, algorithm A2.3.
 *
 * @param {number} span - The span in which `u` lies.
 * @param {number} u - The parametric point.
 * @param {number} p - The degree.
 * @param {number} n - number of derivatives to calculate
 * @param {Array<number>} U - The knot vector.
 * @return {Array<Array<number>>} An array[n+1][p+1] with basis functions derivatives.
 */ function calcBasisFunctionDerivatives(span, u, p, n, U) {
    const zeroArr = [];
    for(let i = 0; i <= p; ++i)zeroArr[i] = 0.0;
    const ders = [];
    for(let i = 0; i <= n; ++i)ders[i] = zeroArr.slice(0);
    const ndu = [];
    for(let i = 0; i <= p; ++i)ndu[i] = zeroArr.slice(0);
    ndu[0][0] = 1.0;
    const left = zeroArr.slice(0);
    const right = zeroArr.slice(0);
    for(let j = 1; j <= p; ++j){
        left[j] = u - U[span + 1 - j];
        right[j] = U[span + j] - u;
        let saved = 0.0;
        for(let r = 0; r < j; ++r){
            const rv = right[r + 1];
            const lv = left[j - r];
            ndu[j][r] = rv + lv;
            const temp = ndu[r][j - 1] / ndu[j][r];
            ndu[r][j] = saved + rv * temp;
            saved = lv * temp;
        }
        ndu[j][j] = saved;
    }
    for(let j = 0; j <= p; ++j)ders[0][j] = ndu[j][p];
    for(let r = 0; r <= p; ++r){
        let s1 = 0;
        let s2 = 1;
        const a = [];
        for(let i = 0; i <= p; ++i)a[i] = zeroArr.slice(0);
        a[0][0] = 1.0;
        for(let k = 1; k <= n; ++k){
            let d = 0.0;
            const rk = r - k;
            const pk = p - k;
            if (r >= k) {
                a[s2][0] = a[s1][0] / ndu[pk + 1][rk];
                d = a[s2][0] * ndu[rk][pk];
            }
            const j1 = rk >= -1 ? 1 : -rk;
            const j2 = r - 1 <= pk ? k - 1 : p - r;
            for(let j = j1; j <= j2; ++j){
                a[s2][j] = (a[s1][j] - a[s1][j - 1]) / ndu[pk + 1][rk + j];
                d += a[s2][j] * ndu[rk + j][pk];
            }
            if (r <= pk) {
                a[s2][k] = -a[s1][k - 1] / ndu[pk + 1][r];
                d += a[s2][k] * ndu[r][pk];
            }
            ders[k][r] = d;
            const j = s1;
            s1 = s2;
            s2 = j;
        }
    }
    let r = p;
    for(let k = 1; k <= n; ++k){
        for(let j = 0; j <= p; ++j)ders[k][j] *= r;
        r *= p - k;
    }
    return ders;
}
/**
 * Calculates derivatives of a B-Spline. See The NURBS Book, page 93, algorithm A3.2.
 *
 * @param {number} p - The degree.
 * @param {Array<number>} U - The knot vector.
 * @param {Array<Vector4>} P - The control points
 * @param {number} u - The parametric point.
 * @param {number} nd - The number of derivatives.
 * @return {Array<Vector4>} An array[d+1] with derivatives.
 */ function calcBSplineDerivatives(p, U, P, u, nd) {
    const du = nd < p ? nd : p;
    const CK = [];
    const span = findSpan(p, u, U);
    const nders = calcBasisFunctionDerivatives(span, u, p, du, U);
    const Pw = [];
    for(let i = 0; i < P.length; ++i){
        const point = P[i].clone();
        const w = point.w;
        point.x *= w;
        point.y *= w;
        point.z *= w;
        Pw[i] = point;
    }
    for(let k = 0; k <= du; ++k){
        const point = Pw[span - p].clone().multiplyScalar(nders[k][0]);
        for(let j = 1; j <= p; ++j)point.add(Pw[span - p + j].clone().multiplyScalar(nders[k][j]));
        CK[k] = point;
    }
    for(let k = du + 1; k <= nd + 1; ++k)CK[k] = new (0, _three.Vector4)(0, 0, 0);
    return CK;
}
/**
 * Calculates "K over I".
 *
 * @param {number} k - The K value.
 * @param {number} i - The I value.
 * @return {number} k!/(i!(k-i)!)
 */ function calcKoverI(k, i) {
    let nom = 1;
    for(let j = 2; j <= k; ++j)nom *= j;
    let denom = 1;
    for(let j = 2; j <= i; ++j)denom *= j;
    for(let j = 2; j <= k - i; ++j)denom *= j;
    return nom / denom;
}
/**
 * Calculates derivatives (0-nd) of rational curve. See The NURBS Book, page 127, algorithm A4.2.
 *
 * @param {Array<Vector4>} Pders - Array with derivatives.
 * @return {Array<Vector3>} An array with derivatives for rational curve.
 */ function calcRationalCurveDerivatives(Pders) {
    const nd = Pders.length;
    const Aders = [];
    const wders = [];
    for(let i = 0; i < nd; ++i){
        const point = Pders[i];
        Aders[i] = new (0, _three.Vector3)(point.x, point.y, point.z);
        wders[i] = point.w;
    }
    const CK = [];
    for(let k = 0; k < nd; ++k){
        const v = Aders[k].clone();
        for(let i = 1; i <= k; ++i)v.sub(CK[k - i].clone().multiplyScalar(calcKoverI(k, i) * wders[i]));
        CK[k] = v.divideScalar(wders[0]);
    }
    return CK;
}
/**
 * Calculates NURBS curve derivatives. See The NURBS Book, page 127, algorithm A4.2.
 *
 * @param {number} p - The degree.
 * @param {Array<number>} U - The knot vector.
 * @param {Array<Vector4>} P - The control points in homogeneous space.
 * @param {number} u - The parametric point.
 * @param {number} nd - The number of derivatives.
 * @return {Array<Vector3>} array with derivatives for rational curve.
 */ function calcNURBSDerivatives(p, U, P, u, nd) {
    const Pders = calcBSplineDerivatives(p, U, P, u, nd);
    return calcRationalCurveDerivatives(Pders);
}
/**
 * Calculates a rational B-Spline surface point. See The NURBS Book, page 134, algorithm A4.3.
 *
 * @param {number} p - The first degree of B-Spline surface.
 * @param {number} q - The second degree of B-Spline surface.
 * @param {Array<number>} U - The first knot vector.
 * @param {Array<number>} V - The second knot vector.
 * @param {Array<Array<Vector4>>} P - The control points in homogeneous space.
 * @param {number} u - The first parametric point.
 * @param {number} v - The second parametric point.
 * @param {Vector3} target - The target vector.
 */ function calcSurfacePoint(p, q, U, V, P, u, v, target) {
    const uspan = findSpan(p, u, U);
    const vspan = findSpan(q, v, V);
    const Nu = calcBasisFunctions(uspan, u, p, U);
    const Nv = calcBasisFunctions(vspan, v, q, V);
    const temp = [];
    for(let l = 0; l <= q; ++l){
        temp[l] = new (0, _three.Vector4)(0, 0, 0, 0);
        for(let k = 0; k <= p; ++k){
            const point = P[uspan - p + k][vspan - q + l].clone();
            const w = point.w;
            point.x *= w;
            point.y *= w;
            point.z *= w;
            temp[l].add(point.multiplyScalar(Nu[k]));
        }
    }
    const Sw = new (0, _three.Vector4)(0, 0, 0, 0);
    for(let l = 0; l <= q; ++l)Sw.add(temp[l].multiplyScalar(Nv[l]));
    Sw.divideScalar(Sw.w);
    target.set(Sw.x, Sw.y, Sw.z);
}
/**
 * Calculates a rational B-Spline volume point. See The NURBS Book, page 134, algorithm A4.3.
 *
 * @param {number} p - The first degree of B-Spline surface.
 * @param {number} q - The second degree of B-Spline surface.
 * @param {number} r - The third degree of B-Spline surface.
 * @param {Array<number>} U - The first knot vector.
 * @param {Array<number>} V - The second knot vector.
 * @param {Array<number>} W - The third knot vector.
 * @param {Array<Array<Array<Vector4>>>} P - The control points in homogeneous space.
 * @param {number} u - The first parametric point.
 * @param {number} v - The second parametric point.
 * @param {number} w - The third parametric point.
 * @param {Vector3} target - The target vector.
 */ function calcVolumePoint(p, q, r, U, V, W, P, u, v, w, target) {
    const uspan = findSpan(p, u, U);
    const vspan = findSpan(q, v, V);
    const wspan = findSpan(r, w, W);
    const Nu = calcBasisFunctions(uspan, u, p, U);
    const Nv = calcBasisFunctions(vspan, v, q, V);
    const Nw = calcBasisFunctions(wspan, w, r, W);
    const temp = [];
    for(let m = 0; m <= r; ++m){
        temp[m] = [];
        for(let l = 0; l <= q; ++l){
            temp[m][l] = new (0, _three.Vector4)(0, 0, 0, 0);
            for(let k = 0; k <= p; ++k){
                const point = P[uspan - p + k][vspan - q + l][wspan - r + m].clone();
                const w = point.w;
                point.x *= w;
                point.y *= w;
                point.z *= w;
                temp[m][l].add(point.multiplyScalar(Nu[k]));
            }
        }
    }
    const Sw = new (0, _three.Vector4)(0, 0, 0, 0);
    for(let m = 0; m <= r; ++m)for(let l = 0; l <= q; ++l)Sw.add(temp[m][l].multiplyScalar(Nw[m]).multiplyScalar(Nv[l]));
    Sw.divideScalar(Sw.w);
    target.set(Sw.x, Sw.y, Sw.z);
}

},{"three":"hJIVG","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}]},["hDYvs"], null, "parcelRequire6840", {})

//# sourceMappingURL=FBXLoader.da86d394.js.map
