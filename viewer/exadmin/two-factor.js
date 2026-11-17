import { t } from "../i18n-utils.js";
import { apiRequest } from "./api.js";
import { qrSvg } from "./qr.js";
import { createTurnstile } from "../turnstile.js";

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
export function renderTwoFactorSetup(container, { user, turnstile, onDone }) {
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
    form.append(label, ...(check.element ? [check.element] : []), submit);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      try {
        const { recoveryCodes } = await apiRequest("/api/auth/2fa/enable", "POST",
          { code: input.value, turnstileToken: await check.token() });
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
export function renderTwoFactorVerify(container, { recoveryLeft, turnstile, onDone }) {
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
  form.append(heading, intro, input, ...(check.element ? [check.element] : []), submit, swap, status, lost);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const result = await apiRequest("/api/auth/2fa/verify", "POST", { code: input.value, turnstileToken: await check.token() });
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
