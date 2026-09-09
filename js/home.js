import { $, esc, fmtDate } from "./utils.js";
import { openDetail } from "./listing.js";

export function renderHome(listings, favorites) {
  const arr = Object.entries(listings).map(([id, v]) => ({ id, ...v }));
  $("#heroTotal").textContent = arr.length;
  $("#totalCount").textContent = arr.length;
  const latest = [...arr].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
  $("#latestStrip").innerHTML = latest.map((x) => card(x, favorites)).join("");
  const featured = arr.filter((x) => x.featuredUntil > Date.now()).slice(0, 6);
  $("#featuredStrip").innerHTML = featured.map((x) => card(x, favorites)).join("");
  $("#featuredEmpty").classList.toggle("hidden", featured.length > 0);
  const popular = [...arr].sort((a, b) => (b.favCount || 0) - (a.favCount || 0)).slice(0, 6);
  $("#popularStrip").innerHTML = popular.map((x) => card(x, favorites)).join("");
  bindCards(favorites);
}

export function card(x, favorites = {}) {
  const img = x.images?.[0] || x.image || "";
  const isFav = favorites[x.id] === true;
  const isFeatured = x.featuredUntil > Date.now();
  const priceText = x.price ? x.price.toLocaleString("tr-TR") + " Parking" : "";
  const featuredTimer = isFeatured ? `<div class="card-timer">🔥 ${Math.ceil((x.featuredUntil - Date.now()) / 60000)}dk</div>` : "";
  return `<article class="listing-card" data-id="${x.id}">
    <div class="listing-image">
      ${img ? `<img loading="lazy" src="${esc(img)}" alt="${esc(x.title)}">` : `<div style="height:100%;display:grid;place-items:center;font-size:40px;color:#aaa">◇</div>`}
      ${isFeatured ? '<span class="badge featured">ÖNE ÇIKAN</span>' : ""}
      ${featuredTimer}
      <button class="fav-btn ${isFav ? "active" : ""}" data-fav="${x.id}" title="Favori">${isFav ? "♥" : "♡"}</button>
    </div>
    <div class="listing-body">
      <h3>${esc(x.title)}</h3>
      <div class="listing-meta"><span>${fmtDate(x.createdAt)}</span>${priceText ? `<span style="color:#16764a;font-weight:700">· ${esc(priceText)}</span>` : ""}</div>
      <div class="listing-foot"><span class="seller">${esc(x.sellerName || "Kullanıcı")}</span><button class="chat-btn">Detay</button></div>
    </div>
  </article>`;
}

export function bindCards(favorites, onFavToggle) {
  document.querySelectorAll(".listing-card").forEach((c) => c.onclick = (e) => { if (e.target.closest(".fav-btn")) return; openDetail(c.dataset.id); });
  document.querySelectorAll(".fav-btn").forEach((b) => b.onclick = (e) => { e.stopPropagation(); const willBeActive = !b.classList.contains("active"); b.classList.toggle("active"); b.textContent = willBeActive ? "♥" : "♡"; if (onFavToggle) onFavToggle(b.dataset.fav); });
}
