document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  const tabs = Array.from(document.querySelectorAll("[data-filter]"));
  const publications = Array.from(document.querySelectorAll("[data-publication]"));
  const panel = document.getElementById("publication-list");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const filter = tab.dataset.filter;
      tabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
      });

      publications.forEach((publication) => {
        publication.hidden = filter === "selected" && publication.dataset.selected !== "true";
      });

      panel.setAttribute("aria-labelledby", tab.id);
    });
  });

  const year = document.getElementById("current-year");
  if (year) year.textContent = String(new Date().getFullYear());
});
