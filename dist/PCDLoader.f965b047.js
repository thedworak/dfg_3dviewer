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
})({"i4cj5":[function(require,module,exports,__globalThis) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SERVER_PORT = 1234;
var HMR_SECURE = false;
var HMR_ENV_HASH = "439701173a9199ea";
var HMR_USE_SSE = false;
module.bundle.HMR_BUNDLE_ID = "24270a14f965b047";
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

},{}],"1twVn":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "PCDLoader", ()=>PCDLoader);
var _three = require("three");
/**
 * A loader for the Point Cloud Data (PCD) format.
 *
 * PCDLoader supports ASCII and (compressed) binary files as well as the following PCD fields:
 * - x y z
 * - rgb
 * - normal_x normal_y normal_z
 * - intensity
 * - label
 *
 * ```js
 * const loader = new PCDLoader();
 *
 * const points = await loader.loadAsync( './models/pcd/binary/Zaghetto.pcd' );
 * points.geometry.center(); // optional
 * points.geometry.rotateX( Math.PI ); // optional
 * scene.add( points );
 * ```
 *
 * @augments Loader
 * @three_import import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';
 */ class PCDLoader extends (0, _three.Loader) {
    /**
	 * Constructs a new PCD loader.
	 *
	 * @param {LoadingManager} [manager] - The loading manager.
	 */ constructor(manager){
        super(manager);
        /**
		 * Whether to use little Endian or not.
		 *
		 * @type {boolean}
		 * @default true
		 */ this.littleEndian = true;
    }
    /**
	 * Starts loading from the given URL and passes the loaded PCD asset
	 * to the `onLoad()` callback.
	 *
	 * @param {string} url - The path/URL of the file to be loaded. This can also be a data URI.
	 * @param {function(Points)} onLoad - Executed when the loading process has been finished.
	 * @param {onProgressCallback} onProgress - Executed while the loading is in progress.
	 * @param {onErrorCallback} onError - Executed when errors occur.
	 */ load(url, onLoad, onProgress, onError) {
        const scope = this;
        const loader = new (0, _three.FileLoader)(scope.manager);
        loader.setPath(scope.path);
        loader.setResponseType('arraybuffer');
        loader.setRequestHeader(scope.requestHeader);
        loader.setWithCredentials(scope.withCredentials);
        loader.load(url, function(data) {
            try {
                onLoad(scope.parse(data));
            } catch (e) {
                if (onError) onError(e);
                else console.error(e);
                scope.manager.itemError(url);
            }
        }, onProgress, onError);
    }
    /**
	 * Get dataview value by field type and size.
	 *
	 * @private
	 * @param {DataView} dataview - The DataView to read from.
	 * @param {number} offset - The offset to start reading from.
	 * @param {'F' | 'U' | 'I'} type - Field type.
	 * @param {number} size - Field size.
	 * @returns {number} Field value.
	 */ _getDataView(dataview, offset, type, size) {
        switch(type){
            case 'F':
                if (size === 8) return dataview.getFloat64(offset, this.littleEndian);
                return dataview.getFloat32(offset, this.littleEndian);
            case 'I':
                if (size === 1) return dataview.getInt8(offset);
                if (size === 2) return dataview.getInt16(offset, this.littleEndian);
                return dataview.getInt32(offset, this.littleEndian);
            case 'U':
                if (size === 1) return dataview.getUint8(offset);
                if (size === 2) return dataview.getUint16(offset, this.littleEndian);
                return dataview.getUint32(offset, this.littleEndian);
        }
    }
    /**
	 * Parses the given PCD data and returns a point cloud.
	 *
	 * @param {ArrayBuffer} data - The raw PCD data as an array buffer.
	 * @return {Points} The parsed point cloud.
	 */ parse(data) {
        // from https://gitlab.com/taketwo/three-pcd-loader/blob/master/decompress-lzf.js
        function decompressLZF(inData, outLength) {
            const inLength = inData.length;
            const outData = new Uint8Array(outLength);
            let inPtr = 0;
            let outPtr = 0;
            let ctrl;
            let len;
            let ref;
            do {
                ctrl = inData[inPtr++];
                if (ctrl < 32) {
                    ctrl++;
                    if (outPtr + ctrl > outLength) throw new Error('Output buffer is not large enough');
                    if (inPtr + ctrl > inLength) throw new Error('Invalid compressed data');
                    do outData[outPtr++] = inData[inPtr++];
                    while (--ctrl);
                } else {
                    len = ctrl >> 5;
                    ref = outPtr - ((ctrl & 0x1f) << 8) - 1;
                    if (inPtr >= inLength) throw new Error('Invalid compressed data');
                    if (len === 7) {
                        len += inData[inPtr++];
                        if (inPtr >= inLength) throw new Error('Invalid compressed data');
                    }
                    ref -= inData[inPtr++];
                    if (outPtr + len + 2 > outLength) throw new Error('Output buffer is not large enough');
                    if (ref < 0) throw new Error('Invalid compressed data');
                    if (ref >= outPtr) throw new Error('Invalid compressed data');
                    do outData[outPtr++] = outData[ref++];
                    while (--len + 2);
                }
            }while (inPtr < inLength);
            return outData;
        }
        function parseHeader(binaryData) {
            const PCDheader = {};
            const buffer = new Uint8Array(binaryData);
            let data = '', line = '', i = 0, end = false;
            const max = buffer.length;
            while(i < max && end === false){
                const char = String.fromCharCode(buffer[i++]);
                if (char === '\n' || char === '\r') {
                    if (line.trim().toLowerCase().startsWith('data')) end = true;
                    line = '';
                } else line += char;
                data += char;
            }
            const result1 = data.search(/[\r\n]DATA\s(\S*)\s/i);
            const result2 = /[\r\n]DATA\s(\S*)\s/i.exec(data.slice(result1 - 1));
            PCDheader.data = result2[1];
            PCDheader.headerLen = result2[0].length + result1;
            PCDheader.str = data.slice(0, PCDheader.headerLen);
            // remove comments
            PCDheader.str = PCDheader.str.replace(/#.*/gi, '');
            // parse
            PCDheader.version = /^VERSION (.*)/im.exec(PCDheader.str);
            PCDheader.fields = /^FIELDS (.*)/im.exec(PCDheader.str);
            PCDheader.size = /^SIZE (.*)/im.exec(PCDheader.str);
            PCDheader.type = /^TYPE (.*)/im.exec(PCDheader.str);
            PCDheader.count = /^COUNT (.*)/im.exec(PCDheader.str);
            PCDheader.width = /^WIDTH (.*)/im.exec(PCDheader.str);
            PCDheader.height = /^HEIGHT (.*)/im.exec(PCDheader.str);
            PCDheader.viewpoint = /^VIEWPOINT (.*)/im.exec(PCDheader.str);
            PCDheader.points = /^POINTS (.*)/im.exec(PCDheader.str);
            // evaluate
            if (PCDheader.version !== null) PCDheader.version = parseFloat(PCDheader.version[1]);
            PCDheader.fields = PCDheader.fields !== null ? PCDheader.fields[1].split(' ') : [];
            if (PCDheader.type !== null) PCDheader.type = PCDheader.type[1].split(' ');
            if (PCDheader.width !== null) PCDheader.width = parseInt(PCDheader.width[1]);
            if (PCDheader.height !== null) PCDheader.height = parseInt(PCDheader.height[1]);
            if (PCDheader.viewpoint !== null) PCDheader.viewpoint = PCDheader.viewpoint[1];
            if (PCDheader.points !== null) PCDheader.points = parseInt(PCDheader.points[1], 10);
            if (PCDheader.points === null) PCDheader.points = PCDheader.width * PCDheader.height;
            if (PCDheader.size !== null) PCDheader.size = PCDheader.size[1].split(' ').map(function(x) {
                return parseInt(x, 10);
            });
            if (PCDheader.count !== null) PCDheader.count = PCDheader.count[1].split(' ').map(function(x) {
                return parseInt(x, 10);
            });
            else {
                PCDheader.count = [];
                for(let i = 0, l = PCDheader.fields.length; i < l; i++)PCDheader.count.push(1);
            }
            PCDheader.offset = {};
            let sizeSum = 0;
            for(let i = 0, l = PCDheader.fields.length; i < l; i++)if (PCDheader.data === 'ascii') PCDheader.offset[PCDheader.fields[i]] = i;
            else {
                PCDheader.offset[PCDheader.fields[i]] = sizeSum;
                sizeSum += PCDheader.size[i] * PCDheader.count[i];
            }
            // for binary only
            PCDheader.rowSize = sizeSum;
            return PCDheader;
        }
        // parse header
        const PCDheader = parseHeader(data);
        // parse data
        const position = [];
        const normal = [];
        const color = [];
        const intensity = [];
        const label = [];
        const c = new (0, _three.Color)();
        // ascii
        if (PCDheader.data === 'ascii') {
            const offset = PCDheader.offset;
            const textData = new TextDecoder().decode(data);
            const pcdData = textData.slice(PCDheader.headerLen);
            const lines = pcdData.split('\n');
            for(let i = 0, l = lines.length; i < l; i++){
                if (lines[i] === '') continue;
                const line = lines[i].split(' ');
                if (offset.x !== undefined) {
                    position.push(parseFloat(line[offset.x]));
                    position.push(parseFloat(line[offset.y]));
                    position.push(parseFloat(line[offset.z]));
                }
                if (offset.rgb !== undefined) {
                    const rgb_field_index = PCDheader.fields.findIndex((field)=>field === 'rgb');
                    const rgb_type = PCDheader.type[rgb_field_index];
                    const float = parseFloat(line[offset.rgb]);
                    let rgb = float;
                    if (rgb_type === 'F') {
                        // treat float values as int
                        // https://github.com/daavoo/pyntcloud/pull/204/commits/7b4205e64d5ed09abe708b2e91b615690c24d518
                        const farr = new Float32Array(1);
                        farr[0] = float;
                        rgb = new Int32Array(farr.buffer)[0];
                    }
                    const r = (rgb >> 16 & 0x0000ff) / 255;
                    const g = (rgb >> 8 & 0x0000ff) / 255;
                    const b = (rgb >> 0 & 0x0000ff) / 255;
                    c.setRGB(r, g, b, (0, _three.SRGBColorSpace));
                    color.push(c.r, c.g, c.b);
                }
                if (offset.normal_x !== undefined) {
                    normal.push(parseFloat(line[offset.normal_x]));
                    normal.push(parseFloat(line[offset.normal_y]));
                    normal.push(parseFloat(line[offset.normal_z]));
                }
                if (offset.intensity !== undefined) intensity.push(parseFloat(line[offset.intensity]));
                if (offset.label !== undefined) label.push(parseInt(line[offset.label]));
            }
        }
        // binary-compressed
        // normally data in PCD files are organized as array of structures: XYZRGBXYZRGB
        // binary compressed PCD files organize their data as structure of arrays: XXYYZZRGBRGB
        // that requires a totally different parsing approach compared to non-compressed data
        if (PCDheader.data === 'binary_compressed') {
            const sizes = new Uint32Array(data.slice(PCDheader.headerLen, PCDheader.headerLen + 8));
            const compressedSize = sizes[0];
            const decompressedSize = sizes[1];
            const decompressed = decompressLZF(new Uint8Array(data, PCDheader.headerLen + 8, compressedSize), decompressedSize);
            const dataview = new DataView(decompressed.buffer);
            const offset = PCDheader.offset;
            for(let i = 0; i < PCDheader.points; i++){
                if (offset.x !== undefined) {
                    const xIndex = PCDheader.fields.indexOf('x');
                    const yIndex = PCDheader.fields.indexOf('y');
                    const zIndex = PCDheader.fields.indexOf('z');
                    position.push(this._getDataView(dataview, PCDheader.points * offset.x + PCDheader.size[xIndex] * i, PCDheader.type[xIndex], PCDheader.size[xIndex]));
                    position.push(this._getDataView(dataview, PCDheader.points * offset.y + PCDheader.size[yIndex] * i, PCDheader.type[yIndex], PCDheader.size[yIndex]));
                    position.push(this._getDataView(dataview, PCDheader.points * offset.z + PCDheader.size[zIndex] * i, PCDheader.type[zIndex], PCDheader.size[zIndex]));
                }
                if (offset.rgb !== undefined) {
                    const rgbIndex = PCDheader.fields.indexOf('rgb');
                    const r = dataview.getUint8(PCDheader.points * offset.rgb + PCDheader.size[rgbIndex] * i + 2) / 255.0;
                    const g = dataview.getUint8(PCDheader.points * offset.rgb + PCDheader.size[rgbIndex] * i + 1) / 255.0;
                    const b = dataview.getUint8(PCDheader.points * offset.rgb + PCDheader.size[rgbIndex] * i + 0) / 255.0;
                    c.setRGB(r, g, b, (0, _three.SRGBColorSpace));
                    color.push(c.r, c.g, c.b);
                }
                if (offset.normal_x !== undefined) {
                    const xIndex = PCDheader.fields.indexOf('normal_x');
                    const yIndex = PCDheader.fields.indexOf('normal_y');
                    const zIndex = PCDheader.fields.indexOf('normal_z');
                    normal.push(this._getDataView(dataview, PCDheader.points * offset.normal_x + PCDheader.size[xIndex] * i, PCDheader.type[xIndex], PCDheader.size[xIndex]));
                    normal.push(this._getDataView(dataview, PCDheader.points * offset.normal_y + PCDheader.size[yIndex] * i, PCDheader.type[yIndex], PCDheader.size[yIndex]));
                    normal.push(this._getDataView(dataview, PCDheader.points * offset.normal_z + PCDheader.size[zIndex] * i, PCDheader.type[zIndex], PCDheader.size[zIndex]));
                }
                if (offset.intensity !== undefined) {
                    const intensityIndex = PCDheader.fields.indexOf('intensity');
                    intensity.push(this._getDataView(dataview, PCDheader.points * offset.intensity + PCDheader.size[intensityIndex] * i, PCDheader.type[intensityIndex], PCDheader.size[intensityIndex]));
                }
                if (offset.label !== undefined) {
                    const labelIndex = PCDheader.fields.indexOf('label');
                    label.push(this._getDataView(dataview, PCDheader.points * offset.label + PCDheader.size[labelIndex] * i, PCDheader.type[labelIndex], PCDheader.size[labelIndex]));
                }
            }
        }
        // binary
        if (PCDheader.data === 'binary') {
            const dataview = new DataView(data, PCDheader.headerLen);
            const offset = PCDheader.offset;
            for(let i = 0, row = 0; i < PCDheader.points; i++, row += PCDheader.rowSize){
                if (offset.x !== undefined) {
                    const xIndex = PCDheader.fields.indexOf('x');
                    const yIndex = PCDheader.fields.indexOf('y');
                    const zIndex = PCDheader.fields.indexOf('z');
                    position.push(this._getDataView(dataview, row + offset.x, PCDheader.type[xIndex], PCDheader.size[xIndex]));
                    position.push(this._getDataView(dataview, row + offset.y, PCDheader.type[yIndex], PCDheader.size[yIndex]));
                    position.push(this._getDataView(dataview, row + offset.z, PCDheader.type[zIndex], PCDheader.size[zIndex]));
                }
                if (offset.rgb !== undefined) {
                    const r = dataview.getUint8(row + offset.rgb + 2) / 255.0;
                    const g = dataview.getUint8(row + offset.rgb + 1) / 255.0;
                    const b = dataview.getUint8(row + offset.rgb + 0) / 255.0;
                    c.setRGB(r, g, b, (0, _three.SRGBColorSpace));
                    color.push(c.r, c.g, c.b);
                }
                if (offset.normal_x !== undefined) {
                    const xIndex = PCDheader.fields.indexOf('normal_x');
                    const yIndex = PCDheader.fields.indexOf('normal_y');
                    const zIndex = PCDheader.fields.indexOf('normal_z');
                    normal.push(this._getDataView(dataview, row + offset.normal_x, PCDheader.type[xIndex], PCDheader.size[xIndex]));
                    normal.push(this._getDataView(dataview, row + offset.normal_y, PCDheader.type[yIndex], PCDheader.size[yIndex]));
                    normal.push(this._getDataView(dataview, row + offset.normal_z, PCDheader.type[zIndex], PCDheader.size[zIndex]));
                }
                if (offset.intensity !== undefined) {
                    const intensityIndex = PCDheader.fields.indexOf('intensity');
                    intensity.push(this._getDataView(dataview, row + offset.intensity, PCDheader.type[intensityIndex], PCDheader.size[intensityIndex]));
                }
                if (offset.label !== undefined) {
                    const labelIndex = PCDheader.fields.indexOf('label');
                    label.push(this._getDataView(dataview, row + offset.label, PCDheader.type[labelIndex], PCDheader.size[labelIndex]));
                }
            }
        }
        // build geometry
        const geometry = new (0, _three.BufferGeometry)();
        if (position.length > 0) geometry.setAttribute('position', new (0, _three.Float32BufferAttribute)(position, 3));
        if (normal.length > 0) geometry.setAttribute('normal', new (0, _three.Float32BufferAttribute)(normal, 3));
        if (color.length > 0) geometry.setAttribute('color', new (0, _three.Float32BufferAttribute)(color, 3));
        if (intensity.length > 0) geometry.setAttribute('intensity', new (0, _three.Float32BufferAttribute)(intensity, 1));
        if (label.length > 0) geometry.setAttribute('label', new (0, _three.Int32BufferAttribute)(label, 1));
        geometry.computeBoundingSphere();
        // build material
        const material = new (0, _three.PointsMaterial)({
            size: 0.005
        });
        if (color.length > 0) material.vertexColors = true;
        // build point cloud
        return new (0, _three.Points)(geometry, material);
    }
}

},{"three":"hJIVG","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}]},["i4cj5"], null, "parcelRequire6840", {})

//# sourceMappingURL=PCDLoader.f965b047.js.map
