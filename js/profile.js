import { ref, get, update, remove } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { db } from "./firebase.js";
import { $, avatar, toast, firebaseMsg, fmtDate } from "./utils.js";
import { authState } from "./auth.js";
import { listingState, toggleFavorite, updateQuotaUI } from "./listing.js";
import { card, bindCards } from "./home.js";

export function renderProfile() {
  $("#profileName").textContent = authState.profile?.username || "Kullanıcı";
  $("#bigAvatar").textContent = avatar(authState.profile?.username);
  const mine = Object.values(listingState.listings).filter((x) => x.uid === authState.user?.uid && !x.sold);
  $("#profileStats").textContent = `${mine.length} ilan yayında`;
  $("#adminBtn").classList.toggle("hidden", !authState.isAdmin);
  renderProfileList("active");
}

export function renderProfileList(mode) {
  const uid = authState.user?.uid;
  if (!uid) return;
  let arr = [];
  let title = "";
  if (mode === "active") {
    title = "Yayındaki İlanlarım";
    arr = Object.entries(listingState.listings).map(([id, v]) => ({ id, ...v })).filter((x) => x.uid === uid && !x.sold);
  } else if (mode === "sold") {
    title = "Satılan İlanlarım";
    arr = Object.entries(listingState.listings).map(([id, v]) => ({ id, ...v })).filter((x) => x.uid === uid && x.sold);
  }
  $("#profileListTitle").textContent = title;
  const grid = $("#profileListGrid");
  if (grid) grid.innerHTML = arr.map((x) => card(x, listingState.favorites)).join("");
  $("#profileListEmpty").classList.toggle("hidden", arr.length > 0);
  bindCards(listingState.favorites, toggleFavorite);

  if (mode === "active" && grid) {
    arr.forEach((x) => {
      const cardEl = grid.querySelector(`.listing-card[data-id="${x.id}"]`);
      if (!cardEl) return;
      const footEl = cardEl.querySelector(".listing-foot");
      if (!footEl || footEl.querySelector(".sold-btn")) return;
      
      // Geri sayım ekle
      const timeLeft = x.featuredUntil ? Math.max(0, x.featuredUntil - Date.now()) : 0;
      if (timeLeft > 0) {
        const timerDiv = document.createElement("div");
        timerDiv.className = "listing-timer";
        timerDiv.style.cssText = "position:absolute;top:8px;left:8px;background:rgba(0,0,0,.8);color:#fff;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:700";
        timerDiv.textContent = formatTimeLeft(timeLeft);
        cardEl.querySelector(".listing-image").appendChild(timerDiv);
        startCardTimer(timerDiv, timeLeft);
      }
      
      const b = document.createElement("button");
      b.className = "chat-btn sold-btn";
      b.textContent = "Satıldı";
      b.style.marginLeft = "6px";
      b.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm("İlanı satıldı olarak işaretlemek istediğine emin misin?")) return;
        try { await update(ref(db, `listings/${x.id}`), { sold: true }); toast("Satıldı olarak işaretlendi."); renderProfileList("active"); } catch (err) { toast(firebaseMsg(err), true); }
      };
      footEl.appendChild(b);
    });
  }
}

function formatTimeLeft(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `⏱️ ${m}:${s.toString().padStart(2, "0")}`;
}

function startCardTimer(el, ms) {
  let remaining = ms;
  const interval = setInterval(() => {
    remaining -= 1000;
    if (remaining <= 0) { clearInterval(interval); el.remove(); return; }
    el.textContent = formatTimeLeft(remaining);
  }, 1000);
}

export async function renderFavoritesPage() {
  const uid = authState.user?.uid;
  const snap = await get(ref(db, `favorites/${uid}`));
  const favs = snap.exists() ? Object.keys(snap.val()) : [];
  const arr = favs.map((id) => ({ id, ...listingState.listings[id] })).filter((x) => x.title);
  $("#favGrid").innerHTML = arr.map((x) => card(x, listingState.favorites)).join("");
  $("#favEmpty").classList.toggle("hidden", arr.length > 0);
  bindCards(listingState.favorites, toggleFavorite);
}

export async function renderSoldPage() {
  const uid = authState.user?.uid;
  const arr = Object.entries(listingState.listings).map(([id, v]) => ({ id, ...v })).filter((x) => x.uid === uid && x.sold);
  $("#soldGrid").innerHTML = arr.map((x) => card(x, listingState.favorites)).join("");
  $("#soldEmpty").classList.toggle("hidden", arr.length > 0);
  bindCards(listingState.favorites, toggleFavorite);
}

export function initProfileButtons(go) {
  $("#myListingsBtn").onclick = () => { go("profile"); setTimeout(() => renderProfileList("active"), 50); };
  $("#soldListingsBtn").onclick = () => { go("sold"); renderSoldPage(); };
  $("#favBtn").onclick = () => { go("favorites"); renderFavoritesPage(); };
  $("#adminBtn").onclick = () => go("admin");
  $("#featuredBtn").onclick = () => { toast("Artık ilan verirken otomatik öne çıkıyor!", true); };
}

export function initClaimButton() {}
