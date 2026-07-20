/* Applies the saved Aurora Glass theme to <html> BEFORE first paint, so a
 * light-mode user never sees a dark flash on load (and vice-versa). Static file
 * (not an inline component script) so no <script> lands in the React tree.
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
