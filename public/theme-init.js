// Sets the theme before the first paint, so a dark interface never flashes light. The same key
// and the same rule as the ThemeProvider, which takes over once the app is running.
//
// A file of its own, not an inline script: the page is served with a Content-Security-Policy
// that allows scripts from its own origin only, and an inline script would be refused.
(function () {
  try {
    var stored = localStorage.getItem('craftstock-theme');
    var dark =
      stored === 'dark' ||
      (stored !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch {
    // Storage is unavailable (a private window, blocked site data): the system's theme stands.
  }
})();
