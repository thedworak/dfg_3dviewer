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
})({"c2m1T":[function(require,module,exports,__globalThis) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SERVER_PORT = 1234;
var HMR_SECURE = false;
var HMR_ENV_HASH = "439701173a9199ea";
var HMR_USE_SSE = false;
module.bundle.HMR_BUNDLE_ID = "886d2bfc8c584f39";
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

},{}],"ecgek":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "ThreeMFLoader", ()=>ThreeMFLoader);
var _three = require("three");
var _fflateModuleJs = require("../libs/fflate.module.js");
const COLOR_SPACE_3MF = (0, _three.SRGBColorSpace);
/**
 * A loader for the [3D Manufacturing Format (3MF)](https://3mf.io/specification/) format.
 *
 * The following features from the core specification are supported:
 *
 * - 3D Models
 * - Object Resources (Meshes and Components)
 * - Material Resources (Base Materials)
 *
 * 3MF Materials and Properties Extension are only partially supported.
 *
 * - Texture 2D
 * - Texture 2D Groups
 * - Color Groups (Vertex Colors)
 * - Metallic Display Properties (PBR)
 *
 * ```js
 * const loader = new ThreeMFLoader();
 *
 * const object = await loader.loadAsync( './models/3mf/truck.3mf' );
 * object.rotation.set( - Math.PI / 2, 0, 0 ); // z-up conversion
 * scene.add( object );
 * ```
 *
 * @augments Loader
 * @three_import import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
 */ class ThreeMFLoader extends (0, _three.Loader) {
    /**
	 * Constructs a new 3MF loader.
	 *
	 * @param {LoadingManager} [manager] - The loading manager.
	 */ constructor(manager){
        super(manager);
        /**
		 * An array of available extensions.
		 *
		 * @type {Array<Object>}
		 */ this.availableExtensions = [];
    }
    /**
	 * Starts loading from the given URL and passes the loaded 3MF asset
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
	 * Parses the given 3MF data and returns the resulting group.
	 *
	 * @param {ArrayBuffer} data - The raw 3MF asset data as an array buffer.
	 * @return {Group} A group representing the parsed asset.
	 */ parse(data) {
        const scope = this;
        const textureLoader = new (0, _three.TextureLoader)(this.manager);
        function loadDocument(data) {
            let zip = null;
            let file = null;
            let relsName;
            let modelRelsName;
            const modelPartNames = [];
            const texturesPartNames = [];
            let modelRels;
            const modelParts = {};
            const printTicketParts = {};
            const texturesParts = {};
            const textDecoder = new TextDecoder();
            try {
                zip = (0, _fflateModuleJs.unzipSync)(new Uint8Array(data));
            } catch (e) {
                if (e instanceof ReferenceError) {
                    console.error('THREE.3MFLoader: fflate missing and file is compressed.');
                    return null;
                }
            }
            let rootModelFile = null;
            for(file in zip){
                if (file.match(/\_rels\/.rels$/)) relsName = file;
                else if (file.match(/3D\/_rels\/.*\.model\.rels$/)) modelRelsName = file;
                else if (file.match(/^3D\/[^\/]*\.model$/)) rootModelFile = file;
                else if (file.match(/^3D\/.*\/.*\.model$/)) modelPartNames.push(file); // sub models
                else if (file.match(/^3D\/Textures?\/.*/)) texturesPartNames.push(file);
            }
            modelPartNames.push(rootModelFile); // push root model at the end so it is processed after the sub models
            if (relsName === undefined) throw new Error('THREE.ThreeMFLoader: Cannot find relationship file `rels` in 3MF archive.');
            //
            const relsView = zip[relsName];
            const relsFileText = textDecoder.decode(relsView);
            const rels = parseRelsXml(relsFileText);
            //
            if (modelRelsName) {
                const relsView = zip[modelRelsName];
                const relsFileText = textDecoder.decode(relsView);
                modelRels = parseRelsXml(relsFileText);
            }
            //
            for(let i = 0; i < modelPartNames.length; i++){
                const modelPart = modelPartNames[i];
                const view = zip[modelPart];
                const fileText = textDecoder.decode(view);
                const xmlData = new DOMParser().parseFromString(fileText, 'application/xml');
                if (xmlData.documentElement.nodeName.toLowerCase() !== 'model') console.error('THREE.3MFLoader: Error loading 3MF - no 3MF document found: ', modelPart);
                const modelNode = xmlData.querySelector('model');
                const extensions = {};
                for(let i = 0; i < modelNode.attributes.length; i++){
                    const attr = modelNode.attributes[i];
                    if (attr.name.match(/^xmlns:(.+)$/)) extensions[attr.value] = RegExp.$1;
                }
                const modelData = parseModelNode(modelNode);
                modelData['xml'] = modelNode;
                if (0 < Object.keys(extensions).length) modelData['extensions'] = extensions;
                modelParts[modelPart] = modelData;
            }
            //
            for(let i = 0; i < texturesPartNames.length; i++){
                const texturesPartName = texturesPartNames[i];
                texturesParts[texturesPartName] = zip[texturesPartName].buffer;
            }
            return {
                rels: rels,
                modelRels: modelRels,
                model: modelParts,
                printTicket: printTicketParts,
                texture: texturesParts
            };
        }
        function parseRelsXml(relsFileText) {
            const relationships = [];
            const relsXmlData = new DOMParser().parseFromString(relsFileText, 'application/xml');
            const relsNodes = relsXmlData.querySelectorAll('Relationship');
            for(let i = 0; i < relsNodes.length; i++){
                const relsNode = relsNodes[i];
                const relationship = {
                    target: relsNode.getAttribute('Target'),
                    id: relsNode.getAttribute('Id'),
                    type: relsNode.getAttribute('Type') //required
                };
                relationships.push(relationship);
            }
            return relationships;
        }
        function parseMetadataNodes(metadataNodes) {
            const metadataData = {};
            for(let i = 0; i < metadataNodes.length; i++){
                const metadataNode = metadataNodes[i];
                const name = metadataNode.getAttribute('name');
                const validNames = [
                    'Title',
                    'Designer',
                    'Description',
                    'Copyright',
                    'LicenseTerms',
                    'Rating',
                    'CreationDate',
                    'ModificationDate'
                ];
                if (0 <= validNames.indexOf(name)) metadataData[name] = metadataNode.textContent;
            }
            return metadataData;
        }
        function parseBasematerialsNode(basematerialsNode) {
            const basematerialsData = {
                id: basematerialsNode.getAttribute('id'),
                basematerials: []
            };
            const basematerialNodes = basematerialsNode.querySelectorAll('base');
            for(let i = 0; i < basematerialNodes.length; i++){
                const basematerialNode = basematerialNodes[i];
                const basematerialData = parseBasematerialNode(basematerialNode);
                basematerialData.index = i; // the order and count of the material nodes form an implicit 0-based index
                basematerialsData.basematerials.push(basematerialData);
            }
            return basematerialsData;
        }
        function parseTexture2DNode(texture2DNode) {
            const texture2dData = {
                id: texture2DNode.getAttribute('id'),
                path: texture2DNode.getAttribute('path'),
                contenttype: texture2DNode.getAttribute('contenttype'),
                tilestyleu: texture2DNode.getAttribute('tilestyleu'),
                tilestylev: texture2DNode.getAttribute('tilestylev'),
                filter: texture2DNode.getAttribute('filter')
            };
            return texture2dData;
        }
        function parseTextures2DGroupNode(texture2DGroupNode) {
            const texture2DGroupData = {
                id: texture2DGroupNode.getAttribute('id'),
                texid: texture2DGroupNode.getAttribute('texid'),
                displaypropertiesid: texture2DGroupNode.getAttribute('displaypropertiesid')
            };
            const tex2coordNodes = texture2DGroupNode.querySelectorAll('tex2coord');
            const uvs = [];
            for(let i = 0; i < tex2coordNodes.length; i++){
                const tex2coordNode = tex2coordNodes[i];
                const u = tex2coordNode.getAttribute('u');
                const v = tex2coordNode.getAttribute('v');
                uvs.push(parseFloat(u), parseFloat(v));
            }
            texture2DGroupData['uvs'] = new Float32Array(uvs);
            return texture2DGroupData;
        }
        function parseColorGroupNode(colorGroupNode) {
            const colorGroupData = {
                id: colorGroupNode.getAttribute('id'),
                displaypropertiesid: colorGroupNode.getAttribute('displaypropertiesid')
            };
            const colorNodes = colorGroupNode.querySelectorAll('color');
            const colors = [];
            const colorObject = new (0, _three.Color)();
            for(let i = 0; i < colorNodes.length; i++){
                const colorNode = colorNodes[i];
                const color = colorNode.getAttribute('color');
                colorObject.setStyle(color.substring(0, 7), COLOR_SPACE_3MF);
                colors.push(colorObject.r, colorObject.g, colorObject.b);
            }
            colorGroupData['colors'] = new Float32Array(colors);
            return colorGroupData;
        }
        function parseImplicitIONode(implicitIONode) {
            const portNodes = implicitIONode.children;
            const portArguments = {};
            for(let i = 0; i < portNodes.length; i++){
                const args = {
                    type: portNodes[i].nodeName.substring(2)
                };
                for(let j = 0; j < portNodes[i].attributes.length; j++){
                    const attrib = portNodes[i].attributes[j];
                    if (attrib.specified) args[attrib.name] = attrib.value;
                }
                portArguments[portNodes[i].getAttribute('identifier')] = args;
            }
            return portArguments;
        }
        function parseImplicitFunctionNode(implicitFunctionNode) {
            const implicitFunctionData = {
                id: implicitFunctionNode.getAttribute('id'),
                displayname: implicitFunctionNode.getAttribute('displayname')
            };
            const functionNodes = implicitFunctionNode.children;
            const operations = {};
            for(let i = 0; i < functionNodes.length; i++){
                const operatorNode = functionNodes[i];
                if (operatorNode.nodeName === 'i:in' || operatorNode.nodeName === 'i:out') operations[operatorNode.nodeName === 'i:in' ? 'inputs' : 'outputs'] = parseImplicitIONode(operatorNode);
                else {
                    const inputNodes = operatorNode.children;
                    const portArguments = {
                        'op': operatorNode.nodeName.substring(2),
                        'identifier': operatorNode.getAttribute('identifier')
                    };
                    for(let i = 0; i < inputNodes.length; i++)portArguments[inputNodes[i].nodeName.substring(2)] = parseImplicitIONode(inputNodes[i]);
                    operations[portArguments['identifier']] = portArguments;
                }
            }
            implicitFunctionData['operations'] = operations;
            return implicitFunctionData;
        }
        function parseMetallicDisplaypropertiesNode(metallicDisplaypropetiesNode) {
            const metallicDisplaypropertiesData = {
                id: metallicDisplaypropetiesNode.getAttribute('id') // required
            };
            const metallicNodes = metallicDisplaypropetiesNode.querySelectorAll('pbmetallic');
            const metallicData = [];
            for(let i = 0; i < metallicNodes.length; i++){
                const metallicNode = metallicNodes[i];
                metallicData.push({
                    name: metallicNode.getAttribute('name'),
                    metallicness: parseFloat(metallicNode.getAttribute('metallicness')),
                    roughness: parseFloat(metallicNode.getAttribute('roughness')) // required
                });
            }
            metallicDisplaypropertiesData.data = metallicData;
            return metallicDisplaypropertiesData;
        }
        function parseBasematerialNode(basematerialNode) {
            const basematerialData = {};
            basematerialData['name'] = basematerialNode.getAttribute('name'); // required
            basematerialData['displaycolor'] = basematerialNode.getAttribute('displaycolor'); // required
            basematerialData['displaypropertiesid'] = basematerialNode.getAttribute('displaypropertiesid');
            return basematerialData;
        }
        function parseMeshNode(meshNode) {
            const meshData = {};
            const vertices = [];
            const vertexNodes = meshNode.querySelectorAll('vertices vertex');
            for(let i = 0; i < vertexNodes.length; i++){
                const vertexNode = vertexNodes[i];
                const x = vertexNode.getAttribute('x');
                const y = vertexNode.getAttribute('y');
                const z = vertexNode.getAttribute('z');
                vertices.push(parseFloat(x), parseFloat(y), parseFloat(z));
            }
            meshData['vertices'] = new Float32Array(vertices);
            const triangleProperties = [];
            const triangles = [];
            const triangleNodes = meshNode.querySelectorAll('triangles triangle');
            for(let i = 0; i < triangleNodes.length; i++){
                const triangleNode = triangleNodes[i];
                const v1 = triangleNode.getAttribute('v1');
                const v2 = triangleNode.getAttribute('v2');
                const v3 = triangleNode.getAttribute('v3');
                const p1 = triangleNode.getAttribute('p1');
                const p2 = triangleNode.getAttribute('p2');
                const p3 = triangleNode.getAttribute('p3');
                const pid = triangleNode.getAttribute('pid');
                const triangleProperty = {};
                triangleProperty['v1'] = parseInt(v1, 10);
                triangleProperty['v2'] = parseInt(v2, 10);
                triangleProperty['v3'] = parseInt(v3, 10);
                triangles.push(triangleProperty['v1'], triangleProperty['v2'], triangleProperty['v3']);
                // optional
                if (p1) triangleProperty['p1'] = parseInt(p1, 10);
                if (p2) triangleProperty['p2'] = parseInt(p2, 10);
                if (p3) triangleProperty['p3'] = parseInt(p3, 10);
                if (pid) triangleProperty['pid'] = pid;
                if (0 < Object.keys(triangleProperty).length) triangleProperties.push(triangleProperty);
            }
            meshData['triangleProperties'] = triangleProperties;
            meshData['triangles'] = new Uint32Array(triangles);
            return meshData;
        }
        function parseComponentsNode(componentsNode) {
            const components = [];
            const componentNodes = componentsNode.querySelectorAll('component');
            for(let i = 0; i < componentNodes.length; i++){
                const componentNode = componentNodes[i];
                const componentData = parseComponentNode(componentNode);
                components.push(componentData);
            }
            return components;
        }
        function parseComponentNode(componentNode) {
            const componentData = {};
            componentData['objectId'] = componentNode.getAttribute('objectid'); // required
            const transform = componentNode.getAttribute('transform');
            if (transform) componentData['transform'] = parseTransform(transform);
            return componentData;
        }
        function parseTransform(transform) {
            const t = [];
            transform.split(' ').forEach(function(s) {
                t.push(parseFloat(s));
            });
            const matrix = new (0, _three.Matrix4)();
            matrix.set(t[0], t[3], t[6], t[9], t[1], t[4], t[7], t[10], t[2], t[5], t[8], t[11], 0.0, 0.0, 0.0, 1.0);
            return matrix;
        }
        function parseObjectNode(objectNode) {
            const objectData = {
                type: objectNode.getAttribute('type')
            };
            const id = objectNode.getAttribute('id');
            if (id) objectData['id'] = id;
            const pid = objectNode.getAttribute('pid');
            if (pid) objectData['pid'] = pid;
            const pindex = objectNode.getAttribute('pindex');
            if (pindex) objectData['pindex'] = pindex;
            const thumbnail = objectNode.getAttribute('thumbnail');
            if (thumbnail) objectData['thumbnail'] = thumbnail;
            const partnumber = objectNode.getAttribute('partnumber');
            if (partnumber) objectData['partnumber'] = partnumber;
            const name = objectNode.getAttribute('name');
            if (name) objectData['name'] = name;
            const meshNode = objectNode.querySelector('mesh');
            if (meshNode) objectData['mesh'] = parseMeshNode(meshNode);
            const componentsNode = objectNode.querySelector('components');
            if (componentsNode) objectData['components'] = parseComponentsNode(componentsNode);
            return objectData;
        }
        function parseResourcesNode(resourcesNode) {
            const resourcesData = {};
            resourcesData['basematerials'] = {};
            const basematerialsNodes = resourcesNode.querySelectorAll('basematerials');
            for(let i = 0; i < basematerialsNodes.length; i++){
                const basematerialsNode = basematerialsNodes[i];
                const basematerialsData = parseBasematerialsNode(basematerialsNode);
                resourcesData['basematerials'][basematerialsData['id']] = basematerialsData;
            }
            //
            resourcesData['texture2d'] = {};
            const textures2DNodes = resourcesNode.querySelectorAll('texture2d');
            for(let i = 0; i < textures2DNodes.length; i++){
                const textures2DNode = textures2DNodes[i];
                const texture2DData = parseTexture2DNode(textures2DNode);
                resourcesData['texture2d'][texture2DData['id']] = texture2DData;
            }
            //
            resourcesData['colorgroup'] = {};
            const colorGroupNodes = resourcesNode.querySelectorAll('colorgroup');
            for(let i = 0; i < colorGroupNodes.length; i++){
                const colorGroupNode = colorGroupNodes[i];
                const colorGroupData = parseColorGroupNode(colorGroupNode);
                resourcesData['colorgroup'][colorGroupData['id']] = colorGroupData;
            }
            //
            const implicitFunctionNodes = resourcesNode.querySelectorAll('implicitfunction');
            if (implicitFunctionNodes.length > 0) resourcesData['implicitfunction'] = {};
            for(let i = 0; i < implicitFunctionNodes.length; i++){
                const implicitFunctionNode = implicitFunctionNodes[i];
                const implicitFunctionData = parseImplicitFunctionNode(implicitFunctionNode);
                resourcesData['implicitfunction'][implicitFunctionData['id']] = implicitFunctionData;
            }
            //
            resourcesData['pbmetallicdisplayproperties'] = {};
            const pbmetallicdisplaypropertiesNodes = resourcesNode.querySelectorAll('pbmetallicdisplayproperties');
            for(let i = 0; i < pbmetallicdisplaypropertiesNodes.length; i++){
                const pbmetallicdisplaypropertiesNode = pbmetallicdisplaypropertiesNodes[i];
                const pbmetallicdisplaypropertiesData = parseMetallicDisplaypropertiesNode(pbmetallicdisplaypropertiesNode);
                resourcesData['pbmetallicdisplayproperties'][pbmetallicdisplaypropertiesData['id']] = pbmetallicdisplaypropertiesData;
            }
            //
            resourcesData['texture2dgroup'] = {};
            const textures2DGroupNodes = resourcesNode.querySelectorAll('texture2dgroup');
            for(let i = 0; i < textures2DGroupNodes.length; i++){
                const textures2DGroupNode = textures2DGroupNodes[i];
                const textures2DGroupData = parseTextures2DGroupNode(textures2DGroupNode);
                resourcesData['texture2dgroup'][textures2DGroupData['id']] = textures2DGroupData;
            }
            //
            resourcesData['object'] = {};
            const objectNodes = resourcesNode.querySelectorAll('object');
            for(let i = 0; i < objectNodes.length; i++){
                const objectNode = objectNodes[i];
                const objectData = parseObjectNode(objectNode);
                resourcesData['object'][objectData['id']] = objectData;
            }
            return resourcesData;
        }
        function parseBuildNode(buildNode) {
            const buildData = [];
            const itemNodes = buildNode.querySelectorAll('item');
            for(let i = 0; i < itemNodes.length; i++){
                const itemNode = itemNodes[i];
                const buildItem = {
                    objectId: itemNode.getAttribute('objectid')
                };
                const transform = itemNode.getAttribute('transform');
                if (transform) buildItem['transform'] = parseTransform(transform);
                buildData.push(buildItem);
            }
            return buildData;
        }
        function parseModelNode(modelNode) {
            const modelData = {
                unit: modelNode.getAttribute('unit') || 'millimeter'
            };
            const metadataNodes = modelNode.querySelectorAll('metadata');
            if (metadataNodes) modelData['metadata'] = parseMetadataNodes(metadataNodes);
            const resourcesNode = modelNode.querySelector('resources');
            if (resourcesNode) modelData['resources'] = parseResourcesNode(resourcesNode);
            const buildNode = modelNode.querySelector('build');
            if (buildNode) modelData['build'] = parseBuildNode(buildNode);
            return modelData;
        }
        function buildTexture(texture2dgroup, objects, modelData, textureData) {
            const texid = texture2dgroup.texid;
            const texture2ds = modelData.resources.texture2d;
            const texture2d = texture2ds[texid];
            if (texture2d) {
                const data = textureData[texture2d.path];
                const type = texture2d.contenttype;
                const blob = new Blob([
                    data
                ], {
                    type: type
                });
                const sourceURI = URL.createObjectURL(blob);
                const texture = textureLoader.load(sourceURI, function() {
                    URL.revokeObjectURL(sourceURI);
                });
                texture.colorSpace = COLOR_SPACE_3MF;
                // texture parameters
                switch(texture2d.tilestyleu){
                    case 'wrap':
                        texture.wrapS = (0, _three.RepeatWrapping);
                        break;
                    case 'mirror':
                        texture.wrapS = (0, _three.MirroredRepeatWrapping);
                        break;
                    case 'none':
                    case 'clamp':
                        texture.wrapS = (0, _three.ClampToEdgeWrapping);
                        break;
                    default:
                        texture.wrapS = (0, _three.RepeatWrapping);
                }
                switch(texture2d.tilestylev){
                    case 'wrap':
                        texture.wrapT = (0, _three.RepeatWrapping);
                        break;
                    case 'mirror':
                        texture.wrapT = (0, _three.MirroredRepeatWrapping);
                        break;
                    case 'none':
                    case 'clamp':
                        texture.wrapT = (0, _three.ClampToEdgeWrapping);
                        break;
                    default:
                        texture.wrapT = (0, _three.RepeatWrapping);
                }
                switch(texture2d.filter){
                    case 'auto':
                        texture.magFilter = (0, _three.LinearFilter);
                        texture.minFilter = (0, _three.LinearMipmapLinearFilter);
                        break;
                    case 'linear':
                        texture.magFilter = (0, _three.LinearFilter);
                        texture.minFilter = (0, _three.LinearFilter);
                        texture.generateMipmaps = false;
                        break;
                    case 'nearest':
                        texture.magFilter = (0, _three.NearestFilter);
                        texture.minFilter = (0, _three.NearestFilter);
                        texture.generateMipmaps = false;
                        break;
                    default:
                        texture.magFilter = (0, _three.LinearFilter);
                        texture.minFilter = (0, _three.LinearMipmapLinearFilter);
                }
                return texture;
            } else return null;
        }
        function buildBasematerialsMeshes(basematerials, triangleProperties, meshData, objects, modelData, textureData, objectData) {
            const objectPindex = objectData.pindex;
            const materialMap = {};
            for(let i = 0, l = triangleProperties.length; i < l; i++){
                const triangleProperty = triangleProperties[i];
                const pindex = triangleProperty.p1 !== undefined ? triangleProperty.p1 : objectPindex;
                if (materialMap[pindex] === undefined) materialMap[pindex] = [];
                materialMap[pindex].push(triangleProperty);
            }
            //
            const keys = Object.keys(materialMap);
            const meshes = [];
            for(let i = 0, l = keys.length; i < l; i++){
                const materialIndex = keys[i];
                const trianglePropertiesProps = materialMap[materialIndex];
                const basematerialData = basematerials.basematerials[materialIndex];
                const material = getBuild(basematerialData, objects, modelData, textureData, objectData, buildBasematerial);
                //
                const geometry = new (0, _three.BufferGeometry)();
                const positionData = [];
                const vertices = meshData.vertices;
                for(let j = 0, jl = trianglePropertiesProps.length; j < jl; j++){
                    const triangleProperty = trianglePropertiesProps[j];
                    positionData.push(vertices[triangleProperty.v1 * 3 + 0]);
                    positionData.push(vertices[triangleProperty.v1 * 3 + 1]);
                    positionData.push(vertices[triangleProperty.v1 * 3 + 2]);
                    positionData.push(vertices[triangleProperty.v2 * 3 + 0]);
                    positionData.push(vertices[triangleProperty.v2 * 3 + 1]);
                    positionData.push(vertices[triangleProperty.v2 * 3 + 2]);
                    positionData.push(vertices[triangleProperty.v3 * 3 + 0]);
                    positionData.push(vertices[triangleProperty.v3 * 3 + 1]);
                    positionData.push(vertices[triangleProperty.v3 * 3 + 2]);
                }
                geometry.setAttribute('position', new (0, _three.Float32BufferAttribute)(positionData, 3));
                //
                const mesh = new (0, _three.Mesh)(geometry, material);
                meshes.push(mesh);
            }
            return meshes;
        }
        function buildTexturedMesh(texture2dgroup, triangleProperties, meshData, objects, modelData, textureData, objectData) {
            // geometry
            const geometry = new (0, _three.BufferGeometry)();
            const positionData = [];
            const uvData = [];
            const vertices = meshData.vertices;
            const uvs = texture2dgroup.uvs;
            for(let i = 0, l = triangleProperties.length; i < l; i++){
                const triangleProperty = triangleProperties[i];
                positionData.push(vertices[triangleProperty.v1 * 3 + 0]);
                positionData.push(vertices[triangleProperty.v1 * 3 + 1]);
                positionData.push(vertices[triangleProperty.v1 * 3 + 2]);
                positionData.push(vertices[triangleProperty.v2 * 3 + 0]);
                positionData.push(vertices[triangleProperty.v2 * 3 + 1]);
                positionData.push(vertices[triangleProperty.v2 * 3 + 2]);
                positionData.push(vertices[triangleProperty.v3 * 3 + 0]);
                positionData.push(vertices[triangleProperty.v3 * 3 + 1]);
                positionData.push(vertices[triangleProperty.v3 * 3 + 2]);
                //
                uvData.push(uvs[triangleProperty.p1 * 2 + 0]);
                uvData.push(uvs[triangleProperty.p1 * 2 + 1]);
                uvData.push(uvs[triangleProperty.p2 * 2 + 0]);
                uvData.push(uvs[triangleProperty.p2 * 2 + 1]);
                uvData.push(uvs[triangleProperty.p3 * 2 + 0]);
                uvData.push(uvs[triangleProperty.p3 * 2 + 1]);
            }
            geometry.setAttribute('position', new (0, _three.Float32BufferAttribute)(positionData, 3));
            geometry.setAttribute('uv', new (0, _three.Float32BufferAttribute)(uvData, 2));
            // material
            const texture = getBuild(texture2dgroup, objects, modelData, textureData, objectData, buildTexture);
            const material = new (0, _three.MeshPhongMaterial)({
                map: texture,
                flatShading: true
            });
            // mesh
            const mesh = new (0, _three.Mesh)(geometry, material);
            return mesh;
        }
        function buildVertexColorMesh(colorgroup, triangleProperties, meshData, objectData) {
            // geometry
            const geometry = new (0, _three.BufferGeometry)();
            const positionData = [];
            const colorData = [];
            const vertices = meshData.vertices;
            const colors = colorgroup.colors;
            for(let i = 0, l = triangleProperties.length; i < l; i++){
                const triangleProperty = triangleProperties[i];
                const v1 = triangleProperty.v1;
                const v2 = triangleProperty.v2;
                const v3 = triangleProperty.v3;
                positionData.push(vertices[v1 * 3 + 0]);
                positionData.push(vertices[v1 * 3 + 1]);
                positionData.push(vertices[v1 * 3 + 2]);
                positionData.push(vertices[v2 * 3 + 0]);
                positionData.push(vertices[v2 * 3 + 1]);
                positionData.push(vertices[v2 * 3 + 2]);
                positionData.push(vertices[v3 * 3 + 0]);
                positionData.push(vertices[v3 * 3 + 1]);
                positionData.push(vertices[v3 * 3 + 2]);
                //
                const p1 = triangleProperty.p1 !== undefined ? triangleProperty.p1 : objectData.pindex;
                const p2 = triangleProperty.p2 !== undefined ? triangleProperty.p2 : p1;
                const p3 = triangleProperty.p3 !== undefined ? triangleProperty.p3 : p1;
                colorData.push(colors[p1 * 3 + 0]);
                colorData.push(colors[p1 * 3 + 1]);
                colorData.push(colors[p1 * 3 + 2]);
                colorData.push(colors[p2 * 3 + 0]);
                colorData.push(colors[p2 * 3 + 1]);
                colorData.push(colors[p2 * 3 + 2]);
                colorData.push(colors[p3 * 3 + 0]);
                colorData.push(colors[p3 * 3 + 1]);
                colorData.push(colors[p3 * 3 + 2]);
            }
            geometry.setAttribute('position', new (0, _three.Float32BufferAttribute)(positionData, 3));
            geometry.setAttribute('color', new (0, _three.Float32BufferAttribute)(colorData, 3));
            // material
            const material = new (0, _three.MeshPhongMaterial)({
                vertexColors: true,
                flatShading: true
            });
            // mesh
            const mesh = new (0, _three.Mesh)(geometry, material);
            return mesh;
        }
        function buildDefaultMesh(meshData) {
            const geometry = new (0, _three.BufferGeometry)();
            geometry.setIndex(new (0, _three.BufferAttribute)(meshData['triangles'], 1));
            geometry.setAttribute('position', new (0, _three.BufferAttribute)(meshData['vertices'], 3));
            const material = new (0, _three.MeshPhongMaterial)({
                name: (0, _three.Loader).DEFAULT_MATERIAL_NAME,
                color: 0xffffff,
                flatShading: true
            });
            const mesh = new (0, _three.Mesh)(geometry, material);
            return mesh;
        }
        function buildMeshes(resourceMap, meshData, objects, modelData, textureData, objectData) {
            const keys = Object.keys(resourceMap);
            const meshes = [];
            for(let i = 0, il = keys.length; i < il; i++){
                const resourceId = keys[i];
                const triangleProperties = resourceMap[resourceId];
                const resourceType = getResourceType(resourceId, modelData);
                switch(resourceType){
                    case 'material':
                        const basematerials = modelData.resources.basematerials[resourceId];
                        const newMeshes = buildBasematerialsMeshes(basematerials, triangleProperties, meshData, objects, modelData, textureData, objectData);
                        for(let j = 0, jl = newMeshes.length; j < jl; j++)meshes.push(newMeshes[j]);
                        break;
                    case 'texture':
                        const texture2dgroup = modelData.resources.texture2dgroup[resourceId];
                        meshes.push(buildTexturedMesh(texture2dgroup, triangleProperties, meshData, objects, modelData, textureData, objectData));
                        break;
                    case 'vertexColors':
                        const colorgroup = modelData.resources.colorgroup[resourceId];
                        meshes.push(buildVertexColorMesh(colorgroup, triangleProperties, meshData, objectData));
                        break;
                    case 'default':
                        meshes.push(buildDefaultMesh(meshData));
                        break;
                    default:
                        console.error('THREE.3MFLoader: Unsupported resource type.');
                }
            }
            if (objectData.name) for(let i = 0; i < meshes.length; i++)meshes[i].name = objectData.name;
            return meshes;
        }
        function getResourceType(pid, modelData) {
            if (modelData.resources.texture2dgroup[pid] !== undefined) return 'texture';
            else if (modelData.resources.basematerials[pid] !== undefined) return 'material';
            else if (modelData.resources.colorgroup[pid] !== undefined) return 'vertexColors';
            else if (pid === 'default') return 'default';
            else return undefined;
        }
        function analyzeObject(meshData, objectData) {
            const resourceMap = {};
            const triangleProperties = meshData['triangleProperties'];
            const objectPid = objectData.pid;
            for(let i = 0, l = triangleProperties.length; i < l; i++){
                const triangleProperty = triangleProperties[i];
                let pid = triangleProperty.pid !== undefined ? triangleProperty.pid : objectPid;
                if (pid === undefined) pid = 'default';
                if (resourceMap[pid] === undefined) resourceMap[pid] = [];
                resourceMap[pid].push(triangleProperty);
            }
            return resourceMap;
        }
        function buildGroup(meshData, objects, modelData, textureData, objectData) {
            const group = new (0, _three.Group)();
            const resourceMap = analyzeObject(meshData, objectData);
            const meshes = buildMeshes(resourceMap, meshData, objects, modelData, textureData, objectData);
            for(let i = 0, l = meshes.length; i < l; i++)group.add(meshes[i]);
            return group;
        }
        function applyExtensions(extensions, meshData, modelXml) {
            if (!extensions) return;
            const availableExtensions = [];
            const keys = Object.keys(extensions);
            for(let i = 0; i < keys.length; i++){
                const ns = keys[i];
                for(let j = 0; j < scope.availableExtensions.length; j++){
                    const extension = scope.availableExtensions[j];
                    if (extension.ns === ns) availableExtensions.push(extension);
                }
            }
            for(let i = 0; i < availableExtensions.length; i++){
                const extension = availableExtensions[i];
                extension.apply(modelXml, extensions[extension['ns']], meshData);
            }
        }
        function getBuild(data, objects, modelData, textureData, objectData, builder) {
            if (data.build !== undefined) return data.build;
            data.build = builder(data, objects, modelData, textureData, objectData);
            return data.build;
        }
        function buildBasematerial(materialData, objects, modelData) {
            let material;
            const displaypropertiesid = materialData.displaypropertiesid;
            const pbmetallicdisplayproperties = modelData.resources.pbmetallicdisplayproperties;
            if (displaypropertiesid !== null && pbmetallicdisplayproperties[displaypropertiesid] !== undefined) {
                // metallic display property, use StandardMaterial
                const pbmetallicdisplayproperty = pbmetallicdisplayproperties[displaypropertiesid];
                const metallicData = pbmetallicdisplayproperty.data[materialData.index];
                material = new (0, _three.MeshStandardMaterial)({
                    flatShading: true,
                    roughness: metallicData.roughness,
                    metalness: metallicData.metallicness
                });
            } else // otherwise use PhongMaterial
            material = new (0, _three.MeshPhongMaterial)({
                flatShading: true
            });
            material.name = materialData.name;
            // displaycolor MUST be specified with a value of a 6 or 8 digit hexadecimal number, e.g. "#RRGGBB" or "#RRGGBBAA"
            const displaycolor = materialData.displaycolor;
            const color = displaycolor.substring(0, 7);
            material.color.setStyle(color, COLOR_SPACE_3MF);
            // process alpha if set
            if (displaycolor.length === 9) material.opacity = parseInt(displaycolor.charAt(7) + displaycolor.charAt(8), 16) / 255;
            return material;
        }
        function buildComposite(compositeData, objects, modelData, textureData) {
            const composite = new (0, _three.Group)();
            for(let j = 0; j < compositeData.length; j++){
                const component = compositeData[j];
                let build = objects[component.objectId];
                if (build === undefined) {
                    buildObject(component.objectId, objects, modelData, textureData);
                    build = objects[component.objectId];
                }
                const object3D = build.clone();
                // apply component transform
                const transform = component.transform;
                if (transform) object3D.applyMatrix4(transform);
                composite.add(object3D);
            }
            return composite;
        }
        function buildObject(objectId, objects, modelData, textureData) {
            const objectData = modelData['resources']['object'][objectId];
            if (objectData['mesh']) {
                const meshData = objectData['mesh'];
                const extensions = modelData['extensions'];
                const modelXml = modelData['xml'];
                applyExtensions(extensions, meshData, modelXml);
                objects[objectData.id] = getBuild(meshData, objects, modelData, textureData, objectData, buildGroup);
            } else {
                const compositeData = objectData['components'];
                objects[objectData.id] = getBuild(compositeData, objects, modelData, textureData, objectData, buildComposite);
            }
            if (objectData.name) objects[objectData.id].name = objectData.name;
            if (modelData.resources.implicitfunction) console.warn('THREE.ThreeMFLoader: Implicit Functions are implemented in data-only.', modelData.resources.implicitfunction);
        }
        function buildObjects(data3mf) {
            const modelsData = data3mf.model;
            const modelRels = data3mf.modelRels;
            const objects = {};
            const modelsKeys = Object.keys(modelsData);
            const textureData = {};
            // evaluate model relationships to textures
            if (modelRels) for(let i = 0, l = modelRels.length; i < l; i++){
                const modelRel = modelRels[i];
                const textureKey = modelRel.target.substring(1);
                if (data3mf.texture[textureKey]) textureData[modelRel.target] = data3mf.texture[textureKey];
            }
            // start build
            for(let i = 0; i < modelsKeys.length; i++){
                const modelsKey = modelsKeys[i];
                const modelData = modelsData[modelsKey];
                const objectIds = Object.keys(modelData['resources']['object']);
                for(let j = 0; j < objectIds.length; j++){
                    const objectId = objectIds[j];
                    buildObject(objectId, objects, modelData, textureData);
                }
            }
            return objects;
        }
        function fetch3DModelPart(rels) {
            for(let i = 0; i < rels.length; i++){
                const rel = rels[i];
                const extension = rel.target.split('.').pop();
                if (extension.toLowerCase() === 'model') return rel;
            }
        }
        function build(objects, data3mf) {
            const group = new (0, _three.Group)();
            const relationship = fetch3DModelPart(data3mf['rels']);
            const buildData = data3mf.model[relationship['target'].substring(1)]['build'];
            for(let i = 0; i < buildData.length; i++){
                const buildItem = buildData[i];
                const object3D = objects[buildItem['objectId']].clone();
                // apply transform
                const transform = buildItem['transform'];
                if (transform) object3D.applyMatrix4(transform);
                group.add(object3D);
            }
            return group;
        }
        const data3mf = loadDocument(data);
        const objects = buildObjects(data3mf);
        return build(objects, data3mf);
    }
    /**
	 * Adds a 3MF extension.
	 *
	 * @param {Object} extension - The extension to add.
	 */ addExtension(extension) {
        this.availableExtensions.push(extension);
    }
}

},{"three":"hJIVG","../libs/fflate.module.js":"4fbyW","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}]},["c2m1T"], null, "parcelRequire6840", {})

//# sourceMappingURL=3MFLoader.8c584f39.js.map
