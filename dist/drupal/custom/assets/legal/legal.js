// Language switch of the legal pages: #en / #pl picks the article; without
// JS both languages are shown.
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  var links = document.querySelectorAll("nav.lang a");
  function show(lang) {
    if (lang !== "en" && lang !== "pl") lang = "en";
    document.querySelectorAll("article[lang]").forEach(function (a) {
      a.classList.toggle("active", a.lang === lang);
    });
    links.forEach(function (l) {
      l.setAttribute("aria-current", l.dataset.lang === lang ? "true" : "false");
    });
    root.lang = lang;
  }
  var initial = location.hash.slice(1).replace(/^.*-/, "") ||
    ((navigator.language || "").toLowerCase().indexOf("pl") === 0 ? "pl" : "en");
  show(initial);
  links.forEach(function (l) {
    l.addEventListener("click", function (event) {
      event.preventDefault();
      history.replaceState(null, "", "#" + l.dataset.lang);
      show(l.dataset.lang);
    });
  });
})();
