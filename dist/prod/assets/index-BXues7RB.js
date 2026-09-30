import { r as registerPlugin } from './index-oR55cej4.js';

var MaxAdContentRating;
(function (MaxAdContentRating) {
    /**
     * Content suitable for general audiences, including families.
     */
    MaxAdContentRating["General"] = "General";
    /**
     * Content suitable for most audiences with parental guidance.
     */
    MaxAdContentRating["ParentalGuidance"] = "ParentalGuidance";
    /**
     * Content suitable for teen and older audiences.
     */
    MaxAdContentRating["Teen"] = "Teen";
    /**
     * Content suitable only for mature audiences.
     */
    MaxAdContentRating["MatureAudience"] = "MatureAudience";
})(MaxAdContentRating || (MaxAdContentRating = {}));

// This enum should be keep in sync with their native equivalents with the same name
var BannerAdPluginEvents;
(function (BannerAdPluginEvents) {
    /**
     * Emits when the displayed banner size changes.
     */
    BannerAdPluginEvents["SizeChanged"] = "bannerAdSizeChanged";
    /**
     * Emits when a banner ad has loaded.
     */
    BannerAdPluginEvents["Loaded"] = "bannerAdLoaded";
    /**
     * Emits when a banner ad fails to load.
     */
    BannerAdPluginEvents["FailedToLoad"] = "bannerAdFailedToLoad";
    /**
     * Emits when a banner opens an overlay after the user taps it.
     */
    BannerAdPluginEvents["Opened"] = "bannerAdOpened";
    /**
     * Emits when the banner overlay is closed.
     */
    BannerAdPluginEvents["Closed"] = "bannerAdClosed";
    /**
     * Emits when an impression is recorded for the banner ad.
     */
    BannerAdPluginEvents["AdImpression"] = "bannerAdImpression";
    /**
     * Emits impression-level ad revenue data when a paid event is recorded.
     */
    BannerAdPluginEvents["AdPaid"] = "bannerAdPaid";
})(BannerAdPluginEvents || (BannerAdPluginEvents = {}));

/**
 * @see https://developer.android.com/reference/android/widget/LinearLayout#attr_android:gravity
 */
var BannerAdPosition;
(function (BannerAdPosition) {
    /**
     * Positions the banner at the top center of the screen.
     */
    BannerAdPosition["TOP_CENTER"] = "TOP_CENTER";
    /**
     * Positions the banner at the center of the screen.
     */
    BannerAdPosition["CENTER"] = "CENTER";
    /**
     * Positions the banner at the bottom center of the screen.
     */
    BannerAdPosition["BOTTOM_CENTER"] = "BOTTOM_CENTER";
})(BannerAdPosition || (BannerAdPosition = {}));

/**
 *  For more information:
 *  https://developers.google.com/admob/ios/banner#banner_sizes
 *  https://developers.google.com/android/reference/com/google/android/gms/ads/AdSize
 *
 * */
var BannerAdSize;
(function (BannerAdSize) {
    /**
     * Mobile Marketing Association (MMA)
     * banner ad size (320x50 density-independent pixels).
     */
    BannerAdSize["BANNER"] = "BANNER";
    /**
     * Interactive Advertising Bureau (IAB)
     * full banner ad size (468x60 density-independent pixels).
     */
    BannerAdSize["FULL_BANNER"] = "FULL_BANNER";
    /**
     * Large banner ad size (320x100 density-independent pixels).
     */
    BannerAdSize["LARGE_BANNER"] = "LARGE_BANNER";
    /**
     * Interactive Advertising Bureau (IAB)
     * medium rectangle ad size (300x250 density-independent pixels).
     */
    BannerAdSize["MEDIUM_RECTANGLE"] = "MEDIUM_RECTANGLE";
    /**
     * Interactive Advertising Bureau (IAB)
     * leaderboard ad size (728x90 density-independent pixels).
     */
    BannerAdSize["LEADERBOARD"] = "LEADERBOARD";
    /**
     * A dynamically sized banner that is full-width and auto-height.
     */
    BannerAdSize["ADAPTIVE_BANNER"] = "ADAPTIVE_BANNER";
    /**
     * A legacy smart banner sized to the screen width.
     * Retained for compatibility; use `ADAPTIVE_BANNER` for new integrations.
     *
     * @deprecated Use `ADAPTIVE_BANNER` instead.
     */
    BannerAdSize["SMART_BANNER"] = "SMART_BANNER";
})(BannerAdSize || (BannerAdSize = {}));

// This enum should be keep in sync with their native equivalents with the same name
var InterstitialAdPluginEvents;
(function (InterstitialAdPluginEvents) {
    /**
     * Emits when an interstitial ad has loaded and is ready to show.
     */
    InterstitialAdPluginEvents["Loaded"] = "interstitialAdLoaded";
    /**
     * Emits when an interstitial ad fails to load.
     */
    InterstitialAdPluginEvents["FailedToLoad"] = "interstitialAdFailedToLoad";
    /**
     * Emits when an interstitial ad is shown.
     */
    InterstitialAdPluginEvents["Showed"] = "interstitialAdShowed";
    /**
     * Emits when a loaded interstitial ad fails to show.
     */
    InterstitialAdPluginEvents["FailedToShow"] = "interstitialAdFailedToShow";
    /**
     * Emits when an interstitial ad is dismissed.
     */
    InterstitialAdPluginEvents["Dismissed"] = "interstitialAdDismissed";
    /**
     * Emits impression-level ad revenue data when a paid event is recorded.
     */
    InterstitialAdPluginEvents["AdImpression"] = "interstitialAdImpression";
})(InterstitialAdPluginEvents || (InterstitialAdPluginEvents = {}));

// This enum should be keep in sync with their native equivalents with the same name
var RewardInterstitialAdPluginEvents;
(function (RewardInterstitialAdPluginEvents) {
    /**
     * Emits when a rewarded interstitial ad has loaded and is ready to show.
     */
    RewardInterstitialAdPluginEvents["Loaded"] = "onRewardedInterstitialAdLoaded";
    /**
     * Emits when a rewarded interstitial ad fails to load.
     */
    RewardInterstitialAdPluginEvents["FailedToLoad"] = "onRewardedInterstitialAdFailedToLoad";
    /**
     * Emits when a rewarded interstitial ad is shown.
     */
    RewardInterstitialAdPluginEvents["Showed"] = "onRewardedInterstitialAdShowed";
    /**
     * Emits when a loaded rewarded interstitial ad fails to show.
     */
    RewardInterstitialAdPluginEvents["FailedToShow"] = "onRewardedInterstitialAdFailedToShow";
    /**
     * Emits when a rewarded interstitial ad is dismissed.
     *
     * This event does not indicate whether the user earned a reward. Listen for
     * `Rewarded` separately before granting the reward.
     */
    RewardInterstitialAdPluginEvents["Dismissed"] = "onRewardedInterstitialAdDismissed";
    /**
     * Emits when the user earns the advertised reward.
     */
    RewardInterstitialAdPluginEvents["Rewarded"] = "onRewardedInterstitialAdReward";
    /**
     * Emits impression-level ad revenue data when a paid event is recorded.
     */
    RewardInterstitialAdPluginEvents["AdImpression"] = "onRewardedInterstitialAdImpression";
})(RewardInterstitialAdPluginEvents || (RewardInterstitialAdPluginEvents = {}));

// This enum should be keep in sync with their native equivalents with the same name
var RewardAdPluginEvents;
(function (RewardAdPluginEvents) {
    /**
     * Emits when a rewarded ad has loaded and is ready to show.
     */
    RewardAdPluginEvents["Loaded"] = "onRewardedVideoAdLoaded";
    /**
     * Emits when a rewarded ad fails to load.
     */
    RewardAdPluginEvents["FailedToLoad"] = "onRewardedVideoAdFailedToLoad";
    /**
     * Emits when a rewarded ad is shown.
     */
    RewardAdPluginEvents["Showed"] = "onRewardedVideoAdShowed";
    /**
     * Emits when a loaded rewarded ad fails to show.
     */
    RewardAdPluginEvents["FailedToShow"] = "onRewardedVideoAdFailedToShow";
    /**
     * Emits when a rewarded ad is dismissed.
     *
     * This event does not indicate whether the user earned a reward. Listen for
     * `Rewarded` separately before granting the reward.
     */
    RewardAdPluginEvents["Dismissed"] = "onRewardedVideoAdDismissed";
    /**
     * Emits when the user earns the advertised reward.
     */
    RewardAdPluginEvents["Rewarded"] = "onRewardedVideoAdReward";
    /**
     * Emits impression-level ad revenue data when a paid event is recorded.
     */
    RewardAdPluginEvents["AdImpression"] = "onRewardedVideoAdImpression";
})(RewardAdPluginEvents || (RewardAdPluginEvents = {}));

/**
 *  For more information:
 *  https://developers.google.com/admob/unity/reference/namespace/google-mobile-ads/ump/api#consentstatus
 *
 * */
var AdmobConsentStatus;
(function (AdmobConsentStatus) {
    /**
     * User consent not required.
     */
    AdmobConsentStatus["NOT_REQUIRED"] = "NOT_REQUIRED";
    /**
     * User consent already obtained.
     */
    AdmobConsentStatus["OBTAINED"] = "OBTAINED";
    /**
     * User consent required but not yet obtained.
     */
    AdmobConsentStatus["REQUIRED"] = "REQUIRED";
    /**
     * Unknown consent status, AdsConsent.requestInfoUpdate needs to be called to update it.
     */
    AdmobConsentStatus["UNKNOWN"] = "UNKNOWN";
})(AdmobConsentStatus || (AdmobConsentStatus = {}));

/**
 *  For more information:
 *  https://developers.google.com/admob/unity/reference/namespace/google-mobile-ads/ump/api#debuggeography
 *
 * */
var AdmobConsentDebugGeography;
(function (AdmobConsentDebugGeography) {
    /**
     * Debug geography disabled.
     */
    AdmobConsentDebugGeography[AdmobConsentDebugGeography["DISABLED"] = 0] = "DISABLED";
    /**
     * Geography appears as in EEA for debug devices.
     */
    AdmobConsentDebugGeography[AdmobConsentDebugGeography["EEA"] = 1] = "EEA";
    /**
     * Geography appears as not in EEA for debug devices.
     * @deprecated
     */
    AdmobConsentDebugGeography[AdmobConsentDebugGeography["NOT_EEA"] = 2] = "NOT_EEA";
    /**
     * Geography appears as in regulated US state for debug devices.
     */
    AdmobConsentDebugGeography[AdmobConsentDebugGeography["US"] = 3] = "US";
    /**
     * Geography appears as OTHER state for debug devices.
     */
    AdmobConsentDebugGeography[AdmobConsentDebugGeography["OTHER"] = 4] = "OTHER";
})(AdmobConsentDebugGeography || (AdmobConsentDebugGeography = {}));

/**
 * The precision of an impression-level ad value.
 */
var AdValuePrecision;
(function (AdValuePrecision) {
    /**
     * The ad value precision is unknown.
     */
    AdValuePrecision[AdValuePrecision["Unknown"] = 0] = "Unknown";
    /**
     * The ad value is estimated from aggregated data.
     */
    AdValuePrecision[AdValuePrecision["Estimated"] = 1] = "Estimated";
    /**
     * The ad value was provided by the publisher.
     */
    AdValuePrecision[AdValuePrecision["PublisherProvided"] = 2] = "PublisherProvided";
    /**
     * The ad value is the precise value paid for this ad.
     */
    AdValuePrecision[AdValuePrecision["Precise"] = 3] = "Precise";
})(AdValuePrecision || (AdValuePrecision = {}));

var AppOpenAdPluginEvents;
(function (AppOpenAdPluginEvents) {
    /**
     * Emits when an App Open ad has loaded.
     */
    AppOpenAdPluginEvents["Loaded"] = "appOpenAdLoaded";
    /**
     * Emits when an App Open ad fails to load.
     */
    AppOpenAdPluginEvents["FailedToLoad"] = "appOpenAdFailedToLoad";
    /**
     * Emits when an App Open ad is shown.
     */
    AppOpenAdPluginEvents["Opened"] = "appOpenAdOpened";
    /**
     * Emits when an App Open ad is dismissed.
     */
    AppOpenAdPluginEvents["Closed"] = "appOpenAdClosed";
    /**
     * Emits when a loaded App Open ad fails to show.
     */
    AppOpenAdPluginEvents["FailedToShow"] = "appOpenAdFailedToShow";
    /**
     * Emits impression-level ad revenue data when a paid event is recorded.
     */
    AppOpenAdPluginEvents["AdImpression"] = "appOpenAdImpression";
})(AppOpenAdPluginEvents || (AppOpenAdPluginEvents = {}));

const AdMob = registerPlugin('AdMob', {
    web: () => import('./web-B3c86vlk.js').then((m) => new m.AdMobWeb()),
});

export { AdMob, AdValuePrecision, AdmobConsentDebugGeography, AdmobConsentStatus, AppOpenAdPluginEvents, BannerAdPluginEvents, BannerAdPosition, BannerAdSize, InterstitialAdPluginEvents, MaxAdContentRating, RewardAdPluginEvents, RewardInterstitialAdPluginEvents };
//# sourceMappingURL=index-CGbUweR4.js.map
