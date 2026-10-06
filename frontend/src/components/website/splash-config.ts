export const SPLASH_STORAGE_KEY = "ums:splash-seen";

/**
 * Runs before React hydrates. The splash is part of the server HTML, so without
 * this it would flash for returning visitors. It is skipped when the visitor
 * already saw it this browser session, or did not land on the homepage (a deep
 * link should not be delayed). Rendered from the server layout: React ignores
 * <script> tags inside client components.
 */
export const SPLASH_SKIP_SCRIPT = `try{if(sessionStorage.getItem(${JSON.stringify(SPLASH_STORAGE_KEY)})||location.pathname!=="/"){document.documentElement.setAttribute("data-splash-skip","")}}catch(e){}`;
