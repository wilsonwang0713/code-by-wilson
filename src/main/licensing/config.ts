/**
 * The Lemon Squeezy store this build sells through — the pin the backend adapter enforces
 * (activation rejects keys from any other store/product). The hosted checkout links the purchase
 * buttons open live in @shared/license (the renderer needs them).
 *
 * Two accepted products because Lemon Squeezy keeps SEPARATE catalogs per mode: 1247708 is the
 * live product (variants: 1950513 Monthly $4.99/mo, 1950488 Annual $49.90/yr, activation limit 1)
 * and 1248877 is its test-mode twin, kept in the allowlist so end-to-end purchase rehearsals
 * (test card → emailed key → activate) run against the packaged app. Exposure is acceptable:
 * test-mode keys can only be minted by the store owner in the store's own test checkout.
 */
export const LS_STORE_ID = 418597;
export const LS_PRODUCT_IDS = [1247708, 1248877];

/** Whether this build can actually activate keys — empty ids would mean "not wired yet". */
export const LS_CONFIGURED = LS_STORE_ID > 0 && LS_PRODUCT_IDS.length > 0;
