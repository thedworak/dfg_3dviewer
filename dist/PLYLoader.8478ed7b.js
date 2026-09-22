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
})({"xLe6P":[function(require,module,exports,__globalThis) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SERVER_PORT = 1234;
var HMR_SECURE = false;
var HMR_ENV_HASH = "439701173a9199ea";
var HMR_USE_SSE = false;
module.bundle.HMR_BUNDLE_ID = "f670e5d98478ed7b";
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

},{}],"b9a6A":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "PLYLoader", ()=>PLYLoader);
var _three = require("three");
const _color = new (0, _three.Color)();
/**
 * A loader for PLY the PLY format (known as the Polygon
 * File Format or the Stanford Triangle Format).
 *
 * Limitations:
 *  - ASCII decoding assumes file is UTF-8.
 *
 * ```js
 * const loader = new PLYLoader();
 * const geometry = await loader.loadAsync( './models/ply/ascii/dolphins.ply' );
 * scene.add( new THREE.Mesh( geometry ) );
 * ```
 *
 * @augments Loader
 * @three_import import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
 */ class PLYLoader extends (0, _three.Loader) {
    /**
	 * Constructs a new PLY loader.
	 *
	 * @param {LoadingManager} [manager] - The loading manager.
	 */ constructor(manager){
        super(manager);
        // internals
        this.propertyNameMapping = {};
        this.customPropertyMapping = {};
    }
    /**
	 * Starts loading from the given URL and passes the loaded PLY asset
	 * to the `onLoad()` callback.
	 *
	 * @param {string} url - The path/URL of the file to be loaded. This can also be a data URI.
	 * @param {function(BufferGeometry)} onLoad - Executed when the loading process has been finished.
	 * @param {onProgressCallback} onProgress - Executed while the loading is in progress.
	 * @param {onErrorCallback} onError - Executed when errors occur.
	 */ load(url, onLoad, onProgress, onError) {
        const scope = this;
        const loader = new (0, _three.FileLoader)(this.manager);
        loader.setPath(this.path);
        loader.setResponseType('arraybuffer');
        loader.setRequestHeader(this.requestHeader);
        loader.setWithCredentials(this.withCredentials);
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
	 * Sets a property name mapping that maps default property names
	 * to custom ones. For example, the following maps the properties
	 * “diffuse_(red|green|blue)” in the file to standard color names.
	 *
	 * ```js
	 * loader.setPropertyNameMapping( {
	 * 	diffuse_red: 'red',
	 * 	diffuse_green: 'green',
	 * 	diffuse_blue: 'blue'
	 * } );
	 * ```
	 *
	 * @param {Object} mapping - The mapping dictionary.
	 */ setPropertyNameMapping(mapping) {
        this.propertyNameMapping = mapping;
    }
    /**
	 * Custom properties outside of the defaults for position, uv, normal
	 * and color attributes can be added using the setCustomPropertyNameMapping method.
	 * For example, the following maps the element properties “custom_property_a”
	 * and “custom_property_b” to an attribute “customAttribute” with an item size of 2.
	 * Attribute item sizes are set from the number of element properties in the property array.
	 *
	 * ```js
	 * loader.setCustomPropertyNameMapping( {
	 *	customAttribute: ['custom_property_a', 'custom_property_b'],
	 * } );
	 * ```
	 * @param {Object} mapping - The mapping dictionary.
	 */ setCustomPropertyNameMapping(mapping) {
        this.customPropertyMapping = mapping;
    }
    /**
	 * Parses the given PLY data and returns the resulting geometry.
	 *
	 * @param {ArrayBuffer} data - The raw PLY data as an array buffer.
	 * @return {BufferGeometry} The parsed geometry.
	 */ parse(data) {
        function parseHeader(data, headerLength = 0) {
            const patternHeader = /^ply([\s\S]*)end_header(\r\n|\r|\n)/;
            let headerText = '';
            const result = patternHeader.exec(data);
            if (result !== null) headerText = result[1];
            const header = {
                comments: [],
                elements: [],
                headerLength: headerLength,
                objInfo: ''
            };
            const lines = headerText.split(/\r\n|\r|\n/);
            let currentElement;
            function make_ply_element_property(propertyValues, propertyNameMapping) {
                const property = {
                    type: propertyValues[0]
                };
                if (property.type === 'list') {
                    property.name = propertyValues[3];
                    property.countType = propertyValues[1];
                    property.itemType = propertyValues[2];
                } else property.name = propertyValues[1];
                if (property.name in propertyNameMapping) property.name = propertyNameMapping[property.name];
                return property;
            }
            for(let i = 0; i < lines.length; i++){
                let line = lines[i];
                line = line.trim();
                if (line === '') continue;
                const lineValues = line.split(/\s+/);
                const lineType = lineValues.shift();
                line = lineValues.join(' ');
                switch(lineType){
                    case 'format':
                        header.format = lineValues[0];
                        header.version = lineValues[1];
                        break;
                    case 'comment':
                        header.comments.push(line);
                        break;
                    case 'element':
                        if (currentElement !== undefined) header.elements.push(currentElement);
                        currentElement = {};
                        currentElement.name = lineValues[0];
                        currentElement.count = parseInt(lineValues[1]);
                        currentElement.properties = [];
                        break;
                    case 'property':
                        currentElement.properties.push(make_ply_element_property(lineValues, scope.propertyNameMapping));
                        break;
                    case 'obj_info':
                        header.objInfo = line;
                        break;
                    default:
                        console.log('unhandled', lineType, lineValues);
                }
            }
            if (currentElement !== undefined) header.elements.push(currentElement);
            return header;
        }
        function parseASCIINumber(n, type) {
            switch(type){
                case 'char':
                case 'uchar':
                case 'short':
                case 'ushort':
                case 'int':
                case 'uint':
                case 'int8':
                case 'uint8':
                case 'int16':
                case 'uint16':
                case 'int32':
                case 'uint32':
                    return parseInt(n);
                case 'float':
                case 'double':
                case 'float32':
                case 'float64':
                    return parseFloat(n);
            }
        }
        function parseASCIIElement(properties, tokens) {
            const element = {};
            for(let i = 0; i < properties.length; i++){
                if (tokens.empty()) return null;
                if (properties[i].type === 'list') {
                    const list = [];
                    const n = parseASCIINumber(tokens.next(), properties[i].countType);
                    for(let j = 0; j < n; j++){
                        if (tokens.empty()) return null;
                        list.push(parseASCIINumber(tokens.next(), properties[i].itemType));
                    }
                    element[properties[i].name] = list;
                } else element[properties[i].name] = parseASCIINumber(tokens.next(), properties[i].type);
            }
            return element;
        }
        function createBuffer() {
            const buffer = {
                indices: [],
                vertices: [],
                normals: [],
                uvs: [],
                faceVertexUvs: [],
                colors: [],
                faceVertexColors: []
            };
            for (const customProperty of Object.keys(scope.customPropertyMapping))buffer[customProperty] = [];
            return buffer;
        }
        function mapElementAttributes(properties) {
            const elementNames = properties.map((property)=>{
                return property.name;
            });
            function findAttrName(names) {
                for(let i = 0, l = names.length; i < l; i++){
                    const name = names[i];
                    if (elementNames.includes(name)) return name;
                }
                return null;
            }
            return {
                attrX: findAttrName([
                    'x',
                    'px',
                    'posx'
                ]) || 'x',
                attrY: findAttrName([
                    'y',
                    'py',
                    'posy'
                ]) || 'y',
                attrZ: findAttrName([
                    'z',
                    'pz',
                    'posz'
                ]) || 'z',
                attrNX: findAttrName([
                    'nx',
                    'normalx'
                ]),
                attrNY: findAttrName([
                    'ny',
                    'normaly'
                ]),
                attrNZ: findAttrName([
                    'nz',
                    'normalz'
                ]),
                attrS: findAttrName([
                    's',
                    'u',
                    'texture_u',
                    'tx'
                ]),
                attrT: findAttrName([
                    't',
                    'v',
                    'texture_v',
                    'ty'
                ]),
                attrR: findAttrName([
                    'red',
                    'diffuse_red',
                    'r',
                    'diffuse_r'
                ]),
                attrG: findAttrName([
                    'green',
                    'diffuse_green',
                    'g',
                    'diffuse_g'
                ]),
                attrB: findAttrName([
                    'blue',
                    'diffuse_blue',
                    'b',
                    'diffuse_b'
                ])
            };
        }
        function parseASCII(data, header) {
            // PLY ascii format specification, as per http://en.wikipedia.org/wiki/PLY_(file_format)
            const buffer = createBuffer();
            const patternBody = /end_header\s+(\S[\s\S]*\S|\S)\s*$/;
            let body, matches;
            if ((matches = patternBody.exec(data)) !== null) body = matches[1].split(/\s+/);
            else body = [];
            const tokens = new ArrayStream(body);
            loop: for(let i = 0; i < header.elements.length; i++){
                const elementDesc = header.elements[i];
                const attributeMap = mapElementAttributes(elementDesc.properties);
                for(let j = 0; j < elementDesc.count; j++){
                    const element = parseASCIIElement(elementDesc.properties, tokens);
                    if (!element) break loop;
                    handleElement(buffer, elementDesc.name, element, attributeMap);
                }
            }
            return postProcess(buffer);
        }
        function postProcess(buffer) {
            let geometry = new (0, _three.BufferGeometry)();
            // mandatory buffer data
            if (buffer.indices.length > 0) geometry.setIndex(buffer.indices);
            geometry.setAttribute('position', new (0, _three.Float32BufferAttribute)(buffer.vertices, 3));
            // optional buffer data
            if (buffer.normals.length > 0) geometry.setAttribute('normal', new (0, _three.Float32BufferAttribute)(buffer.normals, 3));
            if (buffer.uvs.length > 0) geometry.setAttribute('uv', new (0, _three.Float32BufferAttribute)(buffer.uvs, 2));
            if (buffer.colors.length > 0) geometry.setAttribute('color', new (0, _three.Float32BufferAttribute)(buffer.colors, 3));
            if (buffer.faceVertexUvs.length > 0 || buffer.faceVertexColors.length > 0) {
                geometry = geometry.toNonIndexed();
                if (buffer.faceVertexUvs.length > 0) geometry.setAttribute('uv', new (0, _three.Float32BufferAttribute)(buffer.faceVertexUvs, 2));
                if (buffer.faceVertexColors.length > 0) geometry.setAttribute('color', new (0, _three.Float32BufferAttribute)(buffer.faceVertexColors, 3));
            }
            // custom buffer data
            for (const customProperty of Object.keys(scope.customPropertyMapping))if (buffer[customProperty].length > 0) geometry.setAttribute(customProperty, new (0, _three.Float32BufferAttribute)(buffer[customProperty], scope.customPropertyMapping[customProperty].length));
            geometry.computeBoundingSphere();
            return geometry;
        }
        function handleElement(buffer, elementName, element, cacheEntry) {
            if (elementName === 'vertex') {
                buffer.vertices.push(element[cacheEntry.attrX], element[cacheEntry.attrY], element[cacheEntry.attrZ]);
                if (cacheEntry.attrNX !== null && cacheEntry.attrNY !== null && cacheEntry.attrNZ !== null) buffer.normals.push(element[cacheEntry.attrNX], element[cacheEntry.attrNY], element[cacheEntry.attrNZ]);
                if (cacheEntry.attrS !== null && cacheEntry.attrT !== null) buffer.uvs.push(element[cacheEntry.attrS], element[cacheEntry.attrT]);
                if (cacheEntry.attrR !== null && cacheEntry.attrG !== null && cacheEntry.attrB !== null) {
                    _color.setRGB(element[cacheEntry.attrR] / 255.0, element[cacheEntry.attrG] / 255.0, element[cacheEntry.attrB] / 255.0, (0, _three.SRGBColorSpace));
                    buffer.colors.push(_color.r, _color.g, _color.b);
                }
                for (const customProperty of Object.keys(scope.customPropertyMapping))for (const elementProperty of scope.customPropertyMapping[customProperty])buffer[customProperty].push(element[elementProperty]);
            } else if (elementName === 'face') {
                const vertex_indices = element.vertex_indices || element.vertex_index; // issue #9338
                const texcoord = element.texcoord;
                if (vertex_indices.length === 3) {
                    buffer.indices.push(vertex_indices[0], vertex_indices[1], vertex_indices[2]);
                    if (texcoord && texcoord.length === 6) {
                        buffer.faceVertexUvs.push(texcoord[0], texcoord[1]);
                        buffer.faceVertexUvs.push(texcoord[2], texcoord[3]);
                        buffer.faceVertexUvs.push(texcoord[4], texcoord[5]);
                    }
                } else if (vertex_indices.length === 4) {
                    buffer.indices.push(vertex_indices[0], vertex_indices[1], vertex_indices[3]);
                    buffer.indices.push(vertex_indices[1], vertex_indices[2], vertex_indices[3]);
                }
                // face colors
                if (cacheEntry.attrR !== null && cacheEntry.attrG !== null && cacheEntry.attrB !== null) {
                    _color.setRGB(element[cacheEntry.attrR] / 255.0, element[cacheEntry.attrG] / 255.0, element[cacheEntry.attrB] / 255.0, (0, _three.SRGBColorSpace));
                    buffer.faceVertexColors.push(_color.r, _color.g, _color.b);
                    buffer.faceVertexColors.push(_color.r, _color.g, _color.b);
                    buffer.faceVertexColors.push(_color.r, _color.g, _color.b);
                }
            }
        }
        function binaryReadElement(at, properties) {
            const element = {};
            let read = 0;
            for(let i = 0; i < properties.length; i++){
                const property = properties[i];
                const valueReader = property.valueReader;
                if (property.type === 'list') {
                    const list = [];
                    const n = property.countReader.read(at + read);
                    read += property.countReader.size;
                    for(let j = 0; j < n; j++){
                        list.push(valueReader.read(at + read));
                        read += valueReader.size;
                    }
                    element[property.name] = list;
                } else {
                    element[property.name] = valueReader.read(at + read);
                    read += valueReader.size;
                }
            }
            return [
                element,
                read
            ];
        }
        function setPropertyBinaryReaders(properties, body, little_endian) {
            function getBinaryReader(dataview, type, little_endian) {
                switch(type){
                    // correspondences for non-specific length types here match rply:
                    case 'int8':
                    case 'char':
                        return {
                            read: (at)=>{
                                return dataview.getInt8(at);
                            },
                            size: 1
                        };
                    case 'uint8':
                    case 'uchar':
                        return {
                            read: (at)=>{
                                return dataview.getUint8(at);
                            },
                            size: 1
                        };
                    case 'int16':
                    case 'short':
                        return {
                            read: (at)=>{
                                return dataview.getInt16(at, little_endian);
                            },
                            size: 2
                        };
                    case 'uint16':
                    case 'ushort':
                        return {
                            read: (at)=>{
                                return dataview.getUint16(at, little_endian);
                            },
                            size: 2
                        };
                    case 'int32':
                    case 'int':
                        return {
                            read: (at)=>{
                                return dataview.getInt32(at, little_endian);
                            },
                            size: 4
                        };
                    case 'uint32':
                    case 'uint':
                        return {
                            read: (at)=>{
                                return dataview.getUint32(at, little_endian);
                            },
                            size: 4
                        };
                    case 'float32':
                    case 'float':
                        return {
                            read: (at)=>{
                                return dataview.getFloat32(at, little_endian);
                            },
                            size: 4
                        };
                    case 'float64':
                    case 'double':
                        return {
                            read: (at)=>{
                                return dataview.getFloat64(at, little_endian);
                            },
                            size: 8
                        };
                }
            }
            for(let i = 0, l = properties.length; i < l; i++){
                const property = properties[i];
                if (property.type === 'list') {
                    property.countReader = getBinaryReader(body, property.countType, little_endian);
                    property.valueReader = getBinaryReader(body, property.itemType, little_endian);
                } else property.valueReader = getBinaryReader(body, property.type, little_endian);
            }
        }
        function parseBinary(data, header) {
            const buffer = createBuffer();
            const little_endian = header.format === 'binary_little_endian';
            const body = new DataView(data, header.headerLength);
            let result, loc = 0;
            for(let currentElement = 0; currentElement < header.elements.length; currentElement++){
                const elementDesc = header.elements[currentElement];
                const properties = elementDesc.properties;
                const attributeMap = mapElementAttributes(properties);
                setPropertyBinaryReaders(properties, body, little_endian);
                for(let currentElementCount = 0; currentElementCount < elementDesc.count; currentElementCount++){
                    result = binaryReadElement(loc, properties);
                    loc += result[1];
                    const element = result[0];
                    handleElement(buffer, elementDesc.name, element, attributeMap);
                }
            }
            return postProcess(buffer);
        }
        function extractHeaderText(bytes) {
            let i = 0;
            let cont = true;
            let line = '';
            const lines = [];
            const startLine = new TextDecoder().decode(bytes.subarray(0, 5));
            const hasCRNL = /^ply\r\n/.test(startLine);
            do {
                const c = String.fromCharCode(bytes[i++]);
                if (c !== '\n' && c !== '\r') line += c;
                else {
                    if (line === 'end_header') cont = false;
                    if (line !== '') {
                        lines.push(line);
                        line = '';
                    }
                }
            }while (cont && i < bytes.length);
            // ascii section using \r\n as line endings
            if (hasCRNL === true) i++;
            return {
                headerText: lines.join('\r') + '\r',
                headerLength: i
            };
        }
        //
        let geometry;
        const scope = this;
        if (data instanceof ArrayBuffer) {
            const bytes = new Uint8Array(data);
            const { headerText, headerLength } = extractHeaderText(bytes);
            const header = parseHeader(headerText, headerLength);
            if (header.format === 'ascii') {
                const text = new TextDecoder().decode(bytes);
                geometry = parseASCII(text, header);
            } else geometry = parseBinary(data, header);
        } else geometry = parseASCII(data, parseHeader(data));
        return geometry;
    }
}
class ArrayStream {
    constructor(arr){
        this.arr = arr;
        this.i = 0;
    }
    empty() {
        return this.i >= this.arr.length;
    }
    next() {
        return this.arr[this.i++];
    }
}

},{"three":"hJIVG","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}]},["xLe6P"], null, "parcelRequire6840", {})

//# sourceMappingURL=PLYLoader.8478ed7b.js.map
