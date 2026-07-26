/**
 * The Lemon Squeezy store this build sells through — the pin the backend adapter enforces
 * (activation rejects keys from any other store/product). The hosted checkout links the purchase
 * buttons open live in @shared/license (the renderer needs them). Variants: 1950513 = Monthly
 * $4.99/mo, 1950488 = Annual $49.90/yr, activation limit 3.
 */
export const LS_STORE_ID = 418597;
export const LS_PRODUCT_ID = 1247708;

/** Whether this build can actually activate keys — a 0 id would mean "not wired yet". */
export const LS_CONFIGURED = LS_STORE_ID > 0 && LS_PRODUCT_ID > 0;
