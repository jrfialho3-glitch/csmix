// js/utils.js
// Helpers de data, status e formatação.

export const DAYS = [
  { id: 1, short: "SEG", long: "Segunda" },
  { id: 2, short: "TER", long: "Terça" },
  { id: 3, short: "QUA", long: "Quarta" },
  { id: 4, short: "QUI", long: "Quinta" },
  { id: 5, short: "SEX", long: "Sexta" },
  { id: 6, short: "SÁB", long: "Sábado" },
  { id: 0, short: "DOM", long: "Domingo" },
];

// Converte dia JS (0=Dom, 6=Sáb) para índice Seg=0..Dom=6
export function dayIndexMondayFirst(jsDay) {
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDateBR(dateKey) {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}`;
}

export function todayKey() {
  return formatDateKey(new Date());
}

// Gera as próximas 10 datas a partir de hoje
export function getNext10Days() {
  const days = [];
  const today = new Date();

  for (let i = 0; i < 10; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const jsDay = d.getDay();
    const dayInfo = DAYS.find(x => x.id === jsDay);

    days.push({
      key: formatDateKey(d),
      dayName: dayInfo.short,
      dayLong: dayInfo.long,
      dateBR: formatDateBR(formatDateKey(d)),
      isToday: i === 0
    });
  }

  return days;
}

// Status baseado em quantos slots preenchidos (sem contar complete)
export function getStatus(count) {
  if (count >= 10) {
    return { id: "closed", color: "#ef4444", label: "LOTADO" };
  }
  if (count >= 5) {
    return { id: "ready", color: "#eab308", label: "QUASE LÁ" };
  }
  return { id: "open", color: "#22c55e", label: "VAGAS" };
}

// Sanitização de nick (Firebase proíbe alguns chars)
const FORBIDDEN = /[.#$\/\[\]]/g;

export function sanitizeNick(raw) {
  if (!raw) return "";
  return raw
    .toString()
    .trim()
    .replace(FORBIDDEN, "_")
    .slice(0, 24);
}

export function isValidNick(raw) {
  const s = sanitizeNick(raw);
  return s.length >= 2 && s.length <= 24;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
