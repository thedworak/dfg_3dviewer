import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { toastHelper } from "../viewer-utils.js";
import { makePanelWindow } from "./panel-window.js";
import {
  LOCKED_TOOLS,
  TIERS,
  buyPlan,
  currentTier,
  getPlanOffers,
  getTierOverride,
  hasFeature,
  isPlansEnabled,
  isStoreReady,
  isTestingBuild,
  onTierChange,
  restorePlans,
  setTierOverride,
} from "../monetization/plan.js";
import { canShowAdPrivacyOptions, showAdPrivacyOptions } from "../monetization/ads.js";

// The app's plans panel (monetization/plan.js): the three plans with store
// prices, buying, restoring purchases and the ads' privacy options. Opened
// from the header's plan button and from tools the plan does not include.
export function attachPlansPanel(Viewer) {
  Object.assign(Viewer, {
    initPlansUi() {
      if (!isPlansEnabled()) return;
      this.createPlanButton();
      this.applyPlanLocks();
      onTierChange(() => {
        this.applyPlanLocks();
        this.updateRepositoryFormVisibility?.();
        if (this.plansPanel?.hidden === false) this.renderPlansPanel();
      });

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

      const plans = [
        { tier: "free", features: ["plans.freeFeature1"], price: t("plans.freePrice", "Free") },
        { tier: "pro", features: ["plans.proFeature1", "plans.proFeature2"], priceSuffix: t("plans.oneTime", "one-time") },
        {
          tier: "business",
          features: ["plans.businessFeature1", "plans.businessFeature2", "plans.businessFeature3", "plans.businessFeature4"],
          priceSuffix: t("plans.perMonth", "per month"),
        },
      ];

      plans.forEach((plan) => {
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
        head.appendChild(name);
        const price = document.createElement("span");
        price.className = "plans-card-price";
        price.textContent = plan.price || (offer?.priceString ? `${offer.priceString} · ${plan.priceSuffix}` : plan.priceSuffix);
        head.appendChild(price);
        card.appendChild(head);

        const list = document.createElement("ul");
        plan.features.forEach((key) => {
          const item = document.createElement("li");
          item.textContent = t(key);
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
