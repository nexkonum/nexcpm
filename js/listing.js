import { ref, push, set, get, update, remove, serverTimestamp, onValue } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { db } from "./firebase.js";
import { uploadListingImage } from "./supabase.js";
import { $, esc, toast, fmtDate, wordCount, firebaseMsg } from "./utils.js";
import { authState } from "./auth.js";
import { card, bindCards } from "./home.js";
import { startChat } from "./chat.js";

export const listingState = { listings: {}, favorites: {}, currentDetail: null, files: [] };
let selectedListingForFeature = null;

export function subscribeListings() {
  onValue(ref(db, "listings"), (snap) => {
    listingState.listings = {};
    snap.forEach((c) => { listingState.listings[c.key] = c.val(); });
    renderListingsPage();
    document.dispatchEvent(new CustomEvent("listings:updated"));
  });
}

export function subscribeFavorites() {
  if (!authState.user) return;
  onValue(ref(db, `favorites/${authState.user.uid}`), (snap) => {
    listingState.favorites = snap.exists() ? snap.val() : {};
    renderListingsPage();
    document.dispatchEvent(new CustomEvent("favorites:updated"));
  });
}

export function renderListingsPage() {
  const kw = ($("#fKeyword")?.value || "").toLowerCase();
  let arr = Object.entries(listingState.listings).map(([id, v]) => ({ id, ...v }));
  arr = arr.filter((x) => !kw || `${x.title} ${x.description}`.toLowerCase().includes(kw));
  arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const grid = $("#listingGrid");
  if (grid) {
    grid.innerHTML = arr.map((x) => card(x, listingState.favorites)).join("");
    $("#listingEmpty").classList.toggle("hidden", arr.length > 0);
    bindCards(listingState.favorites, toggleFavorite);
  }
}

export function initFilters() {
  $("#fKeyword")?.addEventListener("input", renderListingsPage);
}

export async function toggleFavorite(listingId) {
  if (!authState.user) return toast("Favori için giriş yapmalısın.", true);
  const favRef = ref(db, `favorites/${authState.user.uid}/${listingId}`);
  const listingRef = ref(db, `listings/${listingId}`);
  try {
    const snap = await get(favRef);
    const currentFavCount = listingState.listings[listingId]?.favCount || 0;
    if (snap.exists()) {
      await remove(favRef);
      await update(listingRef, { favCount: Math.max(0, currentFavCount - 1) });
      listingState.favorites[listingId] = false;
      updateFavButton(listingId, false);
      toast("Favorilerden çıkarıldı.");
    } else {
      await set(favRef, { at: serverTimestamp() });
      await update(listingRef, { favCount: currentFavCount + 1 });
      listingState.favorites[listingId] = true;
      updateFavButton(listingId, true);
      toast("Favorilere eklendi ♥");
    }
  } catch (e) { toast(firebaseMsg(e), true); }
}

function updateFavButton(listingId, isFav) {
  document.querySelectorAll(`[data-fav="${listingId}"]`).forEach((btn) => {
    btn.classList.toggle("active", isFav);
    btn.textContent = isFav ? "♥" : "♡";
  });
}

export function openDetail(id) {
  const x = listingState.listings[id];
  if (!x) return;
  listingState.currentDetail = id;
  const isFav = listingState.favorites[id] === true;
  const isMine = x.uid === authState.user?.uid;
  const images = x.images || (x.image ? [x.image] : []);
  const featuredBadge = x.featuredUntil > Date.now() ? `<span class="badge featured">🔥 ÖNE ÇIKAN · ${Math.ceil((x.featuredUntil - Date.now()) / 60000)}dk kaldı</span>` : "";

  $("#detailContent").innerHTML = `
    ${images.length ? `<div class="gallery detail-gallery">${images.map((img) => `<img loading="lazy" src="${esc(img)}">`).join("")}</div>` : ""}
    ${featuredBadge}
    <span class="eyebrow">İLAN</span>
    <h2>${esc(x.title)}</h2>
    <div class="detail-info">
      <div><span>İlan sahibi</span><b>${esc(x.sellerName)}</b></div>
      <div><span>Tarih</span><b>${fmtDate(x.createdAt)}</b></div>
      <div><span>Fiyat</span><b>${x.price ? x.price.toLocaleString("tr-TR") + " Parking" : "Belirtilmemiş"}</b></div>
    </div>
    <p style="line-height:1.7;color:#555;white-space:pre-wrap">${esc(x.description)}</p>
    <div class="detail-actions">
      ${!isMine ? `<button class="primary" id="dChat">Mesaj Gönder</button>` : ""}
      <button class="secondary" id="dFav">${isFav ? "♥ Favorilerden Çıkar" : "♡ Favorilere Ekle"}</button>
      ${!isMine ? `<button class="danger-btn" id="dReport">Bildir</button>` : ""}
      ${isMine ? `<button class="danger-btn" id="dDelete">İlanı Sil</button>` : ""}
    </div>`;
  $("#detailModal").classList.add("open");
  $("#dChat") && ($("#dChat").onclick = async () => { await startChat(x.uid, x.sellerName, x.id); $("#detailModal").classList.remove("open"); document.querySelector('[data-page="messages"]').click(); });
  $("#dFav").onclick = () => toggleFavorite(id);
  $("#dReport") && ($("#dReport").onclick = () => { $("#detailModal").classList.remove("open"); $("#reportModal").classList.add("open"); });
  $("#dDelete") && ($("#dDelete").onclick = async () => { if (!confirm("İlanı silmek istediğine emin misin?")) return; await remove(ref(db, `listings/${id}`)); toast("İlan silindi."); $("#detailModal").classList.remove("open"); });
}

export function initCreateForm() {
  $("#uploadArea").onclick = () => $("#photoInput").click();
  $("#photoInput").onchange = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 2);
    if (!files.length) return;
    for (const f of files) { if (f.size > 8 * 1024 * 1024) { toast("Her fotoğraf 8MB'dan küçük olmalı.", true); e.target.value = ""; listingState.files = []; $("#previewRow").innerHTML = ""; return; } }
    listingState.files = files;
    $("#previewRow").innerHTML = files.map((f) => `<img src="${URL.createObjectURL(f)}">`).join("");
  };
  $("#cDesc").oninput = (e) => { const n = wordCount(e.target.value); $("#descCount").textContent = `${n}/500 kelime`; $("#descCount").style.color = n > 500 ? "#b42318" : "#999"; };

  // Hakkı yenile butonu — direk reklam açar, süre beklemez
  $("#renewQuotaBtn").onclick = () => { $("#adWatchModal").classList.add("open"); startAdTimer(); };

  $("#listingForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!authState.user) return toast("Giriş yapmalısın.", true);
    const title = $("#cTitle").value.trim();
    const desc = $("#cDesc").value.trim();
    const price = $("#cPrice").value.trim();
    if (!title) return toast("Başlık gerekli.", true);
    if (wordCount(desc) > 500) return toast("Açıklama en fazla 500 kelime.", true);
    if (listingState.files.length !== 2) return toast("2 fotoğraf ekle.", true);
    if (!price || isNaN(price) || Number(price) < 0) return toast("Geçerli fiyat gir.", true);
    if (!$("#rulesAccept").checked) return toast("Kuralları kabul et.", true);

    const quota = await checkQuota();
    if (quota.remaining <= 0) { toast("İlan hakkın kalmadı. Yukarıdaki 'Reklam İzle' butonuna tıkla.", true); return; }

    const btn = $("#submitListing");
    btn.disabled = true;
    btn.textContent = "Yükleniyor…";
    try {
      const id = push(ref(db, "listings")).key;
      const urls = await Promise.all(listingState.files.map((f, i) => uploadListingImage(authState.user.uid, id + "_" + i, f)));
      await set(ref(db, `listings/${id}`), { uid: authState.user.uid, sellerName: authState.profile?.username || "Kullanıcı", title, description: desc, images: urls, price: Number(price), featuredUntil: 0, favCount: 0, createdAt: serverTimestamp() });
      await set(ref(db, `quotas/${authState.user.uid}`), { remaining: 0 });
      e.target.reset();
      listingState.files = [];
      $("#previewRow").innerHTML = "";
      updateQuotaUI({ remaining: 0 });
      toast("İlanın yayınlandı ✓ (1 saat sonra otomatik kalkar)");
      document.querySelector('[data-page="listings"]').click();
    } catch (err) { toast("Hata: " + (err?.message || "bilinmeyen"), true); } finally { btn.disabled = false; btn.textContent = "İlanı Yayınla"; }
  };
}

export function initReport() {
  $("#sendReport").onclick = async () => {
    const reason = $("#reportReason").value.trim();
    if (!reason) return toast("Neden yaz.", true);
    await push(ref(db, "reports"), { listingId: listingState.currentDetail, reporter: authState.user.uid, reason: reason.slice(0, 500), createdAt: serverTimestamp() });
    $("#reportModal").classList.remove("open");
    $("#reportReason").value = "";
    toast("Bildirim gönderildi.");
  };
}

export async function checkQuota() {
  if (!authState.user) return { remaining: 0 };
  const snap = await get(ref(db, `quotas/${authState.user.uid}`));
  if (!snap.exists()) { const q = { remaining: 1 }; await set(ref(db, `quotas/${authState.user.uid}`), q); return q; }
  return snap.val();
}

export async function updateQuotaUI(quota) {
  const countEl = $("#quotaCount");
  const renewBtn = $("#renewQuotaBtn");
  const submitBtn = $("#submitListing");
  if (!countEl) return;
  
  const remaining = quota?.remaining ?? 1;
  countEl.textContent = `${remaining} / 1`;
  
  if (remaining > 0) {
    if (renewBtn) renewBtn.style.display = "none";
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "İlanı Yayınla"; }
  } else {
    if (renewBtn) { renewBtn.style.display = "inline-flex"; renewBtn.textContent = "🔄 Reklam İzle (Hakkı Yenile)"; }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "⛔ İlan Hakkı Yok"; }
  }
}

// ÖNE ÇIKARMA — REKLAM İZLE → İLAN SEÇ → ÖNE ÇIKAR
let adInterval = null;
let adWatched = false;

export function startAdTimer() {
  $("#claimRewardBtn").classList.add("hidden");
  $("#adProgressFill").style.width = "0%";
  let seconds = 30;
  $("#adTimer").textContent = seconds;
  adWatched = false;
  clearInterval(adInterval);
  
  // Adsterra Reward Ad
  try {
    const adScript = document.createElement("script");
    adScript.src = "https://www.profitableratecpmnetwork.com/g7qgwyurk?key=eb020d6c26f1fdfa983fd3d9bec96597";
    document.getElementById("adContainer")?.appendChild(adScript);
  } catch (e) { console.log("Adsterra yükleniyor..."); }
  
  adInterval = setInterval(() => {
    seconds--;
    const progress = ((30 - seconds) / 30) * 100;
    $("#adProgressFill").style.width = progress + "%";
    if (seconds > 0 && !adWatched) $("#adTimer").textContent = seconds;
    else if (seconds <= 0) {
      clearInterval(adInterval);
      $("#adTimer").textContent = "0";
      $("#claimRewardBtn").classList.remove("hidden");
      adWatched = true;
    }
  }, 1000);
}

export function initClaimButton() {
  $("#claimRewardBtn").onclick = async () => {
    clearInterval(adInterval);
    $("#adWatchModal").classList.remove("open");
    
    // Kullanıcının ilanlarını listele
    const myListings = Object.entries(listingState.listings)
      .filter(([id, x]) => x.uid === authState.user.uid && !x.sold);
    
    if (myListings.length === 0) {
      // İlan yoksa sadece hakkı yenile
      await set(ref(db, `quotas/${authState.user.uid}`), { remaining: 1 });
      updateQuotaUI({ remaining: 1 });
      toast("🎉 İlan hakkın yenilendi! Şimdi ilan verebilirsin.");
      return;
    }
    
    // İlan seçme ekranı
    showFeatureListingPicker(myListings);
  };
}

function showFeatureListingPicker(listings) {
  const modal = document.createElement("div");
  modal.className = "modal open";
  modal.id = "featurePickerModal";
  modal.innerHTML = `
    <div class="modal-box" style="max-width:500px">
      <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
      <span class="eyebrow">ÖNE ÇIKARMA</span>
      <h2>Hangi İlanı Öne Çıkaralım?</h2>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px;max-height:400px;overflow-y:auto">
        ${listings.map(([id, x]) => `
          <div class="feature-option" data-fid="${id}" style="display:flex;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:12px;cursor:pointer;transition:.15s">
            <img src="${esc(x.images?.[0] || x.image || '')}" style="width:60px;height:60px;object-fit:cover;border-radius:8px">
            <div style="flex:1">
              <b style="font-size:14px">${esc(x.title)}</b>
              <p style="font-size:12px;color:#888;margin-top:2px">${x.price ? x.price.toLocaleString("tr-TR") + " Parking" : "Fiyat yok"}</p>
            </div>
            <button class="primary small" style="padding:8px 14px;font-size:12px">Seç</button>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.querySelectorAll(".feature-option").forEach((opt) => {
    opt.onclick = async () => {
      const fid = opt.dataset.fid;
      modal.remove();
      await featureListing(fid);
    };
  });
}

async function featureListing(listingId) {
  try {
    const featuredUntil = Date.now() + (60 * 60 * 1000); // 1 saat
    await update(ref(db, `listings/${listingId}`), { featuredUntil });
    toast("🔥 İlanın 1 saat öne çıkarıldı!");
  } catch (err) {
    toast("Hata: " + err.message, true);
  }
}
