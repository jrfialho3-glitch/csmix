// js/day-rollover.js
// Rollover automático: move mixes passados (>= 10 slots) para /history
// Roda a cada 60s e no boot, só se admin estiver logado.

import {
  isAuthReady, isLoggedIn, isAdmin, subscribe,
  isRolloverNeeded, runAutomaticRollover
} from "./identity.js";

async function maybeRollover() {
  if (!isAuthReady()) return;
  if (!isLoggedIn() || !isAdmin()) return;
  if (!isRolloverNeeded()) return;
  try {
    console.log("[day-rollover] executando rollover automático");
    await runAutomaticRollover();
  } catch (e) {
    console.error("[day-rollover] falhou:", e.message);
  }
}

// dispara no boot
maybeRollover();

// reage a mudanças globais (outro admin acabou de fazer)
subscribe(() => maybeRollover());

// re-checagem periódica (a cada 60s) — caso a página fique aberta na virada do dia
setInterval(maybeRollover, 60_000);