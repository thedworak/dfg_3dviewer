import { t, c as createTurnstile, e as exampleAssetUrl, G as GALLERY_IMAGE_EXT, f as fillModelThumbnail, m as metaCaption, a as metaPart, b as modelCheckPart, s as setLanguageSource, d as createPasswordField } from './feature-icons-CL_uEPpa.js';
import { m as modelBasename } from './model-extension-BDXGpmfH.js';

// Worker endpoints for the admin pages. On the web they are same-origin
// like the viewer's: the session is the worker's cookie (worker/auth.py).
// In the app (ui/admin-panel.js opens this page with ?app=1&remote=<url>)
// they go to the repository the app is connected to, with the app's
// session token as a Bearer header - kept where the app keeps it
// (remote.js, "dfg3dviewer-session"), so a login or a second step here
// counts in the app's viewer as well. /api/auth/* answers anyone,
// /api/admin/* only an admin session that passed the second step
// (server.py _require_admin, _admin_second_step_ok).

const params = new URLSearchParams(location.search);
const SESSION_KEY = "dfg3dviewer-session";
// The app's "remember this device" for the second step, per repository (on
// the web it is the worker's HttpOnly cookie).
const DEVICE_KEY = "dfg3dviewer-admin-device";

const appMode = params.get("app") === "1";
const remote = appMode ? String(params.get("remote") || "").replace(/\/+$/, "") : "";

function readSessions(key = SESSION_KEY) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}") || {};
  } catch {
    return {};
  }
}

function writeSessions(key, sessions) {
  try {
    localStorage.setItem(key, JSON.stringify(sessions));
  } catch {
    // Storage blocked: the panel keeps working until it is closed.
  }
}

function storeDeviceToken(token) {
  if (!appMode) return;
  const devices = readSessions(DEVICE_KEY);
  if (token) devices[remote] = token;
  else delete devices[remote];
  writeSessions(DEVICE_KEY, devices);
}

function sessionToken() {
  return appMode ? readSessions()[remote] || "" : "";
}

// A new session from logging in or from the second step (in the app; on
// the web the worker sets the cookie itself).
function storeSessionToken(token) {
  if (!appMode) return;
  const sessions = readSessions();
  if (token) sessions[remote] = token;
  else delete sessions[remote];
  writeSessions(SESSION_KEY, sessions);
}

// Site-relative URLs the worker returns (/files/...): on the repository.
const remoteUrl = (path) => (appMode && path?.startsWith("/") ? remote + path : path);

async function apiRequest(endpoint, method = "GET", body = undefined) {
  const options = { method, credentials: appMode ? "omit" : "same-origin", headers: {} };
  const token = sessionToken();
  if (token) options.headers.Authorization = `Bearer ${token}`;
  const device = appMode ? readSessions(DEVICE_KEY)[remote] : "";
  if (device) options.headers["X-Admin-Device"] = device;
  if (body !== undefined) {
    // In the app the token comes back in the answer, not as a cookie.
    if (appMode && endpoint.startsWith("/api/auth/") && body && typeof body === "object") body = { ...body, session: "token" };
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(remoteUrl(endpoint), options);
  let data = {};
  try {
    data = await response.json();
  } catch (_error) {
    // Non-JSON error page (e.g. from a proxy) - fall through with the status.
  }
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.code = data.code;
    // The second step is due (again): main.js asks for it.
    if (data.code === "2fa_required" || data.code === "2fa_setup_required") {
      window.dispatchEvent(new CustomEvent("exadmin:second-step", { detail: data.code }));
    }
    throw error;
  }
  if (data.token) storeSessionToken(data.token);
  if (data.deviceToken) storeDeviceToken(data.deviceToken);
  // Something was changed (an account approved, a report resolved, a
  // model deleted): the navigation's counters are read again (main.js).
  if (method !== "GET" && !endpoint.startsWith("/api/auth/")) {
    window.dispatchEvent(new Event("exadmin:changed"));
  }
  return data;
}

const authRequest = (path, body) => apiRequest(`/api/auth/${path}`, body ? "POST" : "GET", body);

// GET /api/jobs includes each job's `owner` username (worker/server.py
// list_jobs): each user's models without an endpoint of their own. Jobs
// without an owner are keyed "".
async function fetchJobsByOwner() {
  const data = await apiRequest("/api/jobs");
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const byOwner = new Map();
  for (const job of jobs) {
    const owner = job.owner || "";
    if (!byOwner.has(owner)) byOwner.set(owner, []);
    byOwner.get(owner).push(job);
  }
  return byOwner;
}

// Replaces window.confirm(), styled like the viewer's (upload-panel.css
// .viewer-confirm). Resolves true on confirm, false on cancel, Escape or a
// click beside it.
function confirmDialog({ message, confirmLabel, cancelLabel, danger = false, input = null }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "viewer-confirm-backdrop exadmin-confirm-backdrop";
    backdrop.innerHTML = `
      <div class="viewer-confirm" role="alertdialog" aria-modal="true" aria-describedby="exadminConfirmMessage">
        <p id="exadminConfirmMessage" class="viewer-confirm-message"></p>
        <label class="exadmin-confirm-input" hidden><span></span><textarea rows="4" maxlength="2000"></textarea></label>
        <div class="viewer-confirm-actions">
          <button type="button" class="viewer-confirm-cancel"></button>
          <button type="button" class="viewer-confirm-ok${danger ? " viewer-confirm-ok--danger" : ""}"></button>
        </div>
      </div>`;
    backdrop.querySelector(".viewer-confirm-message").textContent = message;
    const cancel = backdrop.querySelector(".viewer-confirm-cancel");
    const ok = backdrop.querySelector(".viewer-confirm-ok");
    cancel.textContent = cancelLabel;
    ok.textContent = confirmLabel;
    // With `input` ({label, placeholder}): a text to give, resolved in place
    // of true (an empty string when left empty), null on cancel.
    const field = backdrop.querySelector(".exadmin-confirm-input");
    const textarea = field.querySelector("textarea");
    if (input) {
      field.hidden = false;
      field.querySelector("span").textContent = input.label || "";
      textarea.placeholder = input.placeholder || "";
    }

    const finish = (value) => {
      if (input) value = value ? textarea.value.trim() : null;
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    cancel.addEventListener("click", () => finish(false));
    ok.addEventListener("click", () => finish(true));
    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop) finish(false);
    });

    document.body.appendChild(backdrop);
    if (input) textarea.focus();
    else cancel.focus();
  });
}

const TOAST_MS = 3500;

// A short message in the corner: `key` from the viewer's toasts.* texts.
function toast(key, tone = "info") {
  let host = document.getElementById("exadminToasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "exadminToasts";
    host.className = "exadmin-toasts";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  const item = document.createElement("div");
  item.className = "exadmin-toast";
  item.dataset.tone = tone;
  item.textContent = t(`toasts.${key}`, key);
  host.appendChild(item);
  setTimeout(() => item.remove(), TOAST_MS);
}

// The admin pages opened inside the app (ui/admin-panel.js shows them in
// a frame over the viewer): closing them and opening a model go to the
// app's viewer as messages; opened on their own, they navigate.

const embedded = appMode && window.parent !== window;

function post(message) {
  window.parent.postMessage({ source: "exadmin", ...message }, location.origin);
}

function closePanel() {
  if (embedded) post({ type: "close" });
  else location.href = appMode ? "../index.html" : "../";
}

// A model of the repository, opened in the viewer the way its own model
// list opens it ({id, modelUrl, imageUrls}).
function openModel(job) {
  if (embedded) post({ type: "open-model", job: { id: job.id, modelUrl: job.modelUrl, imageUrls: job.imageUrls || [] } });
}

// A link to a model: in the app a button that hands it to the viewer, on
// the web the viewer's address in a new tab.
function modelLink(job, text) {
  if (appMode) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.disabled = !embedded;
    button.addEventListener("click", () => openModel(job));
    return button;
  }
  const link = document.createElement("a");
  link.href = `../?model=${encodeURIComponent(job.modelUrl)}`;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = text;
  return link;
}

//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// qrcode
//---------------------------------------------------------------------

/**
 * qrcode
 * @param typeNumber 1 to 40
 * @param errorCorrectionLevel 'L','M','Q','H'
 */
const qrcode = function(typeNumber, errorCorrectionLevel) {

  const PAD0 = 0xEC;
  const PAD1 = 0x11;

  let _typeNumber = typeNumber;
  const _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
  let _modules = null;
  let _moduleCount = 0;
  let _dataCache = null;
  const _dataList = [];

  const _this = {};

  const makeImpl = function(test, maskPattern) {

    _moduleCount = _typeNumber * 4 + 17;
    _modules = function(moduleCount) {
      const modules = new Array(moduleCount);
      for (let row = 0; row < moduleCount; row += 1) {
        modules[row] = new Array(moduleCount);
        for (let col = 0; col < moduleCount; col += 1) {
          modules[row][col] = null;
        }
      }
      return modules;
    }(_moduleCount);

    setupPositionProbePattern(0, 0);
    setupPositionProbePattern(_moduleCount - 7, 0);
    setupPositionProbePattern(0, _moduleCount - 7);
    setupPositionAdjustPattern();
    setupTimingPattern();
    setupTypeInfo(test, maskPattern);

    if (_typeNumber >= 7) {
      setupTypeNumber(test);
    }

    if (_dataCache == null) {
      _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
    }

    mapData(_dataCache, maskPattern);
  };

  const setupPositionProbePattern = function(row, col) {

    for (let r = -1; r <= 7; r += 1) {

      if (row + r <= -1 || _moduleCount <= row + r) continue;

      for (let c = -1; c <= 7; c += 1) {

        if (col + c <= -1 || _moduleCount <= col + c) continue;

        if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
            || (0 <= c && c <= 6 && (r == 0 || r == 6) )
            || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
          _modules[row + r][col + c] = true;
        } else {
          _modules[row + r][col + c] = false;
        }
      }
    }
  };

  const getBestMaskPattern = function() {

    let minLostPoint = 0;
    let pattern = 0;

    for (let i = 0; i < 8; i += 1) {

      makeImpl(true, i);

      const lostPoint = QRUtil.getLostPoint(_this);

      if (i == 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint;
        pattern = i;
      }
    }

    return pattern;
  };

  const setupTimingPattern = function() {

    for (let r = 8; r < _moduleCount - 8; r += 1) {
      if (_modules[r][6] != null) {
        continue;
      }
      _modules[r][6] = (r % 2 == 0);
    }

    for (let c = 8; c < _moduleCount - 8; c += 1) {
      if (_modules[6][c] != null) {
        continue;
      }
      _modules[6][c] = (c % 2 == 0);
    }
  };

  const setupPositionAdjustPattern = function() {

    const pos = QRUtil.getPatternPosition(_typeNumber);

    for (let i = 0; i < pos.length; i += 1) {

      for (let j = 0; j < pos.length; j += 1) {

        const row = pos[i];
        const col = pos[j];

        if (_modules[row][col] != null) {
          continue;
        }

        for (let r = -2; r <= 2; r += 1) {

          for (let c = -2; c <= 2; c += 1) {

            if (r == -2 || r == 2 || c == -2 || c == 2
                || (r == 0 && c == 0) ) {
              _modules[row + r][col + c] = true;
            } else {
              _modules[row + r][col + c] = false;
            }
          }
        }
      }
    }
  };

  const setupTypeNumber = function(test) {

    const bits = QRUtil.getBCHTypeNumber(_typeNumber);

    for (let i = 0; i < 18; i += 1) {
      const mod = (!test && ( (bits >> i) & 1) == 1);
      _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
    }

    for (let i = 0; i < 18; i += 1) {
      const mod = (!test && ( (bits >> i) & 1) == 1);
      _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    }
  };

  const setupTypeInfo = function(test, maskPattern) {

    const data = (_errorCorrectionLevel << 3) | maskPattern;
    const bits = QRUtil.getBCHTypeInfo(data);

    // vertical
    for (let i = 0; i < 15; i += 1) {

      const mod = (!test && ( (bits >> i) & 1) == 1);

      if (i < 6) {
        _modules[i][8] = mod;
      } else if (i < 8) {
        _modules[i + 1][8] = mod;
      } else {
        _modules[_moduleCount - 15 + i][8] = mod;
      }
    }

    // horizontal
    for (let i = 0; i < 15; i += 1) {

      const mod = (!test && ( (bits >> i) & 1) == 1);

      if (i < 8) {
        _modules[8][_moduleCount - i - 1] = mod;
      } else if (i < 9) {
        _modules[8][15 - i - 1 + 1] = mod;
      } else {
        _modules[8][15 - i - 1] = mod;
      }
    }

    // fixed module
    _modules[_moduleCount - 8][8] = (!test);
  };

  const mapData = function(data, maskPattern) {

    let inc = -1;
    let row = _moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;
    const maskFunc = QRUtil.getMaskFunction(maskPattern);

    for (let col = _moduleCount - 1; col > 0; col -= 2) {

      if (col == 6) col -= 1;

      while (true) {

        for (let c = 0; c < 2; c += 1) {

          if (_modules[row][col - c] == null) {

            let dark = false;

            if (byteIndex < data.length) {
              dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
            }

            const mask = maskFunc(row, col - c);

            if (mask) {
              dark = !dark;
            }

            _modules[row][col - c] = dark;
            bitIndex -= 1;

            if (bitIndex == -1) {
              byteIndex += 1;
              bitIndex = 7;
            }
          }
        }

        row += inc;

        if (row < 0 || _moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  };

  const createBytes = function(buffer, rsBlocks) {

    let offset = 0;

    let maxDcCount = 0;
    let maxEcCount = 0;

    const dcdata = new Array(rsBlocks.length);
    const ecdata = new Array(rsBlocks.length);

    for (let r = 0; r < rsBlocks.length; r += 1) {

      const dcCount = rsBlocks[r].dataCount;
      const ecCount = rsBlocks[r].totalCount - dcCount;

      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);

      dcdata[r] = new Array(dcCount);

      for (let i = 0; i < dcdata[r].length; i += 1) {
        dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
      }
      offset += dcCount;

      const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
      const rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

      const modPoly = rawPoly.mod(rsPoly);
      ecdata[r] = new Array(rsPoly.getLength() - 1);
      for (let i = 0; i < ecdata[r].length; i += 1) {
        const modIndex = i + modPoly.getLength() - ecdata[r].length;
        ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
      }
    }

    let totalCodeCount = 0;
    for (let i = 0; i < rsBlocks.length; i += 1) {
      totalCodeCount += rsBlocks[i].totalCount;
    }

    const data = new Array(totalCodeCount);
    let index = 0;

    for (let i = 0; i < maxDcCount; i += 1) {
      for (let r = 0; r < rsBlocks.length; r += 1) {
        if (i < dcdata[r].length) {
          data[index] = dcdata[r][i];
          index += 1;
        }
      }
    }

    for (let i = 0; i < maxEcCount; i += 1) {
      for (let r = 0; r < rsBlocks.length; r += 1) {
        if (i < ecdata[r].length) {
          data[index] = ecdata[r][i];
          index += 1;
        }
      }
    }

    return data;
  };

  const createData = function(typeNumber, errorCorrectionLevel, dataList) {

    const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

    const buffer = qrBitBuffer();

    for (let i = 0; i < dataList.length; i += 1) {
      const data = dataList[i];
      buffer.put(data.getMode(), 4);
      buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
      data.write(buffer);
    }

    // calc num max data.
    let totalDataCount = 0;
    for (let i = 0; i < rsBlocks.length; i += 1) {
      totalDataCount += rsBlocks[i].dataCount;
    }

    if (buffer.getLengthInBits() > totalDataCount * 8) {
      throw 'code length overflow. ('
        + buffer.getLengthInBits()
        + '>'
        + totalDataCount * 8
        + ')';
    }

    // end code
    if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
      buffer.put(0, 4);
    }

    // padding
    while (buffer.getLengthInBits() % 8 != 0) {
      buffer.putBit(false);
    }

    // padding
    while (true) {

      if (buffer.getLengthInBits() >= totalDataCount * 8) {
        break;
      }
      buffer.put(PAD0, 8);

      if (buffer.getLengthInBits() >= totalDataCount * 8) {
        break;
      }
      buffer.put(PAD1, 8);
    }

    return createBytes(buffer, rsBlocks);
  };

  _this.addData = function(data, mode) {

    mode = mode || 'Byte';

    let newData = null;

    switch(mode) {
    case 'Numeric' :
      newData = qrNumber(data);
      break;
    case 'Alphanumeric' :
      newData = qrAlphaNum(data);
      break;
    case 'Byte' :
      newData = qr8BitByte(data);
      break;
    case 'Kanji' :
      newData = qrKanji(data);
      break;
    default :
      throw 'mode:' + mode;
    }

    _dataList.push(newData);
    _dataCache = null;
  };

  _this.isDark = function(row, col) {
    if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
      throw row + ',' + col;
    }
    return _modules[row][col];
  };

  _this.getModuleCount = function() {
    return _moduleCount;
  };

  _this.make = function() {
    if (_typeNumber < 1) {
      let typeNumber = 1;

      for (; typeNumber < 40; typeNumber++) {
        const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
        const buffer = qrBitBuffer();

        for (let i = 0; i < _dataList.length; i++) {
          const data = _dataList[i];
          buffer.put(data.getMode(), 4);
          buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
          data.write(buffer);
        }

        let totalDataCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) {
          totalDataCount += rsBlocks[i].dataCount;
        }

        if (buffer.getLengthInBits() <= totalDataCount * 8) {
          break;
        }
      }

      _typeNumber = typeNumber;
    }

    makeImpl(false, getBestMaskPattern() );
  };

  _this.createTableTag = function(cellSize, margin) {

    cellSize = cellSize || 2;
    margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

    let qrHtml = '';

    qrHtml += '<table style="';
    qrHtml += ' border-width: 0px; border-style: none;';
    qrHtml += ' border-collapse: collapse;';
    qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
    qrHtml += '">';
    qrHtml += '<tbody>';

    for (let r = 0; r < _this.getModuleCount(); r += 1) {

      qrHtml += '<tr>';

      for (let c = 0; c < _this.getModuleCount(); c += 1) {
        qrHtml += '<td style="';
        qrHtml += ' border-width: 0px; border-style: none;';
        qrHtml += ' border-collapse: collapse;';
        qrHtml += ' padding: 0px; margin: 0px;';
        qrHtml += ' width: ' + cellSize + 'px;';
        qrHtml += ' height: ' + cellSize + 'px;';
        qrHtml += ' background-color: ';
        qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
        qrHtml += ';';
        qrHtml += '"/>';
      }

      qrHtml += '</tr>';
    }

    qrHtml += '</tbody>';
    qrHtml += '</table>';

    return qrHtml;
  };

  _this.createSvgTag = function(cellSize, margin, alt, title) {

    let opts = {};
    if (typeof arguments[0] == 'object') {
      // Called by options.
      opts = arguments[0];
      // overwrite cellSize and margin.
      cellSize = opts.cellSize;
      margin = opts.margin;
      alt = opts.alt;
      title = opts.title;
    }

    cellSize = cellSize || 2;
    margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

    // Compose alt property surrogate
    alt = (typeof alt === 'string') ? {text: alt} : alt || {};
    alt.text = alt.text || null;
    alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

    // Compose title property surrogate
    title = (typeof title === 'string') ? {text: title} : title || {};
    title.text = title.text || null;
    title.id = (title.text) ? title.id || 'qrcode-title' : null;

    const size = _this.getModuleCount() * cellSize + margin * 2;
    let c, mc, r, mr, qrSvg='', rect;

    rect = 'l' + cellSize + ',0 0,' + cellSize +
      ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

    qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
    qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
    qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
    qrSvg += ' preserveAspectRatio="xMinYMin meet"';
    qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
        escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
    qrSvg += '>';
    qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
        escapeXml(title.text) + '</title>' : '';
    qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
        escapeXml(alt.text) + '</description>' : '';
    qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
    qrSvg += '<path d="';

    for (r = 0; r < _this.getModuleCount(); r += 1) {
      mr = r * cellSize + margin;
      for (c = 0; c < _this.getModuleCount(); c += 1) {
        if (_this.isDark(r, c) ) {
          mc = c*cellSize+margin;
          qrSvg += 'M' + mc + ',' + mr + rect;
        }
      }
    }

    qrSvg += '" stroke="transparent" fill="black"/>';
    qrSvg += '</svg>';

    return qrSvg;
  };

  _this.createDataURL = function(cellSize, margin) {

    cellSize = cellSize || 2;
    margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

    const size = _this.getModuleCount() * cellSize + margin * 2;
    const min = margin;
    const max = size - margin;

    return createDataURL(size, size, function(x, y) {
      if (min <= x && x < max && min <= y && y < max) {
        const c = Math.floor( (x - min) / cellSize);
        const r = Math.floor( (y - min) / cellSize);
        return _this.isDark(r, c)? 0 : 1;
      } else {
        return 1;
      }
    } );
  };

  _this.createImgTag = function(cellSize, margin, alt) {

    cellSize = cellSize || 2;
    margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

    const size = _this.getModuleCount() * cellSize + margin * 2;

    let img = '';
    img += '<img';
    img += '\u0020src="';
    img += _this.createDataURL(cellSize, margin);
    img += '"';
    img += '\u0020width="';
    img += size;
    img += '"';
    img += '\u0020height="';
    img += size;
    img += '"';
    if (alt) {
      img += '\u0020alt="';
      img += escapeXml(alt);
      img += '"';
    }
    img += '/>';

    return img;
  };

  const escapeXml = function(s) {
    let escaped = '';
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charAt(i);
      switch(c) {
      case '<': escaped += '&lt;'; break;
      case '>': escaped += '&gt;'; break;
      case '&': escaped += '&amp;'; break;
      case '"': escaped += '&quot;'; break;
      default : escaped += c; break;
      }
    }
    return escaped;
  };

  const _createHalfASCII = function(margin) {
    const cellSize = 1;
    margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

    const size = _this.getModuleCount() * cellSize + margin * 2;
    const min = margin;
    const max = size - margin;

    let y, x, r1, r2, p;

    const blocks = {
      '██': '█',
      '█ ': '▀',
      ' █': '▄',
      '  ': ' '
    };

    const blocksLastLineNoMargin = {
      '██': '▀',
      '█ ': '▀',
      ' █': ' ',
      '  ': ' '
    };

    let ascii = '';
    for (y = 0; y < size; y += 2) {
      r1 = Math.floor((y - min) / cellSize);
      r2 = Math.floor((y + 1 - min) / cellSize);
      for (x = 0; x < size; x += 1) {
        p = '█';

        if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
          p = ' ';
        }

        if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
          p += ' ';
        }
        else {
          p += '█';
        }

        // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
        ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
      }

      ascii += '\n';
    }

    if (size % 2 && margin > 0) {
      return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
    }

    return ascii.substring(0, ascii.length-1);
  };

  _this.createASCII = function(cellSize, margin) {
    cellSize = cellSize || 1;

    if (cellSize < 2) {
      return _createHalfASCII(margin);
    }

    cellSize -= 1;
    margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

    const size = _this.getModuleCount() * cellSize + margin * 2;
    const min = margin;
    const max = size - margin;

    let y, x, r, p;

    const white = Array(cellSize+1).join('██');
    const black = Array(cellSize+1).join('  ');

    let ascii = '';
    let line = '';
    for (y = 0; y < size; y += 1) {
      r = Math.floor( (y - min) / cellSize);
      line = '';
      for (x = 0; x < size; x += 1) {
        p = 1;

        if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
          p = 0;
        }

        // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
        line += p ? white : black;
      }

      for (r = 0; r < cellSize; r += 1) {
        ascii += line + '\n';
      }
    }

    return ascii.substring(0, ascii.length-1);
  };

  _this.renderTo2dContext = function(context, cellSize) {
    cellSize = cellSize || 2;
    const length = _this.getModuleCount();
    for (let row = 0; row < length; row++) {
      for (let col = 0; col < length; col++) {
        context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
        context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }
  };

  return _this;
};

//---------------------------------------------------------------------
// qrcode.stringToBytes
//---------------------------------------------------------------------

qrcode.stringToBytes = function(s) {
  const bytes = [];
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    bytes.push(c & 0xff);
  }
  return bytes;
};

//---------------------------------------------------------------------
// qrcode.createStringToBytes
//---------------------------------------------------------------------

/**
 * @param unicodeData base64 string of byte array.
 * [16bit Unicode],[16bit Bytes], ...
 * @param numChars
 */
qrcode.createStringToBytes = function(unicodeData, numChars) {

  // create conversion map.

  const unicodeMap = function() {

    const bin = base64DecodeInputStream(unicodeData);
    const read = function() {
      const b = bin.read();
      if (b == -1) throw 'eof';
      return b;
    };

    let count = 0;
    const unicodeMap = {};
    while (true) {
      const b0 = bin.read();
      if (b0 == -1) break;
      const b1 = read();
      const b2 = read();
      const b3 = read();
      const k = String.fromCharCode( (b0 << 8) | b1);
      const v = (b2 << 8) | b3;
      unicodeMap[k] = v;
      count += 1;
    }
    if (count != numChars) {
      throw count + ' != ' + numChars;
    }

    return unicodeMap;
  }();

  const unknownChar = '?'.charCodeAt(0);

  return function(s) {
    const bytes = [];
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charCodeAt(i);
      if (c < 128) {
        bytes.push(c);
      } else {
        const b = unicodeMap[s.charAt(i)];
        if (typeof b == 'number') {
          if ( (b & 0xff) == b) {
            // 1byte
            bytes.push(b);
          } else {
            // 2bytes
            bytes.push(b >>> 8);
            bytes.push(b & 0xff);
          }
        } else {
          bytes.push(unknownChar);
        }
      }
    }
    return bytes;
  };
};

//---------------------------------------------------------------------
// QRMode
//---------------------------------------------------------------------

const QRMode = {
  MODE_NUMBER :    1 << 0,
  MODE_ALPHA_NUM : 1 << 1,
  MODE_8BIT_BYTE : 1 << 2,
  MODE_KANJI :     1 << 3
};

//---------------------------------------------------------------------
// QRErrorCorrectionLevel
//---------------------------------------------------------------------

const QRErrorCorrectionLevel = {
  L : 1,
  M : 0,
  Q : 3,
  H : 2
};

//---------------------------------------------------------------------
// QRMaskPattern
//---------------------------------------------------------------------

const QRMaskPattern = {
  PATTERN000 : 0,
  PATTERN001 : 1,
  PATTERN010 : 2,
  PATTERN011 : 3,
  PATTERN100 : 4,
  PATTERN101 : 5,
  PATTERN110 : 6,
  PATTERN111 : 7
};

//---------------------------------------------------------------------
// QRUtil
//---------------------------------------------------------------------

const QRUtil = function() {

  const PATTERN_POSITION_TABLE = [
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58],
    [6, 34, 62],
    [6, 26, 46, 66],
    [6, 26, 48, 70],
    [6, 26, 50, 74],
    [6, 30, 54, 78],
    [6, 30, 56, 82],
    [6, 30, 58, 86],
    [6, 34, 62, 90],
    [6, 28, 50, 72, 94],
    [6, 26, 50, 74, 98],
    [6, 30, 54, 78, 102],
    [6, 28, 54, 80, 106],
    [6, 32, 58, 84, 110],
    [6, 30, 58, 86, 114],
    [6, 34, 62, 90, 118],
    [6, 26, 50, 74, 98, 122],
    [6, 30, 54, 78, 102, 126],
    [6, 26, 52, 78, 104, 130],
    [6, 30, 56, 82, 108, 134],
    [6, 34, 60, 86, 112, 138],
    [6, 30, 58, 86, 114, 142],
    [6, 34, 62, 90, 118, 146],
    [6, 30, 54, 78, 102, 126, 150],
    [6, 24, 50, 76, 102, 128, 154],
    [6, 28, 54, 80, 106, 132, 158],
    [6, 32, 58, 84, 110, 136, 162],
    [6, 26, 54, 82, 110, 138, 166],
    [6, 30, 58, 86, 114, 142, 170]
  ];
  const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
  const G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
  const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

  const _this = {};

  const getBCHDigit = function(data) {
    let digit = 0;
    while (data != 0) {
      digit += 1;
      data >>>= 1;
    }
    return digit;
  };

  _this.getBCHTypeInfo = function(data) {
    let d = data << 10;
    while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
      d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
    }
    return ( (data << 10) | d) ^ G15_MASK;
  };

  _this.getBCHTypeNumber = function(data) {
    let d = data << 12;
    while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
      d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
    }
    return (data << 12) | d;
  };

  _this.getPatternPosition = function(typeNumber) {
    return PATTERN_POSITION_TABLE[typeNumber - 1];
  };

  _this.getMaskFunction = function(maskPattern) {

    switch (maskPattern) {

    case QRMaskPattern.PATTERN000 :
      return function(i, j) { return (i + j) % 2 == 0; };
    case QRMaskPattern.PATTERN001 :
      return function(i, j) { return i % 2 == 0; };
    case QRMaskPattern.PATTERN010 :
      return function(i, j) { return j % 3 == 0; };
    case QRMaskPattern.PATTERN011 :
      return function(i, j) { return (i + j) % 3 == 0; };
    case QRMaskPattern.PATTERN100 :
      return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
    case QRMaskPattern.PATTERN101 :
      return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
    case QRMaskPattern.PATTERN110 :
      return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
    case QRMaskPattern.PATTERN111 :
      return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

    default :
      throw 'bad maskPattern:' + maskPattern;
    }
  };

  _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
    let a = qrPolynomial([1], 0);
    for (let i = 0; i < errorCorrectLength; i += 1) {
      a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
    }
    return a;
  };

  _this.getLengthInBits = function(mode, type) {

    if (1 <= type && type < 10) {

      // 1 - 9

      switch(mode) {
      case QRMode.MODE_NUMBER    : return 10;
      case QRMode.MODE_ALPHA_NUM : return 9;
      case QRMode.MODE_8BIT_BYTE : return 8;
      case QRMode.MODE_KANJI     : return 8;
      default :
        throw 'mode:' + mode;
      }

    } else if (type < 27) {

      // 10 - 26

      switch(mode) {
      case QRMode.MODE_NUMBER    : return 12;
      case QRMode.MODE_ALPHA_NUM : return 11;
      case QRMode.MODE_8BIT_BYTE : return 16;
      case QRMode.MODE_KANJI     : return 10;
      default :
        throw 'mode:' + mode;
      }

    } else if (type < 41) {

      // 27 - 40

      switch(mode) {
      case QRMode.MODE_NUMBER    : return 14;
      case QRMode.MODE_ALPHA_NUM : return 13;
      case QRMode.MODE_8BIT_BYTE : return 16;
      case QRMode.MODE_KANJI     : return 12;
      default :
        throw 'mode:' + mode;
      }

    } else {
      throw 'type:' + type;
    }
  };

  _this.getLostPoint = function(qrcode) {

    const moduleCount = qrcode.getModuleCount();

    let lostPoint = 0;

    // LEVEL1

    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {

        let sameCount = 0;
        const dark = qrcode.isDark(row, col);

        for (let r = -1; r <= 1; r += 1) {

          if (row + r < 0 || moduleCount <= row + r) {
            continue;
          }

          for (let c = -1; c <= 1; c += 1) {

            if (col + c < 0 || moduleCount <= col + c) {
              continue;
            }

            if (r == 0 && c == 0) {
              continue;
            }

            if (dark == qrcode.isDark(row + r, col + c) ) {
              sameCount += 1;
            }
          }
        }

        if (sameCount > 5) {
          lostPoint += (3 + sameCount - 5);
        }
      }
    }
    // LEVEL2

    for (let row = 0; row < moduleCount - 1; row += 1) {
      for (let col = 0; col < moduleCount - 1; col += 1) {
        let count = 0;
        if (qrcode.isDark(row, col) ) count += 1;
        if (qrcode.isDark(row + 1, col) ) count += 1;
        if (qrcode.isDark(row, col + 1) ) count += 1;
        if (qrcode.isDark(row + 1, col + 1) ) count += 1;
        if (count == 0 || count == 4) {
          lostPoint += 3;
        }
      }
    }

    // LEVEL3

    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount - 6; col += 1) {
        if (qrcode.isDark(row, col)
            && !qrcode.isDark(row, col + 1)
            &&  qrcode.isDark(row, col + 2)
            &&  qrcode.isDark(row, col + 3)
            &&  qrcode.isDark(row, col + 4)
            && !qrcode.isDark(row, col + 5)
            &&  qrcode.isDark(row, col + 6) ) {
          lostPoint += 40;
        }
      }
    }

    for (let col = 0; col < moduleCount; col += 1) {
      for (let row = 0; row < moduleCount - 6; row += 1) {
        if (qrcode.isDark(row, col)
            && !qrcode.isDark(row + 1, col)
            &&  qrcode.isDark(row + 2, col)
            &&  qrcode.isDark(row + 3, col)
            &&  qrcode.isDark(row + 4, col)
            && !qrcode.isDark(row + 5, col)
            &&  qrcode.isDark(row + 6, col) ) {
          lostPoint += 40;
        }
      }
    }

    // LEVEL4

    let darkCount = 0;

    for (let col = 0; col < moduleCount; col += 1) {
      for (let row = 0; row < moduleCount; row += 1) {
        if (qrcode.isDark(row, col) ) {
          darkCount += 1;
        }
      }
    }

    const ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
    lostPoint += ratio * 10;

    return lostPoint;
  };

  return _this;
}();

//---------------------------------------------------------------------
// QRMath
//---------------------------------------------------------------------

const QRMath = function() {

  const EXP_TABLE = new Array(256);
  const LOG_TABLE = new Array(256);

  // initialize tables
  for (let i = 0; i < 8; i += 1) {
    EXP_TABLE[i] = 1 << i;
  }
  for (let i = 8; i < 256; i += 1) {
    EXP_TABLE[i] = EXP_TABLE[i - 4]
      ^ EXP_TABLE[i - 5]
      ^ EXP_TABLE[i - 6]
      ^ EXP_TABLE[i - 8];
  }
  for (let i = 0; i < 255; i += 1) {
    LOG_TABLE[EXP_TABLE[i] ] = i;
  }

  const _this = {};

  _this.glog = function(n) {

    if (n < 1) {
      throw 'glog(' + n + ')';
    }

    return LOG_TABLE[n];
  };

  _this.gexp = function(n) {

    while (n < 0) {
      n += 255;
    }

    while (n >= 256) {
      n -= 255;
    }

    return EXP_TABLE[n];
  };

  return _this;
}();

//---------------------------------------------------------------------
// qrPolynomial
//---------------------------------------------------------------------

const qrPolynomial = function(num, shift) {

  if (typeof num.length == 'undefined') {
    throw num.length + '/' + shift;
  }

  const _num = function() {
    let offset = 0;
    while (offset < num.length && num[offset] == 0) {
      offset += 1;
    }
    const _num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i += 1) {
      _num[i] = num[i + offset];
    }
    return _num;
  }();

  const _this = {};

  _this.getAt = function(index) {
    return _num[index];
  };

  _this.getLength = function() {
    return _num.length;
  };

  _this.multiply = function(e) {

    const num = new Array(_this.getLength() + e.getLength() - 1);

    for (let i = 0; i < _this.getLength(); i += 1) {
      for (let j = 0; j < e.getLength(); j += 1) {
        num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
      }
    }

    return qrPolynomial(num, 0);
  };

  _this.mod = function(e) {

    if (_this.getLength() - e.getLength() < 0) {
      return _this;
    }

    const ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

    const num = new Array(_this.getLength() );
    for (let i = 0; i < _this.getLength(); i += 1) {
      num[i] = _this.getAt(i);
    }

    for (let i = 0; i < e.getLength(); i += 1) {
      num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
    }

    // recursive call
    return qrPolynomial(num, 0).mod(e);
  };

  return _this;
};

//---------------------------------------------------------------------
// QRRSBlock
//---------------------------------------------------------------------

const QRRSBlock = function() {

  const RS_BLOCK_TABLE = [

    // L
    // M
    // Q
    // H

    // 1
    [1, 26, 19],
    [1, 26, 16],
    [1, 26, 13],
    [1, 26, 9],

    // 2
    [1, 44, 34],
    [1, 44, 28],
    [1, 44, 22],
    [1, 44, 16],

    // 3
    [1, 70, 55],
    [1, 70, 44],
    [2, 35, 17],
    [2, 35, 13],

    // 4
    [1, 100, 80],
    [2, 50, 32],
    [2, 50, 24],
    [4, 25, 9],

    // 5
    [1, 134, 108],
    [2, 67, 43],
    [2, 33, 15, 2, 34, 16],
    [2, 33, 11, 2, 34, 12],

    // 6
    [2, 86, 68],
    [4, 43, 27],
    [4, 43, 19],
    [4, 43, 15],

    // 7
    [2, 98, 78],
    [4, 49, 31],
    [2, 32, 14, 4, 33, 15],
    [4, 39, 13, 1, 40, 14],

    // 8
    [2, 121, 97],
    [2, 60, 38, 2, 61, 39],
    [4, 40, 18, 2, 41, 19],
    [4, 40, 14, 2, 41, 15],

    // 9
    [2, 146, 116],
    [3, 58, 36, 2, 59, 37],
    [4, 36, 16, 4, 37, 17],
    [4, 36, 12, 4, 37, 13],

    // 10
    [2, 86, 68, 2, 87, 69],
    [4, 69, 43, 1, 70, 44],
    [6, 43, 19, 2, 44, 20],
    [6, 43, 15, 2, 44, 16],

    // 11
    [4, 101, 81],
    [1, 80, 50, 4, 81, 51],
    [4, 50, 22, 4, 51, 23],
    [3, 36, 12, 8, 37, 13],

    // 12
    [2, 116, 92, 2, 117, 93],
    [6, 58, 36, 2, 59, 37],
    [4, 46, 20, 6, 47, 21],
    [7, 42, 14, 4, 43, 15],

    // 13
    [4, 133, 107],
    [8, 59, 37, 1, 60, 38],
    [8, 44, 20, 4, 45, 21],
    [12, 33, 11, 4, 34, 12],

    // 14
    [3, 145, 115, 1, 146, 116],
    [4, 64, 40, 5, 65, 41],
    [11, 36, 16, 5, 37, 17],
    [11, 36, 12, 5, 37, 13],

    // 15
    [5, 109, 87, 1, 110, 88],
    [5, 65, 41, 5, 66, 42],
    [5, 54, 24, 7, 55, 25],
    [11, 36, 12, 7, 37, 13],

    // 16
    [5, 122, 98, 1, 123, 99],
    [7, 73, 45, 3, 74, 46],
    [15, 43, 19, 2, 44, 20],
    [3, 45, 15, 13, 46, 16],

    // 17
    [1, 135, 107, 5, 136, 108],
    [10, 74, 46, 1, 75, 47],
    [1, 50, 22, 15, 51, 23],
    [2, 42, 14, 17, 43, 15],

    // 18
    [5, 150, 120, 1, 151, 121],
    [9, 69, 43, 4, 70, 44],
    [17, 50, 22, 1, 51, 23],
    [2, 42, 14, 19, 43, 15],

    // 19
    [3, 141, 113, 4, 142, 114],
    [3, 70, 44, 11, 71, 45],
    [17, 47, 21, 4, 48, 22],
    [9, 39, 13, 16, 40, 14],

    // 20
    [3, 135, 107, 5, 136, 108],
    [3, 67, 41, 13, 68, 42],
    [15, 54, 24, 5, 55, 25],
    [15, 43, 15, 10, 44, 16],

    // 21
    [4, 144, 116, 4, 145, 117],
    [17, 68, 42],
    [17, 50, 22, 6, 51, 23],
    [19, 46, 16, 6, 47, 17],

    // 22
    [2, 139, 111, 7, 140, 112],
    [17, 74, 46],
    [7, 54, 24, 16, 55, 25],
    [34, 37, 13],

    // 23
    [4, 151, 121, 5, 152, 122],
    [4, 75, 47, 14, 76, 48],
    [11, 54, 24, 14, 55, 25],
    [16, 45, 15, 14, 46, 16],

    // 24
    [6, 147, 117, 4, 148, 118],
    [6, 73, 45, 14, 74, 46],
    [11, 54, 24, 16, 55, 25],
    [30, 46, 16, 2, 47, 17],

    // 25
    [8, 132, 106, 4, 133, 107],
    [8, 75, 47, 13, 76, 48],
    [7, 54, 24, 22, 55, 25],
    [22, 45, 15, 13, 46, 16],

    // 26
    [10, 142, 114, 2, 143, 115],
    [19, 74, 46, 4, 75, 47],
    [28, 50, 22, 6, 51, 23],
    [33, 46, 16, 4, 47, 17],

    // 27
    [8, 152, 122, 4, 153, 123],
    [22, 73, 45, 3, 74, 46],
    [8, 53, 23, 26, 54, 24],
    [12, 45, 15, 28, 46, 16],

    // 28
    [3, 147, 117, 10, 148, 118],
    [3, 73, 45, 23, 74, 46],
    [4, 54, 24, 31, 55, 25],
    [11, 45, 15, 31, 46, 16],

    // 29
    [7, 146, 116, 7, 147, 117],
    [21, 73, 45, 7, 74, 46],
    [1, 53, 23, 37, 54, 24],
    [19, 45, 15, 26, 46, 16],

    // 30
    [5, 145, 115, 10, 146, 116],
    [19, 75, 47, 10, 76, 48],
    [15, 54, 24, 25, 55, 25],
    [23, 45, 15, 25, 46, 16],

    // 31
    [13, 145, 115, 3, 146, 116],
    [2, 74, 46, 29, 75, 47],
    [42, 54, 24, 1, 55, 25],
    [23, 45, 15, 28, 46, 16],

    // 32
    [17, 145, 115],
    [10, 74, 46, 23, 75, 47],
    [10, 54, 24, 35, 55, 25],
    [19, 45, 15, 35, 46, 16],

    // 33
    [17, 145, 115, 1, 146, 116],
    [14, 74, 46, 21, 75, 47],
    [29, 54, 24, 19, 55, 25],
    [11, 45, 15, 46, 46, 16],

    // 34
    [13, 145, 115, 6, 146, 116],
    [14, 74, 46, 23, 75, 47],
    [44, 54, 24, 7, 55, 25],
    [59, 46, 16, 1, 47, 17],

    // 35
    [12, 151, 121, 7, 152, 122],
    [12, 75, 47, 26, 76, 48],
    [39, 54, 24, 14, 55, 25],
    [22, 45, 15, 41, 46, 16],

    // 36
    [6, 151, 121, 14, 152, 122],
    [6, 75, 47, 34, 76, 48],
    [46, 54, 24, 10, 55, 25],
    [2, 45, 15, 64, 46, 16],

    // 37
    [17, 152, 122, 4, 153, 123],
    [29, 74, 46, 14, 75, 47],
    [49, 54, 24, 10, 55, 25],
    [24, 45, 15, 46, 46, 16],

    // 38
    [4, 152, 122, 18, 153, 123],
    [13, 74, 46, 32, 75, 47],
    [48, 54, 24, 14, 55, 25],
    [42, 45, 15, 32, 46, 16],

    // 39
    [20, 147, 117, 4, 148, 118],
    [40, 75, 47, 7, 76, 48],
    [43, 54, 24, 22, 55, 25],
    [10, 45, 15, 67, 46, 16],

    // 40
    [19, 148, 118, 6, 149, 119],
    [18, 75, 47, 31, 76, 48],
    [34, 54, 24, 34, 55, 25],
    [20, 45, 15, 61, 46, 16]
  ];

  const qrRSBlock = function(totalCount, dataCount) {
    const _this = {};
    _this.totalCount = totalCount;
    _this.dataCount = dataCount;
    return _this;
  };

  const _this = {};

  const getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

    switch(errorCorrectionLevel) {
    case QRErrorCorrectionLevel.L :
      return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
    case QRErrorCorrectionLevel.M :
      return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
    case QRErrorCorrectionLevel.Q :
      return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
    case QRErrorCorrectionLevel.H :
      return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
    default :
      return undefined;
    }
  };

  _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

    const rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

    if (typeof rsBlock == 'undefined') {
      throw 'bad rs block @ typeNumber:' + typeNumber +
          '/errorCorrectionLevel:' + errorCorrectionLevel;
    }

    const length = rsBlock.length / 3;

    const list = [];

    for (let i = 0; i < length; i += 1) {

      const count = rsBlock[i * 3 + 0];
      const totalCount = rsBlock[i * 3 + 1];
      const dataCount = rsBlock[i * 3 + 2];

      for (let j = 0; j < count; j += 1) {
        list.push(qrRSBlock(totalCount, dataCount) );
      }
    }

    return list;
  };

  return _this;
}();

//---------------------------------------------------------------------
// qrBitBuffer
//---------------------------------------------------------------------

const qrBitBuffer = function() {

  const _buffer = [];
  let _length = 0;

  const _this = {};

  _this.getBuffer = function() {
    return _buffer;
  };

  _this.getAt = function(index) {
    const bufIndex = Math.floor(index / 8);
    return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
  };

  _this.put = function(num, length) {
    for (let i = 0; i < length; i += 1) {
      _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
    }
  };

  _this.getLengthInBits = function() {
    return _length;
  };

  _this.putBit = function(bit) {

    const bufIndex = Math.floor(_length / 8);
    if (_buffer.length <= bufIndex) {
      _buffer.push(0);
    }

    if (bit) {
      _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
    }

    _length += 1;
  };

  return _this;
};

//---------------------------------------------------------------------
// qrNumber
//---------------------------------------------------------------------

const qrNumber = function(data) {

  const _mode = QRMode.MODE_NUMBER;
  const _data = data;

  const _this = {};

  _this.getMode = function() {
    return _mode;
  };

  _this.getLength = function(buffer) {
    return _data.length;
  };

  _this.write = function(buffer) {

    const data = _data;

    let i = 0;

    while (i + 2 < data.length) {
      buffer.put(strToNum(data.substring(i, i + 3) ), 10);
      i += 3;
    }

    if (i < data.length) {
      if (data.length - i == 1) {
        buffer.put(strToNum(data.substring(i, i + 1) ), 4);
      } else if (data.length - i == 2) {
        buffer.put(strToNum(data.substring(i, i + 2) ), 7);
      }
    }
  };

  const strToNum = function(s) {
    let num = 0;
    for (let i = 0; i < s.length; i += 1) {
      num = num * 10 + chatToNum(s.charAt(i) );
    }
    return num;
  };

  const chatToNum = function(c) {
    if ('0' <= c && c <= '9') {
      return c.charCodeAt(0) - '0'.charCodeAt(0);
    }
    throw 'illegal char :' + c;
  };

  return _this;
};

//---------------------------------------------------------------------
// qrAlphaNum
//---------------------------------------------------------------------

const qrAlphaNum = function(data) {

  const _mode = QRMode.MODE_ALPHA_NUM;
  const _data = data;

  const _this = {};

  _this.getMode = function() {
    return _mode;
  };

  _this.getLength = function(buffer) {
    return _data.length;
  };

  _this.write = function(buffer) {

    const s = _data;

    let i = 0;

    while (i + 1 < s.length) {
      buffer.put(
        getCode(s.charAt(i) ) * 45 +
        getCode(s.charAt(i + 1) ), 11);
      i += 2;
    }

    if (i < s.length) {
      buffer.put(getCode(s.charAt(i) ), 6);
    }
  };

  const getCode = function(c) {

    if ('0' <= c && c <= '9') {
      return c.charCodeAt(0) - '0'.charCodeAt(0);
    } else if ('A' <= c && c <= 'Z') {
      return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
    } else {
      switch (c) {
      case '\u0020' : return 36;
      case '$' : return 37;
      case '%' : return 38;
      case '*' : return 39;
      case '+' : return 40;
      case '-' : return 41;
      case '.' : return 42;
      case '/' : return 43;
      case ':' : return 44;
      default :
        throw 'illegal char :' + c;
      }
    }
  };

  return _this;
};

//---------------------------------------------------------------------
// qr8BitByte
//---------------------------------------------------------------------

const qr8BitByte = function(data) {

  const _mode = QRMode.MODE_8BIT_BYTE;
  const _bytes = qrcode.stringToBytes(data);

  const _this = {};

  _this.getMode = function() {
    return _mode;
  };

  _this.getLength = function(buffer) {
    return _bytes.length;
  };

  _this.write = function(buffer) {
    for (let i = 0; i < _bytes.length; i += 1) {
      buffer.put(_bytes[i], 8);
    }
  };

  return _this;
};

//---------------------------------------------------------------------
// qrKanji
//---------------------------------------------------------------------

const qrKanji = function(data) {

  const _mode = QRMode.MODE_KANJI;

  const stringToBytes = qrcode.stringToBytes;
  !function(c, code) {
    // self test for sjis support.
    const test = stringToBytes(c);
    if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
      throw 'sjis not supported.';
    }
  }('\u53cb', 0x9746);

  const _bytes = stringToBytes(data);

  const _this = {};

  _this.getMode = function() {
    return _mode;
  };

  _this.getLength = function(buffer) {
    return ~~(_bytes.length / 2);
  };

  _this.write = function(buffer) {

    const data = _bytes;

    let i = 0;

    while (i + 1 < data.length) {

      let c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

      if (0x8140 <= c && c <= 0x9FFC) {
        c -= 0x8140;
      } else if (0xE040 <= c && c <= 0xEBBF) {
        c -= 0xC140;
      } else {
        throw 'illegal char at ' + (i + 1) + '/' + c;
      }

      c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

      buffer.put(c, 13);

      i += 2;
    }

    if (i < data.length) {
      throw 'illegal char at ' + (i + 1);
    }
  };

  return _this;
};

//=====================================================================
// GIF Support etc.
//

//---------------------------------------------------------------------
// byteArrayOutputStream
//---------------------------------------------------------------------

const byteArrayOutputStream = function() {

  const _bytes = [];

  const _this = {};

  _this.writeByte = function(b) {
    _bytes.push(b & 0xff);
  };

  _this.writeShort = function(i) {
    _this.writeByte(i);
    _this.writeByte(i >>> 8);
  };

  _this.writeBytes = function(b, off, len) {
    off = off || 0;
    len = len || b.length;
    for (let i = 0; i < len; i += 1) {
      _this.writeByte(b[i + off]);
    }
  };

  _this.writeString = function(s) {
    for (let i = 0; i < s.length; i += 1) {
      _this.writeByte(s.charCodeAt(i) );
    }
  };

  _this.toByteArray = function() {
    return _bytes;
  };

  _this.toString = function() {
    let s = '';
    s += '[';
    for (let i = 0; i < _bytes.length; i += 1) {
      if (i > 0) {
        s += ',';
      }
      s += _bytes[i];
    }
    s += ']';
    return s;
  };

  return _this;
};

//---------------------------------------------------------------------
// base64EncodeOutputStream
//---------------------------------------------------------------------

const base64EncodeOutputStream = function() {

  let _buffer = 0;
  let _buflen = 0;
  let _length = 0;
  let _base64 = '';

  const _this = {};

  const writeEncoded = function(b) {
    _base64 += String.fromCharCode(encode(b & 0x3f) );
  };

  const encode = function(n) {
    if (n < 0) {
      throw 'n:' + n;
    } else if (n < 26) {
      return 0x41 + n;
    } else if (n < 52) {
      return 0x61 + (n - 26);
    } else if (n < 62) {
      return 0x30 + (n - 52);
    } else if (n == 62) {
      return 0x2b;
    } else if (n == 63) {
      return 0x2f;
    } else {
      throw 'n:' + n;
    }
  };

  _this.writeByte = function(n) {

    _buffer = (_buffer << 8) | (n & 0xff);
    _buflen += 8;
    _length += 1;

    while (_buflen >= 6) {
      writeEncoded(_buffer >>> (_buflen - 6) );
      _buflen -= 6;
    }
  };

  _this.flush = function() {

    if (_buflen > 0) {
      writeEncoded(_buffer << (6 - _buflen) );
      _buffer = 0;
      _buflen = 0;
    }

    if (_length % 3 != 0) {
      // padding
      const padlen = 3 - _length % 3;
      for (let i = 0; i < padlen; i += 1) {
        _base64 += '=';
      }
    }
  };

  _this.toString = function() {
    return _base64;
  };

  return _this;
};

//---------------------------------------------------------------------
// base64DecodeInputStream
//---------------------------------------------------------------------

const base64DecodeInputStream = function(str) {

  const _str = str;
  let _pos = 0;
  let _buffer = 0;
  let _buflen = 0;

  const _this = {};

  _this.read = function() {

    while (_buflen < 8) {

      if (_pos >= _str.length) {
        if (_buflen == 0) {
          return -1;
        }
        throw 'unexpected end of file./' + _buflen;
      }

      const c = _str.charAt(_pos);
      _pos += 1;

      if (c == '=') {
        _buflen = 0;
        return -1;
      } else if (c.match(/^\s$/) ) {
        // ignore if whitespace.
        continue;
      }

      _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
      _buflen += 6;
    }

    const n = (_buffer >>> (_buflen - 8) ) & 0xff;
    _buflen -= 8;
    return n;
  };

  const decode = function(c) {
    if (0x41 <= c && c <= 0x5a) {
      return c - 0x41;
    } else if (0x61 <= c && c <= 0x7a) {
      return c - 0x61 + 26;
    } else if (0x30 <= c && c <= 0x39) {
      return c - 0x30 + 52;
    } else if (c == 0x2b) {
      return 62;
    } else if (c == 0x2f) {
      return 63;
    } else {
      throw 'c:' + c;
    }
  };

  return _this;
};

//---------------------------------------------------------------------
// gifImage (B/W)
//---------------------------------------------------------------------

const gifImage = function(width, height) {

  const _width = width;
  const _height = height;
  const _data = new Array(width * height);

  const _this = {};

  _this.setPixel = function(x, y, pixel) {
    _data[y * _width + x] = pixel;
  };

  _this.write = function(out) {

    //---------------------------------
    // GIF Signature

    out.writeString('GIF87a');

    //---------------------------------
    // Screen Descriptor

    out.writeShort(_width);
    out.writeShort(_height);

    out.writeByte(0x80); // 2bit
    out.writeByte(0);
    out.writeByte(0);

    //---------------------------------
    // Global Color Map

    // black
    out.writeByte(0x00);
    out.writeByte(0x00);
    out.writeByte(0x00);

    // white
    out.writeByte(0xff);
    out.writeByte(0xff);
    out.writeByte(0xff);

    //---------------------------------
    // Image Descriptor

    out.writeString(',');
    out.writeShort(0);
    out.writeShort(0);
    out.writeShort(_width);
    out.writeShort(_height);
    out.writeByte(0);

    //---------------------------------
    // Local Color Map

    //---------------------------------
    // Raster Data

    const lzwMinCodeSize = 2;
    const raster = getLZWRaster(lzwMinCodeSize);

    out.writeByte(lzwMinCodeSize);

    let offset = 0;

    while (raster.length - offset > 255) {
      out.writeByte(255);
      out.writeBytes(raster, offset, 255);
      offset += 255;
    }

    out.writeByte(raster.length - offset);
    out.writeBytes(raster, offset, raster.length - offset);
    out.writeByte(0x00);

    //---------------------------------
    // GIF Terminator
    out.writeString(';');
  };

  const bitOutputStream = function(out) {

    const _out = out;
    let _bitLength = 0;
    let _bitBuffer = 0;

    const _this = {};

    _this.write = function(data, length) {

      if ( (data >>> length) != 0) {
        throw 'length over';
      }

      while (_bitLength + length >= 8) {
        _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
        length -= (8 - _bitLength);
        data >>>= (8 - _bitLength);
        _bitBuffer = 0;
        _bitLength = 0;
      }

      _bitBuffer = (data << _bitLength) | _bitBuffer;
      _bitLength = _bitLength + length;
    };

    _this.flush = function() {
      if (_bitLength > 0) {
        _out.writeByte(_bitBuffer);
      }
    };

    return _this;
  };

  const getLZWRaster = function(lzwMinCodeSize) {

    const clearCode = 1 << lzwMinCodeSize;
    const endCode = (1 << lzwMinCodeSize) + 1;
    let bitLength = lzwMinCodeSize + 1;

    // Setup LZWTable
    const table = lzwTable();

    for (let i = 0; i < clearCode; i += 1) {
      table.add(String.fromCharCode(i) );
    }
    table.add(String.fromCharCode(clearCode) );
    table.add(String.fromCharCode(endCode) );

    const byteOut = byteArrayOutputStream();
    const bitOut = bitOutputStream(byteOut);

    // clear code
    bitOut.write(clearCode, bitLength);

    let dataIndex = 0;

    let s = String.fromCharCode(_data[dataIndex]);
    dataIndex += 1;

    while (dataIndex < _data.length) {

      const c = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      if (table.contains(s + c) ) {

        s = s + c;

      } else {

        bitOut.write(table.indexOf(s), bitLength);

        if (table.size() < 0xfff) {

          if (table.size() == (1 << bitLength) ) {
            bitLength += 1;
          }

          table.add(s + c);
        }

        s = c;
      }
    }

    bitOut.write(table.indexOf(s), bitLength);

    // end code
    bitOut.write(endCode, bitLength);

    bitOut.flush();

    return byteOut.toByteArray();
  };

  const lzwTable = function() {

    const _map = {};
    let _size = 0;

    const _this = {};

    _this.add = function(key) {
      if (_this.contains(key) ) {
        throw 'dup key:' + key;
      }
      _map[key] = _size;
      _size += 1;
    };

    _this.size = function() {
      return _size;
    };

    _this.indexOf = function(key) {
      return _map[key];
    };

    _this.contains = function(key) {
      return typeof _map[key] != 'undefined';
    };

    return _this;
  };

  return _this;
};

const createDataURL = function(width, height, getPixel) {
  const gif = gifImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      gif.setPixel(x, y, getPixel(x, y) );
    }
  }

  const b = byteArrayOutputStream();
  gif.write(b);

  const base64 = base64EncodeOutputStream();
  const bytes = b.toByteArray();
  for (let i = 0; i < bytes.length; i += 1) {
    base64.writeByte(bytes[i]);
  }
  base64.flush();

  return 'data:image/gif;base64,' + base64;
};

// A QR code as SVG markup (black on white, whatever the theme: scanners
// expect it), for the authenticator app's otpauth:// address.
function qrSvg(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
}

// An administrator's second step for the admin pages (worker/auth.py
// two_factor_*, POST /api/auth/2fa/...): the first time, an authenticator
// app is set up (a QR code or the key typed in, then its first code) and
// the recovery codes shown once; later, a code from the app - or a
// recovery code - every WORKER_ADMIN_2FA_TTL (12 hours by default).

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// The code field: digits on a phone keyboard, filled by the OS from an SMS
// or a password manager where it offers to.
function codeInput({ recovery = false } = {}) {
  const input = document.createElement("input");
  input.type = "text";
  input.required = true;
  input.autocomplete = "one-time-code";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.className = "exadmin-code-input";
  if (!recovery) {
    input.inputMode = "numeric";
    input.pattern = "[0-9 ]{6,7}";
    input.maxLength = 7;
    input.placeholder = "123 456";
  } else {
    input.placeholder = "abcd-efgh-jkmn";
  }
  input.setAttribute("aria-label", t("exadmin.twoFactorCode", "Code"));
  return input;
}

// "Remember this device for N days" (worker WORKER_ADMIN_2FA_REMEMBER_DAYS):
// on by default - the admin's own device is the usual case.
function rememberField(days) {
  if (!days) return { element: null, checked: () => false };
  const label = element("label", "exadmin-remember");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = true;
  label.append(box, element("span", null, t("exadmin.twoFactorRemember", { days }, "Remember this device for {days} days")));
  return { element: label, checked: () => box.checked };
}

function statusLine() {
  const status = element("p", "exadmin-message");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  return status;
}

function fail(status, error) {
  status.dataset.tone = "error";
  status.textContent = error.status === 429
    ? t("exadmin.twoFactorLocked", "Too many wrong codes. Try again in a few minutes.")
    : error.status === 401
      ? t("exadmin.twoFactorWrong", "That code is not right. Check that the time on your phone is set automatically.")
      : error.message;
}

// The first time: scan, confirm with a code, keep the recovery codes.
function renderTwoFactorSetup(container, { user, turnstile, rememberDays, onDone }) {
  const box = element("section", "exadmin-two-factor");
  box.append(
    element("h2", null, t("exadmin.twoFactorSetupTitle", "Set up two-step verification")),
    element("p", null, t("exadmin.twoFactorSetupIntro",
      "The admin pages ask for a code from an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, Aegis, 1Password...) besides the password.")),
  );
  const status = statusLine();
  const steps = element("div", "exadmin-two-factor-steps");
  box.append(steps, status);
  container.appendChild(box);

  apiRequest("/api/auth/2fa/setup", "POST", {}).then(({ secret, uri }) => {
    const scan = element("div", "exadmin-two-factor-scan");
    const qr = element("div", "exadmin-qr");
    qr.innerHTML = qrSvg(uri);
    qr.firstElementChild?.setAttribute("aria-label", t("exadmin.twoFactorQr", "QR code for the authenticator app"));
    qr.firstElementChild?.setAttribute("role", "img");
    const manual = element("div", "exadmin-two-factor-manual");
    manual.append(
      element("p", null, t("exadmin.twoFactorScan", "1. Scan the code with the app - or, on this phone, open it in the app, or type the key in.")),
    );
    const open = element("a", "exadmin-two-factor-open", t("exadmin.twoFactorOpenApp", "Open in the authenticator app"));
    open.href = uri;
    const key = element("code", "exadmin-two-factor-key", secret.replace(/(.{4})/g, "$1 ").trim());
    const copy = element("button", null, t("exadmin.twoFactorCopy", "Copy the key"));
    copy.type = "button";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(secret);
        copy.textContent = t("exadmin.twoFactorCopied", "Copied");
      } catch {
        // No clipboard here: the key stays readable above.
      }
    });
    const account = element("p", "exadmin-two-factor-account",
      t("exadmin.twoFactorAccount", { user }, "Account: {user} · time-based, 6 digits, every 30 seconds"));
    manual.append(open, key, copy, account);
    scan.append(qr, manual);

    const form = element("form", "exadmin-two-factor-form");
    const label = element("label", null);
    label.append(element("span", null, t("exadmin.twoFactorConfirm", "2. Enter the code the app shows")));
    const input = codeInput();
    label.appendChild(input);
    const submit = element("button", null, t("exadmin.twoFactorTurnOn", "Turn on"));
    submit.type = "submit";
    const check = createTurnstile(turnstile, "2fa");
    const remember = rememberField(rememberDays);
    form.append(label, ...[remember.element, check.element].filter(Boolean), submit);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      try {
        const { recoveryCodes } = await apiRequest("/api/auth/2fa/enable", "POST",
          { code: input.value, remember: remember.checked(), turnstileToken: await check.token() });
        box.remove();
        renderRecoveryCodes(container, { codes: recoveryCodes, onDone });
      } catch (error) {
        fail(status, error);
        submit.disabled = false;
        check.reset();
        input.select();
      }
    });
    steps.append(scan, form);
    input.focus();
  }).catch((error) => fail(status, error));
}

// Shown once, right after setting it up.
function renderRecoveryCodes(container, { codes, onDone }) {
  const box = element("section", "exadmin-two-factor");
  box.append(
    element("h2", null, t("exadmin.twoFactorRecoveryTitle", "Keep these recovery codes")),
    element("p", null, t("exadmin.twoFactorRecoveryIntro",
      "Each one lets you in once without the phone. Keep them somewhere safe, away from the phone - they are not shown again.")),
  );
  const list = element("ol", "exadmin-recovery-codes");
  codes.forEach((code) => list.appendChild(element("li", null, code)));
  const actions = element("div", "exadmin-two-factor-actions");
  const copy = element("button", null, t("exadmin.twoFactorCopyCodes", "Copy the codes"));
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      copy.textContent = t("exadmin.twoFactorCopied", "Copied");
    } catch {
      // No clipboard: they stay on screen to write down.
    }
  });
  const done = element("button", "exadmin-two-factor-primary", t("exadmin.twoFactorSaved", "I have saved them"));
  done.type = "button";
  done.addEventListener("click", onDone);
  actions.append(copy, done);
  box.append(list, actions);
  container.appendChild(box);
}

// Every 12 hours (WORKER_ADMIN_2FA_TTL): a code from the app.
function renderTwoFactorVerify(container, { recoveryLeft, turnstile, rememberDays, onDone }) {
  const box = element("section", "exadmin-two-factor exadmin-two-factor-verify");
  const form = element("form", "exadmin-two-factor-form");
  const heading = element("h2", null, t("exadmin.twoFactorVerifyTitle", "Two-step verification"));
  const intro = element("p", null, t("exadmin.twoFactorVerifyIntro", "Enter the code from your authenticator app."));
  let recovery = false;
  let input = codeInput();
  const submit = element("button", "exadmin-two-factor-primary", t("exadmin.twoFactorVerify", "Continue"));
  submit.type = "submit";
  const swap = element("button", "exadmin-link-button", t("exadmin.twoFactorUseRecovery", "Use a recovery code"));
  swap.type = "button";
  swap.addEventListener("click", () => {
    recovery = !recovery;
    const next = codeInput({ recovery });
    input.replaceWith(next);
    input = next;
    intro.textContent = recovery
      ? t("exadmin.twoFactorRecoveryPrompt", { count: recoveryLeft }, "Enter one of your recovery codes ({count} left).")
      : t("exadmin.twoFactorVerifyIntro", "Enter the code from your authenticator app.");
    swap.textContent = recovery
      ? t("exadmin.twoFactorUseApp", "Use the authenticator app")
      : t("exadmin.twoFactorUseRecovery", "Use a recovery code");
    input.focus();
  });
  const status = statusLine();
  const lost = element("p", "exadmin-two-factor-help", t("exadmin.twoFactorLost",
    "Lost the phone and the codes? Another administrator can turn it off for you (Users), or on the server: admin 2fa-reset <user>."));
  const check = createTurnstile(turnstile, "2fa");
  const remember = rememberField(rememberDays);
  form.append(heading, intro, input, ...[remember.element, check.element].filter(Boolean), submit, swap, status, lost);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const result = await apiRequest("/api/auth/2fa/verify", "POST",
        { code: input.value, remember: remember.checked(), turnstileToken: await check.token() });
      onDone(result);
    } catch (error) {
      fail(status, error);
      submit.disabled = false;
      check.reset();
      input.select();
    }
  });
  box.appendChild(form);
  container.appendChild(box);
  input.focus();
}

// The thumbnails of the viewer's bundled example models (examples/index.json,
// the header's "Models" list): which have renders, where they come from
// and whether they load. Admins render them in the viewer - an example
// opened from here, then "Generate thumbnails" in the editor toolbar
// (editor/thumbnail-capture.js) - and the worker keeps them
// (worker/example_thumbnails.py); without those the gallery shows the
// renders bundled with the viewer (examples/gallery/), if there are any.

// The views in the gallery's order (ui/thumbnail-gallery.js).
const VIEWS = ["side0", "side45", "side90", "side135", "side180", "side225", "side270", "side315", "top"];

const localized = (name, fallback = "") => {
  if (typeof name === "string") return name;
  if (!name || typeof name !== "object") return fallback;
  const lang = (document.documentElement.lang || "en").slice(0, 2);
  return name[lang] || name.en || Object.values(name)[0] || fallback;
};

// The name of an example's set of renders, as the viewer derives it
// (ui/thumbnail-gallery.js exampleGallerySet): its folder right under
// examples/ (one model in every format shares one set), else its filename.
function exampleSetOf(url) {
  const match = String(url || "").match(/^\.\/examples\/(.+)$/);
  if (!match) return null;
  const parts = match[1].split("/");
  const filename = parts.pop();
  if (!filename) return null;
  const dir = parts.length === 1 && parts[0] !== "gallery" ? parts[0] : filename;
  return { dir, basename: modelBasename(filename) };
}

const storedUrl = (set, view, version) =>
  `/api/examples/thumbnails/${encodeURIComponent(set.dir)}/${encodeURIComponent(`${set.basename}_${view}.png`)}${version ? `?v=${version}` : ""}`;

const bundledUrl = (set, view) =>
  exampleAssetUrl(`gallery/${encodeURIComponent(set.dir)}/${encodeURIComponent(`${set.basename}_${view}.${GALLERY_IMAGE_EXT}`)}`);

// Resolves true when the image loads, false otherwise.
function imageLoads(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth > 0);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

class ExamplesSection {
  constructor() {
    const element = document.createElement("section");
    element.className = "exadmin-section exadmin-examples";
    element.innerHTML = `
      <div class="exadmin-section-header">
        <h2></h2>
      </div>
      <p class="exadmin-reports-hint"></p>
      <p class="upload-panel-status" role="status" aria-live="polite"></p>
      <ul class="exadmin-examples-list"></ul>
    `;
    this.element = element;
    element.querySelector("h2").textContent = t("exadmin.examplesTitle", "Example model thumbnails");
    element.querySelector(".exadmin-reports-hint").textContent = t(
      "exadmin.examplesHint",
      "Open an example in the viewer, set the view you like, then use \"Generate thumbnails\" in the editor toolbar. The renders are kept on the server and shown in the gallery before the ones bundled with the viewer."
    );
    this.status = element.querySelector(".upload-panel-status");
    this.list = element.querySelector(".exadmin-examples-list");
  }

  setStatus(message, tone = "info") {
    this.status.textContent = message;
    this.status.dataset.tone = tone;
  }

  async load() {
    this.setStatus(t("exadmin.loading", "Loading..."));
    let list;
    try {
      const response = await fetch(exampleAssetUrl("index.json"), { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      list = await response.json();
    } catch (error) {
      console.error("[exadmin] Failed to load the example list:", error);
      this.setStatus(error.message, "error");
      return;
    }
    let stored = {};
    try {
      stored = (await apiRequest("/api/examples/thumbnails")).thumbnails || {};
    } catch (error) {
      console.warn("[exadmin] Failed to load the stored example thumbnails:", error);
    }
    this.stored = stored;
    this.sets = this.groupSets(list);
    this.render();
  }

  // One row per set of renders, with the examples (formats) that show it.
  groupSets(list) {
    const groups = list?.groups && typeof list.groups === "object" ? list.groups : {};
    const sets = new Map();
    (Array.isArray(list?.models) ? list.models : []).forEach((entry) => {
      const set = exampleSetOf(entry?.url);
      if (!set) return;
      const key = `${set.dir}/${set.basename}`;
      if (!sets.has(key)) {
        sets.set(key, { key, set, title: localized(groups[entry.group], entry.group || set.basename), examples: [] });
      }
      sets.get(key).examples.push({ url: entry.url, name: localized(entry.name, entry.url) });
    });
    return [...sets.values()];
  }

  render() {
    this.list.textContent = "";
    if (!this.sets.length) {
      const empty = document.createElement("li");
      empty.className = "exadmin-reports-empty";
      empty.textContent = t("exadmin.examplesEmpty", "No example models.");
      this.list.appendChild(empty);
      this.setStatus("");
      return;
    }
    const checks = this.sets.map((entry) => {
      const { item, check } = this.renderSet(entry);
      this.list.appendChild(item);
      return check;
    });
    Promise.all(checks).then((results) => {
      const loading = results.filter((result) => result === "ok").length;
      const broken = results.filter((result) => result === "broken").length;
      this.setStatus(
        t("exadmin.examplesSummary", { loading, total: results.length, broken },
          "Thumbnails load for {loading} of {total} sets; {broken} fail to load."),
        broken ? "error" : "info"
      );
    });
  }

  renderSet({ key, set, title, examples }) {
    const stored = this.stored[key];
    const storedViews = Array.isArray(stored?.views) ? stored.views : [];
    const item = document.createElement("li");
    item.className = "exadmin-report exadmin-example";

    const thumb = document.createElement("span");
    thumb.className = "models-panel-item-thumb exadmin-example-thumb";
    item.appendChild(thumb);

    const body = document.createElement("div");
    body.className = "exadmin-example-body";
    const head = document.createElement("div");
    head.className = "exadmin-report-head";
    const name = document.createElement("strong");
    name.textContent = title;
    const where = document.createElement("span");
    where.className = "exadmin-report-date";
    where.textContent = `gallery/${key}`;
    head.append(name, where);
    body.appendChild(head);

    const formats = document.createElement("p");
    formats.className = "exadmin-report-meta";
    formats.textContent = examples.map((example) => example.name).join(" · ");
    body.appendChild(formats);

    const state = document.createElement("p");
    state.className = "exadmin-report-meta exadmin-example-state";
    state.textContent = t("exadmin.examplesChecking", "Checking...");
    body.appendChild(state);

    const actions = document.createElement("div");
    actions.className = "exadmin-report-actions";
    const open = document.createElement("a");
    open.href = `${exampleAssetUrl("../")}?model=${encodeURIComponent(examples[0].url)}`;
    open.target = "_blank";
    open.rel = "noopener";
    open.textContent = t("exadmin.examplesOpen", "Open in the viewer to render");
    actions.appendChild(open);
    if (storedViews.length) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "exadmin-report-danger";
      remove.textContent = t("exadmin.examplesRemove", "Remove the viewer's renders");
      remove.addEventListener("click", () => this.remove(set));
      actions.appendChild(remove);
    }
    body.appendChild(actions);
    item.appendChild(body);

    // Each view of the set that shows, the main one (side45) as the picture.
    const check = (async () => {
      const sources = storedViews.length
        ? storedViews.map((view) => storedUrl(set, view, stored.version))
        : VIEWS.map((view) => bundledUrl(set, view));
      const results = await Promise.all(sources.map(imageLoads));
      const loaded = results.filter(Boolean).length;
      const mainIndex = (storedViews.length ? storedViews : VIEWS).indexOf("side45");
      const picture = sources[results[mainIndex] ? mainIndex : results.indexOf(true)];
      if (picture) {
        const image = document.createElement("img");
        image.alt = "";
        image.src = picture;
        thumb.appendChild(image);
      }
      let result;
      if (storedViews.length) {
        result = loaded === sources.length ? "ok" : "broken";
        state.textContent = t("exadmin.examplesStored", { loaded, total: sources.length },
          "Rendered in the viewer: {loaded} of {total} views load.");
      } else if (loaded) {
        result = "ok";
        state.textContent = t("exadmin.examplesBundled", { loaded, total: sources.length },
          "Bundled renders: {loaded} of {total} views load.");
      } else {
        result = "missing";
        state.textContent = t("exadmin.examplesMissing", "No thumbnails - the gallery shows the generic images.");
      }
      item.dataset.status = result;
      return result;
    })();
    return { item, check };
  }

  async remove(set) {
    const confirmed = await confirmDialog({
      message: t("exadmin.examplesRemoveConfirm", "Remove the thumbnails rendered in the viewer? The bundled ones show again."),
      confirmLabel: t("exadmin.examplesRemove", "Remove the viewer's renders"),
      cancelLabel: t("adminPanel.deleteCancel", "Cancel"),
      danger: true,
    });
    if (!confirmed) return;
    try {
      const query = new URLSearchParams({ dir: set.dir, basename: set.basename });
      await apiRequest(`/api/examples/thumbnails?${query}`, "DELETE");
      toast("exampleThumbnailsRemoved", "info");
      await this.load();
    } catch (error) {
      console.error("[exadmin] Failed to remove example thumbnails:", error);
      this.setStatus(error.message, "error");
    }
  }
}

const examplesSection = {
  id: "examples",
  label: () => t("exadmin.navExamples", "Example thumbnails"),
  mount(container) {
    const section = new ExamplesSection();
    container.appendChild(section.element);
    section.load();
  },
};

// Numbers, dates and sizes on the admin pages, in the page's language
// (main.js sets <html lang>), not the browser's.

const locale = () => document.documentElement.lang || undefined;

const toDate = (seconds) => new Date(seconds * 1000);

const formatDate = (seconds) => (seconds ? toDate(seconds).toLocaleDateString(locale()) : "");

const formatDateTime = (seconds) =>
  seconds ? toDate(seconds).toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" }) : "";

const formatCount = (value) => Math.round(value || 0).toLocaleString(locale());

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes || 0;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toLocaleString(locale(), { maximumFractionDigits: digits })} ${units[unit]}`;
}

// "3 days ago", "in 2 hours" - for the last time an account was active.
function formatRelative(seconds, now = Date.now() / 1000) {
  if (!seconds) return "";
  const diff = seconds - now;
  const steps = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  const format = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
  for (const [unit, size] of steps) {
    if (Math.abs(diff) >= size) return format.format(Math.round(diff / size), unit);
  }
  return format.format(0, "minute");
}

// What the administrators did and when (GET /api/admin/audit,
// worker/audit.py): approvals, rejections, roles, plans, limits, models
// edited or deleted, reports decided. Newest first, filtered by admin or
// action, older entries a click away.

const PAGE = 100;

const ACTIONS = {
  approve: ["exadmin.auditApprove", "Account approved"],
  reject: ["exadmin.auditReject", "Account rejected"],
  disable: ["exadmin.auditDisable", "Account disabled"],
  promote: ["exadmin.auditPromote", "Made an administrator"],
  demote: ["exadmin.auditDemote", "Administrator rights taken away"],
  "delete-user": ["exadmin.auditDeleteUser", "Account deleted"],
  plan: ["exadmin.auditPlan", "Plan changed"],
  limits: ["exadmin.auditLimits", "Limits changed"],
  "edit-model": ["exadmin.auditEditModel", "Uploader or upload date changed"],
  "delete-model": ["exadmin.auditDeleteModel", "Model deleted"],
  visibility: ["exadmin.auditVisibility", "Model visibility changed"],
  report: ["exadmin.auditReport", "Report decided"],
  "2fa-enable": ["exadmin.audit2faEnable", "Two-step verification turned on"],
  "2fa-reset": ["exadmin.audit2faReset", "Two-step verification reset"],
  "2fa-forget-devices": ["exadmin.audit2faForgetDevices", "Remembered devices forgotten"],
};

const label$2 = ([key, fallback]) => t(key, fallback);

// The entry's details as a short line.
function describe(entry) {
  const d = entry.details || {};
  const parts = [];
  if (d.name) parts.push(d.name);
  if (entry.action === "reject" && d.reason) parts.push(t("exadmin.auditReason", { reason: d.reason }, "reason: {reason}"));
  if (entry.action === "plan") {
    parts.push(d.tier ? t(`plans.${d.tier}`, d.tier) : t("adminPanel.planNone", "None (only what was bought)"));
    if (d.expiresAt) parts.push(t("exadmin.auditUntil", { date: formatDateTime(d.expiresAt) }, "until {date}"));
  }
  if (entry.action === "limits") {
    const limits = Object.entries(d.limits || {});
    parts.push(limits.length ? limits.map(([key, value]) => `${key}=${value}`).join(", ") : t("adminPanel.limitsReset", "Use defaults"));
  }
  if (entry.action === "edit-model") {
    if (d.owner) parts.push(`${d.owner[0] || "-"} → ${d.owner[1] || "-"}`);
    if (d.createdAt) parts.push(`${formatDateTime(d.createdAt[0])} → ${formatDateTime(d.createdAt[1])}`);
  }
  if (entry.action === "visibility") {
    parts.push(d.private ? t("exadmin.modelsPrivate", "Private") : t("exadmin.modelsPublic", "Public"));
  }
  if (entry.action === "report") {
    const decision = { dismiss: ["adminPanel.reportDismiss", "Dismiss"], "remove-model": ["adminPanel.reportRemoveModel", "Remove model"],
      "disable-user": ["adminPanel.reportDisableUser", "Disable uploader"] }[d.decision];
    if (decision) parts.push(label$2(decision));
    if (d.reason) parts.push(t(`modelsPanel.reportReason_${d.reason}`, d.reason));
  }
  if (["delete-model", "visibility", "report"].includes(entry.action) && d.owner) {
    parts.push(t("adminPanel.reportOwner", { user: d.owner }, "Uploaded by {user}"));
  }
  return parts.join(" · ");
}

class HistorySection {
  constructor() {
    this.entries = [];
    this.filters = { admin: "", action: "" };
    const element = document.createElement("section");
    element.className = "exadmin-section exadmin-history";
    element.innerHTML = `
      <div class="exadmin-section-header"><h2></h2></div>
      <div class="exadmin-models-filters"></div>
      <p class="upload-panel-status" role="status" aria-live="polite"></p>
      <ol class="exadmin-history-list"></ol>
      <button type="button" class="exadmin-models-more" hidden></button>
    `;
    element.querySelector("h2").textContent = t("exadmin.historyTitle", "What the administrators did");
    this.element = element;
    this.filtersBox = element.querySelector(".exadmin-models-filters");
    this.status = element.querySelector(".upload-panel-status");
    this.list = element.querySelector(".exadmin-history-list");
    this.more = element.querySelector(".exadmin-models-more");
    this.more.textContent = t("exadmin.historyMore", "Show older");
    this.more.addEventListener("click", () => this.load(true));
    this.renderFilters();
  }

  renderFilters() {
    const all = t("exadmin.modelsAll", "All");
    const actionField = document.createElement("label");
    const actionCaption = document.createElement("span");
    actionCaption.textContent = t("exadmin.historyAction", "Action");
    const action = document.createElement("select");
    action.setAttribute("aria-label", actionCaption.textContent);
    action.appendChild(new Option(all, ""));
    Object.entries(ACTIONS).forEach(([id, text]) => action.appendChild(new Option(label$2(text), id)));
    action.addEventListener("change", () => {
      this.filters.action = action.value;
      this.load();
    });
    actionField.append(actionCaption, action);

    const adminField = document.createElement("label");
    const adminCaption = document.createElement("span");
    adminCaption.textContent = t("exadmin.historyAdmin", "Administrator");
    this.adminSelect = document.createElement("select");
    this.adminSelect.setAttribute("aria-label", adminCaption.textContent);
    this.adminSelect.appendChild(new Option(all, ""));
    this.adminSelect.addEventListener("change", () => {
      this.filters.admin = this.adminSelect.value;
      this.load();
    });
    adminField.append(adminCaption, this.adminSelect);
    this.filtersBox.append(actionField, adminField);
  }

  // Administrators seen so far are offered in the filter.
  updateAdminOptions() {
    const known = new Set([...this.adminSelect.options].map((option) => option.value));
    this.entries.forEach((entry) => {
      if (!known.has(entry.admin)) {
        known.add(entry.admin);
        this.adminSelect.appendChild(new Option(entry.admin, entry.admin));
      }
    });
  }

  async load(older = false) {
    const params = new URLSearchParams({ limit: String(PAGE) });
    if (older && this.entries.length) params.set("before", String(this.entries[this.entries.length - 1].at));
    if (this.filters.admin) params.set("admin", this.filters.admin);
    if (this.filters.action) params.set("action", this.filters.action);
    this.status.textContent = t("exadmin.loading", "Loading...");
    try {
      const data = await apiRequest(`/api/admin/audit?${params}`);
      const entries = Array.isArray(data.entries) ? data.entries : [];
      this.entries = older ? [...this.entries, ...entries] : entries;
      this.more.hidden = !data.more;
      this.status.textContent = "";
    } catch (error) {
      console.error("[exadmin] Failed to load the history:", error);
      this.status.textContent = error.message;
      this.status.dataset.tone = "error";
      return;
    }
    this.updateAdminOptions();
    this.render();
  }

  render() {
    this.list.textContent = "";
    if (!this.entries.length) {
      const empty = document.createElement("li");
      empty.className = "admin-users-empty";
      empty.textContent = t("exadmin.historyEmpty", "Nothing recorded yet.");
      this.list.appendChild(empty);
      return;
    }
    this.entries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "exadmin-history-entry";
      const when = document.createElement("time");
      when.dateTime = new Date(entry.at * 1000).toISOString();
      when.textContent = formatDateTime(entry.at);
      const what = document.createElement("div");
      what.className = "exadmin-history-what";
      // "Action: target", then who did it and the details (no sentence
      // to inflect for the admin in every language).
      const head = document.createElement("span");
      const action = document.createTextNode(`${ACTIONS[entry.action] ? label$2(ACTIONS[entry.action]) : entry.action}: `);
      const target = document.createElement("strong");
      target.textContent = entry.target;
      head.append(action, target);
      what.appendChild(head);
      const line = document.createElement("span");
      line.className = "exadmin-history-details";
      const admin = entry.admin === "(command line)" ? t("exadmin.historyCli", "the command line") : entry.admin;
      line.textContent = [t("exadmin.historyBy", { admin }, "by {admin}"), describe(entry)].filter(Boolean).join(" · ");
      what.appendChild(line);
      item.append(when, what);
      this.list.appendChild(item);
    });
  }
}

const historySection = {
  id: "history",
  label: () => t("exadmin.navHistory", "History"),
  mount(container) {
    const section = new HistorySection();
    container.appendChild(section.element);
    section.load();
  },
};

// Every uploaded model (GET /api/admin/models, worker/server.py
// admin_models): filtered by owner, format, state and visibility, sorted
// by date, size or name; opened in the viewer, made private or public,
// deleted. Above them the conversions running or queued now, read again
// every few seconds while there are any.

const PAGE_SIZE = 50;
const QUEUE_POLL_MS = 5000;

const STATES = {
  ready: ["exadmin.modelsStateReady", "Ready"],
  converting: ["exadmin.modelsStateConverting", "Converting"],
  failed: ["exadmin.modelsStateFailed", "Conversion failed"],
  incomplete: ["exadmin.modelsStateIncomplete", "Incomplete"],
};

const SORTS = {
  newest: { label: ["exadmin.modelsSortNewest", "Newest first"], compare: (a, b) => b.createdAt - a.createdAt },
  oldest: { label: ["exadmin.modelsSortOldest", "Oldest first"], compare: (a, b) => a.createdAt - b.createdAt },
  largest: { label: ["exadmin.modelsSortLargest", "Largest on disk"], compare: (a, b) => b.storage - a.storage },
  name: { label: ["exadmin.modelsSortName", "Name"], compare: (a, b) => a.name.localeCompare(b.name) },
};

const QUEUE_STATUS = {
  init: ["exadmin.queueInit", "Starting"],
  queued: ["exadmin.queueQueued", "Waiting for a free slot"],
  preparing: ["exadmin.queuePreparing", "Preparing"],
  processing: ["exadmin.queueProcessing", "Converting"],
  rendering: ["exadmin.queueRendering", "Rendering thumbnails"],
};

const label$1 = ([key, fallback]) => t(key, fallback);

function select(options, value, ariaLabel) {
  const element = document.createElement("select");
  element.setAttribute("aria-label", ariaLabel);
  options.forEach(([optionValue, text]) => element.appendChild(new Option(text, optionValue)));
  element.value = value;
  return element;
}

class ModelsSection {
  constructor() {
    this.models = [];
    this.queue = [];
    this.filters = { query: "", owner: "", format: "", state: "", visibility: "" };
    this.sort = "newest";
    this.shown = PAGE_SIZE;

    const element = document.createElement("section");
    element.className = "exadmin-section exadmin-models";
    element.innerHTML = `
      <div class="exadmin-section-header"><h2></h2></div>
      <div class="exadmin-queue" hidden></div>
      <div class="exadmin-models-filters" hidden></div>
      <p class="exadmin-models-summary"></p>
      <p class="upload-panel-status" role="status" aria-live="polite"></p>
      <ul class="exadmin-models-list"></ul>
      <button type="button" class="exadmin-models-more" hidden></button>
    `;
    element.querySelector("h2").textContent = t("exadmin.modelsTitle", "Uploaded models");
    this.element = element;
    this.queueBox = element.querySelector(".exadmin-queue");
    this.filtersBox = element.querySelector(".exadmin-models-filters");
    this.summary = element.querySelector(".exadmin-models-summary");
    this.status = element.querySelector(".upload-panel-status");
    this.list = element.querySelector(".exadmin-models-list");
    this.more = element.querySelector(".exadmin-models-more");
    this.more.addEventListener("click", () => {
      this.shown += PAGE_SIZE;
      this.renderList();
    });
  }

  setStatus(message, tone = "info") {
    this.status.textContent = message;
    this.status.dataset.tone = tone;
  }

  async load({ quiet = false } = {}) {
    if (!quiet) this.setStatus(t("exadmin.loading", "Loading..."));
    try {
      const data = await apiRequest("/api/admin/models");
      this.models = Array.isArray(data.models) ? data.models : [];
      this.queue = Array.isArray(data.queue) ? data.queue : [];
      this.setStatus("");
    } catch (error) {
      console.error("[exadmin] Failed to load models:", error);
      this.setStatus(error.message, "error");
      return;
    }
    if (!quiet) this.renderFilters();
    this.renderQueue();
    this.renderList();
    this.scheduleQueuePoll();
  }

  // While conversions run, they (and the list, as they finish) are read
  // again; it stops once the section is left (its element out of the page).
  scheduleQueuePoll() {
    clearTimeout(this.pollTimer);
    if (!this.queue.length) return;
    this.pollTimer = setTimeout(() => {
      if (this.element.isConnected) this.load({ quiet: true });
    }, QUEUE_POLL_MS);
  }

  renderQueue() {
    this.queueBox.textContent = "";
    this.queueBox.hidden = this.queue.length === 0;
    if (!this.queue.length) return;
    const heading = document.createElement("h3");
    heading.textContent = t("exadmin.queueTitle", { count: this.queue.length }, "Converting now ({count})");
    this.queueBox.appendChild(heading);
    this.queue.forEach((job) => {
      const row = document.createElement("div");
      row.className = "exadmin-queue-row";
      const name = document.createElement("span");
      name.className = "exadmin-queue-name";
      name.textContent = job.filename || job.id;
      const meta = document.createElement("span");
      meta.className = "exadmin-queue-meta";
      meta.textContent = [
        job.owner || t("adminPanel.modelNoOwner", "No owner"),
        QUEUE_STATUS[job.status] ? label$1(QUEUE_STATUS[job.status]) : job.status,
        job.message,
      ].filter(Boolean).join(" · ");
      const bar = document.createElement("progress");
      bar.max = 100;
      bar.value = job.progress || 0;
      bar.setAttribute("aria-label", `${job.filename || job.id}: ${job.progress || 0}%`);
      row.append(name, meta, bar);
      this.queueBox.appendChild(row);
    });
  }

  renderFilters() {
    this.filtersBox.textContent = "";
    this.filtersBox.hidden = this.models.length === 0;
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = t("exadmin.modelsSearch", "Search by name, file or owner");
    search.setAttribute("aria-label", search.placeholder);
    search.value = this.filters.query;
    search.addEventListener("input", () => {
      this.filters.query = search.value.trim().toLocaleLowerCase();
      this.shown = PAGE_SIZE;
      this.renderList();
    });

    const owners = [...new Set(this.models.map((m) => m.owner || ""))].sort((a, b) => a.localeCompare(b));
    const formats = [...new Set(this.models.map((m) => m.format).filter(Boolean))].sort();
    const all = t("exadmin.modelsAll", "All");
    const controls = [
      ["owner", t("exadmin.modelsOwner", "Owner"), [["", all], ...owners.map((o) => [o || "-", o || t("adminPanel.modelNoOwner", "No owner")])]],
      ["format", t("exadmin.modelsFormat", "Format"), [["", all], ...formats.map((f) => [f, `.${f}`])]],
      ["state", t("exadmin.modelsState", "State"), [["", all], ...Object.entries(STATES).map(([id, text]) => [id, label$1(text)]), ["reported", t("exadmin.modelsReported", "Reported")]]],
      ["visibility", t("exadmin.modelsVisibility", "Visibility"), [["", all], ["public", t("exadmin.modelsPublic", "Public")], ["private", t("exadmin.modelsPrivate", "Private")]]],
    ].map(([key, text, options]) => {
      const field = document.createElement("label");
      const caption = document.createElement("span");
      caption.textContent = text;
      const control = select(options, this.filters[key], text);
      control.addEventListener("change", () => {
        this.filters[key] = control.value;
        this.shown = PAGE_SIZE;
        this.renderList();
      });
      field.append(caption, control);
      return field;
    });

    const sortField = document.createElement("label");
    const sortCaption = document.createElement("span");
    sortCaption.textContent = t("adminPanel.sortBy", "Sort by");
    const sort = select(Object.entries(SORTS).map(([id, item]) => [id, label$1(item.label)]), this.sort, sortCaption.textContent);
    sort.addEventListener("change", () => {
      this.sort = sort.value;
      this.renderList();
    });
    sortField.append(sortCaption, sort);

    this.filtersBox.append(search, ...controls, sortField);
  }

  filtered() {
    const { query, owner, format, state, visibility } = this.filters;
    return this.models.filter((model) => {
      if (owner && (model.owner || "-") !== owner) return false;
      if (format && model.format !== format) return false;
      if (state === "reported" ? !model.openReports : state && model.state !== state) return false;
      if (visibility && (visibility === "private") !== model.private) return false;
      if (query && ![model.name, model.filename, model.owner, model.id]
        .some((text) => String(text || "").toLocaleLowerCase().includes(query))) return false;
      return true;
    }).sort(SORTS[this.sort].compare);
  }

  renderList() {
    const models = this.filtered();
    const total = models.reduce((sum, m) => sum + (m.storage || 0), 0);
    this.summary.textContent = this.models.length
      ? t("exadmin.modelsSummary", { count: formatCount(models.length), all: formatCount(this.models.length), size: formatBytes(total) },
        "{count} of {all} models · {size} on disk")
      : "";
    this.list.textContent = "";
    if (!models.length) {
      const empty = document.createElement("li");
      empty.className = "admin-users-empty";
      empty.textContent = this.models.length
        ? t("exadmin.modelsNoMatch", "No model matches these filters.")
        : t("exadmin.modelsEmpty", "No models uploaded yet.");
      this.list.appendChild(empty);
    }
    models.slice(0, this.shown).forEach((model) => this.list.appendChild(this.renderModel(model)));
    const left = models.length - this.shown;
    this.more.hidden = left <= 0;
    this.more.textContent = t("exadmin.modelsMore", { count: Math.min(left, PAGE_SIZE) }, "Show {count} more");
  }

  renderModel(model) {
    const item = document.createElement("li");
    item.className = "exadmin-model";
    item.dataset.state = model.state;

    const thumb = document.createElement("span");
    thumb.className = "models-panel-item-thumb";
    thumb.setAttribute("aria-hidden", "true");
    fillModelThumbnail(thumb, remoteUrl(model.imageUrl) || "", model.id);

    const body = document.createElement("div");
    body.className = "exadmin-model-body";
    const name = document.createElement("span");
    name.className = "exadmin-model-name";
    name.textContent = model.name;
    name.title = model.filename || model.id;
    const meta = document.createElement("span");
    meta.className = "exadmin-model-meta";
    meta.textContent = [
      model.owner || t("adminPanel.modelNoOwner", "No owner"),
      formatDateTime(model.createdAt),
      model.format ? `.${model.format}` : "",
      model.size ? t("exadmin.modelsUploadedSize", { size: formatBytes(model.size) }, "uploaded {size}") : "",
      t("exadmin.modelsStorage", { size: formatBytes(model.storage) }, "{size} on disk"),
    ].filter(Boolean).join(" · ");

    const tags = document.createElement("span");
    tags.className = "exadmin-model-tags";
    const tag = (text, tone) => {
      const element = document.createElement("span");
      element.className = "exadmin-model-tag";
      if (tone) element.dataset.tone = tone;
      element.textContent = text;
      tags.appendChild(element);
    };
    if (model.state !== "ready") tag(label$1(STATES[model.state] || [model.state, model.state]), model.state === "failed" ? "error" : "info");
    if (model.private) tag(t("exadmin.modelsPrivate", "Private"));
    if (model.openReports) {
      tag(t("exadmin.modelsReportsTag", { count: model.openReports }, "Reported ({count})"), "warning");
    }
    if (model.underReview) tag(t("exadmin.modelsUnderReview", "Hidden until decided"), "warning");
    body.append(name, meta);
    if (tags.childElementCount) body.appendChild(tags);
    if (model.error) {
      const error = document.createElement("span");
      error.className = "exadmin-model-error";
      error.textContent = model.error;
      body.appendChild(error);
    }

    const actions = document.createElement("div");
    actions.className = "exadmin-report-actions";
    if (model.modelUrl) {
      actions.appendChild(modelLink({ id: model.id, modelUrl: model.modelUrl, imageUrls: model.imageUrl ? [model.imageUrl] : [] },
        t("exadmin.modelsOpen", "Open")));
    }
    // Only a model with an owner can be private (server.py _handle_visibility).
    if (model.owner) {
      const visibility = document.createElement("button");
      visibility.type = "button";
      visibility.textContent = model.private
        ? t("exadmin.modelsMakePublic", "Make public")
        : t("exadmin.modelsMakePrivate", "Make private");
      visibility.addEventListener("click", () => this.setPrivate(model, !model.private));
      actions.appendChild(visibility);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "exadmin-report-danger";
    remove.textContent = t("adminPanel.delete", "Delete");
    remove.addEventListener("click", () => this.remove(model));
    actions.appendChild(remove);

    item.append(thumb, body, actions);
    return item;
  }

  async setPrivate(model, makePrivate) {
    try {
      await apiRequest(`/api/jobs/${encodeURIComponent(model.id)}/visibility`, "POST", { private: makePrivate });
      model.private = makePrivate;
      toast("modelUpdated", "success");
      this.renderList();
    } catch (error) {
      this.setStatus(error.message, "error");
    }
  }

  async remove(model) {
    const confirmed = await confirmDialog({
      message: t("adminPanel.modelDeleteConfirm", { name: model.name },
        'Delete "{name}"? This permanently removes the converted model and its renders.'),
      confirmLabel: t("modelsPanel.deleteAction", "Delete"),
      cancelLabel: t("modelsPanel.deleteCancel", "Cancel"),
      danger: true,
    });
    if (!confirmed) return;
    try {
      try {
        await apiRequest(`/api/jobs/${encodeURIComponent(model.id)}`, "DELETE");
      } catch (error) {
        if (error.status !== 404) throw error;
      }
      this.models = this.models.filter((item) => item.id !== model.id);
      toast("modelDeleted", "success");
      this.renderList();
    } catch (error) {
      this.setStatus(error.message, "error");
    }
  }
}

const modelsSection = {
  id: "models",
  label: () => t("exadmin.navModels", "Models"),
  mount(container) {
    const section = new ModelsSection();
    container.appendChild(section.element);
    section.load();
  },
};

// Reported models (worker/reports.py, server.py _handle_admin_resolve_report):
// what was reported, why and by whom, and the admin's decision - dismiss,
// remove the model or disable its uploader. The App Store expects reports
// on user-generated content to be acted on within 24 hours (guideline 1.2).

const ACTION_LABELS = {
  dismiss: ["adminPanel.reportDismiss", "Dismiss"],
  "remove-model": ["adminPanel.reportRemoveModel", "Remove model"],
  "disable-user": ["adminPanel.reportDisableUser", "Disable uploader"],
};

const reasonLabel = (reason) => t(`modelsPanel.reportReason_${reason}`, reason);

class ReportsSection {
  constructor({ me }) {
    this.me = me;
    this.showResolved = false;
    const element = document.createElement("section");
    element.className = "exadmin-section exadmin-reports";
    element.innerHTML = `
      <div class="exadmin-section-header">
        <h2>${t("adminPanel.reportsTitle", "Reported models")}</h2>
        <label class="exadmin-reports-toggle"><input type="checkbox" /> <span></span></label>
      </div>
      <p class="exadmin-reports-hint"></p>
      <p class="upload-panel-status" role="status" aria-live="polite"></p>
      <ul class="exadmin-reports-list"></ul>
    `;
    this.element = element;
    this.hint = element.querySelector(".exadmin-reports-hint");
    this.status = element.querySelector(".upload-panel-status");
    this.list = element.querySelector(".exadmin-reports-list");
    const toggle = element.querySelector(".exadmin-reports-toggle input");
    element.querySelector(".exadmin-reports-toggle span").textContent =
      t("adminPanel.reportsShowResolved", "Show resolved reports");
    toggle.addEventListener("change", () => {
      this.showResolved = toggle.checked;
      this.render();
    });
  }

  setStatus(message, tone = "info") {
    this.status.textContent = message;
    this.status.dataset.tone = tone;
  }

  async load() {
    this.setStatus(t("exadmin.loading", "Loading..."));
    try {
      const data = await apiRequest("/api/admin/reports");
      this.reports = Array.isArray(data.reports) ? data.reports : [];
      this.hint.textContent = data.hideThreshold
        ? t("adminPanel.reportsHint", { count: data.hideThreshold },
          "Act on reports within 24 hours. A model reported by {count} people is hidden from others until you decide.")
        : t("adminPanel.reportsHintNoHide", "Act on reports within 24 hours.");
      this.setStatus("");
    } catch (error) {
      console.error("[exadmin] Failed to load reports:", error);
      this.setStatus(error.message, "error");
      this.reports = [];
    }
    this.render();
  }

  render() {
    this.list.textContent = "";
    const reports = (this.reports || []).filter((report) => this.showResolved || report.status === "open");
    if (!reports.length) {
      const empty = document.createElement("li");
      empty.className = "exadmin-reports-empty";
      empty.textContent = t("adminPanel.reportsEmpty", "No reports.");
      this.list.appendChild(empty);
      return;
    }
    reports.forEach((report) => this.list.appendChild(this.renderReport(report)));
  }

  renderReport(report) {
    const item = document.createElement("li");
    item.className = "exadmin-report";
    item.dataset.status = report.status;

    const head = document.createElement("div");
    head.className = "exadmin-report-head";
    const name = document.createElement("strong");
    name.textContent = report.modelName || report.jobId;
    const when = document.createElement("span");
    when.className = "exadmin-report-date";
    when.textContent = formatDateTime(report.createdAt);
    head.append(name, when);
    item.appendChild(head);

    const lines = [
      t("adminPanel.reportReason", { reason: reasonLabel(report.reason) }, "Reason: {reason}"),
      report.owner ? t("adminPanel.reportOwner", { user: report.owner }, "Uploaded by {user}") : null,
      report.reporterUser
        ? t("adminPanel.reportBy", { user: report.reporterUser }, "Reported by {user}")
        : t("adminPanel.reportAnonymous", "Reported without an account"),
    ].filter(Boolean);
    const meta = document.createElement("p");
    meta.className = "exadmin-report-meta";
    meta.textContent = lines.join(" · ");
    item.appendChild(meta);

    if (report.details) {
      const details = document.createElement("blockquote");
      details.textContent = report.details;
      item.appendChild(details);
    }

    if (report.modelExists && report.modelUrl) {
      item.appendChild(modelLink({ id: report.jobId, modelUrl: report.modelUrl },
        t("adminPanel.reportOpenModel", "Open the model")));
    } else if (!report.modelExists) {
      const gone = document.createElement("p");
      gone.className = "exadmin-report-meta";
      gone.textContent = t("adminPanel.reportModelGone", "The model no longer exists.");
      item.appendChild(gone);
    }

    if (report.status !== "open") {
      const resolved = document.createElement("p");
      resolved.className = "exadmin-report-meta";
      resolved.textContent = t(
        "adminPanel.reportResolved",
        { action: t(...(ACTION_LABELS[report.action] || [report.action, report.action])), admin: report.resolvedBy || "" },
        "Resolved ({action}) by {admin}"
      );
      item.appendChild(resolved);
      return item;
    }

    const actions = document.createElement("div");
    actions.className = "exadmin-report-actions";
    Object.entries(ACTION_LABELS).forEach(([action, label]) => {
      if (action === "remove-model" && !report.modelExists) return;
      if (action === "disable-user" && (!report.owner || report.owner === this.me)) return;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = t(...label);
      if (action !== "dismiss") button.classList.add("exadmin-report-danger");
      button.addEventListener("click", () => this.resolve(report, action));
      actions.appendChild(button);
    });
    item.appendChild(actions);
    return item;
  }

  async resolve(report, action) {
    if (action !== "dismiss") {
      const confirmed = await confirmDialog({
        message: action === "remove-model"
          ? t("adminPanel.reportRemoveConfirm",
            "Remove this model for good? Its files, converted model and renders are deleted.")
          : t("adminPanel.reportDisableConfirm", { user: report.owner },
            "Disable the account {user}? They can no longer log in or upload."),
        confirmLabel: t(...ACTION_LABELS[action]),
        cancelLabel: t("adminPanel.deleteCancel", "Cancel"),
        danger: true,
      });
      if (!confirmed) return;
    }
    try {
      await apiRequest(`/api/admin/reports/${encodeURIComponent(report.id)}`, "POST", { action });
      toast("reportResolved", "info");
      await this.load();
    } catch (error) {
      console.error("[exadmin] Failed to resolve report:", error);
      this.setStatus(error.message, "error");
    }
  }
}

const reportsSection = {
  id: "reports",
  label: () => t("exadmin.navReports", "Reports"),
  badge: ({ openReports }) => (openReports
    ? { text: String(openReports), alert: true, title: t("adminPanel.reportsOpenCount", { count: openReports }, "{count} reports waiting for a decision") }
    : null),
  mount(container, context) {
    const section = new ReportsSection(context);
    container.appendChild(section.element);
    section.load();
  },
};

// Statistics (GET /api/admin/stats, worker/server.py admin_stats): how many
// accounts there are, of which role, status and plan, and how many models
// were uploaded and how big, per day (per week or month over longer ranges).
// The worker sends the raw points; they are counted here, in the browser's
// time zone. Charts are plain SVG: one series each, one axis, a tooltip on
// every column, and the numbers as a table underneath.

const SVG_NS = "http://www.w3.org/2000/svg";
const DAY_MS = 24 * 3600 * 1000;

const RANGES = [
  { id: "30", days: 30, unit: "day", label: ["exadmin.statsRange30", "30 days"] },
  { id: "90", days: 90, unit: "day", label: ["exadmin.statsRange90", "90 days"] },
  { id: "365", days: 365, unit: "week", label: ["exadmin.statsRange365", "12 months"] },
  { id: "all", days: 0, unit: "month", label: ["exadmin.statsRangeAll", "All time"] },
];

const ROLE_LABELS = {
  admin: ["exadmin.statsRoleAdmin", "Administrator"],
  user: ["exadmin.statsRoleUser", "User"],
};
const STATUS_LABELS = {
  active: ["exadmin.statsStatusActive", "Active"],
  pending: ["exadmin.statsStatusPending", "Waiting for approval"],
  disabled: ["exadmin.statsStatusDisabled", "Disabled"],
};
const PLAN_LABELS = {
  free: ["exadmin.statsPlanFree", "Free"],
  pro: ["exadmin.statsPlanPro", "Pro"],
  business: ["exadmin.statsPlanBusiness", "Business"],
  enterprise: ["exadmin.statsPlanEnterprise", "Enterprise"],
};

const label = ([key, fallback]) => t(key, fallback);

// ---- buckets -------------------------------------------------------------

function startOf(unit, date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (unit === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (unit === "month") d.setDate(1);
  return d;
}

function nextOf(unit, date) {
  const d = new Date(date);
  if (unit === "day") d.setDate(d.getDate() + 1);
  else if (unit === "week") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

// A local date as YYYY-MM-DD (toISOString would give the UTC day).
const isoDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function bucketLabel(unit, date, short = false) {
  if (unit === "month") return date.toLocaleDateString(locale(), { year: short ? "2-digit" : "numeric", month: "short" });
  return date.toLocaleDateString(locale(), short ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

// The buckets of a range, oldest first: {start, end, label}. "All time"
// starts at the first point.
function makeBuckets(range, now, firstPoint) {
  const end = startOf(range.unit, now);
  let start;
  if (range.days) start = startOf(range.unit, new Date(now.getTime() - (range.days - 1) * DAY_MS));
  else start = startOf(range.unit, firstPoint ? new Date(firstPoint * 1000) : now);
  const buckets = [];
  for (let cursor = start; cursor <= end; cursor = nextOf(range.unit, cursor)) {
    buckets.push({ start: cursor, end: nextOf(range.unit, cursor) });
  }
  return buckets;
}

// Sums value(point) of the points into the buckets.
function fill(buckets, points, value = () => 1) {
  const sums = buckets.map(() => 0);
  if (!buckets.length) return sums;
  const first = buckets[0].start.getTime();
  const last = buckets[buckets.length - 1].end.getTime();
  points.forEach((point) => {
    const time = point.createdAt * 1000;
    if (time < first || time >= last) return;
    // Buckets are few (at most a few hundred): a scan is fine.
    const index = buckets.findIndex((bucket) => time < bucket.end.getTime());
    if (index >= 0) sums[index] += value(point);
  });
  return sums;
}

// ---- charts --------------------------------------------------------------

function svg(tag, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

// Clean axis maximum and ticks: 1, 2 or 5 times a power of ten.
// Counts step by whole numbers.
function niceTicks(max, count = 4) {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const raw = Math.max(1, max / count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { top, ticks };
}

function fractionalTicks(max, count = 4) {
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { top, ticks };
}

// Byte axes step by powers of 1024 so the ticks read 0 / 256 MB / 512 MB.
function niceByteTicks(max) {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const unit = 1024 ** Math.max(0, Math.floor(Math.log(max) / Math.log(1024)));
  const { ticks } = fractionalTicks(max / unit);
  return { top: ticks[ticks.length - 1] * unit, ticks: ticks.map((tick) => tick * unit) };
}

class Tooltip {
  constructor(host) {
    this.element = document.createElement("div");
    this.element.className = "exadmin-stats-tooltip";
    this.element.hidden = true;
    host.appendChild(this.element);
    this.host = host;
  }

  show(event, title, value) {
    this.element.textContent = "";
    const head = document.createElement("div");
    head.className = "exadmin-stats-tooltip-title";
    head.textContent = title;
    const body = document.createElement("div");
    body.textContent = value;
    this.element.append(head, body);
    this.element.hidden = false;
    const box = this.host.getBoundingClientRect();
    const x = event.clientX - box.left;
    const width = this.element.offsetWidth;
    this.element.style.left = `${Math.max(0, Math.min(box.width - width, x - width / 2))}px`;
    this.element.style.top = `${event.clientY - box.top - this.element.offsetHeight - 12}px`;
  }

  hide() {
    this.element.hidden = true;
  }
}

// Columns over time (mode "columns") or a running total (mode "line").
function timeChart({ buckets, values, unit, format, mode = "columns", ticks: tickFn = niceTicks }) {
  const figure = document.createElement("div");
  figure.className = "exadmin-stats-plot";
  const tooltip = new Tooltip(figure);

  const draw = () => {
    figure.querySelector("svg")?.remove();
    const width = Math.max(280, figure.clientWidth || 600);
    const height = 180;
    const margin = { top: 10, right: 8, bottom: 24, left: 56 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const { top, ticks } = tickFn(Math.max(0, ...values));
    const y = (v) => margin.top + plotH - (v / top) * plotH;
    const band = plotW / Math.max(1, buckets.length);

    const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, width, height, role: "img" });
    ticks.forEach((tick) => {
      root.appendChild(svg("line", {
        x1: margin.left, x2: width - margin.right, y1: y(tick), y2: y(tick), class: "exadmin-stats-grid",
      }));
      const text = svg("text", { x: margin.left - 8, y: y(tick) + 4, "text-anchor": "end", class: "exadmin-stats-axis" });
      text.textContent = format(tick);
      root.appendChild(text);
    });

    // Date labels: as many as fit, about 70px apart.
    const every = Math.max(1, Math.ceil(70 / band));
    buckets.forEach((bucket, index) => {
      if (index % every) return;
      const text = svg("text", {
        x: margin.left + band * (index + 0.5), y: height - 6, "text-anchor": "middle", class: "exadmin-stats-axis",
      });
      text.textContent = bucketLabel(unit, bucket.start, true);
      root.appendChild(text);
    });

    if (mode === "line") {
      const points = values.map((v, i) => `${margin.left + band * (i + 0.5)},${y(v)}`);
      const base = y(0);
      root.appendChild(svg("path", {
        d: `M${margin.left + band * 0.5},${base}L${points.join("L")}L${margin.left + band * (values.length - 0.5)},${base}Z`,
        class: "exadmin-stats-area",
      }));
      root.appendChild(svg("path", { d: `M${points.join("L")}`, class: "exadmin-stats-line" }));
      const lastX = margin.left + band * (values.length - 0.5);
      root.appendChild(svg("circle", { cx: lastX, cy: y(values[values.length - 1] || 0), r: 4, class: "exadmin-stats-dot" }));
    } else {
      const barW = Math.max(1, Math.min(24, band - 2));
      const radius = Math.min(4, barW / 2);
      values.forEach((value, index) => {
        if (!value) return;
        const x = margin.left + band * index + (band - barW) / 2;
        const h = Math.max(1, y(0) - y(value));
        const r = Math.min(radius, h);
        const top0 = y(0) - h;
        // Rounded at the data end, square on the baseline.
        root.appendChild(svg("path", {
          d: `M${x},${y(0)}V${top0 + r}Q${x},${top0} ${x + r},${top0}H${x + barW - r}Q${x + barW},${top0} ${x + barW},${top0 + r}V${y(0)}Z`,
          class: "exadmin-stats-bar",
        }));
      });
    }
    root.appendChild(svg("line", {
      x1: margin.left, x2: width - margin.right, y1: y(0), y2: y(0), class: "exadmin-stats-baseline",
    }));

    // Hit targets: the whole band, taller than the mark.
    const marker = svg("line", { y1: margin.top, y2: y(0), class: "exadmin-stats-cursor", visibility: "hidden" });
    root.appendChild(marker);
    buckets.forEach((bucket, index) => {
      const hit = svg("rect", {
        x: margin.left + band * index, y: margin.top, width: band, height: plotH, class: "exadmin-stats-hit",
      });
      const title = unit === "day" ? bucketLabel("day", bucket.start)
        : unit === "week" ? `${bucketLabel("day", bucket.start)} – ${bucketLabel("day", new Date(bucket.end.getTime() - DAY_MS))}`
          : bucketLabel("month", bucket.start);
      hit.addEventListener("pointermove", (event) => {
        const cx = margin.left + band * (index + 0.5);
        marker.setAttribute("x1", cx);
        marker.setAttribute("x2", cx);
        marker.setAttribute("visibility", "visible");
        tooltip.show(event, title, format(values[index]));
      });
      hit.addEventListener("pointerleave", () => {
        marker.setAttribute("visibility", "hidden");
        tooltip.hide();
      });
      root.appendChild(hit);
    });
    figure.prepend(root);
  };

  // Drawn once in the page (its width known), again when the width changes.
  let lastWidth = 0;
  new ResizeObserver(() => {
    if (figure.clientWidth && figure.clientWidth !== lastWidth) {
      lastWidth = figure.clientWidth;
      draw();
    }
  }).observe(figure);
  return figure;
}

// Horizontal bars of a breakdown (role, status, plan), largest first is
// left to the caller: the order of the categories is fixed.
function breakdownChart(rows, format = formatCount) {
  const list = document.createElement("div");
  list.className = "exadmin-stats-breakdown";
  const max = Math.max(1, ...rows.map((row) => row.value));
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "exadmin-stats-breakdown-row";
    const name = document.createElement("span");
    name.className = "exadmin-stats-breakdown-name";
    name.textContent = row.label;
    const track = document.createElement("span");
    track.className = "exadmin-stats-breakdown-track";
    const bar = document.createElement("span");
    bar.className = "exadmin-stats-breakdown-bar";
    bar.style.width = row.value ? `${Math.max(1, (row.value / max) * 100)}%` : "0";
    track.appendChild(bar);
    const value = document.createElement("span");
    value.className = "exadmin-stats-breakdown-value";
    value.textContent = format(row.value);
    item.append(name, track, value);
    list.appendChild(item);
  });
  return list;
}

function dataTable(headers, rows) {
  const details = document.createElement("details");
  details.className = "exadmin-stats-table";
  const summary = document.createElement("summary");
  summary.textContent = t("exadmin.statsShowTable", "Table");
  const table = document.createElement("table");
  const head = table.createTHead().insertRow();
  headers.forEach((header) => {
    const cell = document.createElement("th");
    cell.textContent = header;
    head.appendChild(cell);
  });
  const body = table.createTBody();
  rows.forEach((row) => {
    const tr = body.insertRow();
    row.forEach((value) => {
      tr.insertCell().textContent = value;
    });
  });
  details.append(summary, table);
  return details;
}

function card(title, subtitle, ...content) {
  const element = document.createElement("article");
  element.className = "exadmin-stats-card";
  const heading = document.createElement("h3");
  heading.textContent = title;
  element.appendChild(heading);
  if (subtitle) {
    const sub = document.createElement("p");
    sub.className = "exadmin-stats-sub";
    sub.textContent = subtitle;
    element.appendChild(sub);
  }
  element.append(...content);
  return element;
}

// How full the volume with the models is (admin_watch.py disk_usage), in
// the warning colour from WORKER_DISK_WARN_PERCENT on.
function diskMeter(disk) {
  const element = document.createElement("div");
  element.className = "exadmin-stats-disk";
  if (disk.warning) element.dataset.warning = "true";
  const text = document.createElement("div");
  text.className = "exadmin-stats-disk-text";
  const title = document.createElement("strong");
  title.textContent = t("exadmin.statsDisk", "Disk");
  const values = document.createElement("span");
  values.textContent = t("exadmin.statsDiskValues",
    { used: formatBytes(disk.used), total: formatBytes(disk.total), free: formatBytes(disk.free), percent: Math.round(disk.percent) },
    "{used} of {total} used ({percent}%) · {free} free");
  text.append(title, values);
  const track = document.createElement("div");
  track.className = "exadmin-stats-disk-track";
  track.setAttribute("role", "meter");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", String(disk.percent));
  track.setAttribute("aria-label", title.textContent);
  const bar = document.createElement("div");
  bar.className = "exadmin-stats-disk-bar";
  bar.style.width = `${Math.min(100, disk.percent)}%`;
  track.appendChild(bar);
  if (disk.warnPercent) {
    const mark = document.createElement("div");
    mark.className = "exadmin-stats-disk-mark";
    mark.style.left = `${disk.warnPercent}%`;
    track.appendChild(mark);
  }
  element.append(text, track);
  if (disk.warning) {
    const warning = document.createElement("p");
    warning.className = "exadmin-stats-disk-warning";
    warning.textContent = t("exadmin.statsDiskWarning", { percent: disk.warnPercent },
      "Over {percent}% full: uploads fail once the disk is full. Delete models or give the volume more space.");
    element.appendChild(warning);
  }
  return element;
}

function tile(value, caption) {
  const element = document.createElement("div");
  element.className = "exadmin-stats-tile";
  const number = document.createElement("strong");
  number.textContent = value;
  const text = document.createElement("span");
  text.textContent = caption;
  element.append(number, text);
  return element;
}

// ---- the section ---------------------------------------------------------

const RANGE_STORAGE_KEY = "exadmin-stats-range";

function storedRange() {
  try {
    return RANGES.find((range) => range.id === localStorage.getItem(RANGE_STORAGE_KEY)) || RANGES[0];
  } catch {
    return RANGES[0];
  }
}

class StatsSection {
  constructor() {
    this.range = storedRange();
    const element = document.createElement("section");
    element.className = "exadmin-section exadmin-stats";
    element.innerHTML = `
      <div class="exadmin-section-header">
        <h2></h2>
        <div class="exadmin-stats-ranges" role="group"></div>
        <button type="button" class="exadmin-stats-csv"></button>
      </div>
      <p class="upload-panel-status" role="status" aria-live="polite"></p>
      <div class="exadmin-stats-body"></div>
    `;
    element.querySelector("h2").textContent = t("exadmin.statsTitle", "Statistics");
    this.element = element;
    this.status = element.querySelector(".upload-panel-status");
    this.body = element.querySelector(".exadmin-stats-body");
    this.ranges = element.querySelector(".exadmin-stats-ranges");
    const csvButton = element.querySelector(".exadmin-stats-csv");
    csvButton.textContent = t("exadmin.statsCsv", "Download CSV");
    csvButton.addEventListener("click", () => this.downloadCsv());
    this.ranges.setAttribute("aria-label", t("exadmin.statsRange", "Period"));
    this.renderRanges();
  }

  renderRanges() {
    this.ranges.textContent = "";
    RANGES.forEach((range) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label(range.label);
      button.setAttribute("aria-pressed", String(range === this.range));
      button.addEventListener("click", () => {
        this.range = range;
        try {
          localStorage.setItem(RANGE_STORAGE_KEY, range.id);
        } catch {
          // Storage blocked: the choice lasts until the page is left.
        }
        this.renderRanges();
        this.render();
      });
      this.ranges.appendChild(button);
    });
  }

  downloadCsv() {
    if (!this.csv) return;
    const text = this.csv.rows.map((row) => row.map((cell) => {
      const value = String(cell);
      return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = this.csv.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async load() {
    this.status.textContent = t("exadmin.loading", "Loading...");
    try {
      this.data = await apiRequest("/api/admin/stats");
      this.status.textContent = "";
    } catch (error) {
      console.error("[exadmin] Failed to load statistics:", error);
      this.status.textContent = error.message;
      this.status.dataset.tone = "error";
      return;
    }
    this.render();
  }

  render() {
    if (!this.data) return;
    const users = Array.isArray(this.data.users) ? this.data.users : [];
    const models = Array.isArray(this.data.models) ? this.data.models : [];
    const now = new Date((this.data.now || Date.now() / 1000) * 1000);
    const range = this.range;
    const unitText = {
      day: t("exadmin.statsPerDay", "per day"),
      week: t("exadmin.statsPerWeek", "per week"),
      month: t("exadmin.statsPerMonth", "per month"),
    }[range.unit];
    const firstPoint = Math.min(...[...users, ...models].map((p) => p.createdAt).filter(Boolean), now.getTime() / 1000);
    const buckets = makeBuckets(range, now, firstPoint);
    const periodHeader = t("exadmin.statsPeriod", "Period");
    const periodLabels = buckets.map((bucket) => bucketLabel(range.unit, bucket.start));

    this.body.textContent = "";

    // Headline numbers.
    const count = (list, key, value) => list.filter((item) => item[key] === value).length;
    // Accounts that used the viewer signed in (worker/auth.py lastSeenAt).
    const activeSince = (days) => users.filter((u) => u.lastSeenAt && now.getTime() / 1000 - u.lastSeenAt < days * 86400).length;
    const tiles = document.createElement("div");
    tiles.className = "exadmin-stats-tiles";
    tiles.append(
      tile(formatCount(users.length), t("exadmin.statsUsers", "Accounts")),
      tile(formatCount(count(users, "status", "pending")), t("exadmin.statsPending", "Waiting for approval")),
      tile(formatCount(activeSince(7)), t("exadmin.statsActive7", "Active in the last 7 days")),
      tile(formatCount(activeSince(30)), t("exadmin.statsActive30", "Active in the last 30 days")),
      tile(formatCount(models.length), t("exadmin.statsModels", "Models")),
      tile(formatBytes(models.reduce((sum, m) => sum + (m.size || 0), 0)), t("exadmin.statsUploadedSize", "Uploaded")),
      tile(formatBytes(models.reduce((sum, m) => sum + (m.storage || 0), 0)), t("exadmin.statsStorage", "On disk")),
    );
    this.body.appendChild(tiles);
    if (this.data.disk) this.body.appendChild(diskMeter(this.data.disk));

    // Accounts: in total over time, new ones per bucket.
    const signups = fill(buckets, users);
    const before = users.filter((u) => buckets.length && u.createdAt * 1000 < buckets[0].start.getTime()).length;
    let running = before;
    const totals = signups.map((n) => (running += n));
    const grid = document.createElement("div");
    grid.className = "exadmin-stats-grid-cards";
    grid.append(
      card(t("exadmin.statsUsersTotal", "Accounts in total"), null,
        timeChart({ buckets, values: totals, unit: range.unit, format: formatCount, mode: "line" }),
        dataTable([periodHeader, t("exadmin.statsUsers", "Accounts")], periodLabels.map((p, i) => [p, formatCount(totals[i])]))),
      card(t("exadmin.statsSignups", "New accounts"), unitText,
        timeChart({ buckets, values: signups, unit: range.unit, format: formatCount }),
        dataTable([periodHeader, t("exadmin.statsSignups", "New accounts")], periodLabels.map((p, i) => [p, formatCount(signups[i])]))),
    );

    // Models: how many, how big.
    const uploads = fill(buckets, models);
    const sizes = fill(buckets, models, (m) => m.size || 0);
    grid.append(
      card(t("exadmin.statsUploads", "Uploaded models"), unitText,
        timeChart({ buckets, values: uploads, unit: range.unit, format: formatCount }),
        dataTable([periodHeader, t("exadmin.statsModels", "Models")], periodLabels.map((p, i) => [p, formatCount(uploads[i])]))),
      card(t("exadmin.statsUploadSizes", "Size of the uploaded models"), unitText,
        timeChart({ buckets, values: sizes, unit: range.unit, format: formatBytes, ticks: niceByteTicks }),
        dataTable([periodHeader, t("exadmin.statsUploadedSize", "Uploaded")], periodLabels.map((p, i) => [p, formatBytes(sizes[i])]))),
    );

    // Conversions that failed (worker failed.json, recorded from this
    // version on), and of what the models are.
    const failures = fill(buckets, models, (m) => (m.failed ? 1 : 0));
    const failedInRange = failures.reduce((sum, n) => sum + n, 0);
    const uploadsInRange = uploads.reduce((sum, n) => sum + n, 0);
    const failedShare = uploadsInRange ? Math.round((failedInRange / uploadsInRange) * 1000) / 10 : 0;
    grid.append(
      card(t("exadmin.statsFailures", "Failed conversions"),
        t("exadmin.statsFailuresSub", { count: formatCount(failedInRange), percent: failedShare.toLocaleString(locale()), unit: unitText },
          "{count} in this period ({percent}% of the uploads) · {unit}"),
        timeChart({ buckets, values: failures, unit: range.unit, format: formatCount }),
        dataTable([periodHeader, t("exadmin.statsFailures", "Failed conversions")], periodLabels.map((p, i) => [p, formatCount(failures[i])]))),
    );
    const formatCounts = new Map();
    models.forEach((m) => formatCounts.set(m.format || "?", (formatCounts.get(m.format || "?") || 0) + 1));
    const formatRows = [...formatCounts.entries()].sort((a, b) => b[1] - a[1]);
    // Ten formats by name, the rest folded into one row.
    const topFormats = formatRows.slice(0, 10).map(([format, value]) => ({ label: format === "?" ? "?" : `.${format}`, value }));
    const otherFormats = formatRows.slice(10).reduce((sum, [, value]) => sum + value, 0);
    if (otherFormats) topFormats.push({ label: t("exadmin.statsOtherFormats", "Other"), value: otherFormats });
    if (topFormats.length) {
      grid.append(card(t("exadmin.statsFormats", "Models by format"), t("exadmin.statsAllTime", "all time"),
        breakdownChart(topFormats),
        dataTable([t("exadmin.modelsFormat", "Format"), t("exadmin.statsModels", "Models")],
          formatRows.map(([format, value]) => [format === "?" ? "?" : `.${format}`, formatCount(value)]))));
    }

    // The period's numbers as a file, for a spreadsheet.
    this.csv = {
      name: `statistics-${range.id}-${isoDay(new Date())}.csv`,
      rows: [
        ["period_start", "new_accounts", "accounts_total", "uploaded_models", "uploaded_bytes", "failed_conversions"],
        ...buckets.map((bucket, i) => [
          isoDay(bucket.start), signups[i], totals[i], uploads[i], sizes[i], failures[i],
        ]),
      ],
    };

    // Breakdowns of the accounts as they are now.
    const breakdown = (labels, key) => Object.entries(labels).map(([id, text]) => ({ label: label(text), value: count(users, key, id) }));
    const breakdownCard = (title, rows) => card(title, null, breakdownChart(rows),
      dataTable([title, t("exadmin.statsUsers", "Accounts")], rows.map((row) => [row.label, formatCount(row.value)])));
    // The accounts using the most space on disk (named: admins only).
    const top = Array.isArray(this.data.topStorage) ? this.data.topStorage : [];
    if (top.length) {
      const rows = top.map((entry) => ({ label: entry.username, value: entry.storage }));
      grid.appendChild(card(t("exadmin.statsTopStorage", "Most space on disk"), null,
        breakdownChart(rows, formatBytes),
        dataTable([t("exadmin.modelsOwner", "Owner"), t("exadmin.statsModels", "Models"), t("exadmin.statsStorage", "On disk")],
          top.map((entry) => [entry.username, formatCount(entry.models), formatBytes(entry.storage)]))));
    }
    grid.append(
      breakdownCard(t("exadmin.statsByRole", "Role"), breakdown(ROLE_LABELS, "role")),
      breakdownCard(t("exadmin.statsByPlan", "Plan"), breakdown(PLAN_LABELS, "plan")),
      breakdownCard(t("exadmin.statsByStatus", "Status"), breakdown(STATUS_LABELS, "status")),
    );
    this.body.appendChild(grid);
  }
}

const statsSection = {
  id: "stats",
  label: () => t("exadmin.navStats", "Statistics"),
  badge: ({ disk }) => (disk?.warning
    ? { text: "!", alert: true, title: t("exadmin.statsDiskFull", { percent: Math.round(disk.percent) }, "Disk {percent}% full") }
    : null),
  mount(container) {
    const section = new StatsSection();
    container.appendChild(section.element);
    section.load();
  },
};

// Registered accounts (worker/auth.py "administration" methods, server.py
// _handle_admin_*): approve, disable, promote, delete; each account's plan,
// upload limits and uploaded models.

const adminRequest = (path, method = "GET", body = undefined) =>
  apiRequest(`/api/admin/users${path}`, method, body);

// Per-account upload limits (worker/limits.py). 0 means unlimited; an empty
// field falls back to the worker's WORKER_LIMIT_* default.
const LIMIT_FIELDS = [
  { key: "uploadsPerHour", label: ["adminPanel.limitUploadsPerHour", "Uploads per hour"] },
  { key: "uploadsPerDay", label: ["adminPanel.limitUploadsPerDay", "Uploads per day"] },
  { key: "storageMb", label: ["adminPanel.limitStorageMb", "Storage (MB)"] },
  { key: "maxModels", label: ["adminPanel.limitMaxModels", "Max models"] },
  { key: "concurrentJobs", label: ["adminPanel.limitConcurrentJobs", "Concurrent conversions"] },
];

// The account's plan (worker/auth.py effective_app_plan) as a small icon, coloured like the
// .plan-badge elsewhere: an outlined star (Free), a star (Pro), a gem
// (Business), a crown (Enterprise). The name stays in its tooltip and
// accessible label.
const PLAN_ICONS = {
  free: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  pro: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor"/>',
  business:
    '<defs><linearGradient id="adminPlanBusiness" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#db2777"/></linearGradient></defs>' +
    '<path d="M7 4h10l4 5-9 11L3 9z" fill="url(#adminPlanBusiness)"/>' +
    '<path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1" stroke-linejoin="round"/>',
  enterprise:
    '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="#b8860b"/>' +
    '<path d="M5 19h14" stroke="#7a5a00" stroke-width="1.6" stroke-linecap="round"/>',
};

function createPlanIcon(tier) {
  const icon = document.createElement("span");
  icon.className = "admin-plan-icon";
  icon.dataset.tier = tier;
  icon.setAttribute("role", "img");
  icon.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">${PLAN_ICONS[tier] || PLAN_ICONS.free}</svg>`;
  return icon;
}

const PLAN_RANK = { enterprise: 4, business: 3, pro: 2, free: 1 };

const lastUploadOf = (models) => models.reduce((latest, job) => Math.max(latest, job.createdAt || 0), 0);

// Sort keys for the user list. `desc`: the first click sorts high to low
// (biggest, newest, best plan first); names go A-Z.
const USER_SORTS = {
  plan: { label: ["adminPanel.sortPlan", "Plan"], desc: true, value: (u) => PLAN_RANK[u.user.plan?.tier] || 0 },
  name: { label: ["adminPanel.sortName", "Name"], desc: false, value: (u) => u.user.username.toLocaleLowerCase() },
  models: { label: ["adminPanel.sortModels", "Uploaded models"], desc: true, value: (u) => u.models.length },
  storage: { label: ["adminPanel.sortStorage", "Storage used"], desc: true, value: (u) => u.user.usage?.storageBytes || 0 },
  lastUpload: { label: ["adminPanel.sortLastUpload", "Last upload"], desc: true, value: (u) => lastUploadOf(u.models) },
  lastSeen: { label: ["adminPanel.sortLastSeen", "Last active"], desc: true, value: (u) => u.user.lastSeenAt || 0 },
};

function compareUsers(a, b, key, desc) {
  const va = USER_SORTS[key].value(a);
  const vb = USER_SORTS[key].value(b);
  const order = typeof va === "string" ? va.localeCompare(vb) : va - vb;
  // Ties (e.g. everyone on Free) fall back to the name, always A-Z.
  if (order === 0) return a.user.username.localeCompare(b.user.username);
  return desc ? -order : order;
}

// Unix seconds <-> the local "YYYY-MM-DDTHH:MM" of <input type="datetime-local">.
function toDateTimeInputValue(seconds) {
  if (!seconds) return "";
  const date = new Date(seconds * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateTimeInputValue(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.floor(time / 1000) : null;
}

function formatLimit(value) {
  return value ? String(value) : "∞";
}

// The list's tabs, one per account status (worker/auth.py STATUSES), each
// named with its count; Waiting gets an exclamation mark while any account
// waits for approval.
const STATUS_TABS = [
  { status: "active", label: ["adminPanel.tabActive", "Active"] },
  { status: "pending", label: ["adminPanel.tabPending", "Waiting"] },
  { status: "disabled", label: ["adminPanel.tabDisabled", "Disabled"] },
];

class UsersSection {
  // `me`: the signed-in admin's username (they cannot disable, demote or
  // delete themselves).
  constructor({ me }) {
    this.me = me;
    this.users = [];
    this.unownedModels = [];
    this.expandedModels = new Set();
    // Rows opened to their models, plan and limits (closed by default).
    this.expandedUsers = new Set();
    this.defaultLimits = null;
    this.businessLimits = null;
    this.sort = { key: "plan", desc: USER_SORTS.plan.desc };
    // Chosen on the first load: Waiting while accounts wait, else Active.
    this.statusTab = null;
    // Accounts waiting for approval picked for a bulk approve or reject.
    this.selected = new Set();

    const element = document.createElement("section");
    element.className = "exadmin-section exadmin-users";
    element.innerHTML = `
      <div class="exadmin-section-header">
        <h2>${t("adminPanel.title", "Manage users")}</h2>
        <div class="admin-users-sort" hidden>
          <label for="adminUsersSort">${t("adminPanel.sortBy", "Sort by")}</label>
          <select id="adminUsersSort"></select>
          <button type="button" class="admin-users-sort-direction"></button>
        </div>
      </div>
      <input type="search" class="admin-users-search" hidden autocomplete="off" spellcheck="false" />
      <div class="admin-users-tabs" role="tablist" hidden></div>
      <p class="upload-panel-status" role="status" aria-live="polite"></p>
      <div class="admin-users-bulk admin-users-actions" hidden></div>
      <ul class="admin-users-list" role="tabpanel"></ul>
    `;
    this.element = element;
    this.status = element.querySelector(".upload-panel-status");
    this.list = element.querySelector(".admin-users-list");
    this.sortBar = element.querySelector(".admin-users-sort");
    this.tabs = element.querySelector(".admin-users-tabs");
    this.bulkBar = element.querySelector(".admin-users-bulk");
    // Name or e-mail, any part, any case; the tabs count the matches.
    this.search = element.querySelector(".admin-users-search");
    this.search.placeholder = t("adminPanel.searchPlaceholder", "Search by name or e-mail");
    this.search.setAttribute("aria-label", this.search.placeholder);
    this.query = "";
    this.search.addEventListener("input", () => {
      this.query = this.search.value.trim().toLocaleLowerCase();
      this.render();
    });
    this.tabs.setAttribute("aria-label", t("adminPanel.tabsLabel", "Accounts by status"));
    this.sortSelect = element.querySelector("#adminUsersSort");
    this.sortDirection = element.querySelector(".admin-users-sort-direction");

    Object.entries(USER_SORTS).forEach(([key, sort]) => {
      this.sortSelect.appendChild(new Option(t(...sort.label), key));
    });
    this.sortSelect.value = this.sort.key;
    this.sortSelect.addEventListener("change", () => {
      const key = this.sortSelect.value;
      this.sort = { key, desc: USER_SORTS[key].desc };
      this.render();
    });
    this.sortDirection.addEventListener("click", () => {
      this.sort.desc = !this.sort.desc;
      this.render();
    });
  }

  setStatus(message, tone = "info") {
    this.status.textContent = message;
    this.status.dataset.tone = tone;
  }

  reportError(error, context) {
    console.error(`[exadmin] ${context}:`, error);
  }

  async load() {
    this.list.textContent = "";
    this.sortBar.hidden = true;
    this.tabs.hidden = true;
    this.search.hidden = true;
    this.setStatus(t("exadmin.loading", "Loading..."));

    let users = [];
    try {
      const data = await adminRequest("");
      users = data.users || [];
      this.defaultLimits = data.defaultLimits || null;
      this.businessLimits = data.businessLimits || null;
    } catch (error) {
      this.reportError(error, "Failed to load users list");
      this.setStatus(t("adminPanel.loadError", "Could not load the user list."), "error");
      return;
    }
    this.setStatus("");

    if (users.length === 0) {
      const empty = document.createElement("li");
      empty.className = "admin-users-empty";
      empty.textContent = t("adminPanel.empty", "No registered users yet.");
      this.list.appendChild(empty);
      return;
    }

    // Upload stats/listing are best-effort - a failure here shouldn't
    // block the user list itself, just leave counts at 0/empty.
    let jobsByOwner = new Map();
    try {
      jobsByOwner = await fetchJobsByOwner();
    } catch (error) {
      this.reportError(error, "Failed to load user upload stats");
    }

    this.users = users.map((user) => ({ user, models: jobsByOwner.get(user.username) || [] }));
    // Uploads from before accounts (or anonymous ones): listed separately
    // so an admin can assign them to someone.
    const known = new Set(users.map((user) => user.username));
    this.unownedModels = [...jobsByOwner.entries()]
      .filter(([owner]) => !known.has(owner))
      .flatMap(([, models]) => models);
    if (!this.statusTab) {
      this.statusTab = users.some((user) => user.status === "pending") ? "pending" : "active";
    }
    this.sortBar.hidden = false;
    this.tabs.hidden = false;
    this.search.hidden = false;
    this.render();
  }

  matches({ user }) {
    if (!this.query) return true;
    return [user.username, user.email].some((text) => String(text || "").toLocaleLowerCase().includes(this.query));
  }

  renderTabs() {
    this.tabs.textContent = "";
    const found = this.users.filter((entry) => this.matches(entry));
    STATUS_TABS.forEach(({ status, label }) => {
      const count = found.filter(({ user }) => user.status === status).length;
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "admin-users-tab";
      tab.setAttribute("role", "tab");
      tab.dataset.status = status;
      const selected = status === this.statusTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const text = document.createElement("span");
      text.textContent = `${t(...label)} (${count})`;
      tab.appendChild(text);
      if (status === "pending" && count > 0) {
        const alert = document.createElement("span");
        alert.className = "admin-users-tab-alert";
        alert.textContent = "!";
        alert.title = t("adminPanel.tabPendingAlert", { count }, "{count} accounts waiting for approval");
        alert.setAttribute("aria-label", alert.title);
        tab.appendChild(alert);
      }
      tab.addEventListener("click", () => {
        this.statusTab = status;
        this.render();
      });
      // Arrow keys move between the tabs (WAI-ARIA tabs pattern).
      tab.addEventListener("keydown", (event) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const index = STATUS_TABS.findIndex((item) => item.status === status);
        this.statusTab = STATUS_TABS[(index + step + STATUS_TABS.length) % STATUS_TABS.length].status;
        this.render();
        this.tabs.querySelector('[aria-selected="true"]')?.focus();
      });
      this.tabs.appendChild(tab);
    });
  }

  render() {
    const { key, desc } = this.sort;
    const label = desc
      ? t("adminPanel.sortDescending", "Descending")
      : t("adminPanel.sortAscending", "Ascending");
    this.sortDirection.textContent = desc ? "↓" : "↑";
    this.sortDirection.title = label;
    this.sortDirection.setAttribute("aria-label", label);
    this.renderTabs();
    this.renderBulkBar();
    this.list.textContent = "";
    const shown = this.users.filter((entry) => entry.user.status === this.statusTab && this.matches(entry));
    if (!shown.length) {
      const empty = document.createElement("li");
      empty.className = "admin-users-empty";
      empty.textContent = this.query
        ? t("adminPanel.searchEmpty", "No account here matches the search.")
        : t("adminPanel.tabEmpty", "No accounts here.");
      this.list.appendChild(empty);
    }
    shown
      .sort((a, b) => compareUsers(a, b, key, desc))
      .forEach(({ user, models }) => this.list.appendChild(this.renderUserRow(user, models)));
    // Models without an account belong to no status: listed with the active ones.
    if (this.statusTab === "active" && !this.query && this.unownedModels.length) {
      this.list.appendChild(this.renderUnownedModelsRow(this.unownedModels));
    }
  }

  renderUnownedModelsRow(models) {
    const item = document.createElement("li");
    item.className = "admin-users-row";
    const info = document.createElement("div");
    info.className = "admin-users-info";
    const name = document.createElement("span");
    name.className = "admin-users-name";
    name.textContent = t("adminPanel.unownedTitle", "Uploads without an owner");
    const meta = document.createElement("span");
    meta.className = "admin-users-meta";
    meta.textContent = t("adminPanel.modelsCount", { count: models.length }, "{count} models");
    info.append(name, meta);
    item.append(info, this.renderUserModelsTab("", models));
    return item;
  }

  renderUserRow(user, models = []) {
    const item = document.createElement("li");
    item.className = "admin-users-row";

    const top = document.createElement("div");
    top.className = "admin-users-row-top";

    const info = document.createElement("div");
    info.className = "admin-users-info";
    const name = document.createElement("span");
    name.className = "admin-users-name";
    name.textContent = user.username;
    // Accounts waiting for approval: picked for the bulk actions above them.
    if (user.status === "pending") {
      const pick = document.createElement("input");
      pick.type = "checkbox";
      pick.className = "admin-users-pick";
      pick.checked = this.selected.has(user.username);
      pick.setAttribute("aria-label", t("adminPanel.selectUser", { user: user.username }, "Select {user}"));
      pick.addEventListener("change", () => {
        if (pick.checked) this.selected.add(user.username);
        else this.selected.delete(user.username);
        this.renderBulkBar();
      });
      name.prepend(pick);
    }
    // The account's plan: granted by an admin or bought in an app.
    if (user.plan) {
      const badge = createPlanIcon(user.plan.tier);
      const details = [
        t(`plans.${user.plan.tier}`, user.plan.tier),
        user.plan.source === "admin"
          ? t("adminPanel.planSourceAdmin", "granted by an admin")
          : t("loginPanel.planTitle", "Plan bought in the app"),
      ];
      if (user.plan.expiresAt) {
        details.push(t("adminPanel.planRenews", { date: formatDate(user.plan.expiresAt) }, "renews/ends {date}"));
      }
      if (user.plan.updatedAt) {
        details.push(t("adminPanel.planChecked", { date: formatDateTime(user.plan.updatedAt) }, "checked {date}"));
      }
      badge.title = details.join(" · ");
      badge.setAttribute("aria-label", badge.title);
      name.appendChild(badge);
    }
    const meta = document.createElement("span");
    meta.className = "admin-users-meta";
    const created = user.createdAt
      ? t("adminPanel.createdOn", { date: formatDate(user.createdAt) }, "registered {date}")
      : "";
    const modelsCount = t("adminPanel.modelsCount", { count: models.length }, "{count} models");
    const lastUpload = lastUploadOf(models);
    const lastUploadText = lastUpload
      ? t("adminPanel.lastUpload", { date: formatDate(lastUpload) }, "last upload {date}")
      : "";
    const role = user.role === "admin" ? t("exadmin.statsRoleAdmin", "Administrator") : t("exadmin.statsRoleUser", "User");
    // When the account last used the viewer (worker/auth.py lastSeenAt;
    // empty for accounts not seen since the worker started recording it).
    const seen = user.lastSeenAt
      ? t("adminPanel.lastSeen", { when: formatRelative(user.lastSeenAt) }, "active {when}")
      : user.status === "active" ? t("adminPanel.neverSeen", "not seen yet") : "";
    // An administrator's second step for these pages (worker auth.py).
    const twoFactor = user.role === "admin"
      ? (user.twoFactor ? t("adminPanel.twoFactorOn", "two-step verification on") : t("adminPanel.twoFactorOff", "no two-step verification yet"))
      : "";
    meta.textContent = [user.email, role, twoFactor, seen, modelsCount, lastUploadText, created]
      .filter(Boolean)
      .join(" · ");
    info.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "admin-users-actions";
    const isSelf = user.username === this.me;

    if (user.status === "pending" || user.status === "disabled") {
      actions.appendChild(
        this.createUserActionButton(user.username, "approve", t("adminPanel.approve", "Approve"))
      );
      if (user.status === "pending") {
        const reject = document.createElement("button");
        reject.type = "button";
        reject.className = "admin-users-delete";
        reject.textContent = t("adminPanel.reject", "Reject");
        reject.addEventListener("click", () => this.rejectUsers([user.username]));
        actions.appendChild(reject);
      }
    } else if (!isSelf) {
      actions.appendChild(
        this.createUserActionButton(user.username, "disable", t("adminPanel.disable", "Disable"))
      );
    }

    // Another admin lost their phone: they set the app up again next time.
    if (!isSelf && user.role === "admin" && user.twoFactor) {
      const reset = document.createElement("button");
      reset.type = "button";
      reset.textContent = t("adminPanel.twoFactorReset", "Reset two-step verification");
      reset.addEventListener("click", () => this.resetTwoFactor(user.username));
      actions.appendChild(reset);
    }

    if (!isSelf) {
      if (user.role === "admin") {
        actions.appendChild(
          this.createUserActionButton(user.username, "demote", t("adminPanel.demote", "Demote"))
        );
      } else {
        actions.appendChild(
          this.createUserActionButton(user.username, "promote", t("adminPanel.promote", "Promote"))
        );
      }
    }

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "admin-users-delete";
    deleteButton.textContent = t("adminPanel.delete", "Delete");
    deleteButton.disabled = isSelf;
    deleteButton.title = isSelf ? t("adminPanel.cannotDeleteSelf", "You cannot delete your own account.") : "";
    deleteButton.addEventListener("click", () => this.deleteUserWithConfirm(user.username));
    actions.appendChild(deleteButton);

    top.append(info, actions);

    // Models, plan and limits fold away: a row is one line of name and
    // actions until opened (kept open across re-renders).
    const details = document.createElement("div");
    details.className = "admin-users-details";
    details.id = `adminUserDetails-${user.username}`;
    const open = this.expandedUsers.has(user.username);
    details.hidden = !open;
    details.append(this.renderUserModelsTab(user.username, models), this.renderUserPlanTab(user));
    // Older workers do not report limits - leave the section out.
    if (user.effectiveLimits) details.appendChild(this.renderUserLimitsTab(user));

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "admin-users-expand";
    toggle.setAttribute("aria-controls", details.id);
    const syncToggle = () => {
      const expanded = !details.hidden;
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.textContent = expanded ? t("adminPanel.detailsHide", "Less") : t("adminPanel.detailsShow", "Details");
      item.classList.toggle("is-expanded", expanded);
    };
    toggle.addEventListener("click", () => {
      details.hidden = !details.hidden;
      if (details.hidden) this.expandedUsers.delete(user.username);
      else this.expandedUsers.add(user.username);
      syncToggle();
    });
    syncToggle();
    actions.prepend(toggle);

    item.append(top, details);
    return item;
  }

  // The account's plan (worker/auth.py effective_app_plan): what it bought
  // in the app, raised by a plan an admin grants here (optionally until a
  // date). A grant cannot take away a purchase - the higher one applies.
  renderUserPlanTab(user) {
    const section = document.createElement("div");
    section.className = "admin-users-limits admin-users-plan";
    const plan = user.plan;
    const purchase = plan?.purchase?.tier || (plan?.source === "store" ? plan.tier : null);
    const grant = plan?.grant || null;

    const summary = document.createElement("p");
    summary.className = "admin-users-limits-summary";
    const parts = [
      t("adminPanel.planCurrent", { plan: t(`plans.${plan?.tier || "free"}`, plan?.tier || "free") }, "Plan: {plan}"),
    ];
    // Only an account that bought something in the app has a purchase to name.
    if (purchase && purchase !== "free") {
      parts.push(t("adminPanel.planPurchase", { plan: t(`plans.${purchase}`, purchase) }, "bought in the app: {plan}"));
    }
    if (grant) {
      parts.push(grant.expiresAt
        ? t("adminPanel.planGrantUntil", { plan: t(`plans.${grant.tier}`, grant.tier), date: formatDate(grant.expiresAt) }, "granted: {plan} until {date}")
        : t("adminPanel.planGrant", { plan: t(`plans.${grant.tier}`, grant.tier) }, "granted: {plan}"));
    }
    summary.textContent = parts.join(" · ");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "admin-users-models-toggle";
    toggle.textContent = t("adminPanel.planShow", "Change plan");

    const form = document.createElement("form");
    form.className = "admin-users-limits-form";
    form.hidden = true;

    const tierField = document.createElement("label");
    tierField.className = "admin-users-limits-field";
    const tierText = document.createElement("span");
    tierText.textContent = t("adminPanel.planGrantLabel", "Granted plan");
    const tierSelect = document.createElement("select");
    tierSelect.appendChild(new Option(t("adminPanel.planNone", "None (only what was bought)"), ""));
    // Enterprise is only granted here (price agreed individually).
    ["pro", "business", "enterprise"].forEach((tier) => tierSelect.appendChild(new Option(t(`plans.${tier}`, tier), tier)));
    tierSelect.value = grant?.tier && grant.tier !== "free" ? grant.tier : "";
    tierField.append(tierText, tierSelect);

    const untilField = document.createElement("label");
    untilField.className = "admin-users-limits-field";
    const untilText = document.createElement("span");
    untilText.textContent = t("adminPanel.planUntil", "Until (empty = no end)");
    const until = document.createElement("input");
    until.type = "datetime-local";
    until.value = toDateTimeInputValue(grant?.expiresAt);
    untilField.append(untilText, until);

    const hint = document.createElement("p");
    hint.className = "admin-users-limits-note";
    hint.textContent = t("adminPanel.planHint", "The higher of the granted and the bought plan applies, in the app and for the upload limits.");

    const buttons = document.createElement("div");
    buttons.className = "admin-users-actions";
    const save = document.createElement("button");
    save.type = "submit";
    save.textContent = t("adminPanel.planSave", "Save plan");
    buttons.appendChild(save);
    form.append(tierField, untilField, hint, buttons);

    const syncUntil = () => { until.disabled = !tierSelect.value; };
    syncUntil();
    tierSelect.addEventListener("change", syncUntil);
    toggle.addEventListener("click", () => {
      form.hidden = !form.hidden;
      toggle.textContent = form.hidden
        ? t("adminPanel.planShow", "Change plan")
        : t("adminPanel.planHide", "Hide plan");
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const tier = tierSelect.value || null;
      const expiresAt = tier && until.value ? fromDateTimeInputValue(until.value) : null;
      try {
        await adminRequest(`/${encodeURIComponent(user.username)}/plan`, "POST", { tier, expiresAt });
        toast("userUpdated", "success");
        await this.load();
      } catch (error) {
        this.reportError(error, "Failed to save user plan");
        this.setStatus(error.message, "error");
      }
    });

    section.append(summary, toggle, form);
    return section;
  }

  renderUserLimitsTab(user) {
    const section = document.createElement("div");
    section.className = "admin-users-limits";

    const usage = user.usage || {};
    const limits = user.effectiveLimits || {};
    const summary = document.createElement("p");
    summary.className = "admin-users-limits-summary";
    summary.textContent = t(
      "adminPanel.limitsUsage",
      {
        hour: `${usage.uploadsLastHour ?? 0}/${formatLimit(limits.uploadsPerHour)}`,
        day: `${usage.uploadsLastDay ?? 0}/${formatLimit(limits.uploadsPerDay)}`,
        storage: `${((usage.storageBytes || 0) / 1048576).toFixed(1)}/${formatLimit(limits.storageMb)}`,
        models: `${usage.models ?? 0}/${formatLimit(limits.maxModels)}`,
      },
      "Uploads {hour} this hour, {day} today · Storage {storage} MB · Models {models}"
    );

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "admin-users-models-toggle";
    toggle.textContent = t("adminPanel.limitsShow", "Edit limits");

    const form = document.createElement("form");
    form.className = "admin-users-limits-form";
    form.hidden = true;

    if (user.role === "admin") {
      const note = document.createElement("p");
      note.className = "admin-users-limits-note";
      note.textContent = t("adminPanel.limitsAdmin", "Admins are not limited.");
      form.appendChild(note);
    }

    const overrides = user.limits || {};
    // Accounts with the app's Business plan start from its limits.
    const isBusiness = ["business", "enterprise"].includes(user.plan?.tier) && this.businessLimits;
    const defaults = (isBusiness ? this.businessLimits : this.defaultLimits) || {};
    if (isBusiness && user.role !== "admin") {
      const note = document.createElement("p");
      note.className = "admin-users-limits-note";
      note.textContent = t("adminPanel.limitsBusiness", "Business or Enterprise plan: the Business limits are the defaults here.");
      form.appendChild(note);
    }
    const inputs = {};
    LIMIT_FIELDS.forEach(({ key, label }) => {
      const field = document.createElement("label");
      field.className = "admin-users-limits-field";
      const text = document.createElement("span");
      text.textContent = t(label[0], label[1]);
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.inputMode = "numeric";
      input.value = overrides[key] ?? "";
      input.placeholder = t("adminPanel.limitsDefault", { value: formatLimit(defaults[key]) }, "default: {value}");
      field.append(text, input);
      form.appendChild(field);
      inputs[key] = input;
    });

    const hint = document.createElement("p");
    hint.className = "admin-users-limits-note";
    hint.textContent = t("adminPanel.limitsHint", "Empty = default, 0 = unlimited.");

    const buttons = document.createElement("div");
    buttons.className = "admin-users-actions";
    const save = document.createElement("button");
    save.type = "submit";
    save.textContent = t("adminPanel.limitsSave", "Save limits");
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = t("adminPanel.limitsReset", "Use defaults");
    buttons.append(save, reset);
    form.append(hint, buttons);

    toggle.addEventListener("click", () => {
      form.hidden = !form.hidden;
      toggle.textContent = form.hidden
        ? t("adminPanel.limitsShow", "Edit limits")
        : t("adminPanel.limitsHide", "Hide limits");
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const payload = {};
      LIMIT_FIELDS.forEach(({ key }) => {
        const raw = inputs[key].value.trim();
        payload[key] = raw === "" ? null : Number(raw);
      });
      this.saveUserLimits(user.username, payload);
    });
    reset.addEventListener("click", () => {
      const payload = {};
      LIMIT_FIELDS.forEach(({ key }) => { payload[key] = null; });
      this.saveUserLimits(user.username, payload);
    });

    section.append(summary, toggle, form);
    return section;
  }

  async saveUserLimits(username, payload) {
    try {
      await adminRequest(`/${encodeURIComponent(username)}/limits`, "POST", payload);
      toast("userUpdated", "success");
      await this.load();
    } catch (error) {
      this.reportError(error, "Failed to save user limits");
      this.setStatus(error.message, "error");
    }
  }

  // A per-user "tab": a toggle that reveals that user's own uploaded
  // models, each deletable from here. Since it only ever lists jobs whose
  // owner is this username, deleting from it can only ever remove that
  // user's own uploads - never another user's.
  renderUserModelsTab(username, models) {
    const section = document.createElement("div");
    section.className = "admin-users-models";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "admin-users-models-toggle";
    toggle.textContent = t("adminPanel.modelsShow", "Show models");
    toggle.disabled = models.length === 0;

    const modelsList = document.createElement("ul");
    modelsList.className = "admin-users-models-list";
    // Stays open across re-renders (sorting, editing a model).
    modelsList.hidden = !(models.length > 0 && this.expandedModels.has(username));
    if (!modelsList.hidden) toggle.textContent = t("adminPanel.modelsHide", "Hide models");
    this.renderUserModelsList(modelsList, username, models);

    toggle.addEventListener("click", () => {
      const willShow = modelsList.hidden;
      modelsList.hidden = !willShow;
      if (willShow) this.expandedModels.add(username);
      else this.expandedModels.delete(username);
      toggle.textContent = willShow
        ? t("adminPanel.modelsHide", "Hide models")
        : t("adminPanel.modelsShow", "Show models");
    });

    section.append(toggle, modelsList);
    return section;
  }

  renderUserModelsList(modelsList, username, models) {
    modelsList.textContent = "";
    if (models.length === 0) {
      const empty = document.createElement("li");
      empty.className = "models-panel-empty";
      empty.textContent = t("adminPanel.modelsEmpty", "No models uploaded yet.");
      modelsList.appendChild(empty);
      return;
    }
    models.forEach((job) => modelsList.appendChild(this.renderUserModelRow(username, job, modelsList)));
  }

  renderUserModelRow(username, job, modelsList) {
    const name = job.name || job.id;
    const item = document.createElement("li");
    item.className = "models-panel-row admin-model-row";

    const entry = document.createElement("span");
    entry.className = "models-panel-item";
    entry.title = name;
    // Same thumbnail slot (and placeholder) as the viewer's browse-models panel.
    const thumbSlot = document.createElement("span");
    thumbSlot.className = "models-panel-item-thumb";
    thumbSlot.setAttribute("aria-hidden", "true");
    fillModelThumbnail(thumbSlot, remoteUrl(job.imageUrls?.[0]) || "", job.id);
    entry.appendChild(thumbSlot);
    const text = document.createElement("span");
    text.className = "models-panel-item-text";
    const label = document.createElement("span");
    label.className = "models-panel-item-name";
    label.textContent = name;
    const caption = metaCaption([
      job.owner
        ? metaPart("user", t("modelsMeta.uploadedBy", "Uploaded by"), job.owner)
        : metaPart("no-user", t("adminPanel.modelNoOwner", "No owner")),
      job.createdAt
        ? metaPart("date", t("modelsMeta.uploaded", "Uploaded"), formatDateTime(job.createdAt))
        : null,
      // The worker's check of the model file (validation.json), as in the
      // browse-models panel.
      modelCheckPart(job.validation),
    ]);
    text.append(label, caption);
    entry.appendChild(text);
    item.appendChild(entry);

    const editForm = this.renderModelEditForm(job);
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "models-panel-edit";
    editButton.textContent = "✎";
    const editAria = t("adminPanel.modelEditAria", { name }, "Edit upload details of {name}");
    editButton.setAttribute("aria-label", editAria);
    editButton.title = editAria;
    editButton.setAttribute("aria-expanded", "false");
    editButton.addEventListener("click", () => {
      editForm.hidden = !editForm.hidden;
      editButton.setAttribute("aria-expanded", String(!editForm.hidden));
      if (!editForm.hidden) editForm.querySelector("select")?.focus();
    });
    item.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "models-panel-delete";
    deleteButton.textContent = "✕";
    const deleteAria = t("adminPanel.modelDeleteAria", { name }, "Delete {name}");
    deleteButton.setAttribute("aria-label", deleteAria);
    deleteButton.title = deleteAria;
    deleteButton.addEventListener("click", () =>
      this.deleteUserModelWithConfirm(username, job, item, modelsList)
    );
    item.appendChild(deleteButton);
    item.appendChild(editForm);

    return item;
  }

  // Who uploaded the model and when (POST /api/admin/jobs/<id>).
  renderModelEditForm(job) {
    const form = document.createElement("form");
    form.className = "admin-model-edit";
    form.hidden = true;

    const ownerField = document.createElement("label");
    ownerField.className = "admin-users-limits-field";
    const ownerText = document.createElement("span");
    ownerText.textContent = t("adminPanel.modelOwner", "Uploaded by");
    const ownerSelect = document.createElement("select");
    ownerSelect.appendChild(new Option(t("adminPanel.modelNoOwner", "No owner"), ""));
    this.users
      .map(({ user }) => user.username)
      .sort((a, b) => a.localeCompare(b))
      .forEach((username) => ownerSelect.appendChild(new Option(username, username)));
    ownerSelect.value = job.owner || "";
    ownerField.append(ownerText, ownerSelect);

    const dateField = document.createElement("label");
    dateField.className = "admin-users-limits-field";
    const dateText = document.createElement("span");
    dateText.textContent = t("adminPanel.modelUploadedAt", "Uploaded on");
    const dateInput = document.createElement("input");
    dateInput.type = "datetime-local";
    dateInput.required = true;
    dateInput.value = toDateTimeInputValue(job.createdAt);
    dateField.append(dateText, dateInput);

    const buttons = document.createElement("div");
    buttons.className = "admin-users-actions";
    const save = document.createElement("button");
    save.type = "submit";
    save.textContent = t("adminPanel.modelSave", "Save");
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = t("modelsPanel.deleteCancel", "Cancel");
    buttons.append(save, cancel);

    form.append(ownerField, dateField, buttons);

    cancel.addEventListener("click", () => {
      ownerSelect.value = job.owner || "";
      dateInput.value = toDateTimeInputValue(job.createdAt);
      form.hidden = true;
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const createdAt = fromDateTimeInputValue(dateInput.value);
      if (!createdAt) return;
      save.disabled = true;
      await this.saveModelDetails(job, { owner: ownerSelect.value || null, createdAt });
      save.disabled = false;
    });
    return form;
  }

  async saveModelDetails(job, payload) {
    try {
      const result = await apiRequest(`/api/admin/jobs/${encodeURIComponent(job.id)}`, "POST", payload);
      const owner = result.owner || "";
      const updated = { ...job, owner: result.owner || null, createdAt: result.createdAt || payload.createdAt };
      // Move the model to its (new) owner's list.
      const remove = (models) => models.filter((m) => m.id !== job.id);
      this.users.forEach((entry) => { entry.models = remove(entry.models); });
      this.unownedModels = remove(this.unownedModels);
      const target = this.users.find((entry) => entry.user.username === owner);
      const models = target ? target.models : this.unownedModels;
      models.push(updated);
      models.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      this.expandedModels.add(target ? owner : "");
      this.render();
      toast("modelUpdated", "success");
    } catch (error) {
      this.reportError(error, "Failed to update model details");
      this.setStatus(error.message, "error");
    }
  }

  async deleteUserModelWithConfirm(username, job, item, modelsList) {
    const name = job.name || job.id;
    const confirmed = await confirmDialog({
      message: t(
        "adminPanel.modelDeleteConfirm",
        { name },
        'Delete "{name}"? This permanently removes the converted model and its renders.'
      ),
      confirmLabel: t("modelsPanel.deleteAction", "Delete"),
      cancelLabel: t("modelsPanel.deleteCancel", "Cancel"),
      danger: true,
    });
    if (!confirmed) return;

    try {
      try {
        await apiRequest(`/api/jobs/${encodeURIComponent(job.id)}`, "DELETE");
      } catch (error) {
        if (error.status !== 404) throw error;
      }
      item.remove();
      // Keep the sorted list's data in step (a re-sort re-renders from it).
      const entry = this.users.find((u) => u.user.username === username);
      if (entry) entry.models = entry.models.filter((m) => m.id !== job.id);
      else this.unownedModels = this.unownedModels.filter((m) => m.id !== job.id);
      if (modelsList.children.length === 0) {
        this.renderUserModelsList(modelsList, username, []);
      }
      toast("modelDeleted", "info");
    } catch (error) {
      this.reportError(error, "Failed to delete user's model");
      toast("modelDeleteError", "error");
    }
  }

  createUserActionButton(username, action, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => this.performUserAction(username, action));
    return button;
  }

  // Shown in the Waiting tab: pick all, approve or reject the picked ones.
  renderBulkBar() {
    const pending = this.users
      .filter((entry) => entry.user.status === "pending" && this.matches(entry))
      .map(({ user }) => user.username);
    // Only what is still waiting (and shown) stays picked.
    [...this.selected].forEach((name) => { if (!pending.includes(name)) this.selected.delete(name); });
    this.bulkBar.textContent = "";
    this.bulkBar.hidden = this.statusTab !== "pending" || pending.length === 0;
    if (this.bulkBar.hidden) return;

    const all = document.createElement("label");
    all.className = "admin-users-bulk-all";
    const allBox = document.createElement("input");
    allBox.type = "checkbox";
    allBox.checked = this.selected.size === pending.length;
    allBox.indeterminate = this.selected.size > 0 && this.selected.size < pending.length;
    allBox.addEventListener("change", () => {
      if (allBox.checked) pending.forEach((name) => this.selected.add(name));
      else this.selected.clear();
      this.render();
    });
    const allText = document.createElement("span");
    allText.textContent = t("adminPanel.selectAll", "Select all");
    all.append(allBox, allText);

    const count = this.selected.size;
    const approve = document.createElement("button");
    approve.type = "button";
    approve.textContent = t("adminPanel.approveSelected", { count }, "Approve selected ({count})");
    approve.disabled = !count;
    approve.addEventListener("click", () => this.approveUsers([...this.selected]));
    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "admin-users-delete";
    reject.textContent = t("adminPanel.rejectSelected", { count }, "Reject selected ({count})");
    reject.disabled = !count;
    reject.addEventListener("click", () => this.rejectUsers([...this.selected]));
    this.bulkBar.append(all, approve, reject);
  }

  // One request per account (each mailed on its own), then one reload.
  async approveUsers(usernames) {
    const failed = [];
    for (const username of usernames) {
      try {
        await adminRequest(`/${encodeURIComponent(username)}/approve`, "POST");
        this.selected.delete(username);
      } catch (error) {
        this.reportError(error, `Failed to approve ${username}`);
        failed.push(`${username}: ${error.message}`);
      }
    }
    if (failed.length) this.setStatus(failed.join(" · "), "error");
    else toast("userUpdated", "success");
    await this.load();
  }

  // Asks for the reason (mailed to each of them, optional), then deletes
  // the accounts (POST /api/admin/users/<u>/reject).
  async rejectUsers(usernames) {
    if (!usernames.length) return;
    const reason = await confirmDialog({
      message: usernames.length === 1
        ? t("adminPanel.rejectConfirm", { user: usernames[0] }, "Reject the account {user}? It is deleted and they are told by e-mail.")
        : t("adminPanel.rejectConfirmMany", { count: usernames.length }, "Reject {count} accounts? They are deleted and each is told by e-mail."),
      input: {
        label: t("adminPanel.rejectReason", "Reason (sent in the e-mail, optional)"),
        placeholder: t("adminPanel.rejectReasonPlaceholder", "e.g. We could not confirm who you are."),
      },
      confirmLabel: t("adminPanel.reject", "Reject"),
      cancelLabel: t("adminPanel.deleteCancel", "Cancel"),
      danger: true,
    });
    if (reason === null) return;
    const failed = [];
    for (const username of usernames) {
      try {
        await adminRequest(`/${encodeURIComponent(username)}/reject`, "POST", { reason });
        this.selected.delete(username);
      } catch (error) {
        this.reportError(error, `Failed to reject ${username}`);
        failed.push(`${username}: ${error.message}`);
      }
    }
    if (failed.length) this.setStatus(failed.join(" · "), "error");
    else toast("userUpdated", "success");
    await this.load();
  }

  async resetTwoFactor(username) {
    const confirmed = await confirmDialog({
      message: t("adminPanel.twoFactorResetConfirm", { user: username },
        "Turn off two-step verification of {user}? They set up their authenticator app again on their next visit here."),
      confirmLabel: t("adminPanel.twoFactorReset", "Reset two-step verification"),
      cancelLabel: t("adminPanel.deleteCancel", "Cancel"),
      danger: true,
    });
    if (!confirmed) return;
    await this.performUserAction(username, "2fa-reset");
  }

  async performUserAction(username, action) {
    try {
      await adminRequest(`/${encodeURIComponent(username)}/${action}`, "POST");
      toast("userUpdated", "success");
      await this.load();
    } catch (error) {
      this.reportError(error, `Failed to ${action} user`);
      this.setStatus(error.message, "error");
    }
  }

  async deleteUserWithConfirm(username) {
    const confirmed = await confirmDialog({
      message: t(
        "adminPanel.deleteConfirm",
        { user: username },
        'Delete user "{user}"? This permanently removes their account.'
      ),
      confirmLabel: t("adminPanel.deleteAction", "Delete"),
      cancelLabel: t("adminPanel.deleteCancel", "Cancel"),
      danger: true,
    });
    if (!confirmed) return;

    try {
      await adminRequest(`/${encodeURIComponent(username)}`, "DELETE");
      toast("userDeleted", "info");
      await this.load();
    } catch (error) {
      this.reportError(error, "Failed to delete user");
      this.setStatus(error.message, "error");
    }
  }
}

const usersSection = {
  id: "users",
  label: () => t("exadmin.navUsers", "Users"),
  badge: ({ pendingUsers }) => (pendingUsers
    ? { text: "!", alert: true, title: t("adminPanel.tabPendingAlert", { count: pendingUsers }, "{count} accounts waiting for approval") }
    : null),
  // Builds the section into `container` and loads its data.
  mount(container, context) {
    const section = new UsersSection(context);
    container.appendChild(section.element);
    section.load();
  },
};

// The admin pages' sections, in navigation order. A section is
// { id, label(), mount(container, { me }) }: `id` is its address
// (/exadmin/#<id>), mount() builds it into the emptied main area each time
// it is opened. A new one is added here and nowhere else. An optional
// badge(summary) puts a counter next to its name (main.js, GET
// /api/admin/summary).
const SECTIONS = [usersSection, modelsSection, statsSection, reportsSection, historySection, examplesSection];

// The admin pages (/exadmin/): the worker's administration, apart from the
// viewer. Same-origin with the worker, so the viewer's login (the worker's
// session cookie) is valid here as well. Language and theme follow what
// the viewer stored (viewer-defaults.js storage keys).

const LANGUAGE_STORAGE_KEY = "viewer-language";
const THEME_STORAGE_KEY = "manifesto-dark-mode";
const LANGUAGES = ["en", "pl", "de"];

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice lasts until the page is left.
  }
}

function storedLanguage() {
  const pick = (value) => LANGUAGES.find((lang) => String(value || "").toLowerCase().startsWith(lang));
  return pick(readStorage(LANGUAGE_STORAGE_KEY)) || pick(navigator.language) || "en";
}

let language = storedLanguage();
setLanguageSource(() => language);

// The viewer's default is dark; "0" stored = light.
function applyTheme() {
  const theme = readStorage(THEME_STORAGE_KEY) === "0" ? "light" : "dark";
  document.documentElement.dataset.viewerTheme = theme;
  return theme;
}

const page = {
  main: document.getElementById("exadminMain"),
  nav: document.getElementById("exadminNav"),
  account: document.getElementById("exadminAccount"),
  title: document.getElementById("exadminTitle"),
  viewerLink: document.getElementById("exadminViewerLink"),
};

let me = null;
// The signed-in admin's second step (GET /api/auth/me twoFactor).
let twoFactor = null;

function messageBlock(text, tone = "info") {
  const block = document.createElement("p");
  block.className = "exadmin-message";
  block.dataset.tone = tone;
  block.textContent = text;
  return block;
}

function renderChrome() {
  document.documentElement.lang = language;
  document.title = t("exadmin.title", "Administration");
  page.title.textContent = t("exadmin.title", "Administration");
  page.viewerLink.textContent = t("exadmin.backToViewer", "Back to the viewer");
  // In the app: back to its viewer (the panel lies over it, app-bridge.js).
  if (appMode && !page.viewerLink.dataset.bound) {
    page.viewerLink.dataset.bound = "true";
    page.viewerLink.addEventListener("click", (event) => {
      event.preventDefault();
      closePanel();
    });
  }

  page.account.textContent = "";
  const languageSelect = document.createElement("select");
  languageSelect.className = "exadmin-language";
  languageSelect.setAttribute("aria-label", t("exadmin.language", "Language"));
  LANGUAGES.forEach((lang) => languageSelect.appendChild(new Option(lang.toUpperCase(), lang)));
  languageSelect.value = language;
  languageSelect.addEventListener("change", () => {
    language = languageSelect.value;
    writeStorage(LANGUAGE_STORAGE_KEY, language);
    render();
  });

  const themeButton = document.createElement("button");
  themeButton.type = "button";
  themeButton.className = "exadmin-theme";
  const isDark = applyTheme() === "dark";
  themeButton.textContent = isDark ? "☀️" : "🌙";
  themeButton.title = isDark ? t("theme.lightMode", "Light mode") : t("theme.darkMode", "Dark mode");
  themeButton.setAttribute("aria-label", themeButton.title);
  themeButton.addEventListener("click", () => {
    writeStorage(THEME_STORAGE_KEY, isDark ? "0" : "1");
    renderChrome();
  });

  page.account.append(languageSelect, themeButton);
  if (me) {
    const user = document.createElement("span");
    user.className = "exadmin-user";
    user.textContent = t("loginPanel.openSignedIn", { user: me }, "Signed in as {user}");
    const logout = document.createElement("button");
    logout.type = "button";
    logout.textContent = t("uploadPanel.logout", "Log out");
    logout.addEventListener("click", async () => {
      try {
        await authRequest("logout", {});
      } catch (error) {
        console.error("[exadmin] Logout failed:", error);
      }
      start();
    });
    // The app has its own login: signing out stays there.
    // This device is remembered for the second step: a way to undo it
    // (every remembered device of the account asks for a code again).
    if (twoFactor?.remembered) page.account.append(forgetDevicesButton());
    if (appMode) page.account.append(user);
    else page.account.append(user, logout);
  }
}

function forgetDevicesButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = t("exadmin.twoFactorForget", "Forget remembered devices");
  button.title = t("exadmin.twoFactorForgetTitle", "This and your other remembered devices ask for a code again.");
  button.addEventListener("click", async () => {
    const confirmed = await confirmDialog({
      message: t("exadmin.twoFactorForgetConfirm",
        "Forget every device you chose to remember? Each of them asks for a code from your authenticator app again."),
      confirmLabel: t("exadmin.twoFactorForget", "Forget remembered devices"),
      cancelLabel: t("adminPanel.deleteCancel", "Cancel"),
    });
    if (!confirmed) return;
    try {
      await apiRequest("/api/auth/2fa/forget-devices", "POST", {});
      storeDeviceToken("");
      toast("userUpdated", "success");
      await start();
    } catch (error) {
      console.error("[exadmin] Could not forget the devices:", error);
    }
  });
  return button;
}

function renderLogin(message) {
  const form = document.createElement("form");
  form.className = "exadmin-login";
  const heading = document.createElement("h2");
  heading.textContent = t("exadmin.loginTitle", "Log in as an administrator");
  const username = document.createElement("input");
  username.type = "text";
  username.autocomplete = "username";
  username.autocapitalize = "off";
  username.required = true;
  username.placeholder = t("uploadPanel.username", "Username");
  username.setAttribute("aria-label", username.placeholder);
  const { field: passwordField, input: password } = createPasswordField();
  password.required = true;
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = t("uploadPanel.login", "Log in");
  const status = messageBlock(message || "", message ? "error" : "info");
  // Cloudflare Turnstile, when the worker asks for it (worker/turnstile.py).
  const check = createTurnstile(authConfig?.turnstile, "login");
  form.append(heading, username, passwordField, ...(check.element ? [check.element] : []), submit, status);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      await authRequest("login", { username: username.value.trim(), password: password.value, turnstileToken: await check.token() });
      await start();
    } catch (error) {
      status.dataset.tone = "error";
      status.textContent = error.message;
      submit.disabled = false;
      check.reset();
    }
  });
  page.main.appendChild(form);
  username.focus();
}

function currentSection() {
  const id = location.hash.replace(/^#/, "");
  return SECTIONS.find((section) => section.id === id) || SECTIONS[0];
}

// The navigation's counters (GET /api/admin/summary): a section with a
// badge(summary) shows what waits there - {text, alert, title} or null.
let summary = null;

function renderNavBadges() {
  page.nav.querySelectorAll("a[data-section]").forEach((link) => {
    const section = SECTIONS.find((item) => item.id === link.dataset.section);
    link.querySelector(".exadmin-nav-badge")?.remove();
    const badge = summary && section?.badge ? section.badge(summary) : null;
    if (!badge) return;
    const element = document.createElement("span");
    element.className = "exadmin-nav-badge";
    if (badge.alert) element.dataset.alert = "true";
    element.textContent = badge.text;
    element.title = badge.title || "";
    if (badge.title) element.setAttribute("aria-label", badge.title);
    link.appendChild(element);
  });
}

async function refreshSummary() {
  try {
    summary = await apiRequest("/api/admin/summary");
  } catch (error) {
    // An older worker, or a moment offline: the navigation stays plain.
    console.warn("[exadmin] No summary:", error.message);
    summary = null;
  }
  renderNavBadges();
}

// A section changed something the counters count (approved an account,
// resolved a report): exadmin:changed asks for them again.
window.addEventListener("exadmin:changed", () => {
  if (state.view === "sections") refreshSummary();
});

function renderSection() {
  const active = currentSection();
  page.nav.textContent = "";
  SECTIONS.forEach((section) => {
    const link = document.createElement("a");
    link.href = `#${section.id}`;
    link.dataset.section = section.id;
    link.textContent = section.label();
    if (section === active) link.setAttribute("aria-current", "page");
    page.nav.appendChild(link);
  });
  page.nav.appendChild(reloadButton());
  renderNavBadges();
  refreshSummary();
  page.main.textContent = "";
  active.mount(page.main, { me });
}

// Fetches the open section's values again (its mount() loads them), the
// page itself stays: no reload, no lost place in the navigation.
const RELOAD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function reloadButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "exadmin-reload";
  button.innerHTML = RELOAD_ICON;
  button.title = t("exadmin.reload", "Refresh");
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", () => {
    renderSection();
    // The new button turns once: the values are on their way.
    page.nav.querySelector(".exadmin-reload")?.classList.add("is-spinning");
  });
  return button;
}

// What the page shows: who is signed in decides between the sections, the
// login form and a notice (accounts off, signed in without admin rights).
let state = { view: "loading" };
// GET /api/auth/config: accounts, and Turnstile's site key (login, 2FA).
let authConfig = null;

function render() {
  renderChrome();
  page.nav.textContent = "";
  page.main.textContent = "";
  if (state.view === "sections") renderSection();
  else if (state.view === "twoFactorSetup") {
    renderTwoFactorSetup(page.main, { user: me, turnstile: authConfig?.turnstile, rememberDays: twoFactor?.rememberDays, onDone: start });
  } else if (state.view === "twoFactorVerify") {
    renderTwoFactorVerify(page.main, {
      recoveryLeft: state.recoveryLeft, turnstile: authConfig?.turnstile, rememberDays: twoFactor?.rememberDays, onDone: start,
    });
  }
  else if (state.view === "login") renderLogin(state.message);
  else if (state.view === "accountsOff") page.main.appendChild(messageBlock(t("exadmin.accountsOff", "Accounts are not enabled on this server, so there is nothing to administer here.")));
  else if (state.view === "error") page.main.appendChild(messageBlock(t("exadmin.unreachable", "The server is not responding."), "error"));
  else page.main.appendChild(messageBlock(t("exadmin.loading", "Loading...")));
}

async function start() {
  me = null;
  twoFactor = null;
  state = { view: "loading" };
  render();
  try {
    const config = await authRequest("config");
    authConfig = config;
    if (config.mode !== "required") {
      state = { view: "accountsOff" };
    } else {
      const session = await authRequest("me");
      if (session.user && session.role === "admin") {
        me = session.user;
        twoFactor = session.twoFactor || null;
        // The admin pages' second step (worker WORKER_ADMIN_2FA).
        const second = session.twoFactor?.state;
        if (second === "setup") state = { view: "twoFactorSetup" };
        else if (second === "verify") state = { view: "twoFactorVerify", recoveryLeft: session.twoFactor.recoveryLeft };
        else state = { view: "sections" };
      } else {
        state = {
          view: "login",
          message: session.user
            ? t("exadmin.notAdmin", { user: session.user }, "{user} is not an administrator.")
            : "",
        };
      }
    }
  } catch (error) {
    console.error("[exadmin] Could not read the session:", error);
    state = { view: "error" };
  }
  render();
}

// A section was refused for want of the second step (it lapsed while the
// page was open): asked for again.
window.addEventListener("exadmin:second-step", () => {
  if (state.view === "sections") start();
});

window.addEventListener("hashchange", () => {
  if (state.view === "sections") renderSection();
});
// The theme or language changed in the viewer in another tab.
window.addEventListener("storage", (event) => {
  if (event.key === LANGUAGE_STORAGE_KEY) language = storedLanguage();
  if (event.key === LANGUAGE_STORAGE_KEY || event.key === THEME_STORAGE_KEY) render();
});

applyTheme();
start();
//# sourceMappingURL=exadmin-C2Ei0_Sf.js.map
