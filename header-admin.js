// js/header-admin.js
// Mostra/oculta o link "Admin" no header baseado no estado de auth + flag de admin.

import { isLoggedIn, isAdmin, isAuthReady, subscribe } from "./identity.js";

function updateAdminLink() {
  const link = document.getElementById("admin-link");
  if (!link) return;
  if (!isAuthReady()) return;
  link.hidden = !(isLoggedIn() && isAdmin());
}

subscribe(updateAdminLink);

function boot() {
  updateAdminLink();
  setTimeout(updateAdminLink, 500);
  setTimeout(updateAdminLink, 1500);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
