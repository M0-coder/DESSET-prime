"use strict";
const menu = document.querySelector(".menu-button");
const nav = document.querySelector(".main-nav");
if (menu && nav) {
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "Cerrar navegación" : "Abrir navegación");
    nav.dataset.open = String(open);
  });
  nav.addEventListener("click", event => {
    if (event.target.closest("a")) {
      menu.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-label", "Abrir navegación");
      nav.dataset.open = "false";
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
      menu.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-label", "Abrir navegación");
      nav.dataset.open = "false";
      menu.focus();
    }
  });
}
