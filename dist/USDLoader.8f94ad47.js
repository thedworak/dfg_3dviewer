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
})({"2aqwn":[function(require,module,exports,__globalThis) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SERVER_PORT = 1234;
var HMR_SECURE = false;
var HMR_ENV_HASH = "439701173a9199ea";
var HMR_USE_SSE = false;
module.bundle.HMR_BUNDLE_ID = "afffaae88f94ad47";
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

},{}],"ineoH":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "USDLoader", ()=>USDLoader);
var _three = require("three");
var _fflateModuleJs = require("../libs/fflate.module.js");
var _usdaparserJs = require("./usd/USDAParser.js");
var _usdcparserJs = require("./usd/USDCParser.js");
var _usdcomposerJs = require("./usd/USDComposer.js");
/**
 * A loader for the USD format (USD, USDA, USDC, USDZ).
 *
 * Supports both ASCII (USDA) and binary (USDC) USD files, as well as
 * USDZ archives containing either format.
 *
 * ```js
 * const loader = new USDLoader();
 * const model = await loader.loadAsync( 'model.usdz' );
 * scene.add( model );
 * ```
 *
 * @augments Loader
 * @three_import import { USDLoader } from 'three/addons/loaders/USDLoader.js';
 */ class USDLoader extends (0, _three.Loader) {
    /**
	 * Constructs a new USDZ loader.
	 *
	 * @param {LoadingManager} [manager] - The loading manager.
	 */ constructor(manager){
        super(manager);
    }
    /**
	 * Starts loading from the given URL and passes the loaded USDZ asset
	 * to the `onLoad()` callback.
	 *
	 * @param {string} url - The path/URL of the file to be loaded. This can also be a data URI.
	 * @param {function(Group)} onLoad - Executed when the loading process has been finished.
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
	 * Parses the given USDZ data and returns the resulting group.
	 *
	 * @param {ArrayBuffer|string} buffer - The raw USDZ data as an array buffer.
	 * @return {Group} The parsed asset as a group.
	 */ parse(buffer) {
        const usda = new (0, _usdaparserJs.USDAParser)();
        const usdc = new (0, _usdcparserJs.USDCParser)();
        const textDecoder = new TextDecoder();
        function toArrayBuffer(data) {
            if (data instanceof ArrayBuffer) return data;
            if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) return data.buffer;
            return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        }
        function getLowercaseExtension(filename) {
            const lastDot = filename.lastIndexOf('.');
            if (lastDot < 0) return '';
            const lastSlash = filename.lastIndexOf('/');
            if (lastSlash > lastDot) return '';
            return filename.slice(lastDot + 1).toLowerCase();
        }
        function parseAssets(zip) {
            const data = {};
            for(const filename in zip){
                const fileBytes = zip[filename];
                const ext = getLowercaseExtension(filename);
                if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'avif') {
                    // Keep raw image bytes and create object URLs lazily in USDComposer.
                    data[filename] = fileBytes;
                    continue;
                }
                if (ext !== 'usd' && ext !== 'usda' && ext !== 'usdc') continue;
                if (isCrateFile(fileBytes)) data[filename] = usdc.parseData(toArrayBuffer(fileBytes));
                else data[filename] = usda.parseData(textDecoder.decode(fileBytes));
            }
            return data;
        }
        function isCrateFile(buffer) {
            const crateHeader = new Uint8Array([
                0x50,
                0x58,
                0x52,
                0x2D,
                0x55,
                0x53,
                0x44,
                0x43
            ]); // PXR-USDC
            const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
            if (view.byteLength < crateHeader.length) return false;
            for(let i = 0; i < crateHeader.length; i++){
                if (view[i] !== crateHeader[i]) return false;
            }
            return true;
        }
        function findUSD(zip) {
            const fileNames = Object.keys(zip);
            if (fileNames.length < 1) return {
                file: undefined,
                filename: '',
                basePath: ''
            };
            const firstFileName = fileNames[0];
            const ext = getLowercaseExtension(firstFileName);
            let isCrate = false;
            const lastSlash = firstFileName.lastIndexOf('/');
            const basePath = lastSlash >= 0 ? firstFileName.slice(0, lastSlash) : '';
            // Per AOUSD core spec v1.0.1 section 16.4.1.2, the first ZIP entry is the root layer.
            // ASCII files can end in either .usda or .usd.
            if (ext === 'usda') return {
                file: zip[firstFileName],
                filename: firstFileName,
                basePath
            };
            if (ext === 'usdc') isCrate = true;
            else if (ext === 'usd') {
                // If this is not a crate file, we assume it is a plain USDA file.
                if (!isCrateFile(zip[firstFileName])) return {
                    file: zip[firstFileName],
                    filename: firstFileName,
                    basePath
                };
                else isCrate = true;
            }
            if (isCrate) return {
                file: zip[firstFileName],
                filename: firstFileName,
                basePath
            };
            return {
                file: undefined,
                filename: '',
                basePath: ''
            };
        }
        const scope = this;
        // USDA (standalone)
        if (typeof buffer === 'string') {
            const composer = new (0, _usdcomposerJs.USDComposer)(scope.manager);
            const data = usda.parseData(buffer);
            return composer.compose(data, {});
        }
        // USDC (standalone)
        if (isCrateFile(buffer)) {
            const composer = new (0, _usdcomposerJs.USDComposer)(scope.manager);
            const data = usdc.parseData(toArrayBuffer(buffer));
            return composer.compose(data, {});
        }
        const bytes = new Uint8Array(buffer);
        // USDZ
        if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
            const zip = (0, _fflateModuleJs.unzipSync)(bytes);
            const assets = parseAssets(zip);
            const { file, filename, basePath } = findUSD(zip);
            if (!file) throw new Error('USDLoader: Invalid USDZ package. The first ZIP entry must be a USD layer (.usd/.usda/.usdc).');
            const composer = new (0, _usdcomposerJs.USDComposer)(scope.manager);
            const data = assets[filename];
            if (!data) throw new Error('USDLoader: Failed to parse root layer "' + filename + '".');
            return composer.compose(data, assets, {}, basePath);
        }
        // USDA (standalone, as ArrayBuffer)
        const composer = new (0, _usdcomposerJs.USDComposer)(scope.manager);
        const text = textDecoder.decode(bytes);
        const data = usda.parseData(text);
        return composer.compose(data, {});
    }
}

},{"three":"hJIVG","../libs/fflate.module.js":"4fbyW","./usd/USDAParser.js":"anSdq","./usd/USDCParser.js":"j2FGE","./usd/USDComposer.js":"jbKKq","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"anSdq":[function(require,module,exports,__globalThis) {
// Pre-compiled regex patterns for performance
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "USDAParser", ()=>USDAParser);
const DEF_MATCH_REGEX = /^def\s+(?:(\w+)\s+)?"?([^"]+)"?$/;
const VARIANT_STRING_REGEX = /^string\s+(\w+)$/;
const ATTR_MATCH_REGEX = /^(?:uniform\s+)?(\w+(?:\[\])?)\s+(.+)$/;
class USDAParser {
    parseText(text) {
        // Preprocess: strip comments and normalize multiline values
        text = this._preprocess(text);
        const root = {};
        const lines = text.split('\n');
        let string = null;
        let target = root;
        const stack = [
            root
        ];
        for (const line of lines){
            if (line.includes('=')) {
                // Find the first '=' that's not inside quotes
                const eqIdx = this._findAssignmentOperator(line);
                if (eqIdx === -1) {
                    string = line.trim();
                    continue;
                }
                const lhs = line.slice(0, eqIdx).trim();
                const rhs = line.slice(eqIdx + 1).trim();
                if (rhs.endsWith('{')) {
                    const group = {};
                    stack.push(group);
                    target[lhs] = group;
                    target = group;
                } else if (rhs.endsWith('(')) {
                    // see #28631
                    const values = rhs.slice(0, -1);
                    target[lhs] = values;
                    const meta = {};
                    stack.push(meta);
                    target = meta;
                } else target[lhs] = rhs;
            } else if (line.includes(':') && !line.includes('=')) {
                // Handle dictionary entries like "0: [(...)...]" for timeSamples
                const colonIdx = line.indexOf(':');
                const key = line.slice(0, colonIdx).trim();
                const value = line.slice(colonIdx + 1).trim();
                // Only process if key looks like a number (timeSamples frame)
                if (/^[\d.]+$/.test(key)) target[key] = value;
            } else if (line.endsWith('{')) {
                const group = target[string] || {};
                stack.push(group);
                target[string] = group;
                target = group;
            } else if (line.endsWith('}')) {
                stack.pop();
                if (stack.length === 0) continue;
                target = stack[stack.length - 1];
            } else if (line.endsWith('(')) {
                const meta = {};
                stack.push(meta);
                string = line.split('(')[0].trim() || string;
                target[string] = meta;
                target = meta;
            } else if (line.endsWith(')')) {
                stack.pop();
                target = stack[stack.length - 1];
            } else if (line.trim()) string = line.trim();
        }
        return root;
    }
    _preprocess(text) {
        // Remove block comments /* ... */
        text = this._stripBlockComments(text);
        // Collapse triple-quoted strings into single lines
        text = this._collapseTripleQuotedStrings(text);
        // Remove line comments # ... (but preserve #usda header)
        // Only remove # comments that aren't at the start of a line or after whitespace
        const lines = text.split('\n');
        const processed = [];
        let inMultilineValue = false;
        let bracketDepth = 0;
        let parenDepth = 0;
        let accumulated = '';
        for(let i = 0; i < lines.length; i++){
            let line = lines[i];
            // Strip inline comments (but not inside strings)
            line = this._stripInlineComment(line);
            // Track bracket/paren depth for multiline values
            const trimmed = line.trim();
            if (inMultilineValue) {
                // Continue accumulating multiline value
                accumulated += ' ' + trimmed;
                // Update depths
                for (const ch of trimmed){
                    if (ch === '[') bracketDepth++;
                    else if (ch === ']') bracketDepth--;
                    else if (ch === '(' && bracketDepth > 0) parenDepth++;
                    else if (ch === ')' && bracketDepth > 0) parenDepth--;
                }
                // Check if multiline value is complete
                if (bracketDepth === 0 && parenDepth === 0) {
                    processed.push(accumulated);
                    accumulated = '';
                    inMultilineValue = false;
                }
            } else {
                // Check if this line starts a multiline array value
                // Look for patterns like "attr = [" or "attr = @path@[" without closing ]
                if (trimmed.includes('=')) {
                    const eqIdx = this._findAssignmentOperator(trimmed);
                    if (eqIdx !== -1) {
                        const rhs = trimmed.slice(eqIdx + 1).trim();
                        // Count brackets in the value part
                        let openBrackets = 0;
                        let closeBrackets = 0;
                        for (const ch of rhs){
                            if (ch === '[') openBrackets++;
                            else if (ch === ']') closeBrackets++;
                        }
                        if (openBrackets > closeBrackets) {
                            // Multiline array detected
                            inMultilineValue = true;
                            bracketDepth = openBrackets - closeBrackets;
                            parenDepth = 0;
                            accumulated = trimmed;
                            continue;
                        }
                    }
                }
                processed.push(trimmed);
            }
        }
        return processed.join('\n');
    }
    _stripBlockComments(text) {
        // Iteratively remove /* ... */ comments without regex backtracking
        let result = '';
        let i = 0;
        while(i < text.length)// Check for block comment start
        if (text[i] === '/' && i + 1 < text.length && text[i + 1] === '*') {
            // Find the closing */
            let j = i + 2;
            while(j < text.length){
                if (text[j] === '*' && j + 1 < text.length && text[j + 1] === '/') {
                    // Found closing, skip past it
                    j += 2;
                    break;
                }
                j++;
            }
            // Move past the comment (or to end if unclosed)
            i = j;
        } else {
            result += text[i];
            i++;
        }
        return result;
    }
    _collapseTripleQuotedStrings(text) {
        let result = '';
        let i = 0;
        while(i < text.length){
            if (i + 2 < text.length) {
                const triple = text.slice(i, i + 3);
                if (triple === '\'\'\'' || triple === '"""') {
                    const quoteChar = triple;
                    result += quoteChar;
                    i += 3;
                    while(i < text.length)if (i + 2 < text.length && text.slice(i, i + 3) === quoteChar) {
                        result += quoteChar;
                        i += 3;
                        break;
                    } else {
                        if (text[i] === '\n') result += '\\n';
                        else if (text[i] !== '\r') result += text[i];
                        i++;
                    }
                    continue;
                }
            }
            result += text[i];
            i++;
        }
        return result;
    }
    _stripInlineComment(line) {
        // Don't strip if line starts with #usda
        if (line.trim().startsWith('#usda')) return line;
        // Find # that's not inside a string
        let inString = false;
        let stringChar = null;
        let escaped = false;
        for(let i = 0; i < line.length; i++){
            const ch = line[i];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (!inString && (ch === '"' || ch === '\'')) {
                inString = true;
                stringChar = ch;
            } else if (inString && ch === stringChar) {
                inString = false;
                stringChar = null;
            } else if (!inString && ch === '#') // Found comment start outside of string
            return line.slice(0, i).trimEnd();
        }
        return line;
    }
    _findAssignmentOperator(line) {
        // Find the first '=' that's not inside quotes
        let inString = false;
        let stringChar = null;
        let escaped = false;
        for(let i = 0; i < line.length; i++){
            const ch = line[i];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (!inString && (ch === '"' || ch === '\'')) {
                inString = true;
                stringChar = ch;
            } else if (inString && ch === stringChar) {
                inString = false;
                stringChar = null;
            } else if (!inString && ch === '=') return i;
        }
        return -1;
    }
    /**
	 * Parse USDA text and return raw spec data in specsByPath format.
	 * Used by USDComposer for unified scene composition.
	 */ parseData(text) {
        const root = this.parseText(text);
        const specsByPath = {};
        // Spec types (must match USDCParser/USDComposer)
        const SpecType = {
            Attribute: 1,
            Prim: 6,
            Relationship: 8
        };
        // Parse root metadata
        const rootFields = {};
        if ('#usda 1.0' in root) {
            const header = root['#usda 1.0'];
            if (header.upAxis) rootFields.upAxis = header.upAxis.replace(/"/g, '');
            if (header.defaultPrim) rootFields.defaultPrim = header.defaultPrim.replace(/"/g, '');
            if (header.metersPerUnit !== undefined) rootFields.metersPerUnit = parseFloat(header.metersPerUnit);
        }
        specsByPath['/'] = {
            specType: SpecType.Prim,
            fields: rootFields
        };
        // Walk the tree and build specsByPath
        const walkTree = (data, parentPath)=>{
            const primChildren = [];
            for(const key in data){
                // Skip metadata
                if (key === '#usda 1.0') continue;
                if (key === 'variants') continue;
                // Check for primitive definitions
                // Matches both 'def TypeName "name"' and 'def "name"' (no type)
                const defMatch = key.match(DEF_MATCH_REGEX);
                if (defMatch) {
                    const typeName = defMatch[1] || '';
                    const name = defMatch[2];
                    const path = parentPath === '/' ? '/' + name : parentPath + '/' + name;
                    primChildren.push(name);
                    const primFields = {
                        typeName
                    };
                    const primData = data[key];
                    // Extract attributes and relationships from this prim
                    this._extractPrimData(primData, path, primFields, specsByPath, SpecType);
                    specsByPath[path] = {
                        specType: SpecType.Prim,
                        fields: primFields
                    };
                    // Recurse into children
                    walkTree(primData, path);
                }
            }
            // Add primChildren to parent spec
            if (primChildren.length > 0 && specsByPath[parentPath]) specsByPath[parentPath].fields.primChildren = primChildren;
        };
        walkTree(root, '/');
        return {
            specsByPath
        };
    }
    _extractPrimData(data, path, primFields, specsByPath, SpecType) {
        if (!data || typeof data !== 'object') return;
        for(const key in data){
            // Skip nested defs (handled by walkTree)
            if (key.startsWith('def ')) continue;
            if (key === 'prepend references') {
                primFields.references = [
                    data[key]
                ];
                continue;
            }
            if (key === 'payload') {
                primFields.payload = data[key];
                continue;
            }
            if (key === 'variants') {
                const variantSelection = {};
                const variants = data[key];
                for(const vKey in variants){
                    const match = vKey.match(VARIANT_STRING_REGEX);
                    if (match) {
                        const variantSetName = match[1];
                        const variantValue = variants[vKey].replace(/"/g, '');
                        variantSelection[variantSetName] = variantValue;
                    }
                }
                if (Object.keys(variantSelection).length > 0) primFields.variantSelection = variantSelection;
                continue;
            }
            if (key.startsWith('rel ')) {
                const relName = key.slice(4);
                const relPath = path + '.' + relName;
                const target = data[key].replace(/[<>]/g, '');
                specsByPath[relPath] = {
                    specType: SpecType.Relationship,
                    fields: {
                        targetPaths: [
                            target
                        ]
                    }
                };
                continue;
            }
            // Handle xformOpOrder
            if (key.includes('xformOpOrder')) {
                const ops = data[key].replace(/[\[\]]/g, '').split(',').map((s)=>s.trim().replace(/"/g, ''));
                primFields.xformOpOrder = ops;
                continue;
            }
            // Handle typed attributes
            // Format: [qualifier] type attrName (e.g., "uniform token[] joints", "float3 position")
            const attrMatch = key.match(ATTR_MATCH_REGEX);
            if (attrMatch) {
                const valueType = attrMatch[1];
                const attrName = attrMatch[2];
                const rawValue = data[key];
                // Handle connection attributes (e.g., "inputs:normal.connect = </path>")
                if (attrName.endsWith('.connect')) {
                    const baseAttrName = attrName.slice(0, -8); // Remove '.connect'
                    const attrPath = path + '.' + baseAttrName;
                    // Parse connection path - extract from <path> format
                    let connPath = String(rawValue).trim();
                    if (connPath.startsWith('<')) connPath = connPath.slice(1);
                    if (connPath.endsWith('>')) connPath = connPath.slice(0, -1);
                    // Get or create the attribute spec
                    if (!specsByPath[attrPath]) specsByPath[attrPath] = {
                        specType: SpecType.Attribute,
                        fields: {
                            typeName: valueType
                        }
                    };
                    specsByPath[attrPath].fields.connectionPaths = [
                        connPath
                    ];
                    continue;
                }
                // Handle timeSamples attributes specially
                if (attrName.endsWith('.timeSamples') && typeof rawValue === 'object') {
                    const baseAttrName = attrName.slice(0, -12); // Remove '.timeSamples'
                    const attrPath = path + '.' + baseAttrName;
                    // Parse timeSamples dictionary into times and values arrays
                    const times = [];
                    const values = [];
                    for(const frameKey in rawValue){
                        const frame = parseFloat(frameKey);
                        if (isNaN(frame)) continue;
                        times.push(frame);
                        values.push(this._parseAttributeValue(valueType, rawValue[frameKey]));
                    }
                    // Sort by time
                    const sorted = times.map((t, i)=>({
                            t,
                            v: values[i]
                        })).sort((a, b)=>a.t - b.t);
                    specsByPath[attrPath] = {
                        specType: SpecType.Attribute,
                        fields: {
                            timeSamples: {
                                times: sorted.map((s)=>s.t),
                                values: sorted.map((s)=>s.v)
                            },
                            typeName: valueType
                        }
                    };
                } else {
                    // Parse value based on type
                    const parsedValue = this._parseAttributeValue(valueType, rawValue);
                    // Store as attribute spec
                    const attrPath = path + '.' + attrName;
                    specsByPath[attrPath] = {
                        specType: SpecType.Attribute,
                        fields: {
                            default: parsedValue,
                            typeName: valueType
                        }
                    };
                }
            }
        }
    }
    _parseAttributeValue(valueType, rawValue) {
        if (rawValue === undefined || rawValue === null) return undefined;
        const str = String(rawValue).trim();
        // Array types
        if (valueType.endsWith('[]')) // Parse JSON-like arrays
        try {
            // Handle arrays with parentheses like [(1,2,3), (4,5,6)]
            // Remove trailing comma (valid in USDA but not JSON)
            let cleaned = str.replace(/\(/g, '[').replace(/\)/g, ']');
            if (cleaned.endsWith(',')) cleaned = cleaned.slice(0, -1);
            const parsed = JSON.parse(cleaned);
            // Flatten nested arrays for types like point3f[]
            if (Array.isArray(parsed) && Array.isArray(parsed[0])) return parsed.flat();
            return parsed;
        } catch (e) {
            // Try simple array parsing
            const cleaned = str.replace(/[\[\]]/g, '');
            return cleaned.split(',').map((s)=>{
                const trimmed = s.trim();
                const num = parseFloat(trimmed);
                return isNaN(num) ? trimmed.replace(/"/g, '') : num;
            });
        }
        // Vector types (double3, float3, point3f, etc.)
        if (valueType.includes('3') || valueType.includes('2') || valueType.includes('4')) {
            // Parse (x, y, z) format
            const cleaned = str.replace(/[()]/g, '');
            const values = cleaned.split(',').map((s)=>parseFloat(s.trim()));
            return values;
        }
        // Quaternion types (quatf, quatd, quath)
        // Text format is (w, x, y, z), convert to (x, y, z, w)
        if (valueType.startsWith('quat')) {
            const cleaned = str.replace(/[()]/g, '');
            const values = cleaned.split(',').map((s)=>parseFloat(s.trim()));
            return [
                values[1],
                values[2],
                values[3],
                values[0]
            ];
        }
        // Matrix types
        if (valueType.includes('matrix')) {
            const cleaned = str.replace(/[()]/g, '');
            const values = cleaned.split(',').map((s)=>parseFloat(s.trim()));
            return values;
        }
        // Scalar numeric types
        if (valueType === 'float' || valueType === 'double' || valueType === 'int') return parseFloat(str);
        // String/token types
        if (valueType === 'string' || valueType === 'token') return this._parseString(str);
        // Asset path
        if (valueType === 'asset') return str.replace(/@/g, '').replace(/"/g, '');
        // Default: return as string with quotes removed
        return this._parseString(str);
    }
    _parseString(str) {
        // Remove surrounding quotes
        if (str.startsWith('"') && str.endsWith('"') || str.startsWith('\'') && str.endsWith('\'')) str = str.slice(1, -1);
        // Handle escape sequences
        let result = '';
        let i = 0;
        while(i < str.length)if (str[i] === '\\' && i + 1 < str.length) {
            const next = str[i + 1];
            switch(next){
                case 'n':
                    result += '\n';
                    break;
                case 't':
                    result += '\t';
                    break;
                case 'r':
                    result += '\r';
                    break;
                case '\\':
                    result += '\\';
                    break;
                case '"':
                    result += '"';
                    break;
                case '\'':
                    result += '\'';
                    break;
                default:
                    result += next;
                    break;
            }
            i += 2;
        } else {
            result += str[i];
            i++;
        }
        return result;
    }
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"j2FGE":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "USDCParser", ()=>USDCParser);
const textDecoder = new TextDecoder();
// Pre-computed half-float exponent lookup table for fast conversion
// Math.pow(2, exp - 15) for exp = 0..31
const HALF_EXPONENT_TABLE = new Float32Array(32);
for(let i = 0; i < 32; i++)HALF_EXPONENT_TABLE[i] = Math.pow(2, i - 15);
// Pre-computed constant for denormalized half-floats: 2^-14
const HALF_DENORM_SCALE = Math.pow(2, -14);
// Type enum values from crateDataTypes.h
const TypeEnum = {
    Invalid: 0,
    Bool: 1,
    UChar: 2,
    Int: 3,
    UInt: 4,
    Int64: 5,
    UInt64: 6,
    Half: 7,
    Float: 8,
    Double: 9,
    String: 10,
    Token: 11,
    AssetPath: 12,
    Matrix2d: 13,
    Matrix3d: 14,
    Matrix4d: 15,
    Quatd: 16,
    Quatf: 17,
    Quath: 18,
    Vec2d: 19,
    Vec2f: 20,
    Vec2h: 21,
    Vec2i: 22,
    Vec3d: 23,
    Vec3f: 24,
    Vec3h: 25,
    Vec3i: 26,
    Vec4d: 27,
    Vec4f: 28,
    Vec4h: 29,
    Vec4i: 30,
    Dictionary: 31,
    TokenListOp: 32,
    StringListOp: 33,
    PathListOp: 34,
    ReferenceListOp: 35,
    IntListOp: 36,
    Int64ListOp: 37,
    UIntListOp: 38,
    UInt64ListOp: 39,
    PathVector: 40,
    TokenVector: 41,
    Specifier: 42,
    Permission: 43,
    Variability: 44,
    VariantSelectionMap: 45,
    TimeSamples: 46,
    Payload: 47,
    DoubleVector: 48,
    LayerOffsetVector: 49,
    StringVector: 50,
    ValueBlock: 51,
    Value: 52,
    UnregisteredValue: 53,
    UnregisteredValueListOp: 54,
    PayloadListOp: 55,
    TimeCode: 56,
    PathExpression: 57,
    Relocates: 58,
    Spline: 59,
    AnimationBlock: 60
};
// Field set terminator marker
const FIELD_SET_TERMINATOR = 0xFFFFFFFF;
// Float compression type codes
const FLOAT_COMPRESSION_INT = 0x69; // 'i' - compressed as integers
const FLOAT_COMPRESSION_LUT = 0x74; // 't' - lookup table
// ============================================================================
// LZ4 Decompression (minimal implementation for USD)
// Based on LZ4 block format specification
// ============================================================================
function lz4DecompressBlock(input, inputOffset, inputEnd, output, outputOffset, outputEnd) {
    while(inputOffset < inputEnd){
        // Read token
        const token = input[inputOffset++];
        if (inputOffset > inputEnd) break;
        // Literal length
        let literalLength = token >> 4;
        if (literalLength === 15) {
            let b;
            do {
                if (inputOffset >= inputEnd) break;
                b = input[inputOffset++];
                literalLength += b;
            }while (b === 255 && inputOffset < inputEnd);
        }
        // Copy literals
        if (literalLength > 0) {
            if (inputOffset + literalLength > inputEnd) literalLength = inputEnd - inputOffset;
            for(let i = 0; i < literalLength; i++){
                if (outputOffset >= outputEnd) break;
                output[outputOffset++] = input[inputOffset++];
            }
        }
        // Check if we're at the end (last sequence has no match)
        if (inputOffset >= inputEnd) break;
        // Read match offset (little-endian 16-bit)
        if (inputOffset + 2 > inputEnd) break;
        const matchOffset = input[inputOffset++] | input[inputOffset++] << 8;
        if (matchOffset === 0) break;
        // Match length
        let matchLength = (token & 0x0F) + 4;
        if (matchLength === 19) {
            let b;
            do {
                if (inputOffset >= inputEnd) break;
                b = input[inputOffset++];
                matchLength += b;
            }while (b === 255 && inputOffset < inputEnd);
        }
        // Copy match (byte-by-byte to handle overlapping)
        const matchPos = outputOffset - matchOffset;
        if (matchPos < 0) break;
        for(let i = 0; i < matchLength; i++){
            if (outputOffset >= outputEnd) break;
            output[outputOffset++] = output[matchPos + i];
        }
    }
    return outputOffset;
}
// USD uses TfFastCompression which wraps LZ4 with chunk headers
function decompressLZ4(input, uncompressedSize) {
    // TfFastCompression format (used by OpenUSD):
    // Single chunk (byte 0 == 0): [0] + LZ4 data
    // Multi chunk (byte 0 > 0): [numChunks] + [compressedSizes...] + [chunkData...]
    const output = new Uint8Array(uncompressedSize);
    const numChunks = input[0];
    if (numChunks === 0) {
        // Single chunk - all remaining bytes are LZ4 compressed
        lz4DecompressBlock(input, 1, input.length, output, 0, uncompressedSize);
        return output;
    } else {
        // Multiple chunks - each chunk decompresses to max 65536 bytes
        const CHUNK_SIZE = 65536;
        // First, read all chunk sizes
        let headerOffset = 1;
        const compressedSizes = [];
        for(let i = 0; i < numChunks; i++){
            const size = (input[headerOffset] | input[headerOffset + 1] << 8 | input[headerOffset + 2] << 16 | input[headerOffset + 3] << 24) >>> 0;
            compressedSizes.push(size);
            headerOffset += 4;
        }
        // Decompress each chunk
        let inputOffset = headerOffset;
        let outputOffset = 0;
        for(let i = 0; i < numChunks; i++){
            const chunkCompressedSize = compressedSizes[i];
            const chunkOutputSize = Math.min(CHUNK_SIZE, uncompressedSize - outputOffset);
            lz4DecompressBlock(input, inputOffset, inputOffset + chunkCompressedSize, output, outputOffset, outputOffset + chunkOutputSize);
            inputOffset += chunkCompressedSize;
            outputOffset += chunkOutputSize;
        }
        return output;
    }
}
// ============================================================================
// Integer Decompression (USD-specific delta + variable-width encoding)
// ============================================================================
function decompressIntegers32(compressedData, numInts) {
    // First decompress with LZ4
    const encodedSize = numInts * 4 + (numInts * 2 + 7 >> 3) + 4;
    const encoded = decompressLZ4(new Uint8Array(compressedData), encodedSize);
    // Then decode
    return decodeIntegers32(encoded, numInts);
}
function decodeIntegers32(data, numInts) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;
    // Read common value (signed 32-bit)
    const commonValue = view.getInt32(offset, true);
    offset += 4;
    const numCodesBytes = numInts * 2 + 7 >> 3;
    const codesStart = offset;
    const vintsStart = offset + numCodesBytes;
    const result = new Int32Array(numInts);
    let prevVal = 0;
    let codesOffset = codesStart;
    let vintsOffset = vintsStart;
    for(let i = 0; i < numInts;){
        const codeByte = data[codesOffset++];
        for(let j = 0; j < 4 && i < numInts; j++, i++){
            const code = codeByte >> j * 2 & 3;
            let delta = 0;
            switch(code){
                case 0:
                    delta = commonValue;
                    break;
                case 1:
                    delta = view.getInt8(vintsOffset);
                    vintsOffset += 1;
                    break;
                case 2:
                    delta = view.getInt16(vintsOffset, true);
                    vintsOffset += 2;
                    break;
                case 3:
                    delta = view.getInt32(vintsOffset, true);
                    vintsOffset += 4;
                    break;
            }
            prevVal += delta;
            result[i] = prevVal;
        }
    }
    return result;
}
// ============================================================================
// Binary Reader Helper
// ============================================================================
class BinaryReader {
    constructor(buffer){
        this.buffer = buffer;
        this.view = new DataView(buffer);
        this.offset = 0;
    }
    seek(offset) {
        this.offset = offset;
    }
    tell() {
        return this.offset;
    }
    readUint8() {
        const value = this.view.getUint8(this.offset);
        this.offset += 1;
        return value;
    }
    readInt8() {
        const value = this.view.getInt8(this.offset);
        this.offset += 1;
        return value;
    }
    readUint16() {
        const value = this.view.getUint16(this.offset, true);
        this.offset += 2;
        return value;
    }
    readInt16() {
        const value = this.view.getInt16(this.offset, true);
        this.offset += 2;
        return value;
    }
    readUint32() {
        const value = this.view.getUint32(this.offset, true);
        this.offset += 4;
        return value;
    }
    readInt32() {
        const value = this.view.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }
    readUint64() {
        const lo = this.view.getUint32(this.offset, true);
        const hi = this.view.getUint32(this.offset + 4, true);
        this.offset += 8;
        // For values that fit in Number, this is safe
        return hi * 0x100000000 + lo;
    }
    readInt64() {
        const lo = this.view.getUint32(this.offset, true);
        const hi = this.view.getInt32(this.offset + 4, true);
        this.offset += 8;
        return hi * 0x100000000 + lo;
    }
    readFloat32() {
        const value = this.view.getFloat32(this.offset, true);
        this.offset += 4;
        return value;
    }
    readFloat64() {
        const value = this.view.getFloat64(this.offset, true);
        this.offset += 8;
        return value;
    }
    readBytes(length) {
        const bytes = new Uint8Array(this.buffer, this.offset, length);
        this.offset += length;
        return bytes;
    }
    readString(length) {
        const bytes = this.readBytes(length);
        let end = 0;
        while(end < length && bytes[end] !== 0)end++;
        return textDecoder.decode(bytes.subarray(0, end));
    }
}
// ============================================================================
// ValueRep - 64-bit packed value representation
// ============================================================================
class ValueRep {
    constructor(lo, hi){
        this.lo = lo; // Lower 32 bits
        this.hi = hi; // Upper 32 bits
    }
    get isArray() {
        return (this.hi & 0x80000000) !== 0;
    }
    get isInlined() {
        return (this.hi & 0x40000000) !== 0;
    }
    get isCompressed() {
        return (this.hi & 0x20000000) !== 0;
    }
    get typeEnum() {
        return this.hi >> 16 & 0xFF;
    }
    get payload() {
        // 48-bit payload: lo (32 bits) + hi lower 16 bits
        // Note: JavaScript numbers are IEEE 754 doubles with 53 bits of integer precision,
        // so 48-bit values are represented exactly without loss of precision.
        return this.lo + (this.hi & 0xFFFF) * 0x100000000;
    }
    getInlinedValue() {
        // For inlined scalars, the value is in the lower 32 bits
        return this.lo;
    }
}
// ============================================================================
// USDC Parser
// ============================================================================
class USDCParser {
    /**
	 * Parse USDC file and return raw spec data without building Three.js scene.
	 * Used by USDComposer for unified scene composition.
	 */ parseData(buffer) {
        this.buffer = buffer instanceof ArrayBuffer ? buffer : buffer.buffer;
        this.reader = new BinaryReader(this.buffer);
        this.version = {
            major: 0,
            minor: 0,
            patch: 0
        };
        this._conversionBuffer = new ArrayBuffer(4);
        this._conversionView = new DataView(this._conversionBuffer);
        this._readBootstrap();
        this._readTOC();
        this._readTokens();
        this._readStrings();
        this._readFields();
        this._readFieldSets();
        this._readPaths();
        this._readSpecs();
        // Build specsByPath without building scene
        this.specsByPath = {};
        for (const spec of this.specs){
            const path = this.paths[spec.pathIndex];
            if (!path) continue;
            const fields = this._getFieldsForSpec(spec);
            this.specsByPath[path] = {
                specType: spec.specType,
                fields
            };
        }
        return {
            specsByPath: this.specsByPath
        };
    }
    _readBootstrap() {
        const reader = this.reader;
        reader.seek(0);
        // Read magic "PXR-USDC"
        const magic = reader.readString(8);
        if (magic !== 'PXR-USDC') throw new Error('Not a valid USDC file');
        // Read version
        this.version.major = reader.readUint8();
        this.version.minor = reader.readUint8();
        this.version.patch = reader.readUint8();
        reader.readBytes(5); // Skip remaining version bytes
        // Read TOC offset
        this.tocOffset = reader.readUint64();
    // Skip reserved bytes (rest of 128-byte header)
    // Already at offset 24, skip to end of bootstrap (88 bytes total for bootstrap struct)
    }
    _readTOC() {
        const reader = this.reader;
        reader.seek(this.tocOffset);
        // Read number of sections
        const numSections = reader.readUint64();
        this.sections = {};
        for(let i = 0; i < numSections; i++){
            const name = reader.readString(16);
            const start = reader.readUint64();
            const size = reader.readUint64();
            this.sections[name] = {
                start,
                size
            };
        }
    }
    _readTokens() {
        const section = this.sections['TOKENS'];
        if (!section) return;
        const reader = this.reader;
        reader.seek(section.start);
        const numTokens = reader.readUint64();
        this.tokens = [];
        if (this.version.major === 0 && this.version.minor < 4) {
            // Uncompressed tokens (version < 0.4.0)
            const tokensNumBytes = reader.readUint64();
            const tokensData = reader.readBytes(tokensNumBytes);
            let strStart = 0;
            for(let i = 0; i < numTokens; i++){
                let strEnd = strStart;
                while(strEnd < tokensData.length && tokensData[strEnd] !== 0)strEnd++;
                this.tokens.push(textDecoder.decode(tokensData.subarray(strStart, strEnd)));
                strStart = strEnd + 1;
            }
        } else {
            // Compressed tokens (version >= 0.4.0)
            const uncompressedSize = reader.readUint64();
            const compressedSize = reader.readUint64();
            const compressedData = reader.readBytes(compressedSize);
            const tokensData = decompressLZ4(compressedData, uncompressedSize);
            let strStart = 0;
            for(let i = 0; i < numTokens; i++){
                let strEnd = strStart;
                while(strEnd < tokensData.length && tokensData[strEnd] !== 0)strEnd++;
                this.tokens.push(textDecoder.decode(tokensData.subarray(strStart, strEnd)));
                strStart = strEnd + 1;
            }
        }
    }
    _readStrings() {
        const section = this.sections['STRINGS'];
        if (!section) {
            this.strings = [];
            return;
        }
        const reader = this.reader;
        reader.seek(section.start);
        // Strings section has an 8-byte count prefix, but string indices stored
        // elsewhere in the file are relative to the section start (not the data).
        // So we read the entire section as uint32 values to maintain correct indexing.
        const numStrings = Math.floor(section.size / 4);
        this.strings = [];
        for(let i = 0; i < numStrings; i++)this.strings.push(reader.readUint32());
    }
    _readFields() {
        const section = this.sections['FIELDS'];
        if (!section) return;
        const reader = this.reader;
        reader.seek(section.start);
        this.fields = [];
        if (this.version.major === 0 && this.version.minor < 4) {
            // Uncompressed fields
            const numFields = Math.floor(section.size / 12); // 4 bytes token index + 8 bytes value rep
            for(let i = 0; i < numFields; i++){
                const tokenIndex = reader.readUint32();
                const repLo = reader.readUint32();
                const repHi = reader.readUint32();
                this.fields.push({
                    tokenIndex,
                    valueRep: new ValueRep(repLo, repHi)
                });
            }
        } else {
            // Compressed fields (version >= 0.4.0)
            const numFields = reader.readUint64();
            // Read compressed token indices
            const tokenIndicesCompressedSize = reader.readUint64();
            const tokenIndicesCompressed = reader.readBytes(tokenIndicesCompressedSize);
            const tokenIndices = decompressIntegers32(tokenIndicesCompressed.buffer.slice(tokenIndicesCompressed.byteOffset, tokenIndicesCompressed.byteOffset + tokenIndicesCompressedSize), numFields);
            // Read compressed value reps (LZ4 only, no integer encoding)
            const repsCompressedSize = reader.readUint64();
            const repsCompressed = reader.readBytes(repsCompressedSize);
            const repsData = decompressLZ4(repsCompressed, numFields * 8);
            const repsView = new DataView(repsData.buffer, repsData.byteOffset, repsData.byteLength);
            for(let i = 0; i < numFields; i++){
                const repLo = repsView.getUint32(i * 8, true);
                const repHi = repsView.getUint32(i * 8 + 4, true);
                this.fields.push({
                    tokenIndex: tokenIndices[i],
                    valueRep: new ValueRep(repLo, repHi)
                });
            }
        }
    }
    _readFieldSets() {
        const section = this.sections['FIELDSETS'];
        if (!section) return;
        const reader = this.reader;
        reader.seek(section.start);
        this.fieldSets = [];
        if (this.version.major === 0 && this.version.minor < 4) {
            // Uncompressed field sets
            const numFieldSets = Math.floor(section.size / 4);
            for(let i = 0; i < numFieldSets; i++)this.fieldSets.push(reader.readUint32());
        } else {
            // Compressed field sets
            const numFieldSets = reader.readUint64();
            const compressedSize = reader.readUint64();
            const compressed = reader.readBytes(compressedSize);
            const indices = decompressIntegers32(compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressedSize), numFieldSets);
            for(let i = 0; i < numFieldSets; i++)this.fieldSets.push(indices[i]);
        }
    }
    _readPaths() {
        const section = this.sections['PATHS'];
        if (!section) return;
        const reader = this.reader;
        reader.seek(section.start);
        const numPaths = reader.readUint64();
        this.paths = new Array(numPaths).fill('');
        if (this.version.major === 0 && this.version.minor < 4) // Uncompressed paths - recursive tree structure
        this._readPathsRecursive('');
        else {
            // Compressed paths (version >= 0.4.0)
            // Note: numPaths is stored twice - once for array sizing, once in compressed paths section
            reader.readUint64(); // Read duplicate numPaths value (matches numPaths above)
            const compressedSize1 = reader.readUint64();
            const pathIndicesCompressed = reader.readBytes(compressedSize1);
            const pathIndices = decompressIntegers32(pathIndicesCompressed.buffer.slice(pathIndicesCompressed.byteOffset, pathIndicesCompressed.byteOffset + compressedSize1), numPaths);
            const compressedSize2 = reader.readUint64();
            const elementTokenIndicesCompressed = reader.readBytes(compressedSize2);
            const elementTokenIndices = decompressIntegers32(elementTokenIndicesCompressed.buffer.slice(elementTokenIndicesCompressed.byteOffset, elementTokenIndicesCompressed.byteOffset + compressedSize2), numPaths);
            const compressedSize3 = reader.readUint64();
            const jumpsCompressed = reader.readBytes(compressedSize3);
            const jumps = decompressIntegers32(jumpsCompressed.buffer.slice(jumpsCompressed.byteOffset, jumpsCompressed.byteOffset + compressedSize3), numPaths);
            // Build paths from compressed data
            this._buildPathsFromCompressed(pathIndices, elementTokenIndices, jumps);
        }
    }
    _readPathsRecursive(parentPath, depth = 0) {
        const reader = this.reader;
        // Prevent infinite recursion
        if (depth > 1000) return;
        // Read path item header
        const index = reader.readUint32();
        const elementTokenIndex = reader.readUint32();
        const bits = reader.readUint8();
        const hasChild = (bits & 1) !== 0;
        const hasSibling = (bits & 2) !== 0;
        const isPrimProperty = (bits & 4) !== 0;
        // Build path
        let path;
        if (parentPath === '') path = '/';
        else {
            const elemToken = this.tokens[elementTokenIndex] || '';
            if (isPrimProperty) path = parentPath + '.' + elemToken;
            else path = parentPath === '/' ? '/' + elemToken : parentPath + '/' + elemToken;
        }
        this.paths[index] = path;
        // Process children and siblings
        if (hasChild && hasSibling) {
            // Read sibling offset
            const siblingOffset = reader.readUint64();
            // Read child
            this._readPathsRecursive(path, depth + 1);
            // Read sibling
            reader.seek(siblingOffset);
            this._readPathsRecursive(parentPath, depth + 1);
        } else if (hasChild) this._readPathsRecursive(path, depth + 1);
        else if (hasSibling) this._readPathsRecursive(parentPath, depth + 1);
    }
    _buildPathsFromCompressed(pathIndices, elementTokenIndices, jumps) {
        // Jump encoding from USD:
        // 0 = only sibling (no child), next entry is sibling
        // -1 = only child (no sibling), next entry is child
        // -2 = leaf (no child, no sibling)
        // >0 = has both child and sibling, value is offset to sibling
        const buildPaths = (startIndex, parentPath)=>{
            let curIndex = startIndex;
            while(curIndex < pathIndices.length){
                const thisIndex = curIndex++;
                const pathIndex = pathIndices[thisIndex];
                const elementTokenIndex = elementTokenIndices[thisIndex];
                const jump = jumps[thisIndex];
                // Build path
                let path;
                if (parentPath === '') {
                    path = '/';
                    parentPath = path;
                } else {
                    const elemToken = this.tokens[Math.abs(elementTokenIndex)] || '';
                    const isPrimProperty = elementTokenIndex < 0;
                    if (isPrimProperty) path = parentPath + '.' + elemToken;
                    else path = parentPath === '/' ? '/' + elemToken : parentPath + '/' + elemToken;
                }
                this.paths[pathIndex] = path;
                // Determine children and siblings
                const hasChild = jump > 0 || jump === -1;
                const hasSibling = jump >= 0;
                if (hasChild) {
                    if (hasSibling) {
                        // Has both child and sibling
                        // Recursively process sibling subtree
                        const siblingIndex = thisIndex + jump;
                        buildPaths(siblingIndex, parentPath);
                    }
                    // Child is next entry, continue with new parent path
                    parentPath = path;
                } else if (hasSibling) ;
                else break;
            }
        };
        buildPaths(0, '');
    }
    _readSpecs() {
        const section = this.sections['SPECS'];
        if (!section) return;
        const reader = this.reader;
        reader.seek(section.start);
        this.specs = [];
        if (this.version.major === 0 && this.version.minor < 4) {
            // Uncompressed specs
            // Each spec: pathIndex (4), fieldSetIndex (4), specType (4) = 12 bytes
            // For version 0.0.1 there may be different padding
            const specSize = this.version.minor === 0 && this.version.patch === 1 ? 16 : 12;
            const numSpecs = Math.floor(section.size / specSize);
            for(let i = 0; i < numSpecs; i++){
                const pathIndex = reader.readUint32();
                const fieldSetIndex = reader.readUint32();
                const specType = reader.readUint32();
                if (specSize === 16) reader.readUint32(); // padding
                this.specs.push({
                    pathIndex,
                    fieldSetIndex,
                    specType
                });
            }
        } else {
            // Compressed specs
            const numSpecs = reader.readUint64();
            const compressedSize1 = reader.readUint64();
            const pathIndicesCompressed = reader.readBytes(compressedSize1);
            const pathIndices = decompressIntegers32(pathIndicesCompressed.buffer.slice(pathIndicesCompressed.byteOffset, pathIndicesCompressed.byteOffset + compressedSize1), numSpecs);
            const compressedSize2 = reader.readUint64();
            const fieldSetIndicesCompressed = reader.readBytes(compressedSize2);
            const fieldSetIndices = decompressIntegers32(fieldSetIndicesCompressed.buffer.slice(fieldSetIndicesCompressed.byteOffset, fieldSetIndicesCompressed.byteOffset + compressedSize2), numSpecs);
            const compressedSize3 = reader.readUint64();
            const specTypesCompressed = reader.readBytes(compressedSize3);
            const specTypes = decompressIntegers32(specTypesCompressed.buffer.slice(specTypesCompressed.byteOffset, specTypesCompressed.byteOffset + compressedSize3), numSpecs);
            for(let i = 0; i < numSpecs; i++)this.specs.push({
                pathIndex: pathIndices[i],
                fieldSetIndex: fieldSetIndices[i],
                specType: specTypes[i]
            });
        }
    }
    // ========================================================================
    // Value Reading
    // ========================================================================
    _readValue(valueRep) {
        const type = valueRep.typeEnum;
        const isArray = valueRep.isArray;
        const isInlined = valueRep.isInlined;
        // Handle TimeSamples specially - they have their own format
        if (type === TypeEnum.TimeSamples) return this._readTimeSamples(valueRep);
        if (isInlined) return this._readInlinedValue(valueRep);
        // Seek to payload offset and read value
        const offset = valueRep.payload;
        if (offset === 0 && isArray) // Spec 16.3.9.3: Array payload 0 is an explicit empty-array sentinel.
        return [];
        if (offset < 0 || offset >= this.buffer.byteLength) throw new RangeError('USDCParser: Invalid payload offset ' + offset + ' for type ' + type + '.');
        const savedOffset = this.reader.tell();
        this.reader.seek(offset);
        let value;
        if (isArray) value = this._readArrayValue(valueRep);
        else value = this._readScalarValue(type);
        this.reader.seek(savedOffset);
        return value;
    }
    _readInlinedValue(valueRep) {
        const type = valueRep.typeEnum;
        const payload = valueRep.getInlinedValue();
        const view = this._conversionView;
        switch(type){
            case TypeEnum.Bool:
                return payload !== 0;
            case TypeEnum.UChar:
                return payload & 0xFF;
            case TypeEnum.Int:
            case TypeEnum.UInt:
                return payload;
            case TypeEnum.Float:
                view.setUint32(0, payload, true);
                return view.getFloat32(0, true);
            case TypeEnum.Double:
                // When a double is inlined, it's stored as float32 bits in the payload
                view.setUint32(0, payload, true);
                return view.getFloat32(0, true);
            case TypeEnum.Token:
                return this.tokens[payload] || '';
            case TypeEnum.String:
                return this.tokens[this.strings[payload]] || '';
            case TypeEnum.AssetPath:
                return this.tokens[payload] || '';
            case TypeEnum.Specifier:
                return payload; // 0=def, 1=over, 2=class
            case TypeEnum.Permission:
            case TypeEnum.Variability:
                return payload;
            // Vec2h: Two half-floats fit in 4 bytes, stored directly
            case TypeEnum.Vec2h:
                view.setUint32(0, payload, true);
                return [
                    this._halfToFloat(view.getUint16(0, true)),
                    this._halfToFloat(view.getUint16(2, true))
                ];
            // Inlined vectors that don't fit in 4 bytes are encoded as signed 8-bit integers
            // Vec2f = 8 bytes (2x float32), Vec3f = 12 bytes, Vec4f = 16 bytes, etc.
            case TypeEnum.Vec2f:
            case TypeEnum.Vec2i:
                view.setUint32(0, payload, true);
                return [
                    view.getInt8(0),
                    view.getInt8(1)
                ];
            case TypeEnum.Vec3f:
            case TypeEnum.Vec3i:
                view.setUint32(0, payload, true);
                return [
                    view.getInt8(0),
                    view.getInt8(1),
                    view.getInt8(2)
                ];
            case TypeEnum.Vec4f:
            case TypeEnum.Vec4i:
                view.setUint32(0, payload, true);
                return [
                    view.getInt8(0),
                    view.getInt8(1),
                    view.getInt8(2),
                    view.getInt8(3)
                ];
            case TypeEnum.Matrix2d:
                {
                    // Inlined Matrix2d stores diagonal values as 2 signed int8 values
                    view.setUint32(0, payload, true);
                    const d0 = view.getInt8(0), d1 = view.getInt8(1);
                    return [
                        d0,
                        0,
                        0,
                        d1
                    ];
                }
            case TypeEnum.Matrix3d:
                {
                    // Inlined Matrix3d stores diagonal values as 3 signed int8 values
                    view.setUint32(0, payload, true);
                    const d0 = view.getInt8(0), d1 = view.getInt8(1), d2 = view.getInt8(2);
                    return [
                        d0,
                        0,
                        0,
                        0,
                        d1,
                        0,
                        0,
                        0,
                        d2
                    ];
                }
            case TypeEnum.Matrix4d:
                {
                    // Inlined Matrix4d stores diagonal values as 4 signed int8 values
                    view.setUint32(0, payload, true);
                    const d0 = view.getInt8(0), d1 = view.getInt8(1), d2 = view.getInt8(2), d3 = view.getInt8(3);
                    return [
                        d0,
                        0,
                        0,
                        0,
                        0,
                        d1,
                        0,
                        0,
                        0,
                        0,
                        d2,
                        0,
                        0,
                        0,
                        0,
                        d3
                    ];
                }
            default:
                return payload;
        }
    }
    _readTimeSamples(valueRep) {
        const reader = this.reader;
        const offset = valueRep.payload;
        const savedOffset = reader.tell();
        reader.seek(offset);
        // TimeSamples format uses RELATIVE offsets (from OpenUSD _RecursiveRead):
        // _RecursiveRead: read int64 relativeOffset at current position, then seek to start + relativeOffset
        // After reading timesRep, continue reading from current position (after timesRep)
        // Layout at TimeSamples location:
        // - int64 timesOffset (relative from start of this int64)
        // At (start + timesOffset): timesRep ValueRep, then int64 valuesOffset, then numValues + ValueReps
        // Read times relative offset and resolve
        const timesStart = reader.tell();
        const timesRelOffset = reader.readInt64();
        reader.seek(timesStart + timesRelOffset);
        const timesRepLo = reader.readUint32();
        const timesRepHi = reader.readUint32();
        const timesRep = new ValueRep(timesRepLo, timesRepHi);
        // Resolve times array
        const times = this._readValue(timesRep);
        // Continue reading from current position (after timesRep)
        // The second _RecursiveRead reads from CURRENT position, not from the beginning
        const afterTimesRep = timesStart + timesRelOffset + 8;
        reader.seek(afterTimesRep);
        // Read values relative offset
        const valuesStart = reader.tell();
        const valuesRelOffset = reader.readInt64();
        reader.seek(valuesStart + valuesRelOffset);
        // Read number of values
        const numValues = reader.readUint64();
        // Read all ValueReps
        const valueReps = [];
        for(let i = 0; i < numValues; i++){
            const repLo = reader.readUint32();
            const repHi = reader.readUint32();
            valueReps.push(new ValueRep(repLo, repHi));
        }
        // Resolve each value
        const values = [];
        for(let i = 0; i < numValues; i++)values.push(this._readValue(valueReps[i]));
        reader.seek(savedOffset);
        // Convert times to array if needed
        const timesArray = times instanceof Float64Array ? Array.from(times) : Array.isArray(times) ? times : [
            times
        ];
        return {
            times: timesArray,
            values
        };
    }
    _readScalarValue(type) {
        const reader = this.reader;
        switch(type){
            case TypeEnum.Invalid:
                return null;
            case TypeEnum.Bool:
                return reader.readUint8() !== 0;
            case TypeEnum.UChar:
                return reader.readUint8();
            case TypeEnum.Int:
                return reader.readInt32();
            case TypeEnum.UInt:
                return reader.readUint32();
            case TypeEnum.Int64:
                return reader.readInt64();
            case TypeEnum.UInt64:
                return reader.readUint64();
            case TypeEnum.Half:
                return this._readHalf();
            case TypeEnum.Float:
                return reader.readFloat32();
            case TypeEnum.Double:
                return reader.readFloat64();
            case TypeEnum.String:
            case TypeEnum.Token:
                {
                    const index = reader.readUint32();
                    return this.tokens[index] || '';
                }
            case TypeEnum.AssetPath:
                {
                    const index = reader.readUint32();
                    return this.tokens[index] || '';
                }
            case TypeEnum.Vec2f:
                return [
                    reader.readFloat32(),
                    reader.readFloat32()
                ];
            case TypeEnum.Vec2d:
                return [
                    reader.readFloat64(),
                    reader.readFloat64()
                ];
            case TypeEnum.Vec2i:
                return [
                    reader.readInt32(),
                    reader.readInt32()
                ];
            case TypeEnum.Vec3f:
                return [
                    reader.readFloat32(),
                    reader.readFloat32(),
                    reader.readFloat32()
                ];
            case TypeEnum.Vec3d:
                return [
                    reader.readFloat64(),
                    reader.readFloat64(),
                    reader.readFloat64()
                ];
            case TypeEnum.Vec3i:
                return [
                    reader.readInt32(),
                    reader.readInt32(),
                    reader.readInt32()
                ];
            case TypeEnum.Vec4f:
                return [
                    reader.readFloat32(),
                    reader.readFloat32(),
                    reader.readFloat32(),
                    reader.readFloat32()
                ];
            case TypeEnum.Vec4d:
                return [
                    reader.readFloat64(),
                    reader.readFloat64(),
                    reader.readFloat64(),
                    reader.readFloat64()
                ];
            case TypeEnum.Quatf:
                return [
                    reader.readFloat32(),
                    reader.readFloat32(),
                    reader.readFloat32(),
                    reader.readFloat32()
                ];
            case TypeEnum.Quatd:
                return [
                    reader.readFloat64(),
                    reader.readFloat64(),
                    reader.readFloat64(),
                    reader.readFloat64()
                ];
            case TypeEnum.Matrix4d:
                {
                    const m = [];
                    for(let i = 0; i < 16; i++)m.push(reader.readFloat64());
                    return m;
                }
            case TypeEnum.TokenVector:
                {
                    const count = reader.readUint64();
                    const tokens = [];
                    for(let i = 0; i < count; i++){
                        const index = reader.readUint32();
                        tokens.push(this.tokens[index] || '');
                    }
                    return tokens;
                }
            case TypeEnum.PathVector:
                {
                    const count = reader.readUint64();
                    const paths = [];
                    for(let i = 0; i < count; i++){
                        const index = reader.readUint32();
                        paths.push(this.paths[index] || '');
                    }
                    return paths;
                }
            case TypeEnum.DoubleVector:
                {
                    // DoubleVector is a count-prefixed array of doubles
                    const count = reader.readUint64();
                    const arr = new Float64Array(count);
                    for(let i = 0; i < count; i++)arr[i] = reader.readFloat64();
                    return arr;
                }
            case TypeEnum.Dictionary:
                {
                    // Dictionary format:
                    // u64 elementCount
                    // For each element: u32 keyIndex + i64 valueOffset (relative)
                    const elementCount = reader.readUint64();
                    const dict = {};
                    for(let i = 0; i < elementCount; i++){
                        const keyIdx = reader.readUint32();
                        const key = this.tokens[keyIdx];
                        // Value offset is relative to current position
                        const currentPos = reader.position;
                        const valueOffset = reader.readInt64();
                        const valuePos = currentPos + valueOffset;
                        // Save position, read value, restore position
                        const savedPos = reader.position;
                        reader.position = valuePos;
                        // Read the value representation at the offset
                        const valueRepData = reader.readUint64();
                        const valueRep = new ValueRep(valueRepData);
                        // Read the value based on the representation
                        let value = null;
                        if (valueRep.isInlined) value = this._readInlinedValue(valueRep);
                        else if (valueRep.isArray) {
                            reader.position = valueRep.payload;
                            value = this._readArrayValue(valueRep);
                        } else {
                            reader.position = valueRep.payload;
                            value = this._readScalarValue(valueRep.typeEnum);
                        }
                        reader.position = savedPos;
                        if (key !== undefined && value !== null) dict[key] = value;
                    }
                    return dict;
                }
            case TypeEnum.TokenListOp:
            case TypeEnum.StringListOp:
            case TypeEnum.IntListOp:
            case TypeEnum.Int64ListOp:
            case TypeEnum.UIntListOp:
            case TypeEnum.UInt64ListOp:
                // These complex types are not needed for geometry loading
                // Skip them silently
                return null;
            case TypeEnum.PathListOp:
                {
                    // PathListOp format (from AOUSD Core Spec 16.3.10.25):
                    // Header byte bitmask:
                    // - bit 0 (0x01): Make Explicit (clears list)
                    // - bit 1 (0x02): Add Explicit Items
                    // - bit 2 (0x04): Add Items
                    // - bit 3 (0x08): Delete Items
                    // - bit 4 (0x10): Reorder Items
                    // - bit 5 (0x20): Prepend Items
                    // - bit 6 (0x40): Append Items
                    // Arrays follow in order: Explicit, Add, Prepend, Append, Delete, Reorder
                    // Each array: uint64 count + count * uint32 path indices
                    const flags = reader.readUint8();
                    const hasExplicitItems = (flags & 0x02) !== 0;
                    const hasAddItems = (flags & 0x04) !== 0;
                    const hasDeleteItems = (flags & 0x08) !== 0;
                    const hasReorderItems = (flags & 0x10) !== 0;
                    const hasPrependItems = (flags & 0x20) !== 0;
                    const hasAppendItems = (flags & 0x40) !== 0;
                    const readPathList = ()=>{
                        const itemCount = reader.readUint64();
                        const paths = [];
                        for(let i = 0; i < itemCount; i++){
                            const pathIdx = reader.readUint32();
                            paths.push(this.paths[pathIdx]);
                        }
                        return paths;
                    };
                    // Read arrays in spec order: Explicit, Add, Prepend, Append, Delete, Reorder
                    let explicitPaths = null;
                    let addPaths = null;
                    let prependPaths = null;
                    let appendPaths = null;
                    if (hasExplicitItems) explicitPaths = readPathList();
                    if (hasAddItems) addPaths = readPathList();
                    if (hasPrependItems) prependPaths = readPathList();
                    if (hasAppendItems) appendPaths = readPathList();
                    if (hasDeleteItems) readPathList(); // Skip delete items
                    if (hasReorderItems) readPathList(); // Skip reorder items
                    // Return the first non-empty list (connections are typically prepended)
                    if (prependPaths && prependPaths.length > 0) return prependPaths;
                    if (explicitPaths && explicitPaths.length > 0) return explicitPaths;
                    if (appendPaths && appendPaths.length > 0) return appendPaths;
                    if (addPaths && addPaths.length > 0) return addPaths;
                    return null;
                }
            case TypeEnum.VariantSelectionMap:
                {
                    const elementCount = reader.readUint64();
                    const map = {};
                    for(let i = 0; i < elementCount; i++){
                        const keyIdx = reader.readUint32();
                        const valueIdx = reader.readUint32();
                        const key = this.tokens[this.strings[keyIdx]];
                        const value = this.tokens[this.strings[valueIdx]];
                        if (key && value) map[key] = value;
                    }
                    return map;
                }
            default:
                console.warn('USDCParser: Unsupported scalar type', type);
                return null;
        }
    }
    _readArrayValue(valueRep) {
        const reader = this.reader;
        const type = valueRep.typeEnum;
        const isCompressed = valueRep.isCompressed;
        // Read array size
        let size;
        if (this.version.major === 0 && this.version.minor < 7) size = reader.readUint32();
        else size = reader.readUint64();
        if (!Number.isSafeInteger(size) || size < 0) throw new RangeError('USDCParser: Invalid array size ' + size + ' for type ' + type + '.');
        if (size > 0x7FFFFFFF) // Crate stores counts as uint64, but JS typed arrays cannot represent all such sizes.
        throw new RangeError('USDCParser: Array size ' + size + ' exceeds implementation limits.');
        if (size === 0) return [];
        // Handle compressed arrays
        if (isCompressed) return this._readCompressedArray(type, size);
        // Read uncompressed array
        switch(type){
            case TypeEnum.Int:
                {
                    const arr = new Int32Array(size);
                    for(let i = 0; i < size; i++)arr[i] = reader.readInt32();
                    return arr;
                }
            case TypeEnum.UInt:
                {
                    const arr = new Uint32Array(size);
                    for(let i = 0; i < size; i++)arr[i] = reader.readUint32();
                    return arr;
                }
            case TypeEnum.Float:
                {
                    const arr = new Float32Array(size);
                    for(let i = 0; i < size; i++)arr[i] = reader.readFloat32();
                    return arr;
                }
            case TypeEnum.Double:
                {
                    const arr = new Float64Array(size);
                    for(let i = 0; i < size; i++)arr[i] = reader.readFloat64();
                    return arr;
                }
            case TypeEnum.Vec2f:
                {
                    const arr = new Float32Array(size * 2);
                    for(let i = 0; i < size * 2; i++)arr[i] = reader.readFloat32();
                    return arr;
                }
            case TypeEnum.Vec3f:
                {
                    const arr = new Float32Array(size * 3);
                    for(let i = 0; i < size * 3; i++)arr[i] = reader.readFloat32();
                    return arr;
                }
            case TypeEnum.Vec4f:
                {
                    const arr = new Float32Array(size * 4);
                    for(let i = 0; i < size * 4; i++)arr[i] = reader.readFloat32();
                    return arr;
                }
            case TypeEnum.Vec3h:
                {
                    // Half-precision vec3 array (used for scales in skeletal animation)
                    const arr = new Float32Array(size * 3);
                    for(let i = 0; i < size * 3; i++)arr[i] = this._readHalf();
                    return arr;
                }
            case TypeEnum.Quatf:
                {
                    const arr = new Float32Array(size * 4);
                    for(let i = 0; i < size * 4; i++)arr[i] = reader.readFloat32();
                    return arr;
                }
            case TypeEnum.Quath:
                {
                    // Half-precision quaternion array
                    const arr = new Float32Array(size * 4);
                    for(let i = 0; i < size * 4; i++)arr[i] = this._readHalf();
                    return arr;
                }
            case TypeEnum.Matrix4d:
                {
                    // 4x4 matrix array (16 doubles per matrix, row-major)
                    const arr = new Float64Array(size * 16);
                    for(let i = 0; i < size * 16; i++)arr[i] = reader.readFloat64();
                    return arr;
                }
            case TypeEnum.Token:
                {
                    const arr = [];
                    for(let i = 0; i < size; i++){
                        const index = reader.readUint32();
                        arr.push(this.tokens[index] || '');
                    }
                    return arr;
                }
            case TypeEnum.Half:
                {
                    const arr = new Float32Array(size);
                    for(let i = 0; i < size; i++)arr[i] = this._readHalf();
                    return arr;
                }
            default:
                console.warn('USDCParser: Unsupported array type', type);
                return [];
        }
    }
    _readCompressedArray(type, size) {
        const reader = this.reader;
        switch(type){
            case TypeEnum.Int:
            case TypeEnum.UInt:
                {
                    const compressedSize = reader.readUint64();
                    const compressed = reader.readBytes(compressedSize);
                    return decompressIntegers32(compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressedSize), size);
                }
            case TypeEnum.Float:
                {
                    // Float compression: 'i' = compressed as ints, 't' = lookup table
                    const code = reader.readInt8();
                    if (code === FLOAT_COMPRESSION_INT) {
                        const compressedSize = reader.readUint64();
                        const compressed = reader.readBytes(compressedSize);
                        const ints = decompressIntegers32(compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressedSize), size);
                        const floats = new Float32Array(size);
                        for(let i = 0; i < size; i++)floats[i] = ints[i];
                        return floats;
                    } else if (code === FLOAT_COMPRESSION_LUT) {
                        const lutSize = reader.readUint32();
                        const lut = new Float32Array(lutSize);
                        for(let i = 0; i < lutSize; i++)lut[i] = reader.readFloat32();
                        const compressedSize = reader.readUint64();
                        const compressed = reader.readBytes(compressedSize);
                        const indices = decompressIntegers32(compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressedSize), size);
                        const floats = new Float32Array(size);
                        for(let i = 0; i < size; i++)floats[i] = lut[indices[i]];
                        return floats;
                    }
                    console.warn('USDCParser: Unknown float compression code', code);
                    return new Float32Array(size);
                }
            default:
                console.warn('USDCParser: Unsupported compressed array type', type);
                return [];
        }
    }
    _readHalf() {
        return this._halfToFloat(this.reader.readUint16());
    }
    _halfToFloat(h) {
        const sign = (h & 0x8000) >> 15;
        const exp = (h & 0x7C00) >> 10;
        const frac = h & 0x03FF;
        if (exp === 0) {
            // Zero or denormalized number
            if (frac === 0) return sign ? -0 : 0;
            // Denormalized: value = ±2^-14 × (frac/1024)
            return (sign ? -1 : 1) * HALF_DENORM_SCALE * (frac / 1024);
        } else if (exp === 31) return frac ? NaN : sign ? -Infinity : Infinity;
        return (sign ? -1 : 1) * HALF_EXPONENT_TABLE[exp] * (1 + frac / 1024);
    }
    _getFieldsForSpec(spec) {
        const fields = {};
        let fieldSetIndex = spec.fieldSetIndex;
        // Field sets are terminated by FIELD_SET_TERMINATOR
        // Limit iterations to prevent infinite loops from malformed data
        const maxIterations = 10000;
        let iterations = 0;
        while(fieldSetIndex < this.fieldSets.length && iterations < maxIterations){
            const fieldIndex = this.fieldSets[fieldSetIndex];
            // Terminator
            if (fieldIndex === FIELD_SET_TERMINATOR || fieldIndex === -1) break;
            const field = this.fields[fieldIndex];
            if (field) {
                const name = this.tokens[field.tokenIndex];
                const value = this._readValue(field.valueRep);
                fields[name] = value;
            }
            fieldSetIndex++;
            iterations++;
        }
        return fields;
    }
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"jbKKq":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "USDComposer", ()=>USDComposer);
parcelHelpers.export(exports, "SpecType", ()=>SpecType);
var _three = require("three");
// Pre-compiled regex patterns for performance
const VARIANT_PATH_REGEX = /^(.+?)\/\{(\w+)=(\w+)\}\/(.+)$/;
// Spec types (must match USDCParser)
const SpecType = {
    Unknown: 0,
    Attribute: 1,
    Connection: 2,
    Expression: 3,
    Mapper: 4,
    MapperArg: 5,
    Prim: 6,
    PseudoRoot: 7,
    Relationship: 8,
    RelationshipTarget: 9,
    Variant: 10,
    VariantSet: 11
};
// UsdGeomCamera fallback values (OpenUSD schema)
const USD_CAMERA_DEFAULTS = {
    projection: 'perspective',
    clippingRange: [
        1,
        1000000
    ],
    horizontalAperture: 20.955,
    verticalAperture: 15.2908,
    horizontalApertureOffset: 0,
    verticalApertureOffset: 0,
    focalLength: 50,
    focusDistance: 0,
    fStop: 0
};
/**
 * USDComposer handles scene composition from parsed USD data.
 * This includes reference resolution, variant selection, transform handling,
 * and building the Three.js scene graph.
 *
 * Works with specsByPath format from USDCParser.
 */ class USDComposer {
    constructor(manager = null){
        this.textureCache = {};
        this.skinnedMeshes = [];
        this.manager = manager;
    }
    /**
	 * Compose a Three.js scene from parsed USD data.
	 * @param {Object} parsedData - Data from USDCParser or USDAParser
	 * @param {Object} assets - Dictionary of referenced assets (specsByPath or blob URLs)
	 * @param {Object} variantSelections - External variant selections
	 * @param {string} basePath - Base path for resolving relative references
	 * @returns {Group} Three.js scene graph
	 */ compose(parsedData, assets = {}, variantSelections = {}, basePath = '') {
        this.specsByPath = parsedData.specsByPath;
        this.assets = assets;
        this.externalVariantSelections = variantSelections;
        this.basePath = basePath;
        this.skinnedMeshes = [];
        this.skeletons = {};
        // Build indexes for O(1) lookups
        this._buildIndexes();
        // Get FPS from root spec
        const rootSpec = this.specsByPath['/'];
        const rootFields = rootSpec ? rootSpec.fields : {};
        this.fps = rootFields.framesPerSecond || rootFields.timeCodesPerSecond || 30;
        const group = new (0, _three.Group)();
        this._buildHierarchy(group, '/');
        // Bind skeletons to skinned meshes
        this._bindSkeletons();
        // Expose skeleton on the root group so that AnimationMixer's
        // PropertyBinding.findNode resolves bone names before scene objects.
        // Without this, Xform prims that share a name with a skeleton joint
        // would be animated instead of the bone.
        const skeletonPaths = Object.keys(this.skeletons);
        if (skeletonPaths.length === 1) group.skeleton = this.skeletons[skeletonPaths[0]].skeleton;
        // Build animations
        group.animations = this._buildAnimations();
        // Handle metersPerUnit scaling
        const metersPerUnit = rootFields.metersPerUnit;
        if (metersPerUnit !== undefined && metersPerUnit !== 1) group.scale.setScalar(metersPerUnit);
        // Handle Z-up to Y-up conversion
        if (rootSpec && rootSpec.fields && rootSpec.fields.upAxis === 'Z') group.rotation.x = -Math.PI / 2;
        return group;
    }
    /**
	 * Apply USD transforms to a Three.js object.
	 * Handles xformOpOrder with proper matrix composition.
	 * USD uses row-vector convention, Three.js uses column-vector.
	 */ applyTransform(obj, fields, attrs = {}) {
        const data = {
            ...fields,
            ...attrs
        };
        const xformOpOrder = data['xformOpOrder'];
        // If we have xformOpOrder, apply transforms using matrices
        if (xformOpOrder && xformOpOrder.length > 0) {
            const matrix = new (0, _three.Matrix4)();
            const tempMatrix = new (0, _three.Matrix4)();
            // Track scale for handling negative scale with rotation
            let scaleValues = null;
            // Iterate FORWARD for Three.js column-vector convention
            for(let i = 0; i < xformOpOrder.length; i++){
                const op = xformOpOrder[i];
                const isInverse = op.startsWith('!invert!');
                const opName = isInverse ? op.slice(8) : op;
                if (opName === 'xformOp:transform') {
                    const m = data['xformOp:transform'];
                    if (m && m.length === 16) {
                        tempMatrix.set(m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]);
                        if (isInverse) tempMatrix.invert();
                        matrix.multiply(tempMatrix);
                    }
                } else if (opName === 'xformOp:translate') {
                    const t = data['xformOp:translate'];
                    if (t) {
                        tempMatrix.makeTranslation(t[0], t[1], t[2]);
                        if (isInverse) tempMatrix.invert();
                        matrix.multiply(tempMatrix);
                    }
                } else if (opName === 'xformOp:translate:pivot') {
                    const t = data['xformOp:translate:pivot'];
                    if (t) {
                        tempMatrix.makeTranslation(t[0], t[1], t[2]);
                        if (isInverse) tempMatrix.invert();
                        matrix.multiply(tempMatrix);
                    }
                } else if (opName === 'xformOp:scale') {
                    const s = data['xformOp:scale'];
                    if (s) {
                        if (Array.isArray(s)) {
                            tempMatrix.makeScale(s[0], s[1], s[2]);
                            scaleValues = [
                                s[0],
                                s[1],
                                s[2]
                            ];
                        } else {
                            tempMatrix.makeScale(s, s, s);
                            scaleValues = [
                                s,
                                s,
                                s
                            ];
                        }
                        if (isInverse) tempMatrix.invert();
                        matrix.multiply(tempMatrix);
                    }
                } else if (opName === 'xformOp:rotateXYZ') {
                    const r = data['xformOp:rotateXYZ'];
                    if (r) {
                        // USD rotateXYZ: matrix = Rx * Ry * Rz
                        // Three.js Euler 'ZYX' order produces same result
                        const euler = new (0, _three.Euler)(r[0] * Math.PI / 180, r[1] * Math.PI / 180, r[2] * Math.PI / 180, 'ZYX');
                        tempMatrix.makeRotationFromEuler(euler);
                        if (isInverse) tempMatrix.invert();
                        matrix.multiply(tempMatrix);
                    }
                } else if (opName === 'xformOp:rotateX') {
                    const r = data['xformOp:rotateX'];
                    if (r !== undefined) {
                        tempMatrix.makeRotationX(r * Math.PI / 180);
                        if (isInverse) tempMatrix.invert();
                        matrix.multiply(tempMatrix);
                    }
                } else if (opName === 'xformOp:rotateY') {
                    const r = data['xformOp:rotateY'];
                    if (r !== undefined) {
                        tempMatrix.makeRotationY(r * Math.PI / 180);
                        if (isInverse) tempMatrix.invert();
                        matrix.multiply(tempMatrix);
                    }
                } else if (opName === 'xformOp:rotateZ') {
                    const r = data['xformOp:rotateZ'];
                    if (r !== undefined) {
                        tempMatrix.makeRotationZ(r * Math.PI / 180);
                        if (isInverse) tempMatrix.invert();
                        matrix.multiply(tempMatrix);
                    }
                } else if (opName === 'xformOp:orient') {
                    const q = data['xformOp:orient'];
                    if (q && q.length === 4) {
                        const quat = new (0, _three.Quaternion)(q[0], q[1], q[2], q[3]);
                        tempMatrix.makeRotationFromQuaternion(quat);
                        if (isInverse) tempMatrix.invert();
                        matrix.multiply(tempMatrix);
                    }
                }
            }
            obj.matrix.copy(matrix);
            obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
            // Fix for negative scale: decompose() may absorb negative scale into quaternion
            // Restore original scale signs to keep animation consistent
            if (scaleValues) {
                const negX = scaleValues[0] < 0;
                const negY = scaleValues[1] < 0;
                const negZ = scaleValues[2] < 0;
                const negCount = (negX ? 1 : 0) + (negY ? 1 : 0) + (negZ ? 1 : 0);
                // decompose() absorbs pairs of negative scales into rotation
                // For [-1,-1,-1] → [-1,1,1], Y and Z were absorbed, flip quat.y and quat.w
                if (negCount === 3) {
                    obj.scale.set(scaleValues[0], scaleValues[1], scaleValues[2]);
                    obj.quaternion.set(obj.quaternion.x, -obj.quaternion.y, obj.quaternion.z, -obj.quaternion.w);
                }
            }
            return;
        }
        // Fallback: handle individual transform ops without order
        if (data['xformOp:translate']) {
            const t = data['xformOp:translate'];
            obj.position.set(t[0], t[1], t[2]);
        }
        if (data['xformOp:translate:pivot']) {
            const p = data['xformOp:translate:pivot'];
            obj.pivot = new (0, _three.Vector3)(p[0], p[1], p[2]);
        }
        if (data['xformOp:scale']) {
            const s = data['xformOp:scale'];
            if (Array.isArray(s)) obj.scale.set(s[0], s[1], s[2]);
            else obj.scale.set(s, s, s);
        }
        if (data['xformOp:rotateXYZ']) {
            const r = data['xformOp:rotateXYZ'];
            obj.rotation.set(r[0] * Math.PI / 180, r[1] * Math.PI / 180, r[2] * Math.PI / 180);
        }
        if (data['xformOp:orient']) {
            const q = data['xformOp:orient'];
            if (q.length === 4) obj.quaternion.set(q[0], q[1], q[2], q[3]);
        }
    }
    /**
	 * Build indexes for efficient lookups.
	 * Called once during compose() to avoid O(n) scans per lookup.
	 */ _buildIndexes() {
        // childrenByPath: parentPath -> [childName1, childName2, ...]
        this.childrenByPath = new Map();
        // attributesByPrimPath: primPath -> Map(attrName -> attrSpec)
        this.attributesByPrimPath = new Map();
        // materialsByRoot: rootPath -> [materialPath1, materialPath2, ...]
        this.materialsByRoot = new Map();
        // shadersByMaterialPath: materialPath -> [shaderPath1, shaderPath2, ...]
        this.shadersByMaterialPath = new Map();
        // geomSubsetsByMeshPath: meshPath -> [subsetPath1, subsetPath2, ...]
        this.geomSubsetsByMeshPath = new Map();
        for(const path in this.specsByPath){
            const spec = this.specsByPath[path];
            if (spec.specType === SpecType.Prim) {
                // Build parent-child index
                const lastSlash = path.lastIndexOf('/');
                if (lastSlash > 0) {
                    const parentPath = path.slice(0, lastSlash);
                    const childName = path.slice(lastSlash + 1);
                    if (!this.childrenByPath.has(parentPath)) this.childrenByPath.set(parentPath, []);
                    this.childrenByPath.get(parentPath).push({
                        name: childName,
                        path: path
                    });
                } else if (lastSlash === 0 && path.length > 1) {
                    // Direct child of root
                    const childName = path.slice(1);
                    if (!this.childrenByPath.has('/')) this.childrenByPath.set('/', []);
                    this.childrenByPath.get('/').push({
                        name: childName,
                        path: path
                    });
                }
                const typeName = spec.fields.typeName;
                // Build material index
                if (typeName === 'Material') {
                    const parts = path.split('/');
                    const rootPath = parts.length > 1 ? '/' + parts[1] : '/';
                    if (!this.materialsByRoot.has(rootPath)) this.materialsByRoot.set(rootPath, []);
                    this.materialsByRoot.get(rootPath).push(path);
                }
                // Build shader index (shaders are children or descendants of materials)
                if (typeName === 'Shader' && lastSlash > 0) {
                    // Walk up ancestors to find the nearest Material prim.
                    // Shaders may be direct children of a Material, or nested
                    // inside a NodeGraph (common with MaterialX materials).
                    let ancestorPath = path.slice(0, lastSlash);
                    while(ancestorPath.length > 0){
                        const ancestorSpec = this.specsByPath[ancestorPath];
                        if (ancestorSpec && ancestorSpec.specType === SpecType.Prim && ancestorSpec.fields.typeName === 'Material') {
                            if (!this.shadersByMaterialPath.has(ancestorPath)) this.shadersByMaterialPath.set(ancestorPath, []);
                            this.shadersByMaterialPath.get(ancestorPath).push(path);
                            break;
                        }
                        const slash = ancestorPath.lastIndexOf('/');
                        if (slash <= 0) break;
                        ancestorPath = ancestorPath.slice(0, slash);
                    }
                }
                // Build GeomSubset index (subsets are children of meshes)
                if (typeName === 'GeomSubset' && lastSlash > 0) {
                    const meshPath = path.slice(0, lastSlash);
                    if (!this.geomSubsetsByMeshPath.has(meshPath)) this.geomSubsetsByMeshPath.set(meshPath, []);
                    this.geomSubsetsByMeshPath.get(meshPath).push(path);
                }
            } else if (spec.specType === SpecType.Attribute || spec.specType === SpecType.Relationship) {
                // Build attribute index
                const dotIndex = path.lastIndexOf('.');
                if (dotIndex > 0) {
                    const primPath = path.slice(0, dotIndex);
                    const attrName = path.slice(dotIndex + 1);
                    if (!this.attributesByPrimPath.has(primPath)) this.attributesByPrimPath.set(primPath, new Map());
                    this.attributesByPrimPath.get(primPath).set(attrName, spec);
                }
            }
        }
    }
    /**
	 * Check if a path is a direct child of parentPath.
	 */ _isDirectChild(parentPath, path, prefix) {
        if (!path.startsWith(prefix)) return false;
        const remainder = path.slice(prefix.length);
        if (remainder.length === 0) return false;
        // Check for variant paths or simple names
        if (remainder.startsWith('{')) return false; // Variant paths are not direct children
        return !remainder.includes('/');
    }
    /**
	 * Build the scene hierarchy recursively.
	 * Uses childrenByPath index for O(1) child lookup instead of O(n) iteration.
	 */ _buildHierarchy(parent, parentPath) {
        // Collect children from parentPath and any active variant paths
        const childEntries = [];
        const seenPaths = new Set();
        // Get direct children using the index
        const directChildren = this.childrenByPath.get(parentPath);
        if (directChildren) {
            for (const child of directChildren)if (!seenPaths.has(child.path)) {
                seenPaths.add(child.path);
                childEntries.push(child);
            }
        }
        // Also get children from active variant paths
        const variantPaths = this._getVariantPaths(parentPath);
        for (const vp of variantPaths){
            const variantChildren = this.childrenByPath.get(vp);
            if (variantChildren) {
                for (const child of variantChildren)if (!seenPaths.has(child.path)) {
                    seenPaths.add(child.path);
                    childEntries.push(child);
                }
            }
        }
        // Process each child
        for (const { name, path } of childEntries){
            const spec = this.specsByPath[path];
            if (!spec || spec.specType !== SpecType.Prim) continue;
            const typeName = spec.fields.typeName;
            // Check for references/payloads
            const refValues = this._getReferences(spec);
            if (refValues.length > 0) {
                // Get local variant selections from this prim
                const localVariants = this._getLocalVariantSelections(spec.fields);
                // Resolve all references
                const resolvedGroups = [];
                for (const refValue of refValues){
                    const referencedGroup = this._resolveReference(refValue, localVariants);
                    if (referencedGroup) resolvedGroups.push(referencedGroup);
                }
                if (resolvedGroups.length > 0) {
                    const attrs = this._getAttributes(path);
                    // Single reference with single mesh: use optimized path
                    // This handles the USDZExporter pattern: Xform references geometry file
                    if (resolvedGroups.length === 1) {
                        const singleMesh = this._findSingleMesh(resolvedGroups[0]);
                        if (singleMesh && (typeName === 'Xform' || !typeName)) {
                            // Merge the mesh into this prim
                            singleMesh.name = name;
                            this.applyTransform(singleMesh, spec.fields, attrs);
                            // Apply material binding from the referencing prim if present
                            this._applyMaterialBinding(singleMesh, path);
                            parent.add(singleMesh);
                            // Still build local children (overrides)
                            this._buildHierarchy(singleMesh, path);
                            continue;
                        }
                    }
                    // Create a container for the referenced content
                    const obj = new (0, _three.Object3D)();
                    obj.name = name;
                    this.applyTransform(obj, spec.fields, attrs);
                    // Add all children from all resolved references
                    for (const referencedGroup of resolvedGroups)while(referencedGroup.children.length > 0)obj.add(referencedGroup.children[0]);
                    parent.add(obj);
                    // Still build local children (overrides)
                    this._buildHierarchy(obj, path);
                    continue;
                }
            }
            // Build appropriate object based on type
            if (typeName === 'SkelRoot') {
                // Skeletal root - treat as transform but track for skeleton binding
                const obj = new (0, _three.Object3D)();
                obj.name = name;
                obj.userData.isSkelRoot = true;
                const attrs = this._getAttributes(path);
                this.applyTransform(obj, spec.fields, attrs);
                parent.add(obj);
                this._buildHierarchy(obj, path);
            } else if (typeName === 'Skeleton') {
                // Build skeleton and store it
                const skeleton = this._buildSkeleton(path);
                if (skeleton) this.skeletons[path] = skeleton;
                // Recursively build children (may contain SkelAnimation)
                this._buildHierarchy(parent, path);
            } else if (typeName === 'SkelAnimation') ;
            else if (typeName === 'Mesh') {
                const obj = this._buildMesh(path, spec);
                if (obj) {
                    parent.add(obj);
                    this._buildHierarchy(obj, path);
                }
            } else if (typeName === 'Camera') {
                const obj = this._buildCamera(path);
                obj.name = name;
                const attrs = this._getAttributes(path);
                this.applyTransform(obj, spec.fields, attrs);
                parent.add(obj);
                this._buildHierarchy(obj, path);
            } else if (typeName === 'DistantLight' || typeName === 'SphereLight' || typeName === 'RectLight' || typeName === 'DiskLight') {
                const obj = this._buildLight(path, typeName);
                obj.name = name;
                const attrs = this._getAttributes(path);
                this.applyTransform(obj, spec.fields, attrs);
                parent.add(obj);
                this._buildHierarchy(obj, path);
            } else if (typeName === 'Cube' || typeName === 'Sphere' || typeName === 'Cylinder' || typeName === 'Cone' || typeName === 'Capsule') {
                const obj = this._buildGeomPrimitive(path, spec, typeName);
                if (obj) {
                    parent.add(obj);
                    this._buildHierarchy(obj, path);
                }
            } else if (typeName === 'Material' || typeName === 'Shader' || typeName === 'GeomSubset') ;
            else {
                // Transform node, group, or unknown type
                const obj = new (0, _three.Object3D)();
                obj.name = name;
                const attrs = this._getAttributes(path);
                this.applyTransform(obj, spec.fields, attrs);
                parent.add(obj);
                this._buildHierarchy(obj, path);
            }
        }
    }
    /**
	 * Get variant paths for a parent path based on variant selections.
	 */ _getVariantPaths(parentPath) {
        const parentSpec = this.specsByPath[parentPath];
        const variantSetChildren = parentSpec?.fields?.variantSetChildren;
        const variantPaths = [];
        if (!variantSetChildren || variantSetChildren.length === 0) return variantPaths;
        for (const variantSetName of variantSetChildren){
            // External selections take priority
            let selectedVariant = this.externalVariantSelections[variantSetName] || null;
            // Fall back to file's internal selection
            if (!selectedVariant) {
                const variantSelection = parentSpec.fields.variantSelection;
                selectedVariant = variantSelection ? variantSelection[variantSetName] : null;
            }
            // Fall back to first variant child
            if (!selectedVariant) {
                const variantSetPath = parentPath + '/{' + variantSetName + '=}';
                const variantSetSpec = this.specsByPath[variantSetPath];
                if (variantSetSpec?.fields?.variantChildren) selectedVariant = variantSetSpec.fields.variantChildren[0];
            }
            if (selectedVariant) {
                const variantPath = parentPath + '/{' + variantSetName + '=' + selectedVariant + '}';
                variantPaths.push(variantPath);
            }
        }
        return variantPaths;
    }
    /**
	 * Resolve a file path relative to basePath.
	 */ _resolveFilePath(refPath) {
        let cleanPath = refPath;
        // Remove ./ prefix
        if (cleanPath.startsWith('./')) cleanPath = cleanPath.slice(2);
        // Combine with base path
        if (this.basePath) return this.basePath + '/' + cleanPath;
        return cleanPath;
    }
    /**
	 * Resolve a USD reference and return the composed content.
	 * @param {string} refValue - Reference value like "@./path/to/file.usdc@"
	 * @param {Object} localVariants - Variant selections to apply
	 * @returns {Group|null} Composed content or null
	 */ _resolveReference(refValue, localVariants = {}) {
        if (!refValue) return null;
        const match = refValue.match(/@([^@]+)@(?:<([^>]+)>)?/);
        if (!match) return null;
        const filePath = match[1];
        const primPath = match[2]; // e.g., "/Geometry"
        const resolvedPath = this._resolveFilePath(filePath);
        // Merge variant selections - external takes priority, then local
        const mergedVariants = {
            ...localVariants,
            ...this.externalVariantSelections
        };
        // Look up pre-parsed data in assets
        const referencedData = this.assets[resolvedPath];
        if (!referencedData) return null;
        // If it's specsByPath data, compose it
        if (referencedData.specsByPath) {
            const composer = new USDComposer(this.manager);
            const newBasePath = this._getBasePath(resolvedPath);
            const composedGroup = composer.compose(referencedData, this.assets, mergedVariants, newBasePath);
            // If a primPath is specified, find and return just that subtree
            if (primPath) {
                const primName = primPath.split('/').pop();
                // Find the direct child with this name (not a deep search)
                // This is important because there may be multiple objects with the same name
                let targetObject = null;
                for (const child of composedGroup.children)if (child.name === primName) {
                    targetObject = child;
                    break;
                }
                if (targetObject) {
                    // Detach from parent for re-parenting
                    composedGroup.remove(targetObject);
                    // Wrap in a group to maintain consistent return type
                    const wrapper = new (0, _three.Group)();
                    wrapper.add(targetObject);
                    return wrapper;
                }
            }
            return composedGroup;
        }
        // If it's already a Three.js Group (legacy support), clone it
        if (referencedData.isGroup || referencedData.isObject3D) return referencedData.clone();
        return null;
    }
    /**
	 * Find a single mesh in the group's shallow hierarchy.
	 * Only returns a mesh if it's at depth 0 or 1, not deeply nested.
	 * This preserves transforms in complex hierarchies like Kitchen Set
	 * while supporting USDZExporter round-trip (Xform > Xform > Mesh pattern).
	 */ _findSingleMesh(group) {
        // Check direct children first
        for (const child of group.children)if (child.isMesh) {
            group.remove(child);
            return child;
        }
        // Check grandchildren (USDZExporter pattern: Xform > Geometry > Mesh)
        // Only if there's exactly one child with exactly one grandchild
        if (group.children.length === 1) {
            const child = group.children[0];
            if (child.children && child.children.length === 1) {
                const grandchild = child.children[0];
                if (grandchild.isMesh && !this._hasNonIdentityTransform(child)) {
                    // Safe to merge - intermediate has identity transform
                    child.remove(grandchild);
                    return grandchild;
                }
            }
        }
        return null;
    }
    /**
	 * Check if an object has a non-identity local transform.
	 */ _hasNonIdentityTransform(obj) {
        const pos = obj.position;
        const rot = obj.rotation;
        const scale = obj.scale;
        const hasPosition = pos.x !== 0 || pos.y !== 0 || pos.z !== 0;
        const hasRotation = rot.x !== 0 || rot.y !== 0 || rot.z !== 0;
        const hasScale = scale.x !== 1 || scale.y !== 1 || scale.z !== 1;
        return hasPosition || hasRotation || hasScale;
    }
    /**
	 * Get the base path (directory) from a file path.
	 */ _getBasePath(filePath) {
        const lastSlash = filePath.lastIndexOf('/');
        return lastSlash >= 0 ? filePath.slice(0, lastSlash) : '';
    }
    /**
	 * Extract variant selections from a spec's fields.
	 */ _getLocalVariantSelections(fields) {
        const variants = {};
        if (fields.variantSelection) for(const key in fields.variantSelection)variants[key] = fields.variantSelection[key];
        return variants;
    }
    /**
	 * Get all reference values from a prim spec.
	 * @returns {string[]} Array of reference strings like "@path@" or "@path@<prim>"
	 */ _getReferences(spec) {
        const results = [];
        if (spec.fields.references && spec.fields.references.length > 0) {
            const ref = spec.fields.references[0];
            if (typeof ref === 'string') {
                // Extract all @...@ references (handles both single and array values)
                const matches = ref.matchAll(/@([^@]+)@(?:<([^>]+)>)?/g);
                for (const match of matches)results.push(match[0]);
            } else if (ref.assetPath) results.push('@' + ref.assetPath + '@');
        }
        if (results.length === 0 && spec.fields.payload) {
            const payload = spec.fields.payload;
            if (typeof payload === 'string') results.push(payload);
            else if (payload.assetPath) results.push('@' + payload.assetPath + '@');
        }
        return results;
    }
    /**
	 * Get attributes for a path from attribute specs.
	 */ _getAttributes(path) {
        const attrs = {};
        this._collectAttributesFromPath(path, attrs);
        // Collect overrides from sibling variants (when path is inside a variant)
        const variantMatch = path.match(VARIANT_PATH_REGEX);
        if (variantMatch) {
            const basePath = variantMatch[1];
            const relativePath = variantMatch[4];
            const variantPaths = this._getVariantPaths(basePath);
            for (const vp of variantPaths){
                if (path.startsWith(vp)) continue;
                const overridePath = vp + '/' + relativePath;
                this._collectAttributesFromPath(overridePath, attrs);
            }
        } else {
            // Check for variant overrides at ancestor levels
            const parts = path.split('/');
            for(let i = 1; i < parts.length - 1; i++){
                const ancestorPath = parts.slice(0, i + 1).join('/');
                const relativePath = parts.slice(i + 1).join('/');
                const variantPaths = this._getVariantPaths(ancestorPath);
                for (const vp of variantPaths){
                    const overridePath = vp + '/' + relativePath;
                    this._collectAttributesFromPath(overridePath, attrs);
                }
            }
        }
        return attrs;
    }
    _collectAttributesFromPath(path, attrs) {
        // Use the attribute index for O(1) lookup instead of O(n) iteration
        const attrMap = this.attributesByPrimPath.get(path);
        if (!attrMap) return;
        for (const [attrName, attrSpec] of attrMap){
            if (attrSpec.fields?.default !== undefined) attrs[attrName] = attrSpec.fields.default;
            else if (attrSpec.fields?.timeSamples) {
                // For animated attributes without default, use the first time sample (rest pose)
                const { times, values } = attrSpec.fields.timeSamples;
                if (times && values && times.length > 0) {
                    // Find time 0, or use the first available time
                    const idx = times.indexOf(0);
                    attrs[attrName] = idx >= 0 ? values[idx] : values[0];
                }
            }
            if (attrSpec.fields?.elementSize !== undefined) attrs[attrName + ':elementSize'] = attrSpec.fields.elementSize;
            if (attrName.startsWith('primvars:') && attrSpec.fields?.typeName !== undefined) attrs[attrName + ':typeName'] = attrSpec.fields.typeName;
        }
    }
    /**
	 * Build a mesh from a USD geometric primitive (Cube, Sphere, Cylinder, Cone, Capsule).
	 */ _buildGeomPrimitive(path, spec, typeName) {
        const attrs = this._getAttributes(path);
        const name = path.split('/').pop();
        let geometry;
        switch(typeName){
            case 'Cube':
                {
                    const size = attrs['size'] || 2;
                    geometry = new (0, _three.BoxGeometry)(size, size, size);
                    break;
                }
            case 'Sphere':
                {
                    const radius = attrs['radius'] || 1;
                    geometry = new (0, _three.SphereGeometry)(radius, 32, 16);
                    break;
                }
            case 'Cylinder':
                {
                    const height = attrs['height'] || 2;
                    const radius = attrs['radius'] || 1;
                    geometry = new (0, _three.CylinderGeometry)(radius, radius, height, 32);
                    break;
                }
            case 'Cone':
                {
                    const height = attrs['height'] || 2;
                    const radius = attrs['radius'] || 1;
                    geometry = new (0, _three.ConeGeometry)(radius, height, 32);
                    break;
                }
            case 'Capsule':
                {
                    const height = attrs['height'] || 1;
                    const radius = attrs['radius'] || 0.5;
                    geometry = new (0, _three.CapsuleGeometry)(radius, height, 16, 32);
                    break;
                }
        }
        // USD defaults axis to "Z", Three.js uses Y
        const axis = attrs['axis'] || 'Z';
        if (axis === 'X') geometry.rotateZ(-Math.PI / 2);
        else if (axis === 'Z') geometry.rotateX(Math.PI / 2);
        const material = this._buildMaterial(path, spec.fields);
        const mesh = new (0, _three.Mesh)(geometry, material);
        mesh.name = name;
        this.applyTransform(mesh, spec.fields, attrs);
        return mesh;
    }
    /**
	 * Build a mesh from a Mesh spec.
	 */ _buildMesh(path, spec) {
        const attrs = this._getAttributes(path);
        // Check for skinning data
        const jointIndices = attrs['primvars:skel:jointIndices'];
        const jointWeights = attrs['primvars:skel:jointWeights'];
        const hasSkinning = jointIndices && jointWeights && jointIndices.length > 0 && jointWeights.length > 0;
        // Collect GeomSubsets for multi-material support
        const geomSubsets = this._getGeomSubsets(path);
        let geometry, material;
        if (geomSubsets.length > 0) {
            geometry = this._buildGeometryWithSubsets(attrs, geomSubsets, hasSkinning);
            const meshMaterialPath = this._getMaterialPath(path, spec.fields);
            material = geomSubsets.map((subset)=>{
                const matPath = subset.materialPath || meshMaterialPath;
                return this._buildMaterialForPath(matPath);
            });
        } else {
            geometry = this._buildGeometry(path, attrs, hasSkinning);
            material = this._buildMaterial(path, spec.fields);
        }
        const displayColor = attrs['primvars:displayColor'];
        if (displayColor && displayColor.length >= 3) {
            const applyDisplayColor = (mat)=>{
                if (mat.color && mat.color.r === 1 && mat.color.g === 1 && mat.color.b === 1 && !mat.map) mat.color.setRGB(displayColor[0], displayColor[1], displayColor[2], (0, _three.SRGBColorSpace));
            };
            if (Array.isArray(material)) material.forEach(applyDisplayColor);
            else applyDisplayColor(material);
        }
        const displayOpacity = attrs['primvars:displayOpacity'];
        if (displayOpacity && displayOpacity.length === 1 && geomSubsets.length === 0) {
            const opacity = displayOpacity[0];
            const applyDisplayOpacity = (mat)=>{
                if (opacity < 1 && mat.opacity === 1 && mat.transparent === false) {
                    mat.opacity = opacity;
                    mat.transparent = true;
                }
            };
            if (Array.isArray(material)) material.forEach(applyDisplayOpacity);
            else applyDisplayOpacity(material);
        }
        let mesh;
        if (hasSkinning) {
            mesh = new (0, _three.SkinnedMesh)(geometry, material);
            // Find skeleton path from skel:skeleton relationship
            let skelBindingSpec = this.specsByPath[path + '.skel:skeleton'];
            if (!skelBindingSpec) skelBindingSpec = this.specsByPath[path + '.rel skel:skeleton'];
            let skeletonPath = null;
            if (skelBindingSpec) {
                if (skelBindingSpec.fields.targetPaths && skelBindingSpec.fields.targetPaths.length > 0) skeletonPath = skelBindingSpec.fields.targetPaths[0];
                else if (skelBindingSpec.fields.default) skeletonPath = skelBindingSpec.fields.default.replace(/<|>/g, '');
            }
            // Get per-mesh joint mapping
            const localJoints = attrs['skel:joints'];
            // Get geomBindTransform if present
            const geomBindTransform = attrs['primvars:skel:geomBindTransform'];
            this.skinnedMeshes.push({
                mesh,
                skeletonPath,
                path,
                localJoints,
                geomBindTransform
            });
        } else mesh = new (0, _three.Mesh)(geometry, material);
        mesh.name = path.split('/').pop();
        this.applyTransform(mesh, spec.fields, attrs);
        return mesh;
    }
    /**
	 * Build a camera from a Camera spec.
	 */ _buildCamera(path) {
        const attrs = this._getAttributes(path);
        const projectionToken = attrs['projection'];
        const projection = typeof projectionToken === 'string' ? projectionToken.toLowerCase() : USD_CAMERA_DEFAULTS.projection;
        const clippingRange = attrs['clippingRange'] || USD_CAMERA_DEFAULTS.clippingRange;
        const near = Math.max(Number.EPSILON, this._parseNumber(clippingRange[0], USD_CAMERA_DEFAULTS.clippingRange[0]));
        const far = Math.max(near + Number.EPSILON, this._parseNumber(clippingRange[1], USD_CAMERA_DEFAULTS.clippingRange[1]));
        const horizontalAperture = this._parseNumber(attrs['horizontalAperture'], USD_CAMERA_DEFAULTS.horizontalAperture);
        const verticalAperture = this._parseNumber(attrs['verticalAperture'], USD_CAMERA_DEFAULTS.verticalAperture);
        const horizontalApertureOffset = this._parseNumber(attrs['horizontalApertureOffset'], USD_CAMERA_DEFAULTS.horizontalApertureOffset);
        const verticalApertureOffset = this._parseNumber(attrs['verticalApertureOffset'], USD_CAMERA_DEFAULTS.verticalApertureOffset);
        const focalLength = this._parseNumber(attrs['focalLength'], USD_CAMERA_DEFAULTS.focalLength);
        const focusDistance = this._parseNumber(attrs['focusDistance'], USD_CAMERA_DEFAULTS.focusDistance);
        const fStop = this._parseNumber(attrs['fStop'], USD_CAMERA_DEFAULTS.fStop);
        let camera;
        if (projection === 'orthographic') {
            // USD orthographic apertures are in tenths of a world unit.
            const width = horizontalAperture / 10;
            const height = verticalAperture / 10;
            const offsetX = horizontalApertureOffset / 10;
            const offsetY = verticalApertureOffset / 10;
            camera = new (0, _three.OrthographicCamera)(offsetX - width * 0.5, offsetX + width * 0.5, offsetY + height * 0.5, offsetY - height * 0.5, near, far);
        } else {
            const safeVerticalAperture = Math.max(Number.EPSILON, verticalAperture);
            const safeFocalLength = Math.max(Number.EPSILON, focalLength);
            const aspect = horizontalAperture / safeVerticalAperture;
            const fov = 2 * Math.atan(safeVerticalAperture / (2 * safeFocalLength)) * 180 / Math.PI;
            camera = new (0, _three.PerspectiveCamera)(fov, aspect, near, far);
            camera.filmGauge = Math.max(horizontalAperture, verticalAperture);
            camera.filmOffset = horizontalApertureOffset;
            camera.focus = focusDistance;
            camera.setFocalLength(safeFocalLength);
            if (verticalApertureOffset !== 0) // Three.js supports only horizontal film offset directly.
            camera.userData.verticalApertureOffset = verticalApertureOffset;
        }
        camera.userData.fStop = fStop;
        camera.userData.usdProjection = projection;
        return camera;
    }
    /**
	 * Build a light from a UsdLux light spec.
	 */ _buildLight(path, typeName) {
        const attrs = this._getAttributes(path);
        const intensity = this._parseNumber(attrs['inputs:intensity'], 1);
        const baseColor = attrs['inputs:color'] || [
            1,
            1,
            1
        ];
        const enableColorTemperature = attrs['inputs:enableColorTemperature'] === true;
        const colorTemperature = this._parseNumber(attrs['inputs:colorTemperature'], 6500);
        const color = new (0, _three.Color)(baseColor[0], baseColor[1], baseColor[2]);
        if (enableColorTemperature) {
            const temp = this._colorTemperature(colorTemperature);
            color.multiply(temp);
        }
        let light;
        switch(typeName){
            case 'DistantLight':
                light = new (0, _three.DirectionalLight)(color, intensity);
                break;
            case 'SphereLight':
                {
                    const coneAngle = this._parseNumber(attrs['shaping:cone:angle'], 0);
                    if (coneAngle > 0) {
                        const angle = coneAngle * Math.PI / 180;
                        const softness = this._parseNumber(attrs['shaping:cone:softness'], 0);
                        light = new (0, _three.SpotLight)(color, intensity, 0, angle, softness);
                    } else light = new (0, _three.PointLight)(color, intensity);
                    break;
                }
            case 'RectLight':
                {
                    const width = this._parseNumber(attrs['inputs:width'], 1);
                    const height = this._parseNumber(attrs['inputs:height'], 1);
                    light = new (0, _three.RectAreaLight)(color, intensity, width, height);
                    break;
                }
            case 'DiskLight':
                {
                    const radius = this._parseNumber(attrs['inputs:radius'], 0.5);
                    const side = radius * 2;
                    light = new (0, _three.RectAreaLight)(color, intensity, side, side);
                    break;
                }
        }
        return light;
    }
    /**
	 * Convert a color temperature in Kelvin to an RGB Color.
	 * Based on Tanner Helland's algorithm.
	 */ _colorTemperature(kelvin) {
        const temp = kelvin / 100;
        let r, g, b;
        if (temp <= 66) {
            r = 1;
            g = 0.39008157876901960784 * Math.log(temp) - 0.63184144378862745098;
        } else {
            r = 1.29293618606274509804 * Math.pow(temp - 60, -0.1332047592);
            g = 1.12989086089529411765 * Math.pow(temp - 60, -0.0755148492);
        }
        if (temp >= 66) b = 1;
        else if (temp <= 19) b = 0;
        else b = 0.54320678911019607843 * Math.log(temp - 10) - 1.19625408914;
        return new (0, _three.Color)(Math.min(Math.max(r, 0), 1), Math.min(Math.max(g, 0), 1), Math.min(Math.max(b, 0), 1));
    }
    _parseNumber(value, fallback) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }
    _getGeomSubsets(meshPath) {
        const subsets = [];
        const subsetPaths = this.geomSubsetsByMeshPath.get(meshPath);
        if (!subsetPaths) return subsets;
        for (const p of subsetPaths){
            const attrs = this._getAttributes(p);
            const indices = attrs['indices'];
            if (!indices || indices.length === 0) continue;
            // Get material binding - check direct path and variant paths
            const materialPath = this._getMaterialBindingTarget(p);
            subsets.push({
                name: p.split('/').pop(),
                indices: indices,
                materialPath: materialPath
            });
        }
        return subsets;
    }
    /**
	 * Get material binding target path, checking variant paths if needed.
	 */ _getMaterialBindingTarget(primPath) {
        const attrName = 'material:binding';
        // First check direct path
        const directPath = primPath + '.' + attrName;
        const directSpec = this.specsByPath[directPath];
        if (directSpec?.fields?.targetPaths?.length > 0) return directSpec.fields.targetPaths[0];
        // Check variant paths at ancestor levels
        const parts = primPath.split('/');
        for(let i = 1; i < parts.length; i++){
            const ancestorPath = parts.slice(0, i + 1).join('/');
            const relativePath = parts.slice(i + 1).join('/');
            const variantPaths = this._getVariantPaths(ancestorPath);
            for (const vp of variantPaths){
                const overridePath = relativePath ? vp + '/' + relativePath + '.' + attrName : vp + '.' + attrName;
                const overrideSpec = this.specsByPath[overridePath];
                if (overrideSpec?.fields?.targetPaths?.length > 0) return overrideSpec.fields.targetPaths[0];
            }
        }
        return null;
    }
    _buildGeometry(path, fields, hasSkinning = false) {
        const geometry = new (0, _three.BufferGeometry)();
        const points = fields['points'];
        if (!points || points.length === 0) return geometry;
        const faceVertexIndices = fields['faceVertexIndices'];
        const faceVertexCounts = fields['faceVertexCounts'];
        // Parse polygon holes (Arnold format: [holeFaceIdx, parentFaceIdx, ...])
        const polygonHoles = fields['primvars:arnold:polygon_holes'];
        const holeMap = this._buildHoleMap(polygonHoles);
        // Compute triangulation pattern once using actual vertex positions
        // This pattern will be reused for normals, UVs, etc.
        let indices = faceVertexIndices;
        let triPattern = null;
        if (faceVertexCounts && faceVertexCounts.length > 0) {
            const result = this._triangulateIndicesWithPattern(faceVertexIndices, faceVertexCounts, points, holeMap);
            indices = result.indices;
            triPattern = result.pattern;
        }
        let positions = points;
        if (indices && indices.length > 0) positions = this._expandAttribute(points, indices, 3);
        geometry.setAttribute('position', new (0, _three.BufferAttribute)(new Float32Array(positions), 3));
        const normals = fields['normals'] || fields['primvars:normals'];
        const normalIndicesRaw = fields['normals:indices'] || fields['primvars:normals:indices'];
        if (normals && normals.length > 0) {
            let normalData = normals;
            if (normalIndicesRaw && normalIndicesRaw.length > 0 && triPattern) {
                // Indexed normals - apply triangulation pattern to indices
                const triangulatedNormalIndices = this._applyTriangulationPattern(normalIndicesRaw, triPattern);
                normalData = this._expandAttribute(normals, triangulatedNormalIndices, 3);
            } else if (normals.length === points.length) // Per-vertex normals
            {
                if (indices && indices.length > 0) normalData = this._expandAttribute(normals, indices, 3);
            } else if (triPattern) {
                // Per-face-vertex normals (no separate indices) - use same triangulation pattern
                const normalIndices = this._applyTriangulationPattern(Array.from({
                    length: normals.length / 3
                }, (_, i)=>i), triPattern);
                normalData = this._expandAttribute(normals, normalIndices, 3);
            }
            geometry.setAttribute('normal', new (0, _three.BufferAttribute)(new Float32Array(normalData), 3));
        } else {
            // Compute vertex normals from the original indexed topology where
            // vertices are shared, then expand them like positions.
            const vertexNormals = this._computeVertexNormals(points, indices);
            geometry.setAttribute('normal', new (0, _three.BufferAttribute)(new Float32Array(this._expandAttribute(vertexNormals, indices, 3)), 3));
        }
        const { uvs, uvIndices } = this._findUVPrimvar(fields);
        const numFaceVertices = faceVertexIndices ? faceVertexIndices.length : 0;
        if (uvs && uvs.length > 0) {
            let uvData = uvs;
            if (uvIndices && uvIndices.length > 0 && triPattern) {
                const triangulatedUvIndices = this._applyTriangulationPattern(uvIndices, triPattern);
                uvData = this._expandAttribute(uvs, triangulatedUvIndices, 2);
            } else if (indices && uvs.length / 2 === points.length / 3) uvData = this._expandAttribute(uvs, indices, 2);
            else if (triPattern && uvs.length / 2 === numFaceVertices) {
                // Per-face-vertex UVs (faceVarying, no separate indices)
                const uvIndicesFromPattern = this._applyTriangulationPattern(Array.from({
                    length: numFaceVertices
                }, (_, i)=>i), triPattern);
                uvData = this._expandAttribute(uvs, uvIndicesFromPattern, 2);
            }
            geometry.setAttribute('uv', new (0, _three.BufferAttribute)(new Float32Array(uvData), 2));
        }
        // Second UV set (st1) for lightmaps/AO
        const { uvs2, uv2Indices } = this._findUV2Primvar(fields);
        if (uvs2 && uvs2.length > 0) {
            let uv2Data = uvs2;
            if (uv2Indices && uv2Indices.length > 0 && triPattern) {
                const triangulatedUv2Indices = this._applyTriangulationPattern(uv2Indices, triPattern);
                uv2Data = this._expandAttribute(uvs2, triangulatedUv2Indices, 2);
            } else if (indices && uvs2.length / 2 === points.length / 3) uv2Data = this._expandAttribute(uvs2, indices, 2);
            else if (triPattern && uvs2.length / 2 === numFaceVertices) {
                // Per-face-vertex UV2 (faceVarying, no separate indices)
                const uv2IndicesFromPattern = this._applyTriangulationPattern(Array.from({
                    length: numFaceVertices
                }, (_, i)=>i), triPattern);
                uv2Data = this._expandAttribute(uvs2, uv2IndicesFromPattern, 2);
            }
            geometry.setAttribute('uv1', new (0, _three.BufferAttribute)(new Float32Array(uv2Data), 2));
        }
        // Add skinning attributes
        if (hasSkinning) {
            const jointIndices = fields['primvars:skel:jointIndices'];
            const jointWeights = fields['primvars:skel:jointWeights'];
            const elementSize = fields['primvars:skel:jointIndices:elementSize'] || 4;
            if (jointIndices && jointWeights) {
                const numVertices = positions.length / 3;
                let skinIndexData, skinWeightData;
                if (indices && indices.length > 0) {
                    skinIndexData = this._expandAttribute(jointIndices, indices, elementSize);
                    skinWeightData = this._expandAttribute(jointWeights, indices, elementSize);
                } else {
                    skinIndexData = jointIndices;
                    skinWeightData = jointWeights;
                }
                const skinIndices = new Uint16Array(numVertices * 4);
                const skinWeights = new Float32Array(numVertices * 4);
                this._selectTopWeights(skinIndexData, skinWeightData, elementSize, numVertices, skinIndices, skinWeights);
                geometry.setAttribute('skinIndex', new (0, _three.BufferAttribute)(skinIndices, 4));
                geometry.setAttribute('skinWeight', new (0, _three.BufferAttribute)(skinWeights, 4));
            }
        }
        return geometry;
    }
    _buildGeometryWithSubsets(fields, geomSubsets, hasSkinning = false) {
        const geometry = new (0, _three.BufferGeometry)();
        const points = fields['points'];
        if (!points || points.length === 0) return geometry;
        const faceVertexIndices = fields['faceVertexIndices'];
        const faceVertexCounts = fields['faceVertexCounts'];
        if (!faceVertexCounts || faceVertexCounts.length === 0) return geometry;
        const polygonHoles = fields['primvars:arnold:polygon_holes'];
        const holeMap = this._buildHoleMap(polygonHoles);
        const holeFaces = holeMap.holeFaces;
        const parentToHoles = holeMap.parentToHoles;
        const { uvs, uvIndices } = this._findUVPrimvar(fields);
        const { uvs2, uv2Indices } = this._findUV2Primvar(fields);
        const normals = fields['normals'] || fields['primvars:normals'];
        const normalIndicesRaw = fields['normals:indices'] || fields['primvars:normals:indices'];
        const jointIndices = hasSkinning ? fields['primvars:skel:jointIndices'] : null;
        const jointWeights = hasSkinning ? fields['primvars:skel:jointWeights'] : null;
        const elementSize = fields['primvars:skel:jointIndices:elementSize'] || 4;
        // Build face-to-triangle mapping (accounting for holes)
        const faceTriangleOffset = [];
        let triangleCount = 0;
        for(let i = 0; i < faceVertexCounts.length; i++){
            faceTriangleOffset.push(triangleCount);
            // Skip hole faces - they're triangulated with their parent
            if (holeFaces.has(i)) continue;
            const count = faceVertexCounts[i];
            const holes = parentToHoles.get(i);
            if (holes && holes.length > 0) {
                // For faces with holes, count triangles based on total vertices
                // Earcut produces (total_vertices - 2) triangles for any polygon including holes
                let totalVerts = count;
                for (const holeIdx of holes)totalVerts += faceVertexCounts[holeIdx];
                triangleCount += totalVerts - 2;
            } else if (count >= 3) triangleCount += count - 2;
        }
        const triangleToSubset = new Int32Array(triangleCount).fill(-1);
        for(let si = 0; si < geomSubsets.length; si++){
            const subset = geomSubsets[si];
            for(let i = 0; i < subset.indices.length; i++){
                const faceIdx = subset.indices[i];
                if (faceIdx >= faceVertexCounts.length) continue;
                const triStart = faceTriangleOffset[faceIdx];
                const triCount = faceVertexCounts[faceIdx] - 2;
                for(let t = 0; t < triCount; t++)triangleToSubset[triStart + t] = si;
            }
        }
        // Sort triangles by subset
        const sortedTriangles = [];
        for(let tri = 0; tri < triangleCount; tri++)sortedTriangles.push({
            original: tri,
            subset: triangleToSubset[tri]
        });
        sortedTriangles.sort((a, b)=>a.subset - b.subset);
        const groups = [];
        let currentSubset = sortedTriangles.length > 0 ? sortedTriangles[0].subset : -1;
        let groupStart = 0;
        for(let i = 0; i < sortedTriangles.length; i++)if (sortedTriangles[i].subset !== currentSubset) {
            if (currentSubset >= 0) groups.push({
                start: groupStart * 3,
                count: (i - groupStart) * 3,
                materialIndex: currentSubset
            });
            currentSubset = sortedTriangles[i].subset;
            groupStart = i;
        }
        if (currentSubset >= 0 && sortedTriangles.length > groupStart) groups.push({
            start: groupStart * 3,
            count: (sortedTriangles.length - groupStart) * 3,
            materialIndex: currentSubset
        });
        for (const group of groups)geometry.addGroup(group.start, group.count, group.materialIndex);
        // Triangulate original data using consistent pattern
        const { indices: origIndices, pattern: triPattern } = this._triangulateIndicesWithPattern(faceVertexIndices, faceVertexCounts, points, holeMap);
        const numFaceVertices = faceVertexCounts.reduce((a, b)=>a + b, 0);
        const faceVaryingIdentity = uvs && !uvIndices && uvs.length / 2 === numFaceVertices || uvs2 && !uv2Indices && uvs2.length / 2 === numFaceVertices ? this._applyTriangulationPattern(Array.from({
            length: numFaceVertices
        }, (_, i)=>i), triPattern) : null;
        const origUvIndices = uvIndices ? this._applyTriangulationPattern(uvIndices, triPattern) : uvs && uvs.length / 2 === numFaceVertices ? faceVaryingIdentity : null;
        const origUv2Indices = uv2Indices ? this._applyTriangulationPattern(uv2Indices, triPattern) : uvs2 && uvs2.length / 2 === numFaceVertices ? faceVaryingIdentity : null;
        const hasIndexedNormals = normals && normalIndicesRaw && normalIndicesRaw.length > 0;
        const hasFaceVaryingNormals = normals && normals.length / 3 === numFaceVertices;
        const origNormalIndices = hasIndexedNormals ? this._applyTriangulationPattern(normalIndicesRaw, triPattern) : hasFaceVaryingNormals ? this._applyTriangulationPattern(Array.from({
            length: numFaceVertices
        }, (_, i)=>i), triPattern) : null;
        // When no normals are provided, compute vertex normals from
        // the indexed topology so that shared vertices produce averaged normals.
        const vertexNormals = !normals && origIndices.length > 0 ? this._computeVertexNormals(points, origIndices) : null;
        // Build reordered vertex data
        const vertexCount = triangleCount * 3;
        const positions = new Float32Array(vertexCount * 3);
        const uvData = uvs ? new Float32Array(vertexCount * 2) : null;
        const uv1Data = uvs2 ? new Float32Array(vertexCount * 2) : null;
        const normalData = normals || vertexNormals ? new Float32Array(vertexCount * 3) : null;
        const skinSrcIndices = jointIndices ? new Uint16Array(vertexCount * elementSize) : null;
        const skinSrcWeights = jointWeights ? new Float32Array(vertexCount * elementSize) : null;
        for(let i = 0; i < sortedTriangles.length; i++){
            const origTri = sortedTriangles[i].original;
            for(let v = 0; v < 3; v++){
                const origIdx = origTri * 3 + v;
                const newIdx = i * 3 + v;
                const pointIdx = origIndices[origIdx];
                positions[newIdx * 3] = points[pointIdx * 3];
                positions[newIdx * 3 + 1] = points[pointIdx * 3 + 1];
                positions[newIdx * 3 + 2] = points[pointIdx * 3 + 2];
                if (uvData && uvs) {
                    if (origUvIndices) {
                        const uvIdx = origUvIndices[origIdx];
                        uvData[newIdx * 2] = uvs[uvIdx * 2];
                        uvData[newIdx * 2 + 1] = uvs[uvIdx * 2 + 1];
                    } else if (uvs.length / 2 === points.length / 3) {
                        uvData[newIdx * 2] = uvs[pointIdx * 2];
                        uvData[newIdx * 2 + 1] = uvs[pointIdx * 2 + 1];
                    }
                }
                if (uv1Data && uvs2) {
                    if (origUv2Indices) {
                        const uv2Idx = origUv2Indices[origIdx];
                        uv1Data[newIdx * 2] = uvs2[uv2Idx * 2];
                        uv1Data[newIdx * 2 + 1] = uvs2[uv2Idx * 2 + 1];
                    } else if (uvs2.length / 2 === points.length / 3) {
                        uv1Data[newIdx * 2] = uvs2[pointIdx * 2];
                        uv1Data[newIdx * 2 + 1] = uvs2[pointIdx * 2 + 1];
                    }
                }
                if (normalData) {
                    if (normals && origNormalIndices) {
                        const normalIdx = origNormalIndices[origIdx];
                        normalData[newIdx * 3] = normals[normalIdx * 3];
                        normalData[newIdx * 3 + 1] = normals[normalIdx * 3 + 1];
                        normalData[newIdx * 3 + 2] = normals[normalIdx * 3 + 2];
                    } else if (normals && normals.length === points.length) {
                        normalData[newIdx * 3] = normals[pointIdx * 3];
                        normalData[newIdx * 3 + 1] = normals[pointIdx * 3 + 1];
                        normalData[newIdx * 3 + 2] = normals[pointIdx * 3 + 2];
                    } else if (vertexNormals) {
                        normalData[newIdx * 3] = vertexNormals[pointIdx * 3];
                        normalData[newIdx * 3 + 1] = vertexNormals[pointIdx * 3 + 1];
                        normalData[newIdx * 3 + 2] = vertexNormals[pointIdx * 3 + 2];
                    }
                }
                if (skinSrcIndices && skinSrcWeights && jointIndices && jointWeights) for(let j = 0; j < elementSize; j++){
                    skinSrcIndices[newIdx * elementSize + j] = jointIndices[pointIdx * elementSize + j] || 0;
                    skinSrcWeights[newIdx * elementSize + j] = jointWeights[pointIdx * elementSize + j] || 0;
                }
            }
        }
        geometry.setAttribute('position', new (0, _three.BufferAttribute)(positions, 3));
        if (uvData) geometry.setAttribute('uv', new (0, _three.BufferAttribute)(uvData, 2));
        if (uv1Data) geometry.setAttribute('uv1', new (0, _three.BufferAttribute)(uv1Data, 2));
        geometry.setAttribute('normal', new (0, _three.BufferAttribute)(normalData, 3));
        if (skinSrcIndices && skinSrcWeights) {
            const skinIndexData = new Uint16Array(vertexCount * 4);
            const skinWeightData = new Float32Array(vertexCount * 4);
            this._selectTopWeights(skinSrcIndices, skinSrcWeights, elementSize, vertexCount, skinIndexData, skinWeightData);
            geometry.setAttribute('skinIndex', new (0, _three.BufferAttribute)(skinIndexData, 4));
            geometry.setAttribute('skinWeight', new (0, _three.BufferAttribute)(skinWeightData, 4));
        }
        return geometry;
    }
    _selectTopWeights(srcIndices, srcWeights, elementSize, numVertices, dstIndices, dstWeights) {
        if (elementSize <= 4) {
            for(let i = 0; i < numVertices; i++){
                for(let j = 0; j < 4; j++)if (j < elementSize) {
                    dstIndices[i * 4 + j] = srcIndices[i * elementSize + j] || 0;
                    dstWeights[i * 4 + j] = srcWeights[i * elementSize + j] || 0;
                } else {
                    dstIndices[i * 4 + j] = 0;
                    dstWeights[i * 4 + j] = 0;
                }
            }
            return;
        }
        // When elementSize > 4, find the 4 largest weights per vertex
        // using a partial selection sort (4 iterations of O(elementSize)).
        const order = new Uint32Array(elementSize);
        for(let i = 0; i < numVertices; i++){
            const base = i * elementSize;
            for(let j = 0; j < elementSize; j++)order[j] = j;
            for(let k = 0; k < 4; k++){
                let maxIdx = k;
                let maxW = srcWeights[base + order[k]] || 0;
                for(let j = k + 1; j < elementSize; j++){
                    const w = srcWeights[base + order[j]] || 0;
                    if (w > maxW) {
                        maxW = w;
                        maxIdx = j;
                    }
                }
                if (maxIdx !== k) {
                    const tmp = order[k];
                    order[k] = order[maxIdx];
                    order[maxIdx] = tmp;
                }
            }
            let total = 0;
            for(let j = 0; j < 4; j++)total += srcWeights[base + order[j]] || 0;
            for(let j = 0; j < 4; j++){
                const s = order[j];
                if (total > 0) {
                    dstIndices[i * 4 + j] = srcIndices[base + s] || 0;
                    dstWeights[i * 4 + j] = (srcWeights[base + s] || 0) / total;
                } else {
                    dstIndices[i * 4 + j] = 0;
                    dstWeights[i * 4 + j] = 0;
                }
            }
        }
    }
    _findUVPrimvar(fields) {
        for(const key in fields){
            if (!key.startsWith('primvars:')) continue;
            if (key.endsWith(':typeName') || key.endsWith(':elementSize') || key.endsWith(':indices')) continue;
            if (key.includes('skel:')) continue;
            const typeName = fields[key + ':typeName'];
            if (typeName && typeName.includes('texCoord')) return {
                uvs: fields[key],
                uvIndices: fields[key + ':indices']
            };
        }
        const uvs = fields['primvars:st'] || fields['primvars:UVMap'];
        const uvIndices = fields['primvars:st:indices'];
        return {
            uvs,
            uvIndices
        };
    }
    _findUV2Primvar(fields) {
        const uvs2 = fields['primvars:st1'];
        const uv2Indices = fields['primvars:st1:indices'];
        return {
            uvs2,
            uv2Indices
        };
    }
    _buildHoleMap(polygonHoles) {
        // polygonHoles is in Arnold format: [holeFaceIdx, parentFaceIdx, holeFaceIdx, parentFaceIdx, ...]
        // Returns a map: parentFaceIdx -> [holeFaceIdx1, holeFaceIdx2, ...]
        // Also returns a set of hole face indices to skip during triangulation
        if (!polygonHoles || polygonHoles.length === 0) return {
            parentToHoles: new Map(),
            holeFaces: new Set()
        };
        const parentToHoles = new Map();
        const holeFaces = new Set();
        for(let i = 0; i < polygonHoles.length; i += 2){
            const holeFaceIdx = polygonHoles[i];
            const parentFaceIdx = polygonHoles[i + 1];
            holeFaces.add(holeFaceIdx);
            if (!parentToHoles.has(parentFaceIdx)) parentToHoles.set(parentFaceIdx, []);
            parentToHoles.get(parentFaceIdx).push(holeFaceIdx);
        }
        return {
            parentToHoles,
            holeFaces
        };
    }
    _triangulateIndicesWithPattern(indices, counts, points = null, holeMap = null) {
        const triangulated = [];
        const pattern = []; // Stores face-local indices for each triangle vertex
        // Build face offset lookup for accessing hole face data
        const faceOffsets = [];
        let offsetAccum = 0;
        for(let i = 0; i < counts.length; i++){
            faceOffsets.push(offsetAccum);
            offsetAccum += counts[i];
        }
        const parentToHoles = holeMap?.parentToHoles || new Map();
        const holeFaces = holeMap?.holeFaces || new Set();
        let offset = 0;
        for(let i = 0; i < counts.length; i++){
            const count = counts[i];
            // Skip faces that are holes - they will be triangulated with their parent
            if (holeFaces.has(i)) {
                offset += count;
                continue;
            }
            // Check if this face has holes
            const holes = parentToHoles.get(i);
            if (holes && holes.length > 0 && points && points.length > 0) {
                // Triangulate face with holes using vertex -> face-vertex mapping
                const vertexToFaceVertex = new Map();
                const faceIndices = [];
                for(let j = 0; j < count; j++){
                    const vertIdx = indices[offset + j];
                    faceIndices.push(vertIdx);
                    vertexToFaceVertex.set(vertIdx, offset + j);
                }
                const holeContours = [];
                for (const holeFaceIdx of holes){
                    const holeOffset = faceOffsets[holeFaceIdx];
                    const holeCount = counts[holeFaceIdx];
                    const holeIndices = [];
                    for(let j = 0; j < holeCount; j++){
                        const vertIdx = indices[holeOffset + j];
                        holeIndices.push(vertIdx);
                        vertexToFaceVertex.set(vertIdx, holeOffset + j);
                    }
                    holeContours.push(holeIndices);
                }
                const triangles = this._triangulateNGonWithHoles(faceIndices, holeContours, points);
                for (const tri of triangles){
                    triangulated.push(tri[0], tri[1], tri[2]);
                    pattern.push(vertexToFaceVertex.get(tri[0]), vertexToFaceVertex.get(tri[1]), vertexToFaceVertex.get(tri[2]));
                }
            } else if (count === 3) {
                triangulated.push(indices[offset], indices[offset + 1], indices[offset + 2]);
                pattern.push(offset, offset + 1, offset + 2);
            } else if (count === 4) {
                triangulated.push(indices[offset], indices[offset + 1], indices[offset + 2], indices[offset], indices[offset + 2], indices[offset + 3]);
                pattern.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
            } else if (count > 4) {
                // Use ear-clipping for complex n-gons if we have vertex positions
                if (points && points.length > 0) {
                    const faceIndices = [];
                    for(let j = 0; j < count; j++)faceIndices.push(indices[offset + j]);
                    const triangles = this._triangulateNGon(faceIndices, points);
                    for (const tri of triangles){
                        triangulated.push(tri[0], tri[1], tri[2]);
                        // Find local indices within the face
                        pattern.push(offset + faceIndices.indexOf(tri[0]), offset + faceIndices.indexOf(tri[1]), offset + faceIndices.indexOf(tri[2]));
                    }
                } else // Fallback to fan triangulation
                for(let j = 1; j < count - 1; j++){
                    triangulated.push(indices[offset], indices[offset + j], indices[offset + j + 1]);
                    pattern.push(offset, offset + j, offset + j + 1);
                }
            }
            offset += count;
        }
        return {
            indices: triangulated,
            pattern
        };
    }
    _applyTriangulationPattern(indices, pattern) {
        const result = [];
        for(let i = 0; i < pattern.length; i++)result.push(indices[pattern[i]]);
        return result;
    }
    _triangulateNGon(faceIndices, points) {
        // Project 3D polygon to 2D for triangulation using Newell's method for normal
        const contour2D = [];
        const contour3D = [];
        for (const idx of faceIndices)contour3D.push(new (0, _three.Vector3)(points[idx * 3], points[idx * 3 + 1], points[idx * 3 + 2]));
        // Calculate polygon normal using Newell's method
        const normal = new (0, _three.Vector3)();
        for(let i = 0; i < contour3D.length; i++){
            const curr = contour3D[i];
            const next = contour3D[(i + 1) % contour3D.length];
            normal.x += (curr.y - next.y) * (curr.z + next.z);
            normal.y += (curr.z - next.z) * (curr.x + next.x);
            normal.z += (curr.x - next.x) * (curr.y + next.y);
        }
        normal.normalize();
        // Create tangent basis for projection
        const tangent = new (0, _three.Vector3)();
        const bitangent = new (0, _three.Vector3)();
        if (Math.abs(normal.y) > 0.9) tangent.set(1, 0, 0);
        else tangent.set(0, 1, 0);
        bitangent.crossVectors(normal, tangent).normalize();
        tangent.crossVectors(bitangent, normal).normalize();
        // Project to 2D
        for (const p of contour3D)contour2D.push(new (0, _three.Vector2)(p.dot(tangent), p.dot(bitangent)));
        // Triangulate using ShapeUtils
        const triangles = (0, _three.ShapeUtils).triangulateShape(contour2D, []);
        // Map back to original indices
        const result = [];
        for (const tri of triangles)result.push([
            faceIndices[tri[0]],
            faceIndices[tri[1]],
            faceIndices[tri[2]]
        ]);
        return result;
    }
    _triangulateNGonWithHoles(outerIndices, holeContours, points) {
        // Project 3D polygon with holes to 2D for triangulation
        const outer3D = [];
        for (const idx of outerIndices)outer3D.push(new (0, _three.Vector3)(points[idx * 3], points[idx * 3 + 1], points[idx * 3 + 2]));
        // Calculate polygon normal using Newell's method
        const normal = new (0, _three.Vector3)();
        for(let i = 0; i < outer3D.length; i++){
            const curr = outer3D[i];
            const next = outer3D[(i + 1) % outer3D.length];
            normal.x += (curr.y - next.y) * (curr.z + next.z);
            normal.y += (curr.z - next.z) * (curr.x + next.x);
            normal.z += (curr.x - next.x) * (curr.y + next.y);
        }
        normal.normalize();
        // Create tangent basis for projection
        const tangent = new (0, _three.Vector3)();
        const bitangent = new (0, _three.Vector3)();
        if (Math.abs(normal.y) > 0.9) tangent.set(1, 0, 0);
        else tangent.set(0, 1, 0);
        bitangent.crossVectors(normal, tangent).normalize();
        tangent.crossVectors(bitangent, normal).normalize();
        // Project outer contour to 2D
        const outer2D = [];
        for (const p of outer3D)outer2D.push(new (0, _three.Vector2)(p.dot(tangent), p.dot(bitangent)));
        // Project hole contours to 2D
        const holes2D = [];
        for (const holeIndices of holeContours){
            const hole2D = [];
            for (const idx of holeIndices){
                const p = new (0, _three.Vector3)(points[idx * 3], points[idx * 3 + 1], points[idx * 3 + 2]);
                hole2D.push(new (0, _three.Vector2)(p.dot(tangent), p.dot(bitangent)));
            }
            holes2D.push(hole2D);
        }
        // Build combined index array: outer contour followed by all holes
        const allIndices = [
            ...outerIndices
        ];
        for (const holeIndices of holeContours)allIndices.push(...holeIndices);
        // Triangulate using ShapeUtils with holes
        const triangles = (0, _three.ShapeUtils).triangulateShape(outer2D, holes2D);
        // Map back to original vertex indices
        const result = [];
        for (const tri of triangles)result.push([
            allIndices[tri[0]],
            allIndices[tri[1]],
            allIndices[tri[2]]
        ]);
        return result;
    }
    _triangulateIndices(indices, counts) {
        const triangulated = [];
        let offset = 0;
        for(let i = 0; i < counts.length; i++){
            const count = counts[i];
            if (count === 3) triangulated.push(indices[offset], indices[offset + 1], indices[offset + 2]);
            else if (count === 4) triangulated.push(indices[offset], indices[offset + 1], indices[offset + 2], indices[offset], indices[offset + 2], indices[offset + 3]);
            else if (count > 4) // Fan triangulation for n-gons
            for(let j = 1; j < count - 1; j++)triangulated.push(indices[offset], indices[offset + j], indices[offset + j + 1]);
            offset += count;
        }
        return triangulated;
    }
    _expandAttribute(data, indices, itemSize) {
        const expanded = new Array(indices.length * itemSize);
        for(let i = 0; i < indices.length; i++){
            const srcIdx = indices[i];
            for(let j = 0; j < itemSize; j++)expanded[i * itemSize + j] = data[srcIdx * itemSize + j];
        }
        return expanded;
    }
    /**
	 * Compute per-vertex normals from indexed triangle data.
	 * Accumulates area-weighted face normals at each shared vertex and normalizes.
	 */ _computeVertexNormals(points, indices) {
        const numVertices = points.length / 3;
        const normals = new Float32Array(numVertices * 3);
        for(let i = 0; i < indices.length; i += 3){
            const a = indices[i];
            const b = indices[i + 1];
            const c = indices[i + 2];
            const ax = points[a * 3], ay = points[a * 3 + 1], az = points[a * 3 + 2];
            const bx = points[b * 3], by = points[b * 3 + 1], bz = points[b * 3 + 2];
            const cx = points[c * 3], cy = points[c * 3 + 1], cz = points[c * 3 + 2];
            const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
            const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
            const nx = e1y * e2z - e1z * e2y;
            const ny = e1z * e2x - e1x * e2z;
            const nz = e1x * e2y - e1y * e2x;
            normals[a * 3] += nx;
            normals[a * 3 + 1] += ny;
            normals[a * 3 + 2] += nz;
            normals[b * 3] += nx;
            normals[b * 3 + 1] += ny;
            normals[b * 3 + 2] += nz;
            normals[c * 3] += nx;
            normals[c * 3 + 1] += ny;
            normals[c * 3 + 2] += nz;
        }
        for(let i = 0; i < numVertices; i++){
            const x = normals[i * 3], y = normals[i * 3 + 1], z = normals[i * 3 + 2];
            const len = Math.sqrt(x * x + y * y + z * z);
            if (len > 0) {
                normals[i * 3] /= len;
                normals[i * 3 + 1] /= len;
                normals[i * 3 + 2] /= len;
            }
        }
        return normals;
    }
    /**
	 * Get the material path for a mesh, checking various binding sources.
	 */ _getMaterialPath(meshPath, fields) {
        let materialPath = null;
        const materialBinding = fields['material:binding'];
        if (materialBinding) materialPath = Array.isArray(materialBinding) ? materialBinding[0] : materialBinding;
        // Use variant-aware lookup if no direct binding in fields
        if (!materialPath) materialPath = this._getMaterialBindingTarget(meshPath);
        return materialPath;
    }
    _buildMaterial(meshPath, fields) {
        const material = new (0, _three.MeshPhysicalMaterial)();
        let materialPath = null;
        const materialBinding = fields['material:binding'];
        if (materialBinding) materialPath = Array.isArray(materialBinding) ? materialBinding[0] : materialBinding;
        // Use variant-aware lookup if no direct binding in fields
        if (!materialPath) materialPath = this._getMaterialBindingTarget(meshPath);
        if (!materialPath) {
            const materialPaths = [];
            const prefix = meshPath + '/';
            for(const path in this.specsByPath){
                if (!path.startsWith(prefix)) continue;
                if (!path.endsWith('.material:binding')) continue;
                const bindingSpec = this.specsByPath[path];
                if (!bindingSpec) continue;
                const targetPaths = bindingSpec.fields.targetPaths;
                if (targetPaths && targetPaths.length > 0) materialPaths.push(targetPaths[0]);
            }
            if (materialPaths.length > 0) materialPath = this._pickBestMaterial(materialPaths);
        }
        if (!materialPath) {
            // Use material index for O(1) lookup instead of O(n) iteration
            const meshParts = meshPath.split('/');
            const rootPath = '/' + meshParts[1];
            const materialsInRoot = this.materialsByRoot.get(rootPath);
            if (materialsInRoot) {
                for (const path of materialsInRoot)if (path.startsWith(rootPath + '/Looks/') || path.startsWith(rootPath + '/Materials/')) {
                    materialPath = path;
                    break;
                }
            }
        }
        if (materialPath) this._applyMaterial(material, materialPath);
        return material;
    }
    _buildMaterialForPath(materialPath) {
        const material = new (0, _three.MeshPhysicalMaterial)();
        if (materialPath) this._applyMaterial(material, materialPath);
        return material;
    }
    /**
	 * Apply material binding from a prim path to a mesh.
	 * Used when merging referenced geometry into a prim that has material binding.
	 */ _applyMaterialBinding(mesh, primPath) {
        // Look for material:binding on this prim
        const bindingPath = primPath + '.material:binding';
        const bindingSpec = this.specsByPath[bindingPath];
        if (!bindingSpec) return;
        let materialPath = null;
        const targetPaths = bindingSpec.fields?.targetPaths || bindingSpec.fields?.default;
        if (targetPaths) materialPath = Array.isArray(targetPaths) ? targetPaths[0] : targetPaths;
        if (!materialPath) return;
        // Clean the material path
        materialPath = String(materialPath).replace(/^<|>$/g, '');
        // Build and apply the material
        const material = new (0, _three.MeshPhysicalMaterial)();
        this._applyMaterial(material, materialPath);
        mesh.material = material;
    }
    _pickBestMaterial(materialPaths) {
        for (const materialPath of materialPaths){
            const shaderPaths = this.shadersByMaterialPath.get(materialPath);
            if (!shaderPaths) continue;
            for (const path of shaderPaths){
                const attrs = this._getAttributes(path);
                if (attrs['info:id'] === 'UsdUVTexture' && attrs['inputs:file']) return materialPath;
            }
        }
        return materialPaths[0];
    }
    _applyMaterial(material, materialPath) {
        const materialSpec = this.specsByPath[materialPath];
        if (!materialSpec) return;
        const shaderPaths = this.shadersByMaterialPath.get(materialPath);
        if (!shaderPaths) return;
        for (const path of shaderPaths){
            const spec = this.specsByPath[path];
            if (!spec) continue;
            const shaderAttrs = this._getAttributes(path);
            const infoId = shaderAttrs['info:id'] || spec.fields['info:id'];
            if (infoId === 'UsdPreviewSurface' || infoId === 'ND_UsdPreviewSurface_surfaceshader') this._applyPreviewSurface(material, path);
            else if (infoId === 'arnold:openpbr_surface') this._applyOpenPBRSurface(material, path);
        }
    }
    /**
	 * Shared helper for applying texture or value from shader attribute.
	 * Reduces duplication between _applyPreviewSurface and _applyOpenPBRSurface.
	 */ _applyTextureOrValue(material, shaderPath, fields, attrName, textureProperty, colorSpace, valueCallback, textureGetter) {
        const attrPath = shaderPath + '.' + attrName;
        const spec = this.specsByPath[attrPath];
        if (spec && spec.fields.connectionPaths && spec.fields.connectionPaths.length > 0) {
            // For OpenPBR, try all connection paths; for PreviewSurface, just the first
            const paths = textureGetter === this._getTextureFromOpenPBRConnection ? spec.fields.connectionPaths : [
                spec.fields.connectionPaths[0]
            ];
            for (const connPath of paths){
                const texture = textureGetter.call(this, connPath);
                if (texture) {
                    texture.colorSpace = colorSpace;
                    material[textureProperty] = texture;
                    return true;
                }
            }
        }
        if (fields[attrName] !== undefined && valueCallback) valueCallback(fields[attrName]);
        return false;
    }
    _applyPreviewSurface(material, shaderPath) {
        const fields = this._getAttributes(shaderPath);
        const applyTexture = (attrName, textureProperty, colorSpace, valueCallback)=>{
            return this._applyTextureOrValue(material, shaderPath, fields, attrName, textureProperty, colorSpace, valueCallback, this._getTextureFromConnection);
        };
        const getAttrSpec = (attrName)=>{
            const attrPath = shaderPath + '.' + attrName;
            return this.specsByPath[attrPath];
        };
        // Diffuse color / base color map
        applyTexture('inputs:diffuseColor', 'map', (0, _three.SRGBColorSpace), (color)=>{
            if (Array.isArray(color) && color.length >= 3) material.color.setRGB(color[0], color[1], color[2], (0, _three.SRGBColorSpace));
        });
        // Apply UsdUVTexture scale to diffuse color (output = texture * scale + bias)
        if (material.map && material.map.userData.scale) {
            const scale = material.map.userData.scale;
            if (Array.isArray(scale) && scale.length >= 3) material.color.setRGB(scale[0], scale[1], scale[2], (0, _three.SRGBColorSpace));
        }
        // Emissive
        applyTexture('inputs:emissiveColor', 'emissiveMap', (0, _three.SRGBColorSpace), (color)=>{
            if (Array.isArray(color) && color.length >= 3) material.emissive.setRGB(color[0], color[1], color[2], (0, _three.SRGBColorSpace));
        });
        if (material.emissiveMap) {
            if (material.emissiveMap.userData.scale) {
                const scale = material.emissiveMap.userData.scale;
                if (Array.isArray(scale) && scale.length >= 3) material.emissive.setRGB(scale[0], scale[1], scale[2], (0, _three.SRGBColorSpace));
            } else material.emissive.set(0xffffff);
        }
        // Normal map
        applyTexture('inputs:normal', 'normalMap', (0, _three.NoColorSpace), null);
        // Apply normal map scale from UsdUVTexture scale input
        if (material.normalMap && material.normalMap.userData.scale) {
            const scale = material.normalMap.userData.scale;
            // UsdUVTexture scale is float4 (r,g,b,a), use first two components for normalScale
            material.normalScale = new (0, _three.Vector2)(scale[0], scale[1]);
        }
        // Roughness
        const hasRoughnessMap = applyTexture('inputs:roughness', 'roughnessMap', (0, _three.NoColorSpace), (value)=>{
            material.roughness = value;
        });
        if (hasRoughnessMap) material.roughness = 1.0;
        // Metallic
        const hasMetalnessMap = applyTexture('inputs:metallic', 'metalnessMap', (0, _three.NoColorSpace), (value)=>{
            material.metalness = value;
        });
        if (hasMetalnessMap) material.metalness = 1.0;
        // Occlusion
        applyTexture('inputs:occlusion', 'aoMap', (0, _three.NoColorSpace), null);
        // IOR
        if (fields['inputs:ior'] !== undefined) material.ior = fields['inputs:ior'];
        // Specular color
        applyTexture('inputs:specularColor', 'specularColorMap', (0, _three.SRGBColorSpace), (color)=>{
            if (Array.isArray(color) && color.length >= 3) material.specularColor.setRGB(color[0], color[1], color[2], (0, _three.SRGBColorSpace));
        });
        // Apply UsdUVTexture scale to specular color
        if (material.specularColorMap && material.specularColorMap.userData.scale) {
            const scale = material.specularColorMap.userData.scale;
            if (Array.isArray(scale) && scale.length >= 3) material.specularColor.setRGB(scale[0], scale[1], scale[2], (0, _three.SRGBColorSpace));
        }
        // Clearcoat
        if (fields['inputs:clearcoat'] !== undefined) material.clearcoat = fields['inputs:clearcoat'];
        // Clearcoat roughness
        if (fields['inputs:clearcoatRoughness'] !== undefined) material.clearcoatRoughness = fields['inputs:clearcoatRoughness'];
        // Opacity and opacity modes
        const opacityThreshold = fields['inputs:opacityThreshold'] !== undefined ? fields['inputs:opacityThreshold'] : 0.0;
        // Check if opacity is connected to a texture (e.g., diffuse texture's alpha)
        const opacitySpec = getAttrSpec('inputs:opacity');
        const hasOpacityConnection = opacitySpec?.fields?.connectionPaths?.length > 0;
        if (hasOpacityConnection) {
            // Opacity from texture alpha - use the diffuse map's alpha channel
            if (opacityThreshold > 0) {
                // Alpha cutoff mode
                material.alphaTest = opacityThreshold;
                material.transparent = false;
            } else // Alpha blend mode
            material.transparent = true;
        } else {
            // Direct opacity value
            const opacity = fields['inputs:opacity'] !== undefined ? fields['inputs:opacity'] : 1.0;
            if (opacity < 1.0) {
                material.transparent = true;
                material.opacity = opacity;
            }
        }
    }
    _applyOpenPBRSurface(material, shaderPath) {
        const fields = this._getAttributes(shaderPath);
        const applyTexture = (attrName, textureProperty, colorSpace, valueCallback)=>{
            return this._applyTextureOrValue(material, shaderPath, fields, attrName, textureProperty, colorSpace, valueCallback, this._getTextureFromOpenPBRConnection);
        };
        // Base color (diffuse)
        applyTexture('inputs:base_color', 'map', (0, _three.SRGBColorSpace), (color)=>{
            if (Array.isArray(color) && color.length >= 3) material.color.setRGB(color[0], color[1], color[2], (0, _three.SRGBColorSpace));
        });
        // Apply UsdUVTexture scale to base color
        if (material.map && material.map.userData.scale) {
            const scale = material.map.userData.scale;
            if (Array.isArray(scale) && scale.length >= 3) material.color.setRGB(scale[0], scale[1], scale[2], (0, _three.SRGBColorSpace));
        }
        // Base metalness
        applyTexture('inputs:base_metalness', 'metalnessMap', (0, _three.NoColorSpace), (value)=>{
            if (typeof value === 'number') material.metalness = value;
        });
        // Specular roughness
        applyTexture('inputs:specular_roughness', 'roughnessMap', (0, _three.NoColorSpace), (value)=>{
            if (typeof value === 'number') material.roughness = value;
        });
        // Emission color
        const hasEmissionMap = applyTexture('inputs:emission_color', 'emissiveMap', (0, _three.SRGBColorSpace), (color)=>{
            if (Array.isArray(color) && color.length >= 3) material.emissive.setRGB(color[0], color[1], color[2], (0, _three.SRGBColorSpace));
        });
        // Emission luminance/weight - multiply emissive by this factor
        const emissionLuminance = fields['inputs:emission_luminance'];
        if (emissionLuminance !== undefined && emissionLuminance > 0) {
            if (hasEmissionMap) material.emissiveIntensity = emissionLuminance;
            else // Scale the emissive color by luminance
            material.emissive.multiplyScalar(emissionLuminance);
        }
        // Transmission (transparency)
        const transmissionWeight = fields['inputs:transmission_weight'];
        if (transmissionWeight !== undefined && transmissionWeight > 0) {
            material.transmission = transmissionWeight;
            const transmissionDepth = fields['inputs:transmission_depth'];
            if (transmissionDepth !== undefined) material.thickness = transmissionDepth;
            const transmissionColor = fields['inputs:transmission_color'];
            if (transmissionColor !== undefined && Array.isArray(transmissionColor)) {
                material.attenuationColor.setRGB(transmissionColor[0], transmissionColor[1], transmissionColor[2]);
                material.attenuationDistance = transmissionDepth || 1.0;
            }
        }
        // Geometry opacity (overall surface opacity)
        const geometryOpacity = fields['inputs:geometry_opacity'];
        if (geometryOpacity !== undefined && geometryOpacity < 1.0) {
            material.opacity = geometryOpacity;
            material.transparent = true;
        }
        // Specular IOR
        const specularIOR = fields['inputs:specular_ior'];
        if (specularIOR !== undefined) material.ior = specularIOR;
        // Coat (clearcoat)
        const coatWeight = fields['inputs:coat_weight'];
        if (coatWeight !== undefined && coatWeight > 0) {
            material.clearcoat = coatWeight;
            const coatRoughness = fields['inputs:coat_roughness'];
            if (coatRoughness !== undefined) material.clearcoatRoughness = coatRoughness;
        }
        // Thin film (iridescence)
        const thinFilmWeight = fields['inputs:thin_film_weight'];
        if (thinFilmWeight !== undefined && thinFilmWeight > 0) {
            material.iridescence = thinFilmWeight;
            const thinFilmIOR = fields['inputs:thin_film_ior'];
            if (thinFilmIOR !== undefined) material.iridescenceIOR = thinFilmIOR;
            const thinFilmThickness = fields['inputs:thin_film_thickness'];
            if (thinFilmThickness !== undefined) {
                // OpenPBR uses micrometers, Three.js uses nanometers
                const thicknessNm = thinFilmThickness * 1000;
                material.iridescenceThicknessRange = [
                    thicknessNm,
                    thicknessNm
                ];
            }
        }
        // Specular
        const specularWeight = fields['inputs:specular_weight'];
        if (specularWeight !== undefined) material.specularIntensity = specularWeight;
        const specularColor = fields['inputs:specular_color'];
        if (specularColor !== undefined && Array.isArray(specularColor)) material.specularColor.setRGB(specularColor[0], specularColor[1], specularColor[2]);
        // Anisotropy
        const anisotropy = fields['inputs:specular_roughness_anisotropy'];
        if (anisotropy !== undefined && anisotropy > 0) material.anisotropy = anisotropy;
        // Geometry normal (normal map)
        applyTexture('inputs:geometry_normal', 'normalMap', (0, _three.NoColorSpace), null);
    }
    _getTextureFromOpenPBRConnection(connPath) {
        // connPath is like /Material/NodeGraph.outputs:baseColor or /Material/Shader.outputs:out
        const cleanPath = connPath.replace(/<|>/g, '');
        const shaderPath = cleanPath.split('.')[0];
        const shaderSpec = this.specsByPath[shaderPath];
        if (!shaderSpec) return null;
        const attrs = this._getAttributes(shaderPath);
        const infoId = attrs['info:id'] || shaderSpec.fields['info:id'];
        const typeName = shaderSpec.fields.typeName;
        // Handle NodeGraph - follow output connection to internal shader
        if (typeName === 'NodeGraph') {
            // Get the output attribute that's connected
            const outputName = cleanPath.split('.')[1]; // e.g., "outputs:baseColor"
            const outputAttrPath = shaderPath + '.' + outputName;
            const outputSpec = this.specsByPath[outputAttrPath];
            if (outputSpec?.fields?.connectionPaths?.length > 0) // Follow the internal connection
            return this._getTextureFromOpenPBRConnection(outputSpec.fields.connectionPaths[0]);
            return null;
        }
        // Handle arnold:image - Arnold's texture node
        if (infoId === 'arnold:image') {
            const filePath = attrs['inputs:filename'];
            if (!filePath) return null;
            return this._loadTextureFromPath(filePath);
        }
        // Handle MaterialX image nodes (ND_image_color4, ND_image_color3, etc.)
        if (infoId && infoId.startsWith('ND_image_')) {
            const filePath = attrs['inputs:file'];
            if (!filePath) return null;
            return this._loadTextureFromPath(filePath);
        }
        // Handle Maya file texture - follow the inColor connection to the actual image
        if (infoId === 'MayaND_fileTexture_color4') {
            const inColorPath = shaderPath + '.inputs:inColor';
            const inColorSpec = this.specsByPath[inColorPath];
            if (inColorSpec?.fields?.connectionPaths?.length > 0) return this._getTextureFromOpenPBRConnection(inColorSpec.fields.connectionPaths[0]);
            return null;
        }
        // Handle color conversion nodes - follow the input connection
        if (infoId && infoId.startsWith('ND_convert_')) {
            const inPath = shaderPath + '.inputs:in';
            const inSpec = this.specsByPath[inPath];
            if (inSpec?.fields?.connectionPaths?.length > 0) return this._getTextureFromOpenPBRConnection(inSpec.fields.connectionPaths[0]);
            return null;
        }
        // Handle Arnold bump2d - follow the bump_map input
        if (infoId === 'arnold:bump2d') {
            const bumpMapPath = shaderPath + '.inputs:bump_map';
            const bumpMapSpec = this.specsByPath[bumpMapPath];
            if (bumpMapSpec?.fields?.connectionPaths?.length > 0) return this._getTextureFromOpenPBRConnection(bumpMapSpec.fields.connectionPaths[0]);
            return null;
        }
        // Handle Arnold color_correct - follow the input connection
        if (infoId === 'arnold:color_correct') {
            const inputPath = shaderPath + '.inputs:input';
            const inputSpec = this.specsByPath[inputPath];
            if (inputSpec?.fields?.connectionPaths?.length > 0) return this._getTextureFromOpenPBRConnection(inputSpec.fields.connectionPaths[0]);
            return null;
        }
        // Handle nested shader paths (e.g., /Material/file2/cc.outputs:a)
        // Check if parent path is an image node
        const parentPath = shaderPath.substring(0, shaderPath.lastIndexOf('/'));
        if (parentPath) {
            const parentSpec = this.specsByPath[parentPath];
            if (parentSpec) {
                const parentAttrs = this._getAttributes(parentPath);
                const parentInfoId = parentAttrs['info:id'] || parentSpec.fields['info:id'];
                if (parentInfoId === 'arnold:image') {
                    const filePath = parentAttrs['inputs:filename'];
                    if (filePath) return this._loadTextureFromPath(filePath);
                }
            }
        }
        return null;
    }
    _loadTextureFromPath(filePath) {
        if (!filePath) return null;
        // Check cache first
        if (this.textureCache[filePath]) return this.textureCache[filePath];
        const texture = this._loadTexture(filePath, null, null);
        if (texture) this.textureCache[filePath] = texture;
        return texture;
    }
    _getTextureFromConnection(connPath) {
        // connPath is like /Material/Shader.outputs:rgb
        const shaderPath = connPath.split('.')[0];
        const shaderSpec = this.specsByPath[shaderPath];
        if (!shaderSpec) return null;
        const attrs = this._getAttributes(shaderPath);
        const infoId = attrs['info:id'] || shaderSpec.fields['info:id'];
        if (infoId !== 'UsdUVTexture') return null;
        const filePath = attrs['inputs:file'];
        if (!filePath) return null;
        // Check for UsdTransform2d connection via inputs:st and trace to PrimvarReader
        let transformAttrs = null;
        let uvChannel = 0; // Default to first UV set
        const stAttrPath = shaderPath + '.inputs:st';
        const stAttrSpec = this.specsByPath[stAttrPath];
        if (stAttrSpec?.fields?.connectionPaths?.length > 0) {
            const stConnPath = stAttrSpec.fields.connectionPaths[0];
            const stPath = stConnPath.replace(/<|>/g, '').split('.')[0];
            const stSpec = this.specsByPath[stPath];
            if (stSpec) {
                const stAttrs = this._getAttributes(stPath);
                const stInfoId = stAttrs['info:id'] || stSpec.fields['info:id'];
                if (stInfoId === 'UsdTransform2d') {
                    transformAttrs = stAttrs;
                    // Trace to PrimvarReader to find UV set
                    const inAttrPath = stPath + '.inputs:in';
                    const inAttrSpec = this.specsByPath[inAttrPath];
                    if (inAttrSpec?.fields?.connectionPaths?.length > 0) {
                        const inConnPath = inAttrSpec.fields.connectionPaths[0];
                        const primvarPath = inConnPath.replace(/<|>/g, '').split('.')[0];
                        const primvarAttrs = this._getAttributes(primvarPath);
                        // Check varname to determine UV channel
                        const varname = primvarAttrs['inputs:varname'];
                        if (varname === 'st1') uvChannel = 1;
                        else if (varname === 'st2') uvChannel = 2;
                    }
                } else if (stInfoId === 'UsdPrimvarReader_float2') {
                    // Direct connection to PrimvarReader
                    const varname = stAttrs['inputs:varname'];
                    if (varname === 'st1') uvChannel = 1;
                    else if (varname === 'st2') uvChannel = 2;
                }
            }
        }
        // Extract scale and bias for texture value modification
        const scale = attrs['inputs:scale'];
        const bias = attrs['inputs:bias'];
        // Create cache key that includes scale/bias if present
        let cacheKey = filePath;
        if (scale) cacheKey += ':s' + scale.join(',');
        if (bias) cacheKey += ':b' + bias.join(',');
        if (this.textureCache[cacheKey]) return this.textureCache[cacheKey];
        const texture = this._loadTexture(filePath, attrs, transformAttrs);
        if (texture) {
            // Store scale/bias and UV channel in userData
            if (scale) texture.userData.scale = scale;
            if (bias) texture.userData.bias = bias;
            if (uvChannel !== 0) texture.channel = uvChannel;
            this.textureCache[cacheKey] = texture;
        }
        return texture;
    }
    _applyTextureTransforms(texture, attrs) {
        if (!attrs) return;
        const scale = attrs['inputs:scale'];
        if (scale && Array.isArray(scale) && scale.length >= 2) texture.repeat.set(scale[0], scale[1]);
        const translation = attrs['inputs:translation'];
        if (translation && Array.isArray(translation) && translation.length >= 2) texture.offset.set(translation[0], translation[1]);
        const rotation = attrs['inputs:rotation'];
        if (typeof rotation === 'number') texture.rotation = rotation * Math.PI / 180;
    }
    _loadTexture(filePath, textureAttrs, transformAttrs) {
        let cleanPath = filePath;
        if (cleanPath.startsWith('@')) cleanPath = cleanPath.slice(1);
        if (cleanPath.endsWith('@')) cleanPath = cleanPath.slice(0, -1);
        // Resolve relative to basePath first
        const resolvedPath = this._resolveFilePath(cleanPath);
        let assetData = this.assets[resolvedPath];
        // Fallback to unresolved path
        if (!assetData) assetData = this.assets[cleanPath];
        // Last resort: search by basename
        if (!assetData) {
            const baseName = cleanPath.split('/').pop();
            for(const key in this.assets){
                if (key.endsWith(baseName) || key.endsWith('/' + baseName)) return this._createTextureFromData(this.assets[key], textureAttrs, transformAttrs);
            }
            // Try loading via LoadingManager if available
            if (this.manager) {
                const url = this.manager.resolveURL(baseName);
                if (url !== baseName) // URL modifier found a match - load it
                return this._createTextureFromData(url, textureAttrs, transformAttrs);
            }
            console.warn('USDLoader: Texture not found:', cleanPath);
            return null;
        }
        return this._createTextureFromData(assetData, textureAttrs, transformAttrs);
    }
    _createTextureFromData(data, textureAttrs, transformAttrs) {
        if (!data) return null;
        const scope = this;
        const texture = new (0, _three.Texture)();
        let url;
        if (typeof data === 'string') url = data;
        else if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
            const blob = new Blob([
                data
            ]);
            url = URL.createObjectURL(blob);
        } else return null;
        const image = new Image();
        image.onload = function() {
            texture.image = image;
            if (textureAttrs) {
                texture.wrapS = scope._getWrapMode(textureAttrs['inputs:wrapS']);
                texture.wrapT = scope._getWrapMode(textureAttrs['inputs:wrapT']);
            }
            scope._applyTextureTransforms(texture, transformAttrs);
            texture.needsUpdate = true;
            if (typeof data !== 'string') URL.revokeObjectURL(url);
        };
        image.src = url;
        return texture;
    }
    _getWrapMode(wrapValue) {
        if (wrapValue === 'repeat') return 0, _three.RepeatWrapping;
        if (wrapValue === 'mirror') return 0, _three.MirroredRepeatWrapping;
        if (wrapValue === 'clamp') return 0, _three.ClampToEdgeWrapping;
        return 0, _three.RepeatWrapping;
    }
    // ========================================================================
    // Skeletal Animation
    // ========================================================================
    _buildSkeleton(path) {
        const attrs = this._getAttributes(path);
        // Get joint names (paths like "root", "root/body_joint", etc.)
        const joints = attrs['joints'];
        if (!joints || joints.length === 0) return null;
        // Get bind transforms (world-space bind pose matrices)
        // These can be nested arrays (USDA) or flat arrays (USDC)
        const rawBindTransforms = attrs['bindTransforms'];
        const rawRestTransforms = attrs['restTransforms'];
        const bindTransforms = this._flattenMatrixArray(rawBindTransforms, joints.length);
        const restTransforms = this._flattenMatrixArray(rawRestTransforms, joints.length);
        // Build bones
        const bones = [];
        const bonesByPath = {};
        const boneInverses = [];
        for(let i = 0; i < joints.length; i++){
            const jointPath = joints[i];
            const jointName = jointPath.split('/').pop();
            const bone = new (0, _three.Bone)();
            bone.name = jointName;
            bones.push(bone);
            bonesByPath[jointPath] = {
                bone,
                index: i
            };
            // Compute inverse bind matrix
            if (bindTransforms && bindTransforms.length >= (i + 1) * 16) {
                const bindMatrix = new (0, _three.Matrix4)();
                // USD matrices are row-major, Three.js is column-major - need to transpose
                const m = bindTransforms.slice(i * 16, (i + 1) * 16);
                bindMatrix.set(m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]);
                const inverseBindMatrix = bindMatrix.clone().invert();
                boneInverses.push(inverseBindMatrix);
            } else boneInverses.push(new (0, _three.Matrix4)());
        }
        // Build parent-child relationships based on joint paths
        for(let i = 0; i < joints.length; i++){
            const jointPath = joints[i];
            const parts = jointPath.split('/');
            if (parts.length > 1) {
                const parentPath = parts.slice(0, -1).join('/');
                const parentData = bonesByPath[parentPath];
                if (parentData) parentData.bone.add(bones[i]);
            }
        }
        // Apply rest transforms as bone local transforms.
        // Rest transforms are the skeleton's default local-space pose and match
        // the reference frame used by SkelAnimation data. Bind transforms are
        // world-space matrices used only for computing inverse bind matrices.
        if (restTransforms && restTransforms.length >= joints.length * 16) for(let i = 0; i < joints.length; i++){
            const matrix = new (0, _three.Matrix4)();
            const m = restTransforms.slice(i * 16, (i + 1) * 16);
            matrix.set(m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]);
            matrix.decompose(bones[i].position, bones[i].quaternion, bones[i].scale);
        }
        // Find root bone(s) - bones without a parent bone
        const rootBones = bones.filter((bone)=>!bone.parent || !bone.parent.isBone);
        // Get animation source path
        const animSourceSpec = this.specsByPath[path + '.skel:animationSource'];
        let animationPath = null;
        if (animSourceSpec && animSourceSpec.fields.targetPaths && animSourceSpec.fields.targetPaths.length > 0) animationPath = animSourceSpec.fields.targetPaths[0];
        return {
            skeleton: new (0, _three.Skeleton)(bones, boneInverses),
            joints: joints,
            rootBones: rootBones,
            animationPath: animationPath,
            path: path
        };
    }
    _bindSkeletons() {
        for (const meshData of this.skinnedMeshes){
            const { mesh, skeletonPath, localJoints, geomBindTransform } = meshData;
            let skeletonData = null;
            // Try exact match first
            if (skeletonPath && this.skeletons[skeletonPath]) skeletonData = this.skeletons[skeletonPath];
            // Try includes match as fallback
            if (!skeletonData) {
                for(const skelPath in this.skeletons)if (skeletonPath && (skeletonPath.includes(skelPath) || skelPath.includes(skeletonPath))) {
                    skeletonData = this.skeletons[skelPath];
                    break;
                }
            }
            // Fallback to first skeleton for single-skeleton files
            if (!skeletonData) {
                const skeletonPaths = Object.keys(this.skeletons);
                if (skeletonPaths.length > 0) skeletonData = this.skeletons[skeletonPaths[0]];
            }
            if (!skeletonData) {
                console.warn('USDComposer: No skeleton found for skinned mesh', mesh.name);
                continue;
            }
            const { skeleton, rootBones, joints } = skeletonData;
            if (localJoints && localJoints.length > 0) {
                const skinIndex = mesh.geometry.attributes.skinIndex;
                if (skinIndex) {
                    const localToGlobal = [];
                    for(let i = 0; i < localJoints.length; i++){
                        const jointName = localJoints[i];
                        const globalIdx = joints.indexOf(jointName);
                        localToGlobal[i] = globalIdx >= 0 ? globalIdx : 0;
                    }
                    const arr = skinIndex.array;
                    for(let i = 0; i < arr.length; i++){
                        const localIdx = arr[i];
                        if (localIdx < localToGlobal.length) arr[i] = localToGlobal[localIdx];
                    }
                }
            }
            for (const rootBone of rootBones)mesh.add(rootBone);
            // Use geomBindTransform if available, otherwise fall back to identity.
            // Estimating bind transforms from vertex/joint samples is not robust and can
            // produce severe skinning distortion for valid assets.
            const bindMatrix = new (0, _three.Matrix4)();
            if (geomBindTransform && geomBindTransform.length === 16) {
                // USD matrices are row-major, Three.js is column-major - need to transpose
                const m = geomBindTransform;
                bindMatrix.set(m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]);
            }
            mesh.bind(skeleton, bindMatrix);
        }
    }
    _buildAnimations() {
        const animations = [];
        // Find all SkelAnimation prims
        for(const path in this.specsByPath){
            const spec = this.specsByPath[path];
            if (spec.specType !== SpecType.Prim) continue;
            if (spec.fields.typeName !== 'SkelAnimation') continue;
            const clip = this._buildAnimationClip(path);
            if (clip) animations.push(clip);
        }
        // Build transform animations from time-sampled xformOps
        const transformTracks = this._buildTransformAnimations();
        if (transformTracks.length > 0) animations.push(new (0, _three.AnimationClip)('TransformAnimation', -1, transformTracks));
        return animations;
    }
    _buildTransformAnimations() {
        const tracks = [];
        for(const path in this.specsByPath){
            const spec = this.specsByPath[path];
            if (spec.specType !== SpecType.Prim) continue;
            const typeName = spec.fields?.typeName;
            if (typeName !== 'Xform' && typeName !== 'Scope' && typeName !== 'Mesh') continue;
            const objectName = path.split('/').pop();
            // Check for animated xformOp:orient
            const orientPath = path + '.xformOp:orient';
            const orientSpec = this.specsByPath[orientPath];
            if (orientSpec?.fields?.timeSamples) {
                const { times, values } = orientSpec.fields.timeSamples;
                const keyframeTimes = [];
                const keyframeValues = [];
                for(let i = 0; i < times.length; i++){
                    keyframeTimes.push(times[i] / this.fps);
                    const q = values[i];
                    keyframeValues.push(q[0], q[1], q[2], q[3]);
                }
                if (keyframeTimes.length > 0) tracks.push(new (0, _three.QuaternionKeyframeTrack)(objectName + '.quaternion', new Float32Array(keyframeTimes), new Float32Array(keyframeValues)));
            }
            // Check for animated xformOp:rotateXYZ
            const rotateXYZPath = path + '.xformOp:rotateXYZ';
            const rotateXYZSpec = this.specsByPath[rotateXYZPath];
            if (rotateXYZSpec?.fields?.timeSamples) {
                const { times, values } = rotateXYZSpec.fields.timeSamples;
                const keyframeTimes = [];
                const keyframeValues = [];
                const tempEuler = new (0, _three.Euler)();
                const tempQuat = new (0, _three.Quaternion)();
                for(let i = 0; i < times.length; i++){
                    keyframeTimes.push(times[i] / this.fps);
                    const r = values[i];
                    // USD rotateXYZ: matrix = Rx * Ry * Rz, use 'ZYX' order in Three.js
                    tempEuler.set(r[0] * Math.PI / 180, r[1] * Math.PI / 180, r[2] * Math.PI / 180, 'ZYX');
                    tempQuat.setFromEuler(tempEuler);
                    keyframeValues.push(tempQuat.x, tempQuat.y, tempQuat.z, tempQuat.w);
                }
                if (keyframeTimes.length > 0) tracks.push(new (0, _three.QuaternionKeyframeTrack)(objectName + '.quaternion', new Float32Array(keyframeTimes), new Float32Array(keyframeValues)));
            }
            // Check for animated xformOp:translate
            const translatePath = path + '.xformOp:translate';
            const translateSpec = this.specsByPath[translatePath];
            if (translateSpec?.fields?.timeSamples) {
                const { times, values } = translateSpec.fields.timeSamples;
                const keyframeTimes = [];
                const keyframeValues = [];
                for(let i = 0; i < times.length; i++){
                    keyframeTimes.push(times[i] / this.fps);
                    const t = values[i];
                    keyframeValues.push(t[0], t[1], t[2]);
                }
                if (keyframeTimes.length > 0) tracks.push(new (0, _three.VectorKeyframeTrack)(objectName + '.position', new Float32Array(keyframeTimes), new Float32Array(keyframeValues)));
            }
            // Check for animated xformOp:scale
            const scalePath = path + '.xformOp:scale';
            const scaleSpec = this.specsByPath[scalePath];
            if (scaleSpec?.fields?.timeSamples) {
                const { times, values } = scaleSpec.fields.timeSamples;
                const keyframeTimes = [];
                const keyframeValues = [];
                for(let i = 0; i < times.length; i++){
                    keyframeTimes.push(times[i] / this.fps);
                    const s = values[i];
                    keyframeValues.push(s[0], s[1], s[2]);
                }
                if (keyframeTimes.length > 0) tracks.push(new (0, _three.VectorKeyframeTrack)(objectName + '.scale', new Float32Array(keyframeTimes), new Float32Array(keyframeValues)));
            }
            // Check for animated xformOp:transform (matrix animations)
            // These can have suffixes like xformOp:transform:transform
            const properties = spec.fields?.properties || [];
            for (const prop of properties){
                if (!prop.startsWith('xformOp:transform')) continue;
                const transformPath = path + '.' + prop;
                const transformSpec = this.specsByPath[transformPath];
                if (!transformSpec?.fields?.timeSamples) continue;
                const { times, values } = transformSpec.fields.timeSamples;
                const positionTimes = [];
                const positionValues = [];
                const quaternionTimes = [];
                const quaternionValues = [];
                const scaleTimes = [];
                const scaleValues = [];
                const matrix = new (0, _three.Matrix4)();
                const position = new (0, _three.Vector3)();
                const quaternion = new (0, _three.Quaternion)();
                const scale = new (0, _three.Vector3)();
                for(let i = 0; i < times.length; i++){
                    const m = values[i];
                    if (!m || m.length < 16) continue;
                    const t = times[i] / this.fps;
                    // USD matrices are row-major, Three.js is column-major
                    matrix.set(m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]);
                    matrix.decompose(position, quaternion, scale);
                    positionTimes.push(t);
                    positionValues.push(position.x, position.y, position.z);
                    quaternionTimes.push(t);
                    quaternionValues.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
                    scaleTimes.push(t);
                    scaleValues.push(scale.x, scale.y, scale.z);
                }
                if (positionTimes.length > 0) {
                    tracks.push(new (0, _three.VectorKeyframeTrack)(objectName + '.position', new Float32Array(positionTimes), new Float32Array(positionValues)));
                    tracks.push(new (0, _three.QuaternionKeyframeTrack)(objectName + '.quaternion', new Float32Array(quaternionTimes), new Float32Array(quaternionValues)));
                    tracks.push(new (0, _three.VectorKeyframeTrack)(objectName + '.scale', new Float32Array(scaleTimes), new Float32Array(scaleValues)));
                }
                break; // Only process first transform op
            }
        }
        return tracks;
    }
    _buildAnimationClip(path) {
        const attrs = this._getAttributes(path);
        const joints = attrs['joints'];
        if (!joints || joints.length === 0) return null;
        const tracks = [];
        // Get rotation time samples
        const rotationsAttr = this._getTimeSampledAttribute(path, 'rotations');
        if (rotationsAttr && rotationsAttr.times && rotationsAttr.values) {
            const { times, values } = rotationsAttr;
            for(let jointIdx = 0; jointIdx < joints.length; jointIdx++){
                const jointName = joints[jointIdx].split('/').pop();
                const keyframeTimes = [];
                const keyframeValues = [];
                for(let t = 0; t < times.length; t++){
                    const quatData = values[t];
                    if (!quatData || quatData.length < (jointIdx + 1) * 4) continue;
                    keyframeTimes.push(times[t] / this.fps);
                    // USD GfQuatf stores imaginary (x,y,z) first, then real (w)
                    // This matches Three.js quaternion order (x,y,z,w)
                    const x = quatData[jointIdx * 4 + 0];
                    const y = quatData[jointIdx * 4 + 1];
                    const z = quatData[jointIdx * 4 + 2];
                    const w = quatData[jointIdx * 4 + 3];
                    keyframeValues.push(x, y, z, w);
                }
                if (keyframeTimes.length > 0) tracks.push(new (0, _three.QuaternionKeyframeTrack)(jointName + '.quaternion', new Float32Array(keyframeTimes), new Float32Array(keyframeValues)));
            }
        }
        // Get translation time samples
        const translationsAttr = this._getTimeSampledAttribute(path, 'translations');
        if (translationsAttr && translationsAttr.times && translationsAttr.values) {
            const { times, values } = translationsAttr;
            for(let jointIdx = 0; jointIdx < joints.length; jointIdx++){
                const jointName = joints[jointIdx].split('/').pop();
                const keyframeTimes = [];
                const keyframeValues = [];
                for(let t = 0; t < times.length; t++){
                    const transData = values[t];
                    if (!transData || transData.length < (jointIdx + 1) * 3) continue;
                    keyframeTimes.push(times[t] / this.fps);
                    keyframeValues.push(transData[jointIdx * 3 + 0], transData[jointIdx * 3 + 1], transData[jointIdx * 3 + 2]);
                }
                if (keyframeTimes.length > 0) tracks.push(new (0, _three.VectorKeyframeTrack)(jointName + '.position', new Float32Array(keyframeTimes), new Float32Array(keyframeValues)));
            }
        }
        // Get scale time samples
        const scalesAttr = this._getTimeSampledAttribute(path, 'scales');
        if (scalesAttr && scalesAttr.times && scalesAttr.values) {
            const { times, values } = scalesAttr;
            for(let jointIdx = 0; jointIdx < joints.length; jointIdx++){
                const jointName = joints[jointIdx].split('/').pop();
                const keyframeTimes = [];
                const keyframeValues = [];
                for(let t = 0; t < times.length; t++){
                    const scaleData = values[t];
                    if (!scaleData || scaleData.length < (jointIdx + 1) * 3) continue;
                    keyframeTimes.push(times[t] / this.fps);
                    keyframeValues.push(scaleData[jointIdx * 3 + 0], scaleData[jointIdx * 3 + 1], scaleData[jointIdx * 3 + 2]);
                }
                if (keyframeTimes.length > 0) tracks.push(new (0, _three.VectorKeyframeTrack)(jointName + '.scale', new Float32Array(keyframeTimes), new Float32Array(keyframeValues)));
            }
        }
        if (tracks.length === 0) return null;
        const clipName = path.split('/').pop();
        return new (0, _three.AnimationClip)(clipName, -1, tracks);
    }
    _getTimeSampledAttribute(primPath, attrName) {
        // Look for the attribute spec with time samples
        const attrPath = primPath + '.' + attrName;
        const attrSpec = this.specsByPath[attrPath];
        if (attrSpec && attrSpec.fields.timeSamples) {
            const timeSamples = attrSpec.fields.timeSamples;
            if (timeSamples.times && timeSamples.values) return timeSamples;
        }
        return null;
    }
    _flattenMatrixArray(matrices, numMatrices) {
        if (!matrices || matrices.length === 0) return null;
        if (typeof matrices[0] === 'number') return matrices;
        const flatArray = [];
        for(let m = 0; m < numMatrices; m++)for(let row = 0; row < 4; row++){
            const rowData = matrices[m * 4 + row];
            if (rowData && rowData.length === 4) flatArray.push(rowData[0], rowData[1], rowData[2], rowData[3]);
            else flatArray.push(row === 0 ? 1 : 0, row === 1 ? 1 : 0, row === 2 ? 1 : 0, row === 3 ? 1 : 0);
        }
        return flatArray;
    }
}

},{"three":"hJIVG","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}]},["2aqwn"], null, "parcelRequire6840", {})

//# sourceMappingURL=USDLoader.8f94ad47.js.map
