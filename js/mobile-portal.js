(function () {
  "use strict";

  const views = [...document.querySelectorAll("[data-portal-view]")];
  const tabs = [...document.querySelectorAll("[data-view-target]")];
  const toast = document.getElementById("portalToast");
  const time = document.getElementById("portalTime");
  let toastTimer;

  function setTime() {
    const now = new Date();
    time.textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  function setView(viewName) {
    const nextView = viewName === "apps" ? "apps" : "workbench";
    views.forEach(view => { view.hidden = view.dataset.portalView !== nextView; });
    tabs.forEach(tab => {
      const active = tab.dataset.viewTarget === nextView;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-current", active ? "page" : "false");
    });
    document.title = nextView === "apps" ? "应用中心 - 智慧监理" : "智慧监理 - 移动工作台";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function routeFromHash() {
    setView(location.hash.replace("#", ""));
  }

  function showPlaceholder() {
    clearTimeout(toastTimer);
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 1800);
  }

  tabs.forEach(tab => tab.addEventListener("click", () => {
    const target = tab.dataset.viewTarget;
    if (target) location.hash = target;
  }));
  document.querySelectorAll("[data-placeholder]").forEach(button => button.addEventListener("click", showPlaceholder));
  window.addEventListener("hashchange", routeFromHash);
  setTime();
  routeFromHash();
})();
