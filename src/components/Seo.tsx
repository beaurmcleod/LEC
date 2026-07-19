import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Route-aware SEO manager for this single-page app.
 *
 * Because every route is served the same static index.html shell, crawlers see
 * many URLs with identical pre-render markup. Without an explicit, self-referencing
 * canonical on each route, Google clusters them and picks its own canonical —
 * the "Duplicate, Google chose different canonical than user" report in Search Console.
 *
 * This component runs on every navigation and:
 *   - writes a self-referencing <link rel="canonical"> for the current path
 *   - keeps <meta property="og:url"> in sync with that canonical
 *   - adds <meta name="robots" content="noindex, follow"> on utility / transactional
 *     / redirect / 404 routes that should never be indexed
 *
 * It updates the existing tags from index.html in place (rather than appending),
 * so there is always exactly one canonical / og:url tag.
 */

const SITE_ORIGIN = "https://lowendcandy.com";

// Public, content-bearing routes that should be indexed.
const INDEXABLE_EXACT = new Set<string>([
  "/",
  "/shop",
  "/free",
  "/racks",
  "/links",
  "/lessons",
  "/free-consultation",
  "/candy-club",
  "/ask",
  "/bio",
  "/local-lessons",
  "/dj",
  "/collective",
  "/blog",
  "/crux-chords",
  "/crux-chords/api-guide",
  "/crux-chords/download",
  "/preverb",
  "/terms",
  "/privacy",
  "/license",
  "/cookies",
  "/tiktok",
  "/ig",
]);

// Dynamic route families that are indexable (e.g. /product/:id, /blog/:slug).
const INDEXABLE_PREFIXES = ["/product/", "/blog/"];

// Utility / transactional / private / redirect routes that must not be indexed.
const NOINDEX_EXACT = new Set<string>([
  "/cart",
  "/checkout",
  "/enter-email",
  "/payment-success",
  "/payment-canceled",
  "/auth",
  "/reset-password",
  "/my-purchases",
  "/download",
  "/cancel-lesson",
  "/collective/join",
  "/collective/success",
  "/skool",
  "/admin/setup",
  "/admin/dashboard",
]);

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function isIndexable(path: string): boolean {
  if (NOINDEX_EXACT.has(path)) return false;
  if (INDEXABLE_EXACT.has(path)) return true;
  if (INDEXABLE_PREFIXES.some((prefix) => path.startsWith(prefix) && path.length > prefix.length)) {
    return true;
  }
  // Unknown path -> served by the catch-all 404 route -> should not be indexed.
  return false;
}

function upsertCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertOgUrl(content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]');
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", "og:url");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setRobots(noindex: boolean): void {
  let el = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (noindex) {
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", "robots");
      document.head.appendChild(el);
    }
    el.setAttribute("content", "noindex, follow");
  } else if (el) {
    el.parentNode?.removeChild(el);
  }
}

export function Seo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const path = normalizePath(pathname);
    const canonical = path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;

    upsertCanonical(canonical);
    upsertOgUrl(canonical);
    setRobots(!isIndexable(path));
  }, [pathname]);

  return null;
}

export default Seo;
