/**
 * The Lemon Squeezy store this build sells through — the pin the backend adapter enforces and the
 * checkout links the purchase buttons open. Store id 0 means "not wired yet": the app still runs
 * its trial, but activation reports not-configured instead of hitting LS with a pin that can never
 * match. Fill these from the LS dashboard (Settings → Stores for the store id; the product page URL
 * for the product id; each variant's Share → Copy link for the checkout URLs).
 *
 * Known so far (user-supplied): variant ids 1950488 (Annual $49.90/yr) and 1950513
 * (Monthly $4.99/mo); store id, product id, and the two buy links are still pending.
 */
export const LS_STORE_ID = 0;
export const LS_PRODUCT_ID = 0;

/** The hosted checkout links the Subscribe buttons open (LS hosts the whole purchase flow). */
export const CHECKOUT_URL_MONTHLY = "";
export const CHECKOUT_URL_YEARLY = "";

/** Whether this build can actually activate keys — false until the ids above are filled. */
export const LS_CONFIGURED = LS_STORE_ID > 0 && LS_PRODUCT_ID > 0;
