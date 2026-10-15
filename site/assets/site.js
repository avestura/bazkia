// Tiny, dependency-free. Three jobs: theme toggle, searchable tool catalogue, latest-release links.
(function () {
  "use strict";

  // ---- theme: system -> light -> dark ----
  var root = document.documentElement;
  var btn = document.getElementById("theme");
  var order = ["system", "light", "dark"];
  function current() {
    var t = root.getAttribute("data-theme");
    return t === "light" || t === "dark" ? t : "system";
  }
  function label() {
    if (btn) btn.textContent = "Theme: " + current();
  }
  if (btn) {
    label();
    btn.addEventListener("click", function () {
      var next = order[(order.indexOf(current()) + 1) % order.length];
      if (next === "system") root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", next);
      try { localStorage.setItem("bazkia-site:theme", next); } catch (e) {}
      label();
    });
  }

  // ---- catalogue ----
  var host = document.getElementById("cats");
  var input = document.getElementById("q");
  var data = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function render(query) {
    if (!data || !host) return;
    var words = query.toLowerCase().split(/\s+/).filter(Boolean);
    host.textContent = "";
    var shown = 0;
    data.categories.forEach(function (cat) {
      var tools = cat.tools.filter(function (t) {
        var hay = (t.name + " " + t.description + " " + cat.name).toLowerCase();
        return words.every(function (w) { return hay.indexOf(w) !== -1; });
      });
      if (!tools.length) return;
      shown += tools.length;
      var d = el("details", "st-cat");
      if (words.length) d.open = true;
      var s = el("summary");
      s.appendChild(el("span", null, cat.name));
      s.appendChild(el("span", "st-cat__count", String(tools.length)));
      d.appendChild(s);
      var ul = el("ul", "st-tools");
      tools.forEach(function (t) {
        var li = el("li");
        li.appendChild(el("strong", null, t.name));
        li.appendChild(el("span", null, t.description));
        ul.appendChild(li);
      });
      d.appendChild(ul);
      host.appendChild(d);
    });
    if (!shown) host.appendChild(el("p", "st-empty", "Nothing matches “" + query + "”."));
  }

  if (host) {
    fetch("assets/tools.json")
      .then(function (r) { return r.json(); })
      .then(function (j) { data = j; render(""); })
      .catch(function () { host.appendChild(el("p", "st-empty", "Could not load the catalogue. The app lists every tool in its sidebar.")); });
  }
  if (input) input.addEventListener("input", function () { render(input.value); });

  // ---- copy buttons on code blocks (Boxy: [data-copy] holds the text, without comments) ----
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy]");
    if (!b || !navigator.clipboard) return;
    navigator.clipboard.writeText(b.getAttribute("data-copy")).then(function () {
      var was = b.textContent;
      b.textContent = "copied";
      setTimeout(function () { b.textContent = was; }, 1200);
    });
  });

  // ---- downloads: point the buttons at the newest release's assets ----
  var note = document.getElementById("dl-note");
  fetch("https://api.github.com/repos/avestura/bazkia/releases/latest", { headers: { Accept: "application/vnd.github+json" } })
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(function (rel) {
      var pick = {
        windows: /(-setup\.exe|\.msi)$/i,
        mac: /\.dmg$/i,
        linux: /\.(AppImage|deb)$/i,
      };
      Object.keys(pick).forEach(function (os) {
        var a = document.querySelector('[data-os="' + os + '"]');
        var asset = (rel.assets || []).filter(function (x) { return pick[os].test(x.name); })[0];
        if (a && asset) {
          a.href = asset.browser_download_url;
          a.setAttribute("data-ready", "true");
        }
      });
      if (note) note.textContent = "Latest: " + rel.tag_name + " · all releases on GitHub";
    })
    .catch(function () { /* no release yet: the buttons keep pointing at the releases page */ });
})();
