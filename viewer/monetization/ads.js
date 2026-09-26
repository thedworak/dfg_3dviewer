import { currentTier, hasFeature, isPlansEnabled, monetizationSettings, onTierChange } from "./plan.js";

// Free plan ads (AdMob, @capacitor-community/admob): a banner along the bottom
// and a full-screen ad after every Nth model loaded, at most once per
// interval, never for the model the app opens with. The page gives the
// banner its height (--app-ad-banner-height on body, see main.css), so the
// toolbar sits above it instead of under it.
//
// Consent first (Google UMP): in the EEA and UK the form is shown before any
// ad is requested, and no ads are requested without it. Its privacy options
// stay reachable from the plans panel (showAdPrivacyOptions).

let admob = null;
let started = false;
let bannerShown = false;
let consentInfo = null;
let modelsLoaded = 0;
let lastInterstitialAt = 0;
let interstitialReady = false;

function adsSettings() {
  return monetizationSettings()?.admob || {};
}

function wantsAds() {
  return isPlansEnabled() && !hasFeature("noAds") && window.Capacitor?.isNativePlatform?.() === true;
}

function setBannerHeight(px) {
  document.body?.style.setProperty("--app-ad-banner-height", `${Math.max(0, Math.round(px || 0))}px`);
}

async function loadPlugin() {
  if (admob) return admob;
  const module = await import("@capacitor-community/admob");
  admob = module;
  return admob;
}

async function requestConsent() {
  const { AdMob, AdmobConsentStatus } = admob;
  consentInfo = await AdMob.requestConsentInfo();
  if (consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
    consentInfo = await AdMob.showConsentForm();
  }
  return consentInfo.canRequestAds !== false;
}

async function showBanner() {
  if (bannerShown || !wantsAds()) return;
  const { AdMob, BannerAdPosition, BannerAdSize, BannerAdPluginEvents } = admob;
  await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => setBannerHeight(size?.height));
  await AdMob.showBanner({
    adId: adsSettings().bannerId,
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    isTesting: monetizationSettings()?.testing === true,
  });
  bannerShown = true;
}

async function removeBanner() {
  if (!bannerShown || !admob) return;
  bannerShown = false;
  setBannerHeight(0);
  await admob.AdMob.removeBanner().catch(() => {});
}

async function prepareInterstitial() {
  if (interstitialReady || !wantsAds() || !adsSettings().interstitialId) return;
  try {
    await admob.AdMob.prepareInterstitial({
      adId: adsSettings().interstitialId,
      isTesting: monetizationSettings()?.testing === true,
    });
    interstitialReady = true;
  } catch {
    // No fill or no network: tried again after the next model.
  }
}

async function start() {
  if (started || !wantsAds()) return;
  started = true;
  try {
    await loadPlugin();
    await admob.AdMob.initialize({ initializeForTesting: monetizationSettings()?.testing === true });
    if (!(await requestConsent())) return;
    await showBanner();
    prepareInterstitial();
  } catch (error) {
    // Ads never stop the viewer.
    console.warn("Ads unavailable", error);
    started = false;
  }
}

export function initAds() {
  if (!isPlansEnabled()) return;
  onTierChange(() => {
    if (wantsAds()) {
      if (started) showBanner().catch(() => {});
      else if (modelsLoaded > 0) start();
    } else {
      removeBanner();
    }
  });
}

// Called after each model finishes loading (loaders.js). The first one
// starts the ads - after the splash, over a viewer that shows something.
export function onModelLoadedForAds() {
  if (!wantsAds()) return;
  modelsLoaded += 1;
  if (!started) {
    start();
    return;
  }
  const every = Math.max(1, Number(adsSettings().interstitialEvery) || 3);
  const minIntervalMs = Math.max(0, Number(adsSettings().interstitialMinIntervalSec) || 0) * 1000;
  const due = modelsLoaded > 1 && (modelsLoaded - 1) % every === 0;
  if (!due || !interstitialReady || Date.now() - lastInterstitialAt < minIntervalMs) {
    prepareInterstitial();
    return;
  }
  interstitialReady = false;
  lastInterstitialAt = Date.now();
  admob.AdMob.showInterstitial()
    .catch(() => {})
    .finally(() => prepareInterstitial());
}

// The "privacy options" entry the consent rules require (plans panel).
export function canShowAdPrivacyOptions() {
  return Boolean(admob && consentInfo && consentInfo.privacyOptionsRequirementStatus === "REQUIRED" && currentTier() === "free");
}

export async function showAdPrivacyOptions() {
  if (!admob) return;
  await admob.AdMob.showPrivacyOptionsForm().catch(() => {});
}
