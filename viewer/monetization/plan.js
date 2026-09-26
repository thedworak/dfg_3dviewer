import { core } from "../core.js";

// The app's plans: free (ads), pro (one-time purchase, no ads) and business
// (monthly subscription: no ads, higher limits on the repository, a custom
// repository address and the editor/export tools below). Purchases go
// through Google Play, verified by RevenueCat
// (@revenuecat/purchases-capacitor); an entitlement per paid plan decides.
//
// Web builds have no plans: hasFeature() is always true there, so nothing
// outside the app is gated or changes.
//
// Settings: viewer-settings.json mobile.monetization, written by
// rollup.config.js from MOBILE_* environment variables - see
// docs/mobile-monetization.md.

export const TIERS = ["free", "pro", "business"];

// Which plans unlock what. Changing a plan's features is an edit here.
const FEATURES = {
  noAds: ["pro", "business"],
  // The repository address field in the models panel; free/pro use the
  // one the app was built with.
  customRepository: ["business"],
  // Sends the RevenueCat app user id with uploads; the worker then applies
  // WORKER_LIMIT_BUSINESS_* (see worker/entitlements.py).
  serverBusinessLimits: ["business"],
  annotations: ["business"],
  materialsEditor: ["business"],
};

// Toolbar tools (editor-toolbar.js data-tool keys) and the feature each
// needs; a locked tool opens the plans panel instead (see locks.js).
// "annotate" covers its submenu: annotation and IIIF import/export.
export const LOCKED_TOOLS = {
  annotate: "annotations",
  materials: "materialsEditor",
};

const TIER_KEY = "dfg3dviewer-plan";
// Testing builds only: forces a plan without buying it (plans panel).
const OVERRIDE_KEY = "dfg3dviewer-plan-override";

const listeners = new Set();
let tier = "free";
let purchases = null; // the RevenueCat plugin once configured
let appUserId = "";

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // The plan is only kept for this session.
  }
}

export function monetizationSettings() {
  return core.CONFIG?.mobile?.monetization || null;
}

export function isPlansEnabled() {
  return Boolean(core.CONFIG?.mobile && monetizationSettings());
}

export function isTestingBuild() {
  return monetizationSettings()?.testing === true;
}

export function currentTier() {
  return isPlansEnabled() ? tier : "business";
}

export function hasFeature(feature) {
  if (!isPlansEnabled()) return true;
  return (FEATURES[feature] || []).includes(tier);
}

export function getAppUserId() {
  return appUserId;
}

// Calls listener(tier) on every change; returns a function that unsubscribes.
export function onTierChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setTier(next) {
  const value = TIERS.includes(next) ? next : "free";
  // Remembered so the app starts on the last known plan offline, before
  // RevenueCat answers.
  writeStorage(TIER_KEY, value);
  if (value === tier) return;
  tier = value;
  document.body?.setAttribute("data-app-plan", tier);
  listeners.forEach((listener) => listener(tier));
}

function tierFromCustomerInfo(customerInfo) {
  const active = customerInfo?.entitlements?.active || {};
  const ids = monetizationSettings()?.revenuecat?.entitlements || {};
  if (active[ids.business || "business"]) return "business";
  if (active[ids.pro || "pro"]) return "pro";
  return "free";
}

function applyCustomerInfo(customerInfo) {
  if (isTestingBuild() && readStorage(OVERRIDE_KEY)) return;
  setTier(tierFromCustomerInfo(customerInfo));
}

export async function initPlan() {
  if (!isPlansEnabled()) return;
  tier = TIERS.includes(readStorage(TIER_KEY)) ? readStorage(TIER_KEY) : "free";
  const override = isTestingBuild() ? readStorage(OVERRIDE_KEY) : null;
  if (TIERS.includes(override)) tier = override;
  document.body?.setAttribute("data-app-plan", tier);

  const apiKey = monetizationSettings()?.revenuecat?.apiKey;
  if (!apiKey || window.Capacitor?.isNativePlatform?.() !== true) return;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.configure({ apiKey });
    purchases = Purchases;
    appUserId = (await Purchases.getAppUserID()).appUserID || "";
    await Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
    applyCustomerInfo((await Purchases.getCustomerInfo()).customerInfo);
  } catch (error) {
    // No network or no store: the app keeps the last known plan.
    console.warn("Plans: store unavailable", error);
  }
}

export function isStoreReady() {
  return purchases !== null;
}

// [{ tier, priceString, title, package }] for the paid plans the store
// offers, matched by product id (settings) or package type.
export async function getPlanOffers() {
  if (!purchases) return [];
  const settings = monetizationSettings()?.revenuecat || {};
  const offerings = await purchases.getOfferings();
  const offering = offerings?.all?.[settings.offering] || offerings?.current;
  const products = settings.products || {};
  const offers = [];
  (offering?.availablePackages || []).forEach((pkg) => {
    const productId = pkg.product?.identifier || "";
    let offerTier = null;
    if (productId === products.pro || pkg.packageType === "LIFETIME") offerTier = "pro";
    else if (productId === products.business || pkg.packageType === "MONTHLY") offerTier = "business";
    if (offerTier && !offers.some((offer) => offer.tier === offerTier)) {
      offers.push({ tier: offerTier, priceString: pkg.product?.priceString || "", title: pkg.product?.title || "", package: pkg });
    }
  });
  return offers;
}

// Resolves to true when bought, false when the user cancelled; throws on
// store errors.
export async function buyPlan(offer) {
  if (!purchases || !offer?.package) throw new Error("Store unavailable");
  try {
    const result = await purchases.purchasePackage({ aPackage: offer.package });
    applyCustomerInfo(result.customerInfo);
    return true;
  } catch (error) {
    if (error?.userCancelled) return false;
    throw error;
  }
}

export async function restorePlans() {
  if (!purchases) throw new Error("Store unavailable");
  const { customerInfo } = await purchases.restorePurchases();
  applyCustomerInfo(customerInfo);
  return currentTier();
}

// Testing builds: pick a plan without the store (null = back to the store's).
export function setTierOverride(value) {
  if (!isTestingBuild()) return;
  writeStorage(OVERRIDE_KEY, TIERS.includes(value) ? value : null);
  if (TIERS.includes(value)) {
    setTier(value);
  } else if (purchases) {
    purchases.getCustomerInfo().then(({ customerInfo }) => applyCustomerInfo(customerInfo)).catch(() => {});
  } else {
    setTier("free");
  }
}

export function getTierOverride() {
  return isTestingBuild() ? readStorage(OVERRIDE_KEY) : null;
}
