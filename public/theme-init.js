/* Applies the saved portal theme to <html> BEFORE first paint, so a light-mode
 * user never sees a dark flash on load (and vice-versa). Kept as a static file
 * rather than an inline script so no <script> lands in the React tree — React
 * warns about inline scripts in components and never runs them on client renders.
 * Dark is the default when nothing is stored or storage is unavailable. */
(function () {
  try {
    var t = localStorage.getItem('portal-theme');
    if (t !== 'light' && t !== 'dark') t = 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
