// Filetree folder collapse/expand — project override of the Hextra theme script.
// ======================================================================
// Structure-tolerant version: locates the child <ul> via the enclosing <li>
// instead of `folder.nextElementSibling`, so it keeps working whether the
// folder name lives inside the toggle button (no link) or in a separate
// <a> sibling (when the folder has a `link`).
document.addEventListener("DOMContentLoaded", function () {
  const folders = document.querySelectorAll(".hextra-filetree-folder");
  folders.forEach(function (folder) {
    folder.addEventListener("click", function () {
      // Flip the two folder icons (only the icon spans carry data-state).
      Array.from(folder.children).forEach(function (el) {
        if (el.dataset.state) {
          el.dataset.state = el.dataset.state === "open" ? "closed" : "open";
        }
      });
      // Toggle the direct child <ul> of the enclosing <li>.
      const li = folder.closest("li");
      const ul = li && li.querySelector(":scope > ul");
      if (!ul) return;
      const newState = ul.dataset.state === "open" ? "closed" : "open";
      ul.dataset.state = newState;
      folder.setAttribute("aria-expanded", newState === "open" ? "true" : "false");
    });
  });
});
