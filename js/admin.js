// NEXCPM — Admin paneli
import { ref, onValue, update, remove } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { db } from "./firebase.js";
import { $, esc, toast, firebaseMsg } from "./utils.js";
import { authState } from "./auth.js";
import { listingState } from "./listing.js";

// Admin kontrolü - authState.isAdmin auth.js'ten geliyor
export function checkAdmin() {
  // auth.js'te zaten ayarlandı
  return authState.isAdmin;
}

export function subscribeAdmin() {
  if (!authState.isAdmin) {
    console.log("Admin değil, panel gizleniyor");
    return;
  }

  console.log("Admin paneli yükleniyor...");

  // İstatistikler
  onValue(ref(db, "presence"), (s) => {
    const el = $("#adminStats");
    if (!el) return;
    el.innerHTML = `
      <div class="stat-card"><b>${s.exists() ? Object.keys(s.val()).length : 0}</b><span>Aktif Kullanıcı</span></div>
      <div class="stat-card"><b>${Object.keys(listingState.listings).length}</b><span>Toplam İlan</span></div>
      <div class="stat-card"><b>${Object.values(listingState.listings).filter(x => x.sold).length}</b><span>Satılan</span></div>
      <div class="stat-card"><b>${new Set(Object.values(listingState.listings).map(x => x.uid)).size}</b><span>İlan Sahibi</span></div>`;
  });

  // Raporlar
  onValue(ref(db, "reports"), (snap) => {
    const el = $("#reportList");
    if (!el) return;

    const reports = [];
    snap.forEach((c) => reports.push({ id: c.key, ...c.val() }));
    reports.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    el.innerHTML = reports.map((r) => {
      const l = listingState.listings[r.listingId];
      return `<div class="report-item">
        <div>
          <b>${esc(l ? l.title : "Silinmiş ilan")}</b>
          <p>${esc(r.reason)}</p>
        </div>
        <div class="report-actions">
          ${l ? `<button data-del-listing="${r.listingId}">İlanı Sil</button>` : ""}
          <button data-del-report="${r.id}">Raporu Sil</button>
        </div>
      </div>`;
    }).join("") || `<div class="empty"><h3>Rapor yok</h3></div>`;

    document.querySelectorAll("[data-del-listing]").forEach((b) => (b.onclick = async () => {
      try { 
        await remove(ref(db, `listings/${b.dataset.delListing}`)); 
        toast("İlan silindi."); 
      } catch (e) { toast(firebaseMsg(e), true); }
    }));

    document.querySelectorAll("[data-del-report]").forEach((b) => (b.onclick = async () => {
      try { 
        await remove(ref(db, `reports/${b.dataset.delReport}`)); 
        toast("Rapor silindi."); 
      } catch (e) { toast(firebaseMsg(e), true); }
    }));
  });

  // Kullanıcılar - admin atama/ban
  onValue(ref(db, "users"), (snap) => {
    const el = $("#userList");
    if (!el) return;

    const users = [];
    snap.forEach((c) => users.push({ id: c.key, ...c.val() }));

    el.innerHTML = users.map((u) => `
      <div class="report-item">
        <div>
          <b>${esc(u.username)}</b>
          <p>${u.isAdmin ? "👑 Admin" : "Kullanıcı"} ${u.banned ? "· 🚫 Banlı" : ""}</p>
        </div>
        <div class="report-actions">
          <button data-toggle-admin="${u.id}" data-is-admin="${u.isAdmin ? 1 : 0}">
            ${u.isAdmin ? "Adminlik Al" : "Admin Yap"}
          </button>
          <button class="${u.banned ? "" : "danger"}" data-ban="${u.id}" data-banned="${u.banned ? 1 : 0}">
            ${u.banned ? "Banı Kaldır" : "Banla"}
          </button>
        </div>
      </div>`).join("");

    // Admin toggle
    document.querySelectorAll("[data-toggle-admin]").forEach((b) => (b.onclick = async () => {
      try {
        const newAdminState = b.dataset.isAdmin !== "1";
        await update(ref(db, `users/${b.dataset.toggleAdmin}`), { isAdmin: newAdminState });
        toast(newAdminState ? "Admin atandı." : "Adminlik alındı.");
      } catch (e) { toast(firebaseMsg(e), true); }
    }));

    // Ban toggle
    document.querySelectorAll("[data-ban]").forEach((b) => (b.onclick = async () => {
      try {
        const newBanState = b.dataset.banned !== "1";
        await update(ref(db, `users/${b.dataset.ban}`), { banned: newBanState });
        toast(newBanState ? "Kullanıcı banlandı." : "Ban kaldırıldı.");
      } catch (e) { toast(firebaseMsg(e), true); }
    }));
  });
}