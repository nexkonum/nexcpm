// NEXCPM — Yardımcı fonksiyonlar
export const $ = (s) => document.querySelector(s);
export const $$ = (s) => [...document.querySelectorAll(s)];

export function toast(msg, bad = false) {
  const root = $("#toast-root");
  if (!root) return;
  const x = document.createElement("div");
  x.className = "toast" + (bad ? " bad" : "");
  x.textContent = msg;
  root.appendChild(x);
  setTimeout(() => x.remove(), 3500);
}

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[m]));

export const avatar = (n) => (n || "?").slice(0, 1).toUpperCase();
export const syntheticEmail = (u) =>
  `${u.toLowerCase().replace(/[^a-z0-9_]/g, "_")}@users.nexcpm.local`;
export const wordCount = (s) => (s.trim().match(/\S+/g) || []).length;
export const fmtDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString("tr-TR") : "—";

export function firebaseMsg(e) {
  const c = e?.code || "";
  if (c.includes("email-already-in-use")) return "Bu kullanıcı adı zaten alınmış.";
  if (c.includes("invalid-credential")) return "Kullanıcı adı veya şifre yanlış.";
  if (c.includes("invalid-login-credentials")) return "Kullanıcı adı veya şifre yanlış.";
  if (c.includes("wrong-password")) return "Şifre yanlış.";
  if (c.includes("user-not-found")) return "Kullanıcı bulunamadı.";
  if (c.includes("weak-password")) return "Şifre en az 6 karakter olmalı.";
  if (c.includes("too-many-requests")) return "Çok fazla deneme. Biraz sonra tekrar dene.";
  if (c.includes("network-request-failed")) return "İnternet bağlantısı yok.";
  if (c.includes("permission-denied")) return "Yetkiniz yok.";
  return "Hata: " + (e?.message || "bilinmeyen");
}