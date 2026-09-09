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
})({"9oQXJ":[function(require,module,exports,__globalThis) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SERVER_PORT = 1234;
var HMR_SECURE = false;
var HMR_ENV_HASH = "439701173a9199ea";
var HMR_USE_SSE = false;
module.bundle.HMR_BUNDLE_ID = "4a86f11bf13f946a";
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

},{}],"8uDDV":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
// const MESH_COLOR = 0x4165;
// const MESH_TEXTURE_INFO = 0x4170;
// const KFDATA = 0xB000;
// const KFHDR = 0xB00A;
// const KFSEG = 0xB008;
// const KFCURTIME = 0xB009;
// const AMBIENT_NODE_TAG = 0xB001;
// const OBJECT_NODE_TAG = 0xB002;
// const CAMERA_NODE_TAG = 0xB003;
// const TARGET_NODE_TAG = 0xB004;
// const LIGHT_NODE_TAG = 0xB005;
// const L_TARGET_NODE_TAG = 0xB006;
// const SPOTLIGHT_NODE_TAG = 0xB007;
// const NODE_ID = 0xB030;
// const NODE_HDR = 0xB010;
// const PIVOT = 0xB013;
// const INSTANCE_NAME = 0xB011;
// const MORPH_SMOOTH = 0xB015;
// const BOUNDBOX = 0xB014;
// const POS_TRACK_TAG = 0xB020;
// const COL_TRACK_TAG = 0xB025;
// const ROT_TRACK_TAG = 0xB021;
// const SCL_TRACK_TAG = 0xB022;
// const MORPH_TRACK_TAG = 0xB026;
// const FOV_TRACK_TAG = 0xB023;
// const ROLL_TRACK_TAG = 0xB024;
// const HOT_TRACK_TAG = 0xB027;
// const FALL_TRACK_TAG = 0xB028;
// const HIDE_TRACK_TAG = 0xB029;
// const POLY_2D = 0x5000;
// const SHAPE_OK = 0x5010;
// const SHAPE_NOT_OK = 0x5011;
// const SHAPE_HOOK = 0x5020;
// const PATH_3D = 0x6000;
// const PATH_MATRIX = 0x6005;
// const SHAPE_2D = 0x6010;
// const M_SCALE = 0x6020;
// const M_TWIST = 0x6030;
// const M_TEETER = 0x6040;
// const M_FIT = 0x6050;
// const M_BEVEL = 0x6060;
// const XZ_CURVE = 0x6070;
// const YZ_CURVE = 0x6080;
// const INTERPCT = 0x6090;
// const DEFORM_LIMIT = 0x60A0;
// const USE_CONTOUR = 0x6100;
// const USE_TWEEN = 0x6110;
// const USE_SCALE = 0x6120;
// const USE_TWIST = 0x6130;
// const USE_TEETER = 0x6140;
// const USE_FIT = 0x6150;
// const USE_BEVEL = 0x6160;
// const DEFAULT_VIEW = 0x3000;
// const VIEW_TOP = 0x3010;
// const VIEW_BOTTOM = 0x3020;
// const VIEW_LEFT = 0x3030;
// const VIEW_RIGHT = 0x3040;
// const VIEW_FRONT = 0x3050;
// const VIEW_BACK = 0x3060;
// const VIEW_USER = 0x3070;
// const VIEW_CAMERA = 0x3080;
// const VIEW_WINDOW = 0x3090;
// const VIEWPORT_LAYOUT_OLD = 0x7000;
// const VIEWPORT_DATA_OLD = 0x7010;
// const VIEWPORT_LAYOUT = 0x7001;
// const VIEWPORT_DATA = 0x7011;
// const VIEWPORT_DATA_3 = 0x7012;
// const VIEWPORT_SIZE = 0x7020;
// const NETWORK_VIEW = 0x7030;
parcelHelpers.export(exports, "TDSLoader", ()=>TDSLoader);
var _three = require("three");
/**
 * A loader for the 3DS format, based on lib3ds.
 *
 * Loads geometry with uv and materials basic properties with texture support.
 *
 * ```js
 * const loader = new TDSLoader();
 * loader.setResourcePath( 'models/3ds/portalgun/textures/' );
 * const object = await loader.loadAsync( 'models/3ds/portalgun/portalgun.3ds' );
 * scene.add( object );
 *
 * @augments Loader
 * @three_import import { TDSLoader } from 'three/addons/loaders/TDSLoader.js';
 */ class TDSLoader extends (0, _three.Loader) {
    /**
	 * Constructs a new 3DS loader.
	 *
	 * @param {LoadingManager} [manager] - The loading manager.
	 */ constructor(manager){
        super(manager);
        /**
		 * Whether debug mode should be enabled or not.
		 *
		 * @type {boolean}
		 * @default false
		 */ this.debug = false;
        // internals
        this.group = null;
        this.materials = [];
        this.meshes = [];
    }
    /**
	 * Starts loading from the given URL and passes the loaded 3DS asset
	 * to the `onLoad()` callback.
	 *
	 * @param {string} url - The path/URL of the file to be loaded. This can also be a data URI.
	 * @param {function(Group)} onLoad - Executed when the loading process has been finished.
	 * @param {onProgressCallback} onProgress - Executed while the loading is in progress.
	 * @param {onErrorCallback} onError - Executed when errors occur.
	 */ load(url, onLoad, onProgress, onError) {
        const scope = this;
        const path = this.path === '' ? (0, _three.LoaderUtils).extractUrlBase(url) : this.path;
        const loader = new (0, _three.FileLoader)(this.manager);
        loader.setPath(this.path);
        loader.setResponseType('arraybuffer');
        loader.setRequestHeader(this.requestHeader);
        loader.setWithCredentials(this.withCredentials);
        loader.load(url, function(data) {
            try {
                onLoad(scope.parse(data, path));
            } catch (e) {
                if (onError) onError(e);
                else console.error(e);
                scope.manager.itemError(url);
            }
        }, onProgress, onError);
    }
    /**
	 * Parses the given 3DS data and returns the resulting data.
	 *
	 * @param {ArrayBuffer} arraybuffer - The raw 3DS data as an array buffer.
	 * @param {string} path - The asset path.
	 * @return {Group} The parsed asset represented as a group.
	 */ parse(arraybuffer, path) {
        this.group = new (0, _three.Group)();
        this.materials = [];
        this.meshes = [];
        this.readFile(arraybuffer, path);
        for(let i = 0; i < this.meshes.length; i++)this.group.add(this.meshes[i]);
        return this.group;
    }
    /**
	 * Decode file content to read 3ds data.
	 *
	 * @private
	 * @param {ArrayBuffer} arraybuffer - Arraybuffer data to be loaded.
	 * @param {string} path - Path for external resources.
	 */ readFile(arraybuffer, path) {
        const data = new DataView(arraybuffer);
        const chunk = new Chunk(data, 0, this.debugMessage);
        if (chunk.id === MLIBMAGIC || chunk.id === CMAGIC || chunk.id === M3DMAGIC) {
            let next = chunk.readChunk();
            while(next){
                if (next.id === M3D_VERSION) {
                    const version = next.readDWord();
                    this.debugMessage('3DS file version: ' + version);
                } else if (next.id === MDATA) this.readMeshData(next, path);
                else this.debugMessage('Unknown main chunk: ' + next.hexId);
                next = chunk.readChunk();
            }
        }
        this.debugMessage('Parsed ' + this.meshes.length + ' meshes');
    }
    /**
	 * Read mesh data chunk.
	 *
	 * @private
	 * @param {Chunk} chunk - to read mesh from
	 * @param {string} path - Path for external resources.
	 */ readMeshData(chunk, path) {
        let next = chunk.readChunk();
        while(next){
            if (next.id === MESH_VERSION) {
                const version = +next.readDWord();
                this.debugMessage('Mesh Version: ' + version);
            } else if (next.id === MASTER_SCALE) {
                const scale = next.readFloat();
                this.debugMessage('Master scale: ' + scale);
                this.group.scale.set(scale, scale, scale);
            } else if (next.id === NAMED_OBJECT) {
                this.debugMessage('Named Object');
                this.readNamedObject(next);
            } else if (next.id === MAT_ENTRY) {
                this.debugMessage('Material');
                this.readMaterialEntry(next, path);
            } else this.debugMessage('Unknown MDATA chunk: ' + next.hexId);
            next = chunk.readChunk();
        }
    }
    /**
	 * Read named object chunk.
	 *
	 * @private
	 * @param {Chunk} chunk - Chunk in use.
	 */ readNamedObject(chunk) {
        const name = chunk.readString();
        let next = chunk.readChunk();
        while(next){
            if (next.id === N_TRI_OBJECT) {
                const mesh = this.readMesh(next);
                mesh.name = name;
                this.meshes.push(mesh);
            } else this.debugMessage('Unknown named object chunk: ' + next.hexId);
            next = chunk.readChunk();
        }
    }
    /**
	 * Read material data chunk and add it to the material list.
	 *
	 * @private
	 * @param {Chunk} chunk - Chunk in use.
	 * @param {string} path - Path for external resources.
	 */ readMaterialEntry(chunk, path) {
        let next = chunk.readChunk();
        const material = new (0, _three.MeshPhongMaterial)();
        while(next){
            if (next.id === MAT_NAME) {
                material.name = next.readString();
                this.debugMessage('   Name: ' + material.name);
            } else if (next.id === MAT_WIRE) {
                this.debugMessage('   Wireframe');
                material.wireframe = true;
            } else if (next.id === MAT_WIRE_SIZE) {
                const value = next.readByte();
                material.wireframeLinewidth = value;
                this.debugMessage('   Wireframe Thickness: ' + value);
            } else if (next.id === MAT_TWO_SIDE) {
                material.side = (0, _three.DoubleSide);
                this.debugMessage('   DoubleSided');
            } else if (next.id === MAT_ADDITIVE) {
                this.debugMessage('   Additive Blending');
                material.blending = (0, _three.AdditiveBlending);
            } else if (next.id === MAT_DIFFUSE) {
                this.debugMessage('   Diffuse Color');
                material.color = this.readColor(next);
            } else if (next.id === MAT_SPECULAR) {
                this.debugMessage('   Specular Color');
                material.specular = this.readColor(next);
            } else if (next.id === MAT_AMBIENT) {
                this.debugMessage('   Ambient color');
                material.color = this.readColor(next);
            } else if (next.id === MAT_SHININESS) {
                const shininess = this.readPercentage(next);
                material.shininess = shininess * 100;
                this.debugMessage('   Shininess : ' + shininess);
            } else if (next.id === MAT_TRANSPARENCY) {
                const transparency = this.readPercentage(next);
                material.opacity = 1 - transparency;
                this.debugMessage('  Transparency : ' + transparency);
                material.transparent = material.opacity < 1 ? true : false;
            } else if (next.id === MAT_TEXMAP) {
                this.debugMessage('   ColorMap');
                material.map = this.readMap(next, path);
            } else if (next.id === MAT_BUMPMAP) {
                this.debugMessage('   BumpMap');
                material.bumpMap = this.readMap(next, path);
            } else if (next.id === MAT_OPACMAP) {
                this.debugMessage('   OpacityMap');
                material.alphaMap = this.readMap(next, path);
            } else if (next.id === MAT_SPECMAP) {
                this.debugMessage('   SpecularMap');
                material.specularMap = this.readMap(next, path);
            } else this.debugMessage('   Unknown material chunk: ' + next.hexId);
            next = chunk.readChunk();
        }
        this.materials[material.name] = material;
    }
    /**
	 * Read mesh data chunk.
	 *
	 * @private
	 * @param {Chunk} chunk - Chunk in use.
	 * @return {Mesh} - The parsed mesh.
	 */ readMesh(chunk) {
        let next = chunk.readChunk();
        const geometry = new (0, _three.BufferGeometry)();
        const material = new (0, _three.MeshPhongMaterial)();
        const mesh = new (0, _three.Mesh)(geometry, material);
        mesh.name = 'mesh';
        while(next){
            if (next.id === POINT_ARRAY) {
                const points = next.readWord();
                this.debugMessage('   Vertex: ' + points);
                //BufferGeometry
                const vertices = [];
                for(let i = 0; i < points; i++){
                    vertices.push(next.readFloat());
                    vertices.push(next.readFloat());
                    vertices.push(next.readFloat());
                }
                geometry.setAttribute('position', new (0, _three.Float32BufferAttribute)(vertices, 3));
            } else if (next.id === FACE_ARRAY) this.readFaceArray(next, mesh);
            else if (next.id === TEX_VERTS) {
                const texels = next.readWord();
                this.debugMessage('   UV: ' + texels);
                //BufferGeometry
                const uvs = [];
                for(let i = 0; i < texels; i++){
                    uvs.push(next.readFloat());
                    uvs.push(next.readFloat());
                }
                geometry.setAttribute('uv', new (0, _three.Float32BufferAttribute)(uvs, 2));
            } else if (next.id === MESH_MATRIX) {
                this.debugMessage('   Transformation Matrix (TODO)');
                const values = [];
                for(let i = 0; i < 12; i++)values[i] = next.readFloat();
                const matrix = new (0, _three.Matrix4)();
                //X Line
                matrix.elements[0] = values[0];
                matrix.elements[1] = values[6];
                matrix.elements[2] = values[3];
                matrix.elements[3] = values[9];
                //Y Line
                matrix.elements[4] = values[2];
                matrix.elements[5] = values[8];
                matrix.elements[6] = values[5];
                matrix.elements[7] = values[11];
                //Z Line
                matrix.elements[8] = values[1];
                matrix.elements[9] = values[7];
                matrix.elements[10] = values[4];
                matrix.elements[11] = values[10];
                //W Line
                matrix.elements[12] = 0;
                matrix.elements[13] = 0;
                matrix.elements[14] = 0;
                matrix.elements[15] = 1;
                matrix.transpose();
                const inverse = new (0, _three.Matrix4)();
                inverse.copy(matrix).invert();
                geometry.applyMatrix4(inverse);
                matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
            } else this.debugMessage('   Unknown mesh chunk: ' + next.hexId);
            next = chunk.readChunk();
        }
        geometry.computeVertexNormals();
        return mesh;
    }
    /**
	 * Read face array data chunk.
	 *
	 * @private
	 * @param {Chunk} chunk - Chunk in use.
	 * @param {Mesh} mesh - Mesh to be filled with the data read.
	 */ readFaceArray(chunk, mesh) {
        const faces = chunk.readWord();
        this.debugMessage('   Faces: ' + faces);
        const index = [];
        for(let i = 0; i < faces; ++i){
            index.push(chunk.readWord(), chunk.readWord(), chunk.readWord());
            chunk.readWord(); // visibility
        }
        mesh.geometry.setIndex(index);
        //The rest of the FACE_ARRAY chunk is subchunks
        let materialIndex = 0;
        let start = 0;
        while(!chunk.endOfChunk){
            const subchunk = chunk.readChunk();
            if (subchunk.id === MSH_MAT_GROUP) {
                this.debugMessage('      Material Group');
                const group = this.readMaterialGroup(subchunk);
                const count = group.index.length * 3; // assuming successive indices
                mesh.geometry.addGroup(start, count, materialIndex);
                start += count;
                materialIndex++;
                const material = this.materials[group.name];
                if (Array.isArray(mesh.material) === false) mesh.material = [];
                if (material !== undefined) mesh.material.push(material);
            } else this.debugMessage('      Unknown face array chunk: ' + subchunk.hexId);
        }
        if (mesh.material.length === 1) mesh.material = mesh.material[0]; // for backwards compatibility
    }
    /**
	 * Read texture map data chunk.
	 *
	 * @private
	 * @param {Chunk} chunk - Chunk in use.
	 * @param {string} path - Path for external resources.
	 * @return {Texture} Texture read from this data chunk.
	 */ readMap(chunk, path) {
        let next = chunk.readChunk();
        let texture = {};
        const loader = new (0, _three.TextureLoader)(this.manager);
        loader.setPath(this.resourcePath || path).setCrossOrigin(this.crossOrigin);
        while(next){
            if (next.id === MAT_MAPNAME) {
                const name = next.readString();
                texture = loader.load(name);
                this.debugMessage('      File: ' + path + name);
            } else if (next.id === MAT_MAP_UOFFSET) {
                texture.offset.x = next.readFloat();
                this.debugMessage('      OffsetX: ' + texture.offset.x);
            } else if (next.id === MAT_MAP_VOFFSET) {
                texture.offset.y = next.readFloat();
                this.debugMessage('      OffsetY: ' + texture.offset.y);
            } else if (next.id === MAT_MAP_USCALE) {
                texture.repeat.x = next.readFloat();
                this.debugMessage('      RepeatX: ' + texture.repeat.x);
            } else if (next.id === MAT_MAP_VSCALE) {
                texture.repeat.y = next.readFloat();
                this.debugMessage('      RepeatY: ' + texture.repeat.y);
            } else this.debugMessage('      Unknown map chunk: ' + next.hexId);
            next = chunk.readChunk();
        }
        return texture;
    }
    /**
	 * Read material group data chunk.
	 *
	 * @private
	 * @param {Chunk} chunk - Chunk in use.
	 * @return {Object} Object with name and index of the object.
	 */ readMaterialGroup(chunk) {
        const name = chunk.readString();
        const numFaces = chunk.readWord();
        this.debugMessage('         Name: ' + name);
        this.debugMessage('         Faces: ' + numFaces);
        const index = [];
        for(let i = 0; i < numFaces; ++i)index.push(chunk.readWord());
        return {
            name: name,
            index: index
        };
    }
    /**
	 * Read a color value.
	 *
	 * @private
	 * @param {Chunk} chunk - Chunk.
	 * @return {Color} Color value read.
	 */ readColor(chunk) {
        const subChunk = chunk.readChunk();
        const color = new (0, _three.Color)();
        if (subChunk.id === COLOR_24 || subChunk.id === LIN_COLOR_24) {
            const r = subChunk.readByte();
            const g = subChunk.readByte();
            const b = subChunk.readByte();
            color.setRGB(r / 255, g / 255, b / 255);
            this.debugMessage('      Color: ' + color.r + ', ' + color.g + ', ' + color.b);
        } else if (subChunk.id === COLOR_F || subChunk.id === LIN_COLOR_F) {
            const r = subChunk.readFloat();
            const g = subChunk.readFloat();
            const b = subChunk.readFloat();
            color.setRGB(r, g, b);
            this.debugMessage('      Color: ' + color.r + ', ' + color.g + ', ' + color.b);
        } else this.debugMessage('      Unknown color chunk: ' + subChunk.hexId);
        return color;
    }
    /**
	 * Read percentage value.
	 *
	 * @private
	 * @param {Chunk} chunk - Chunk to read data from.
	 * @return {number} Data read from the dataview.
	 */ readPercentage(chunk) {
        const subChunk = chunk.readChunk();
        switch(subChunk.id){
            case INT_PERCENTAGE:
                return subChunk.readShort() / 100;
            case FLOAT_PERCENTAGE:
                return subChunk.readFloat();
            default:
                this.debugMessage('      Unknown percentage chunk: ' + subChunk.hexId);
                return 0;
        }
    }
    /**
	 * Print debug message to the console.
	 *
	 * Is controlled by a flag to show or hide debug messages.
	 *
	 * @private
	 * @param {Object} message - Debug message to print to the console.
	 */ debugMessage(message) {
        if (this.debug) console.log(message);
    }
}
/**
 * Read data/sub-chunks from chunk.
 *
 * @private
 */ class Chunk {
    /**
	 * Create a new chunk
	 *
	 * @private
	 * @param {DataView} data - DataView to read from.
	 * @param {number} position - In data.
	 * @param {Function} debugMessage - Logging callback.
	 */ constructor(data, position, debugMessage){
        this.data = data;
        // the offset to the begin of this chunk
        this.offset = position;
        // the current reading position
        this.position = position;
        this.debugMessage = debugMessage;
        if (this.debugMessage instanceof Function) this.debugMessage = function() {};
        this.id = this.readWord();
        this.size = this.readDWord();
        this.end = this.offset + this.size;
        if (this.end > data.byteLength) this.debugMessage('Bad chunk size for chunk at ' + position);
    }
    /**
	 * Reads a sub cchunk.
	 *
	 * @private
	 * @return {Chunk | null} next sub chunk.
	 */ readChunk() {
        if (this.endOfChunk) return null;
        try {
            const next = new Chunk(this.data, this.position, this.debugMessage);
            this.position += next.size;
            return next;
        } catch (e) {
            this.debugMessage('Unable to read chunk at ' + this.position);
            return null;
        }
    }
    /**
	 * Returns the ID of this chunk as Hex
	 *
	 * @private
	 * @return {string} hex-string of id
	 */ get hexId() {
        return this.id.toString(16);
    }
    get endOfChunk() {
        return this.position >= this.end;
    }
    /**
	 * Read byte value.
	 *
	 * @private
	 * @return {number} Data read from the dataview.
	 */ readByte() {
        const v = this.data.getUint8(this.position, true);
        this.position += 1;
        return v;
    }
    /**
	 * Read 32 bit float value.
	 *
	 * @private
	 * @return {number} Data read from the dataview.
	 */ readFloat() {
        try {
            const v = this.data.getFloat32(this.position, true);
            this.position += 4;
            return v;
        } catch (e) {
            this.debugMessage(e + ' ' + this.position + ' ' + this.data.byteLength);
            return 0;
        }
    }
    /**
	 * Read 32 bit signed integer value.
	 *
	 * @private
	 * @return {number} Data read from the dataview.
	 */ readInt() {
        const v = this.data.getInt32(this.position, true);
        this.position += 4;
        return v;
    }
    /**
	 * Read 16 bit signed integer value.
	 *
	 * @private
	 * @return {number} Data read from the dataview.
	 */ readShort() {
        const v = this.data.getInt16(this.position, true);
        this.position += 2;
        return v;
    }
    /**
	 * Read 64 bit unsigned integer value.
	 *
	 * @private
	 * @return {number} Data read from the dataview.
	 */ readDWord() {
        const v = this.data.getUint32(this.position, true);
        this.position += 4;
        return v;
    }
    /**
	 * Read 32 bit unsigned integer value.
	 *
	 * @private
	 * @return {number} Data read from the dataview.
	 */ readWord() {
        const v = this.data.getUint16(this.position, true);
        this.position += 2;
        return v;
    }
    /**
	 * Read NULL terminated ASCII string value from chunk-pos.
	 *
	 * @private
	 * @return {string} Data read from the dataview.
	 */ readString() {
        let s = '';
        let c = this.readByte();
        while(c){
            s += String.fromCharCode(c);
            c = this.readByte();
        }
        return s;
    }
}
// const NULL_CHUNK = 0x0000;
const M3DMAGIC = 0x4D4D;
// const SMAGIC = 0x2D2D;
// const LMAGIC = 0x2D3D;
const MLIBMAGIC = 0x3DAA;
// const MATMAGIC = 0x3DFF;
const CMAGIC = 0xC23D;
const M3D_VERSION = 0x0002;
// const M3D_KFVERSION = 0x0005;
const COLOR_F = 0x0010;
const COLOR_24 = 0x0011;
const LIN_COLOR_24 = 0x0012;
const LIN_COLOR_F = 0x0013;
const INT_PERCENTAGE = 0x0030;
const FLOAT_PERCENTAGE = 0x0031;
const MDATA = 0x3D3D;
const MESH_VERSION = 0x3D3E;
const MASTER_SCALE = 0x0100;
// const LO_SHADOW_BIAS = 0x1400;
// const HI_SHADOW_BIAS = 0x1410;
// const SHADOW_MAP_SIZE = 0x1420;
// const SHADOW_SAMPLES = 0x1430;
// const SHADOW_RANGE = 0x1440;
// const SHADOW_FILTER = 0x1450;
// const RAY_BIAS = 0x1460;
// const O_CONSTS = 0x1500;
// const AMBIENT_LIGHT = 0x2100;
// const BIT_MAP = 0x1100;
// const SOLID_BGND = 0x1200;
// const V_GRADIENT = 0x1300;
// const USE_BIT_MAP = 0x1101;
// const USE_SOLID_BGND = 0x1201;
// const USE_V_GRADIENT = 0x1301;
// const FOG = 0x2200;
// const FOG_BGND = 0x2210;
// const LAYER_FOG = 0x2302;
// const DISTANCE_CUE = 0x2300;
// const DCUE_BGND = 0x2310;
// const USE_FOG = 0x2201;
// const USE_LAYER_FOG = 0x2303;
// const USE_DISTANCE_CUE = 0x2301;
const MAT_ENTRY = 0xAFFF;
const MAT_NAME = 0xA000;
const MAT_AMBIENT = 0xA010;
const MAT_DIFFUSE = 0xA020;
const MAT_SPECULAR = 0xA030;
const MAT_SHININESS = 0xA040;
// const MAT_SHIN2PCT = 0xA041;
const MAT_TRANSPARENCY = 0xA050;
// const MAT_XPFALL = 0xA052;
// const MAT_USE_XPFALL = 0xA240;
// const MAT_REFBLUR = 0xA053;
// const MAT_SHADING = 0xA100;
// const MAT_USE_REFBLUR = 0xA250;
// const MAT_SELF_ILLUM = 0xA084;
const MAT_TWO_SIDE = 0xA081;
// const MAT_DECAL = 0xA082;
const MAT_ADDITIVE = 0xA083;
const MAT_WIRE = 0xA085;
// const MAT_FACEMAP = 0xA088;
// const MAT_TRANSFALLOFF_IN = 0xA08A;
// const MAT_PHONGSOFT = 0xA08C;
// const MAT_WIREABS = 0xA08E;
const MAT_WIRE_SIZE = 0xA087;
const MAT_TEXMAP = 0xA200;
// const MAT_SXP_TEXT_DATA = 0xA320;
// const MAT_TEXMASK = 0xA33E;
// const MAT_SXP_TEXTMASK_DATA = 0xA32A;
// const MAT_TEX2MAP = 0xA33A;
// const MAT_SXP_TEXT2_DATA = 0xA321;
// const MAT_TEX2MASK = 0xA340;
// const MAT_SXP_TEXT2MASK_DATA = 0xA32C;
const MAT_OPACMAP = 0xA210;
// const MAT_SXP_OPAC_DATA = 0xA322;
// const MAT_OPACMASK = 0xA342;
// const MAT_SXP_OPACMASK_DATA = 0xA32E;
const MAT_BUMPMAP = 0xA230;
// const MAT_SXP_BUMP_DATA = 0xA324;
// const MAT_BUMPMASK = 0xA344;
// const MAT_SXP_BUMPMASK_DATA = 0xA330;
const MAT_SPECMAP = 0xA204;
// const MAT_SXP_SPEC_DATA = 0xA325;
// const MAT_SPECMASK = 0xA348;
// const MAT_SXP_SPECMASK_DATA = 0xA332;
// const MAT_SHINMAP = 0xA33C;
// const MAT_SXP_SHIN_DATA = 0xA326;
// const MAT_SHINMASK = 0xA346;
// const MAT_SXP_SHINMASK_DATA = 0xA334;
// const MAT_SELFIMAP = 0xA33D;
// const MAT_SXP_SELFI_DATA = 0xA328;
// const MAT_SELFIMASK = 0xA34A;
// const MAT_SXP_SELFIMASK_DATA = 0xA336;
// const MAT_REFLMAP = 0xA220;
// const MAT_REFLMASK = 0xA34C;
// const MAT_SXP_REFLMASK_DATA = 0xA338;
// const MAT_ACUBIC = 0xA310;
const MAT_MAPNAME = 0xA300;
// const MAT_MAP_TILING = 0xA351;
// const MAT_MAP_TEXBLUR = 0xA353;
const MAT_MAP_USCALE = 0xA354;
const MAT_MAP_VSCALE = 0xA356;
const MAT_MAP_UOFFSET = 0xA358;
const MAT_MAP_VOFFSET = 0xA35A;
// const MAT_MAP_ANG = 0xA35C;
// const MAT_MAP_COL1 = 0xA360;
// const MAT_MAP_COL2 = 0xA362;
// const MAT_MAP_RCOL = 0xA364;
// const MAT_MAP_GCOL = 0xA366;
// const MAT_MAP_BCOL = 0xA368;
const NAMED_OBJECT = 0x4000;
// const N_DIRECT_LIGHT = 0x4600;
// const DL_OFF = 0x4620;
// const DL_OUTER_RANGE = 0x465A;
// const DL_INNER_RANGE = 0x4659;
// const DL_MULTIPLIER = 0x465B;
// const DL_EXCLUDE = 0x4654;
// const DL_ATTENUATE = 0x4625;
// const DL_SPOTLIGHT = 0x4610;
// const DL_SPOT_ROLL = 0x4656;
// const DL_SHADOWED = 0x4630;
// const DL_LOCAL_SHADOW2 = 0x4641;
// const DL_SEE_CONE = 0x4650;
// const DL_SPOT_RECTANGULAR = 0x4651;
// const DL_SPOT_ASPECT = 0x4657;
// const DL_SPOT_PROJECTOR = 0x4653;
// const DL_SPOT_OVERSHOOT = 0x4652;
// const DL_RAY_BIAS = 0x4658;
// const DL_RAYSHAD = 0x4627;
// const N_CAMERA = 0x4700;
// const CAM_SEE_CONE = 0x4710;
// const CAM_RANGES = 0x4720;
// const OBJ_HIDDEN = 0x4010;
// const OBJ_VIS_LOFTER = 0x4011;
// const OBJ_DOESNT_CAST = 0x4012;
// const OBJ_DONT_RECVSHADOW = 0x4017;
// const OBJ_MATTE = 0x4013;
// const OBJ_FAST = 0x4014;
// const OBJ_PROCEDURAL = 0x4015;
// const OBJ_FROZEN = 0x4016;
const N_TRI_OBJECT = 0x4100;
const POINT_ARRAY = 0x4110;
// const POINT_FLAG_ARRAY = 0x4111;
const FACE_ARRAY = 0x4120;
const MSH_MAT_GROUP = 0x4130;
// const SMOOTH_GROUP = 0x4150;
// const MSH_BOXMAP = 0x4190;
const TEX_VERTS = 0x4140;
const MESH_MATRIX = 0x4160;

},{"three":"hJIVG","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}]},["9oQXJ"], null, "parcelRequire6840", {})

//# sourceMappingURL=TDSLoader.f13f946a.js.map
