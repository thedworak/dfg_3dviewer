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
})({"biVwq":[function(require,module,exports,__globalThis) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SERVER_PORT = 1234;
var HMR_SECURE = false;
var HMR_ENV_HASH = "439701173a9199ea";
var HMR_USE_SSE = false;
module.bundle.HMR_BUNDLE_ID = "557fdbdf9d32232b";
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

},{}],"g9HJ8":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "VOXLoader", ()=>VOXLoader);
parcelHelpers.export(exports, "buildMesh", ()=>buildMesh);
parcelHelpers.export(exports, "buildData3DTexture", ()=>buildData3DTexture);
parcelHelpers.export(exports, "VOXMesh", ()=>VOXMesh);
parcelHelpers.export(exports, "VOXData3DTexture", ()=>VOXData3DTexture);
var _three = require("three");
// Helper function to read a STRING from the data view
function readString(data, offset) {
    const size = data.getUint32(offset, true);
    offset += 4;
    let str = '';
    for(let i = 0; i < size; i++)str += String.fromCharCode(data.getUint8(offset++));
    return {
        value: str,
        size: 4 + size
    };
}
// Helper function to read a DICT from the data view
function readDict(data, offset) {
    const dict = {};
    const count = data.getUint32(offset, true);
    offset += 4;
    let totalSize = 4;
    for(let i = 0; i < count; i++){
        const key = readString(data, offset);
        offset += key.size;
        totalSize += key.size;
        const value = readString(data, offset);
        offset += value.size;
        totalSize += value.size;
        dict[key.value] = value.value;
    }
    return {
        value: dict,
        size: totalSize
    };
}
// Helper function to decode ROTATION byte into a rotation matrix
function decodeRotation(byte) {
    // The rotation is stored as a row-major 3x3 matrix encoded in a single byte
    // Bits 0-1: index of the non-zero entry in the first row
    // Bits 2-3: index of the non-zero entry in the second row
    // Bit 4: sign of the first row entry (0 = positive, 1 = negative)
    // Bit 5: sign of the second row entry
    // Bit 6: sign of the third row entry
    // The third row index is determined by the remaining column
    const index1 = byte & 0x3;
    const index2 = byte >> 2 & 0x3;
    const sign1 = byte >> 4 & 0x1 ? -1 : 1;
    const sign2 = byte >> 5 & 0x1 ? -1 : 1;
    const sign3 = byte >> 6 & 0x1 ? -1 : 1;
    // Find the third row index (the one not used by row 0 or row 1)
    const index3 = 3 - index1 - index2;
    // Build the VOX rotation matrix (row-major 3x3)
    // r[row][col] - each row has one non-zero entry
    const r = [
        [
            0,
            0,
            0
        ],
        [
            0,
            0,
            0
        ],
        [
            0,
            0,
            0
        ]
    ];
    r[0][index1] = sign1;
    r[1][index2] = sign2;
    r[2][index3] = sign3;
    // Convert from VOX coordinate system (Z-up) to Three.js (Y-up)
    // VOX: X-right, Y-forward, Z-up
    // Three.js: X-right, Y-up, Z-backward
    // Transformation: x' = x, y' = z, z' = -y
    //
    // To convert rotation matrix R_vox to R_three:
    // R_three = C * R_vox * C^-1
    // where C converts VOX coords to Three.js coords
    // Apply coordinate change: swap Y and Z, negate new Z
    // This is equivalent to: C * R * C^-1
    const m = new (0, _three.Matrix4)();
    m.set(r[0][0], r[0][2], -r[0][1], 0, r[2][0], r[2][2], -r[2][1], 0, -r[1][0], -r[1][2], r[1][1], 0, 0, 0, 0, 1);
    return m;
}
// Apply VOX transform to a Three.js object
function applyTransform(object, node) {
    if (node.attributes._name) object.name = node.attributes._name;
    if (node.frames.length > 0) {
        const frame = node.frames[0];
        if (frame.rotation) object.applyMatrix4(frame.rotation);
        if (frame.translation) // VOX uses Z-up, Three.js uses Y-up
        object.position.set(frame.translation.x, frame.translation.z, -frame.translation.y);
    }
}
// Recursively build Three.js object graph from VOX nodes
function buildObject(nodeId, nodes, chunks) {
    const node = nodes[nodeId];
    if (node.type === 'transform') {
        const childNode = nodes[node.childNodeId];
        // Check if this transform has actual transformation data
        const frame = node.frames[0];
        const hasTransform = frame && (frame.rotation || frame.translation);
        // Flatten: if child is a single-model shape, apply transform directly to mesh
        if (childNode.type === 'shape' && childNode.models.length === 1) {
            const chunk = chunks[childNode.models[0].modelId];
            const mesh = buildMesh(chunk);
            applyTransform(mesh, node);
            return mesh;
        }
        // If no transform, just return the child directly (avoid unnecessary group)
        if (!hasTransform) {
            const child = buildObject(node.childNodeId, nodes, chunks);
            if (child && node.attributes._name) child.name = node.attributes._name;
            return child;
        }
        // Otherwise create a group
        const group = new (0, _three.Group)();
        applyTransform(group, node);
        const child = buildObject(node.childNodeId, nodes, chunks);
        if (child) group.add(child);
        return group;
    } else if (node.type === 'group') {
        const group = new (0, _three.Group)();
        for (const childId of node.childIds){
            const child = buildObject(childId, nodes, chunks);
            if (child) group.add(child);
        }
        return group;
    } else if (node.type === 'shape') {
        // Shape reached directly (shouldn't happen in well-formed files, but handle it)
        if (node.models.length === 1) {
            const chunk = chunks[node.models[0].modelId];
            return buildMesh(chunk);
        }
        const group = new (0, _three.Group)();
        for (const model of node.models){
            const chunk = chunks[model.modelId];
            group.add(buildMesh(chunk));
        }
        return group;
    }
    return null;
}
/**
 * A loader for the VOX format.
 *
 * ```js
 * const loader = new VOXLoader();
 * const result = await loader.loadAsync( 'models/vox/monu10.vox' );
 *
 * scene.add( result.scene.children[ 0 ] );
 * ```
 * @augments Loader
 * @three_import import { VOXLoader } from 'three/addons/loaders/VOXLoader.js';
 */ class VOXLoader extends (0, _three.Loader) {
    /**
	 * Starts loading from the given URL and passes the loaded VOX asset
	 * to the `onLoad()` callback.
	 *
	 * @param {string} url - The path/URL of the file to be loaded. This can also be a data URI.
	 * @param {function(Object)} onLoad - Executed when the loading process has been finished.
	 * @param {onProgressCallback} onProgress - Executed while the loading is in progress.
	 * @param {onErrorCallback} onError - Executed when errors occur.
	 */ load(url, onLoad, onProgress, onError) {
        const scope = this;
        const loader = new (0, _three.FileLoader)(scope.manager);
        loader.setPath(scope.path);
        loader.setResponseType('arraybuffer');
        loader.setRequestHeader(scope.requestHeader);
        loader.load(url, function(buffer) {
            try {
                onLoad(scope.parse(buffer));
            } catch (e) {
                if (onError) onError(e);
                else console.error(e);
                scope.manager.itemError(url);
            }
        }, onProgress, onError);
    }
    /**
	 * Parses the given VOX data and returns the result object.
	 *
	 * @param {ArrayBuffer} buffer - The raw VOX data as an array buffer.
	 * @return {Object} The parsed VOX data with properties: chunks, scene.
	 */ parse(buffer) {
        const data = new DataView(buffer);
        const id = data.getUint32(0, true);
        const version = data.getUint32(4, true);
        if (id !== 542658390) {
            console.error('THREE.VOXLoader: Invalid VOX file.');
            return;
        }
        if (version !== 150 && version !== 200) {
            console.error('THREE.VOXLoader: Invalid VOX file. Unsupported version:', version);
            return;
        }
        const DEFAULT_PALETTE = [
            0x00000000,
            0xffffffff,
            0xffccffff,
            0xff99ffff,
            0xff66ffff,
            0xff33ffff,
            0xff00ffff,
            0xffffccff,
            0xffccccff,
            0xff99ccff,
            0xff66ccff,
            0xff33ccff,
            0xff00ccff,
            0xffff99ff,
            0xffcc99ff,
            0xff9999ff,
            0xff6699ff,
            0xff3399ff,
            0xff0099ff,
            0xffff66ff,
            0xffcc66ff,
            0xff9966ff,
            0xff6666ff,
            0xff3366ff,
            0xff0066ff,
            0xffff33ff,
            0xffcc33ff,
            0xff9933ff,
            0xff6633ff,
            0xff3333ff,
            0xff0033ff,
            0xffff00ff,
            0xffcc00ff,
            0xff9900ff,
            0xff6600ff,
            0xff3300ff,
            0xff0000ff,
            0xffffffcc,
            0xffccffcc,
            0xff99ffcc,
            0xff66ffcc,
            0xff33ffcc,
            0xff00ffcc,
            0xffffcccc,
            0xffcccccc,
            0xff99cccc,
            0xff66cccc,
            0xff33cccc,
            0xff00cccc,
            0xffff99cc,
            0xffcc99cc,
            0xff9999cc,
            0xff6699cc,
            0xff3399cc,
            0xff0099cc,
            0xffff66cc,
            0xffcc66cc,
            0xff9966cc,
            0xff6666cc,
            0xff3366cc,
            0xff0066cc,
            0xffff33cc,
            0xffcc33cc,
            0xff9933cc,
            0xff6633cc,
            0xff3333cc,
            0xff0033cc,
            0xffff00cc,
            0xffcc00cc,
            0xff9900cc,
            0xff6600cc,
            0xff3300cc,
            0xff0000cc,
            0xffffff99,
            0xffccff99,
            0xff99ff99,
            0xff66ff99,
            0xff33ff99,
            0xff00ff99,
            0xffffcc99,
            0xffcccc99,
            0xff99cc99,
            0xff66cc99,
            0xff33cc99,
            0xff00cc99,
            0xffff9999,
            0xffcc9999,
            0xff999999,
            0xff669999,
            0xff339999,
            0xff009999,
            0xffff6699,
            0xffcc6699,
            0xff996699,
            0xff666699,
            0xff336699,
            0xff006699,
            0xffff3399,
            0xffcc3399,
            0xff993399,
            0xff663399,
            0xff333399,
            0xff003399,
            0xffff0099,
            0xffcc0099,
            0xff990099,
            0xff660099,
            0xff330099,
            0xff000099,
            0xffffff66,
            0xffccff66,
            0xff99ff66,
            0xff66ff66,
            0xff33ff66,
            0xff00ff66,
            0xffffcc66,
            0xffcccc66,
            0xff99cc66,
            0xff66cc66,
            0xff33cc66,
            0xff00cc66,
            0xffff9966,
            0xffcc9966,
            0xff999966,
            0xff669966,
            0xff339966,
            0xff009966,
            0xffff6666,
            0xffcc6666,
            0xff996666,
            0xff666666,
            0xff336666,
            0xff006666,
            0xffff3366,
            0xffcc3366,
            0xff993366,
            0xff663366,
            0xff333366,
            0xff003366,
            0xffff0066,
            0xffcc0066,
            0xff990066,
            0xff660066,
            0xff330066,
            0xff000066,
            0xffffff33,
            0xffccff33,
            0xff99ff33,
            0xff66ff33,
            0xff33ff33,
            0xff00ff33,
            0xffffcc33,
            0xffcccc33,
            0xff99cc33,
            0xff66cc33,
            0xff33cc33,
            0xff00cc33,
            0xffff9933,
            0xffcc9933,
            0xff999933,
            0xff669933,
            0xff339933,
            0xff009933,
            0xffff6633,
            0xffcc6633,
            0xff996633,
            0xff666633,
            0xff336633,
            0xff006633,
            0xffff3333,
            0xffcc3333,
            0xff993333,
            0xff663333,
            0xff333333,
            0xff003333,
            0xffff0033,
            0xffcc0033,
            0xff990033,
            0xff660033,
            0xff330033,
            0xff000033,
            0xffffff00,
            0xffccff00,
            0xff99ff00,
            0xff66ff00,
            0xff33ff00,
            0xff00ff00,
            0xffffcc00,
            0xffcccc00,
            0xff99cc00,
            0xff66cc00,
            0xff33cc00,
            0xff00cc00,
            0xffff9900,
            0xffcc9900,
            0xff999900,
            0xff669900,
            0xff339900,
            0xff009900,
            0xffff6600,
            0xffcc6600,
            0xff996600,
            0xff666600,
            0xff336600,
            0xff006600,
            0xffff3300,
            0xffcc3300,
            0xff993300,
            0xff663300,
            0xff333300,
            0xff003300,
            0xffff0000,
            0xffcc0000,
            0xff990000,
            0xff660000,
            0xff330000,
            0xff0000ee,
            0xff0000dd,
            0xff0000bb,
            0xff0000aa,
            0xff000088,
            0xff000077,
            0xff000055,
            0xff000044,
            0xff000022,
            0xff000011,
            0xff00ee00,
            0xff00dd00,
            0xff00bb00,
            0xff00aa00,
            0xff008800,
            0xff007700,
            0xff005500,
            0xff004400,
            0xff002200,
            0xff001100,
            0xffee0000,
            0xffdd0000,
            0xffbb0000,
            0xffaa0000,
            0xff880000,
            0xff770000,
            0xff550000,
            0xff440000,
            0xff220000,
            0xff110000,
            0xffeeeeee,
            0xffdddddd,
            0xffbbbbbb,
            0xffaaaaaa,
            0xff888888,
            0xff777777,
            0xff555555,
            0xff444444,
            0xff222222,
            0xff111111
        ];
        let i = 8;
        let chunk;
        const chunks = [];
        // Extension data
        const nodes = {};
        let palette = DEFAULT_PALETTE;
        while(i < data.byteLength){
            let id = '';
            for(let j = 0; j < 4; j++)id += String.fromCharCode(data.getUint8(i++));
            const chunkSize = data.getUint32(i, true);
            i += 4;
            i += 4; // childChunks
            if (id === 'SIZE') {
                const x = data.getUint32(i, true);
                i += 4;
                const y = data.getUint32(i, true);
                i += 4;
                const z = data.getUint32(i, true);
                i += 4;
                chunk = {
                    palette: DEFAULT_PALETTE,
                    size: {
                        x: x,
                        y: y,
                        z: z
                    }
                };
                chunks.push(chunk);
                i += chunkSize - 12;
            } else if (id === 'XYZI') {
                const numVoxels = data.getUint32(i, true);
                i += 4;
                chunk.data = new Uint8Array(buffer, i, numVoxels * 4);
                i += numVoxels * 4;
            } else if (id === 'RGBA') {
                palette = [
                    0
                ];
                for(let j = 0; j < 256; j++){
                    palette[j + 1] = data.getUint32(i, true);
                    i += 4;
                }
                chunk.palette = palette;
            } else if (id === 'nTRN') {
                // Transform Node
                const nodeId = data.getUint32(i, true);
                i += 4;
                const attributes = readDict(data, i);
                i += attributes.size;
                const childNodeId = data.getUint32(i, true);
                i += 4;
                i += 4; // reserved (-1)
                const layerId = data.getInt32(i, true);
                i += 4;
                const numFrames = data.getUint32(i, true);
                i += 4;
                const frames = [];
                for(let f = 0; f < numFrames; f++){
                    const frameDict = readDict(data, i);
                    i += frameDict.size;
                    const frame = {
                        rotation: null,
                        translation: null
                    };
                    if (frameDict.value._r !== undefined) frame.rotation = decodeRotation(parseInt(frameDict.value._r));
                    if (frameDict.value._t !== undefined) {
                        const parts = frameDict.value._t.split(' ').map(Number);
                        frame.translation = {
                            x: parts[0],
                            y: parts[1],
                            z: parts[2]
                        };
                    }
                    frames.push(frame);
                }
                nodes[nodeId] = {
                    type: 'transform',
                    id: nodeId,
                    attributes: attributes.value,
                    childNodeId: childNodeId,
                    layerId: layerId,
                    frames: frames
                };
            } else if (id === 'nGRP') {
                // Group Node
                const nodeId = data.getUint32(i, true);
                i += 4;
                const attributes = readDict(data, i);
                i += attributes.size;
                const numChildren = data.getUint32(i, true);
                i += 4;
                const childIds = [];
                for(let c = 0; c < numChildren; c++){
                    childIds.push(data.getUint32(i, true));
                    i += 4;
                }
                nodes[nodeId] = {
                    type: 'group',
                    id: nodeId,
                    attributes: attributes.value,
                    childIds: childIds
                };
            } else if (id === 'nSHP') {
                // Shape Node
                const nodeId = data.getUint32(i, true);
                i += 4;
                const attributes = readDict(data, i);
                i += attributes.size;
                const numModels = data.getUint32(i, true);
                i += 4;
                const models = [];
                for(let m = 0; m < numModels; m++){
                    const modelId = data.getUint32(i, true);
                    i += 4;
                    const modelAttributes = readDict(data, i);
                    i += modelAttributes.size;
                    models.push({
                        modelId: modelId,
                        attributes: modelAttributes.value
                    });
                }
                nodes[nodeId] = {
                    type: 'shape',
                    id: nodeId,
                    attributes: attributes.value,
                    models: models
                };
            } else // Skip unknown chunks
            i += chunkSize;
        }
        // Apply palette to all chunks
        for(let c = 0; c < chunks.length; c++)chunks[c].palette = palette;
        // Build Three.js scene graph from nodes
        let scene = null;
        if (Object.keys(nodes).length > 0) scene = buildObject(0, nodes, chunks);
        // Build result object
        const result = {
            chunks: chunks,
            scene: scene
        };
        // @deprecated, r182
        // Proxy for backwards compatibility with array-like access
        let warned = false;
        return new Proxy(result, {
            get (target, prop) {
                // Handle numeric indices
                if (typeof prop === 'string' && /^\d+$/.test(prop)) {
                    if (!warned) {
                        console.warn('THREE.VOXLoader: Accessing result as an array is deprecated. Use result.chunks[] instead.');
                        warned = true;
                    }
                    return target.chunks[parseInt(prop)];
                }
                // Handle array properties/methods
                if (prop === 'length') {
                    if (!warned) {
                        console.warn('THREE.VOXLoader: Accessing result as an array is deprecated. Use result.chunks instead.');
                        warned = true;
                    }
                    return target.chunks.length;
                }
                // Handle iteration
                if (prop === Symbol.iterator) {
                    if (!warned) {
                        console.warn('THREE.VOXLoader: Iterating result as an array is deprecated. Use result.chunks instead.');
                        warned = true;
                    }
                    return target.chunks[Symbol.iterator].bind(target.chunks);
                }
                return target[prop];
            }
        });
    }
}
/**
 * Builds a mesh from a VOX chunk.
 *
 * @param {Object} chunk - A VOX chunk loaded via {@link VOXLoader}.
 * @return {Mesh} The generated mesh.
 */ function buildMesh(chunk) {
    const data = chunk.data;
    const size = chunk.size;
    const palette = chunk.palette;
    const sx = size.x;
    const sy = size.y;
    const sz = size.z;
    // Build volume with color indices
    const volume = new Uint8Array(sx * sy * sz);
    for(let j = 0; j < data.length; j += 4){
        const x = data[j + 0];
        const y = data[j + 1];
        const z = data[j + 2];
        const c = data[j + 3];
        volume[x + y * sx + z * sx * sy] = c;
    }
    // Greedy meshing
    const vertices = [];
    const indices = [];
    const colors = [];
    const _color = new (0, _three.Color)();
    let hasColors = false;
    // Process each of the 6 face directions
    // dims: the 3 axis sizes, d: which axis is normal to the face
    const dims = [
        sx,
        sy,
        sz
    ];
    for(let d = 0; d < 3; d++){
        const u = (d + 1) % 3;
        const v = (d + 2) % 3;
        const dimsD = dims[d];
        const dimsU = dims[u];
        const dimsV = dims[v];
        const q = [
            0,
            0,
            0
        ];
        const mask = new Int16Array(dimsU * dimsV);
        q[d] = 1;
        // Sweep through slices
        for(let slice = 0; slice <= dimsD; slice++){
            // Build mask for this slice
            let n = 0;
            for(let vv = 0; vv < dimsV; vv++)for(let uu = 0; uu < dimsU; uu++){
                const pos = [
                    0,
                    0,
                    0
                ];
                pos[d] = slice;
                pos[u] = uu;
                pos[v] = vv;
                const x0 = pos[0], y0 = pos[1], z0 = pos[2];
                // Get voxel behind and in front of this face
                const behind = slice > 0 ? volume[x0 - q[0] + (y0 - q[1]) * sx + (z0 - q[2]) * sx * sy] : 0;
                const infront = slice < dimsD ? volume[x0 + y0 * sx + z0 * sx * sy] : 0;
                // Face exists if exactly one side is solid
                if (behind > 0 && infront === 0) mask[n] = behind; // positive face
                else if (infront > 0 && behind === 0) mask[n] = -infront; // negative face
                else mask[n] = 0;
                n++;
            }
            // Greedy merge mask into quads
            n = 0;
            for(let vv = 0; vv < dimsV; vv++)for(let uu = 0; uu < dimsU;){
                const c = mask[n];
                if (c !== 0) {
                    // Find width
                    let w = 1;
                    while(uu + w < dimsU && mask[n + w] === c)w++;
                    // Find height
                    let h = 1;
                    let done = false;
                    while(vv + h < dimsV && !done){
                        for(let k = 0; k < w; k++)if (mask[n + k + h * dimsU] !== c) {
                            done = true;
                            break;
                        }
                        if (!done) h++;
                    }
                    // Add quad
                    const pos = [
                        0,
                        0,
                        0
                    ];
                    pos[d] = slice;
                    pos[u] = uu;
                    pos[v] = vv;
                    const du = [
                        0,
                        0,
                        0
                    ];
                    const dv = [
                        0,
                        0,
                        0
                    ];
                    du[u] = w;
                    dv[v] = h;
                    // Get color
                    const colorIndex = Math.abs(c);
                    const hex = palette[colorIndex];
                    const r = (hex >> 0 & 0xff) / 0xff;
                    const g = (hex >> 8 & 0xff) / 0xff;
                    const b = (hex >> 16 & 0xff) / 0xff;
                    if (r > 0 || g > 0 || b > 0) hasColors = true;
                    _color.setRGB(r, g, b, (0, _three.SRGBColorSpace));
                    // Convert VOX coords to Three.js coords (Y-up)
                    // VOX: X right, Y forward, Z up -> Three.js: X right, Y up, Z back
                    const toThree = (p)=>[
                            p[0] - sx / 2,
                            p[2] - sz / 2,
                            -p[1] + sy / 2
                        ];
                    const v0 = toThree(pos);
                    const v1 = toThree([
                        pos[0] + du[0],
                        pos[1] + du[1],
                        pos[2] + du[2]
                    ]);
                    const v2 = toThree([
                        pos[0] + du[0] + dv[0],
                        pos[1] + du[1] + dv[1],
                        pos[2] + du[2] + dv[2]
                    ]);
                    const v3 = toThree([
                        pos[0] + dv[0],
                        pos[1] + dv[1],
                        pos[2] + dv[2]
                    ]);
                    const idx = vertices.length / 3;
                    // Winding order depends on face direction
                    if (c > 0) {
                        vertices.push(...v0, ...v1, ...v2, ...v3);
                        indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
                    } else {
                        vertices.push(...v0, ...v3, ...v2, ...v1);
                        indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
                    }
                    colors.push(_color.r, _color.g, _color.b, _color.r, _color.g, _color.b, _color.r, _color.g, _color.b, _color.r, _color.g, _color.b);
                    // Clear mask
                    for(let hh = 0; hh < h; hh++)for(let ww = 0; ww < w; ww++)mask[n + ww + hh * dimsU] = 0;
                    uu += w;
                    n += w;
                } else {
                    uu++;
                    n++;
                }
            }
        }
    }
    const geometry = new (0, _three.BufferGeometry)();
    geometry.setAttribute('position', new (0, _three.Float32BufferAttribute)(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = new (0, _three.MeshStandardMaterial)();
    if (hasColors) {
        geometry.setAttribute('color', new (0, _three.Float32BufferAttribute)(colors, 3));
        material.vertexColors = true;
    }
    return new (0, _three.Mesh)(geometry, material);
}
/**
 * Builds a 3D texture from a VOX chunk.
 *
 * @param {Object} chunk - A VOX chunk loaded via {@link VOXLoader}.
 * @return {Data3DTexture} The generated 3D texture.
 */ function buildData3DTexture(chunk) {
    const data = chunk.data;
    const size = chunk.size;
    const offsety = size.x;
    const offsetz = size.x * size.y;
    const array = new Uint8Array(size.x * size.y * size.z);
    for(let j = 0; j < data.length; j += 4){
        const x = data[j + 0];
        const y = data[j + 1];
        const z = data[j + 2];
        const index = x + y * offsety + z * offsetz;
        array[index] = 255;
    }
    const texture = new (0, _three.Data3DTexture)(array, size.x, size.y, size.z);
    texture.format = (0, _three.RedFormat);
    texture.minFilter = (0, _three.NearestFilter);
    texture.magFilter = (0, _three.LinearFilter);
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return texture;
}
// @deprecated, r182
class VOXMesh extends (0, _three.Mesh) {
    constructor(chunk){
        console.warn('VOXMesh has been deprecated. Use buildMesh() instead.');
        const mesh = buildMesh(chunk);
        super(mesh.geometry, mesh.material);
    }
}
class VOXData3DTexture extends (0, _three.Data3DTexture) {
    constructor(chunk){
        console.warn('VOXData3DTexture has been deprecated. Use buildData3DTexture() instead.');
        const texture = buildData3DTexture(chunk);
        super(texture.image.data, texture.image.width, texture.image.height, texture.image.depth);
        this.format = texture.format;
        this.minFilter = texture.minFilter;
        this.magFilter = texture.magFilter;
        this.unpackAlignment = texture.unpackAlignment;
        this.needsUpdate = true;
    }
}

},{"three":"hJIVG","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}]},["biVwq"], null, "parcelRequire6840", {})

//# sourceMappingURL=VOXLoader.9d32232b.js.map
