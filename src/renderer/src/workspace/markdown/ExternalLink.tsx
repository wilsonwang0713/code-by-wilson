import type { ReactNode } from "react";

function openExternal(href: string | undefined) {
  if (href) void window.api.openExternal(href);
}

/** A link that opens in the OS browser instead of navigating the renderer. Used for both real links and
 *  images: rendering `![](url)` as a link (not an <img>) means an untrusted image URL in assistant output
 *  never auto-fetches on render — no tracking-pixel / SSRF-from-renderer surface; it loads only when the
 *  user deliberately clicks, in their browser. */
export function ExternalLink({
  href,
  children,
}: {
  href: string | undefined;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      rel="noreferrer"
      onClick={(e) => {
        e.preventDefault();
        openExternal(href);
      }}
      className="text-primary-bright underline decoration-primary/40 underline-offset-2 hover:decoration-primary-bright"
    >
      {children}
    </a>
  );
}
