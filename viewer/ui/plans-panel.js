import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { toastHelper } from "../viewer-utils.js";
import { makePanelWindow } from "./panel-window.js";
import {
  LOCKED_TOOLS,
  TIERS,
  buyPlan,
  currentTier,
  defaultPrice,
  getPlanOffers,
  getTierOverride,
  hasFeature,
  isPlansEnabled,
  isStoreReady,
  isTestingBuild,
  onStoreTierChange,
  onTierChange,
  restorePlans,
  setTierOverride,
  tierHasFeature,
} from "../monetization/plan.js";
import { syncAccountLink } from "../monetization/account-link.js";
import { hasRemote } from "../remote.js";
import { canShowAdPrivacyOptions, showAdPrivacyOptions } from "../monetization/ads.js";
import { createDeleteAccountLink, createPlanBadge } from "./login-panel.js";

// A lock like the one on toolbar tools the plan does not include (the same
// icon, see .plan-lock-icon in main.css).
export function createPlanLockIcon() {
  const icon = document.createElement("span");
  icon.className = "plan-lock-icon";
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

// "viewer.thedworak.com": the repository the app was built with.
function builtInRepositoryHost() {
  try {
    return new URL(core.CONFIG?.mobile?.remoteUrl || "").host;
  } catch {
    return "";
  }
}

// The plans' feature lists. `feature` (monetization/plan.js FEATURES) marks
// an entry with a lock when the current plan - or, on the Free card, Free
// itself - does not include it.
const PLAN_CARDS = [
  {
    tier: "free",
    features: [
      { key: "plans.freeFeature1" },
      { key: "plans.proFeature1", feature: "noAds" },
      { key: "plans.businessFeature5", feature: "remoteModels" },
      { key: "plans.businessFeature4", feature: "annotations" },
      { key: "plans.businessFeature3", feature: "customRepository" },
    ],
  },
  {
    tier: "pro",
    features: [{ key: "plans.proFeature1", feature: "noAds" }, { key: "plans.proFeature2" }],
    priceSuffix: ["plans.oneTime", "one-time"],
  },
  {
    tier: "business",
    features: [
      { key: "plans.businessFeature1", feature: "noAds" },
      { key: "plans.businessFeature5", feature: "remoteModels" },
      { key: "plans.businessFeature2", feature: "serverBusinessLimits" },
      { key: "plans.businessFeature3", feature: "customRepository" },
      { key: "plans.businessFeature4", feature: "annotations" },
    ],
    priceSuffix: ["plans.perMonth", "per month"],
  },
];

// The app's plans panel (monetization/plan.js): the three plans with store
// prices, buying, restoring purchases, linking the purchase to an account on
// the repository and the ads' privacy options. Opened from the header's plan
// button and from tools the plan does not include.
export function attachPlansPanel(Viewer) {
  Object.assign(Viewer, {
    initPlansUi() {
      if (!isPlansEnabled()) return;
      this.createPlanButton();
      this.applyPlanLocks();
      onTierChange(() => {
        this.applyPlanLocks();
        this.updateRepositoryFormVisibility?.();
        this.applyModelsSourceLocks?.();
        if (this.plansPanel?.hidden === false) this.renderPlansPanel();
      });
      // Purchases, restores and lapsed subscriptions are the store's; tell
      // the account about them (not about tier changes the account itself
      // caused - see account-link.js).
      onStoreTierChange(() => syncAccountLink().then(() => this.refreshAuthState?.()));
      syncAccountLink().then(() => this.refreshAuthState?.());

      // Locked tools: the tap opens the plans panel instead. Capture phase,
      // so it runs before the tool's own handler (and its submenu).
      this.bindEventListener(document, "click", (event) => {
        const button = event.target.closest?.("#viewerEditorToolbar [data-tool]");
        if (!button) return;
        const locked = Object.entries(LOCKED_TOOLS).find(([tool, feature]) =>
          !hasFeature(feature) && button.closest(`[data-tool="${tool}"]`));
        if (!locked) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        toastHelper("planLocked", "info", { key: "plan-locked", replace: true });
        this.openPlansPanel("business");
      }, { capture: true });
    },

    // Called on plan changes and once the toolbar exists (after a model
    // has loaded) - it is built after this runs.
    applyPlanLocks() {
      if (!isPlansEnabled()) return;
      Object.entries(LOCKED_TOOLS).forEach(([tool, feature]) => {
        const button = this.editorToolbarButtons?.[tool];
        button?.classList.toggle("plan-locked", !hasFeature(feature));
      });
    },

    createPlanButton() {
      const anchor = document.getElementById("openLocalFileButton");
      if (!anchor || document.getElementById("planButton")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.id = "planButton";
      button.innerHTML = '<span class="plan-button-icon" aria-hidden="true"></span>';
      const label = t("plans.open", "Plans");
      button.setAttribute("aria-label", label);
      button.title = label;
      anchor.after(button);
      this.bindEventListener(button, "click", () => this.openPlansPanel());
    },

    openPlansPanel(highlight = "") {
      this.createPlansPanel();
      if (!this.plansPanel) return;
      this.closeLibraryPanel?.();
      this.closeModelsPanel?.();
      this.plansHighlight = highlight;
      this.plansPanel.hidden = false;
      this.renderPlansPanel();
    },

    closePlansPanel() {
      if (this.plansPanel) this.plansPanel.hidden = true;
    },

    createPlansPanel() {
      if (!core.container || this.plansPanel) return;
      const panel = document.createElement("div");
      panel.id = "plansPanel";
      panel.hidden = true;
      panel.innerHTML = `
        <div class="upload-panel-header">
          <span>${t("plans.title", "Plans")}</span>
          <button id="plansPanelClose" type="button" aria-label="${t("plans.closeAria", "Close")}">X</button>
        </div>
        <div class="plans-panel-body"></div>
      `;
      core.container.appendChild(panel);
      this.plansPanel = panel;
      this.bindEventListener(panel.querySelector("#plansPanelClose"), "click", () => this.closePlansPanel());
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"));
    },

    // The account on the repository (login-panel.js): signed in, its plan
    // applies on this device (the higher of it and what this device bought),
    // and a purchase made here is added to the account (account-link.js), so
    // the admin panel and other devices see it.
    renderPlansAccount() {
      const section = document.createElement("div");
      section.className = "plans-account";
      const title = document.createElement("strong");
      title.textContent = t("plans.accountTitle", "Account");
      section.appendChild(title);

      const state = this.authState || {};
      if (state.user) {
        const row = document.createElement("div");
        row.className = "plans-account-row";
        const label = document.createElement("span");
        label.className = "plans-account-user";
        label.textContent = t("plans.accountSignedIn", { user: state.user }, "Signed in as {user}");
        const tier = state.plan?.tier || "free";
        label.appendChild(createPlanBadge(tier));
        const logout = document.createElement("button");
        logout.type = "button";
        logout.textContent = t("plans.accountLogout", "Log out");
        this.bindEventListener(logout, "click", async () => {
          logout.disabled = true;
          try {
            await this.runAuthAction("logout");
          } catch (error) {
            toastHelper("planLinkError", "info", { message: error.message });
            logout.disabled = false;
          }
        });
        row.append(label, logout);
        section.append(row, createDeleteAccountLink());
        return section;
      }

      const hint = document.createElement("p");
      hint.className = "plans-panel-note";
      if (!hasRemote()) {
        hint.textContent = t("plans.accountUnavailable", "Connect a repository to log in to an account.");
        section.appendChild(hint);
        return section;
      }
      if (!state.required) {
        hint.textContent = t("loginPanel.notRequired", "Accounts are not enabled on this server.");
        section.appendChild(hint);
        return section;
      }
      hint.textContent = t(
        "plans.accountHint",
        "Log in to use your account's plan on this device. A plan bought here is added to the account."
      );
      const form = document.createElement("form");
      form.className = "plans-account-form";
      const username = document.createElement("input");
      username.type = "text";
      username.autocomplete = "username";
      username.autocapitalize = "off";
      username.placeholder = t("uploadPanel.username", "Username");
      username.setAttribute("aria-label", username.placeholder);
      const password = document.createElement("input");
      password.type = "password";
      password.autocomplete = "current-password";
      password.placeholder = t("uploadPanel.password", "Password");
      password.setAttribute("aria-label", password.placeholder);
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.textContent = t("plans.accountLogin", "Log in");
      // Errors stay next to the form - a toast can end up behind the panel.
      const status = document.createElement("p");
      status.className = "plans-account-status";
      status.setAttribute("role", "alert");
      status.hidden = true;
      form.append(username, password, submit);
      this.bindEventListener(form, "submit", async (event) => {
        event.preventDefault();
        submit.disabled = true;
        status.hidden = true;
        try {
          await this.runAuthAction("login", { username: username.value.trim(), password: password.value });
          toastHelper("planLinked", "success");
        } catch (error) {
          status.textContent = t("toasts.planLinkError", { message: error.message }, "Could not log in: {message}");
          status.hidden = false;
          submit.disabled = false;
        }
      });
      section.append(hint, form, status, createDeleteAccountLink());
      return section;
    },

    async renderPlansPanel() {
      const body = this.plansPanel?.querySelector(".plans-panel-body");
      if (!body) return;
      const renderId = (this.plansRenderId ?? 0) + 1;
      this.plansRenderId = renderId;

      let offers = [];
      try {
        offers = await getPlanOffers();
      } catch (error) {
        console.warn("Plans: offers unavailable", error);
      }
      if (renderId !== this.plansRenderId) return;

      const tier = currentTier();
      body.textContent = "";

      PLAN_CARDS.forEach((plan) => {
        const offer = offers.find((entry) => entry.tier === plan.tier);
        const card = document.createElement("section");
        card.className = "plans-card";
        card.dataset.tier = plan.tier;
        if (plan.tier === tier) card.dataset.current = "true";
        if (plan.tier === this.plansHighlight) card.dataset.highlight = "true";

        const head = document.createElement("div");
        head.className = "plans-card-head";
        const name = document.createElement("strong");
        name.textContent = t(`plans.${plan.tier}`, plan.tier);
        if (plan.tier === "free") name.appendChild(createPlanLockIcon());
        head.appendChild(name);
        const price = document.createElement("span");
        price.className = "plans-card-price";
        if (plan.tier === "free") {
          price.textContent = t("plans.freePrice", "Free");
        } else {
          // The store's price is the one charged (localized); ours until it answers.
          const amount = offer?.priceString || defaultPrice(plan.tier);
          const suffix = t(plan.priceSuffix[0], plan.priceSuffix[1]);
          price.textContent = amount ? `${amount} · ${suffix}` : suffix;
        }
        head.appendChild(price);
        card.appendChild(head);

        const list = document.createElement("ul");
        plan.features.forEach(({ key, feature }) => {
          const item = document.createElement("li");
          item.textContent = t(key, { host: builtInRepositoryHost() });
          const locked = feature && (plan.tier === "free" ? !tierHasFeature("free", feature) : !hasFeature(feature));
          if (locked) {
            item.classList.add("plans-feature-locked");
            item.prepend(createPlanLockIcon());
          }
          list.appendChild(item);
        });
        card.appendChild(list);

        if (plan.tier === tier) {
          const badge = document.createElement("span");
          badge.className = "plans-card-current";
          badge.textContent = t("plans.current", "Your plan");
          card.appendChild(badge);
        } else if (plan.tier !== "free" && TIERS.indexOf(plan.tier) > TIERS.indexOf(tier)) {
          const buy = document.createElement("button");
          buy.type = "button";
          buy.className = "plans-card-buy";
          buy.textContent = plan.tier === "business" ? t("plans.subscribe", "Subscribe") : t("plans.buy", "Buy");
          buy.disabled = !offer;
          this.bindEventListener(buy, "click", async () => {
            buy.disabled = true;
            try {
              if (await buyPlan(offer)) toastHelper("planPurchased", "success");
            } catch (error) {
              console.warn("Plans: purchase failed", error);
              toastHelper("planPurchaseError", "info");
            } finally {
              buy.disabled = false;
            }
          });
          card.appendChild(buy);
        }
        body.appendChild(card);
      });

      if (!isStoreReady()) {
        const note = document.createElement("p");
        note.className = "plans-panel-note";
        note.textContent = t("plans.storeUnavailable", "The store is not available right now - buying is disabled.");
        body.appendChild(note);
      }

      const actions = document.createElement("div");
      actions.className = "plans-panel-actions";
      const restore = document.createElement("button");
      restore.type = "button";
      restore.textContent = t("plans.restore", "Restore purchases");
      restore.disabled = !isStoreReady();
      this.bindEventListener(restore, "click", async () => {
        restore.disabled = true;
        try {
          const restored = await restorePlans();
          toastHelper(restored === "free" ? "planRestoreNone" : "planRestored", "info");
        } catch {
          toastHelper("planPurchaseError", "info");
        } finally {
          restore.disabled = false;
        }
      });
      actions.appendChild(restore);

      body.appendChild(this.renderPlansAccount());

      if (canShowAdPrivacyOptions()) {
        const privacy = document.createElement("button");
        privacy.type = "button";
        privacy.textContent = t("plans.adPrivacy", "Ad privacy options");
        this.bindEventListener(privacy, "click", () => showAdPrivacyOptions());
        actions.appendChild(privacy);
      }
      body.appendChild(actions);

      // Testing builds (mobile.monetization.testing): try each plan without
      // buying it.
      if (isTestingBuild()) {
        const test = document.createElement("label");
        test.className = "plans-panel-test";
        test.textContent = t("plans.testOverride", "Test: force plan");
        const select = document.createElement("select");
        [["", t("plans.testStore", "from the store")], ...TIERS.map((value) => [value, t(`plans.${value}`, value)])]
          .forEach(([value, label]) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            select.appendChild(option);
          });
        select.value = getTierOverride() || "";
        this.bindEventListener(select, "change", () => setTierOverride(select.value || null));
        test.appendChild(select);
        body.appendChild(test);
      }
    },
  });
}
