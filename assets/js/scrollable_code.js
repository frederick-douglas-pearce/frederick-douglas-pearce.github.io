// Make horizontally scrolling code blocks reachable by keyboard.
//
// A wide <pre> scrolls sideways, but it holds no focusable content and isn't
// focusable itself, so a keyboard-only user cannot reach anything past its
// right edge — the content is simply unavailable to them. axe reports this as
// scrollable-region-focusable.
//
// The block also gets role="group" and a label, so that tabbing into it
// announces what it is instead of dropping the user into unnamed content.
// Deliberately not role="region": that is a landmark, and a page with several
// code blocks then trips landmark-unique and clutters landmark navigation.
//
// Applied only to blocks that actually overflow — tabbing through every short
// snippet on a page would be its own annoyance.

(function () {
  var LANG_PATTERN = /(?:^|\s)language-([\w+#-]+)/;

  function describe(pre) {
    // Rouge wraps output as
    //   <div class="language-bash highlighter-rouge"><div class="highlight"><pre>
    // so the language lives on an ancestor, not on the <pre> itself.
    var el = pre;
    while (el && el !== document.body) {
      var match = LANG_PATTERN.exec(el.className || "");
      if (match) return match[1] + " code block";
      el = el.parentElement;
    }
    var code = pre.querySelector("code");
    if (code) {
      var codeMatch = LANG_PATTERN.exec(code.className || "");
      if (codeMatch) return codeMatch[1] + " code block";
    }
    return "Code block";
  }

  function update() {
    document.querySelectorAll("pre").forEach(function (pre) {
      // A 1px allowance keeps sub-pixel layout rounding from making a block
      // that visually fits look scrollable.
      var scrolls = pre.scrollWidth - pre.clientWidth > 1;

      if (scrolls) {
        if (!pre.hasAttribute("tabindex")) {
          pre.setAttribute("tabindex", "0");
          pre.setAttribute("role", "group");
          pre.setAttribute("aria-label", describe(pre));
          pre.dataset.scrollable = "true";
        }
      } else if (pre.dataset.scrollable === "true") {
        // The viewport widened and it no longer overflows — take it back out
        // of the tab order rather than leaving a dead stop behind.
        pre.removeAttribute("tabindex");
        pre.removeAttribute("role");
        pre.removeAttribute("aria-label");
        delete pre.dataset.scrollable;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", update);
  } else {
    update();
  }

  // Web fonts and syntax highlighting can both change how wide the content is
  // after first paint, and a resize changes whether it overflows at all.
  window.addEventListener("load", update);
  window.addEventListener("resize", update);
})();
