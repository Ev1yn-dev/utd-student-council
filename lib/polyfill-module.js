// Replaces next/dist/build/polyfills/polyfill-module (next.config.ts turbopack.resolveAlias). Next.js targets
// Chrome/Edge/Firefox 111+ and Safari 16.4+, which all ship Array.prototype.at/flat/flatMap, Object.fromEntries,
// Object.hasOwn, String.prototype.trimStart/trimEnd, Symbol.prototype.description and Promise.prototype.finally.
// Only URL.canParse (Chrome 120 / Safari 17) is still missing in part of that range, so only it is kept.
if (typeof URL !== "undefined" && !("canParse" in URL)) {
  URL.canParse = function (url, base) {
    try {
      return !!new URL(url, base);
    } catch {
      return false;
    }
  };
}
