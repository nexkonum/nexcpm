import { $, $$, toast } from "./utils.js";
import { authState, initAuth, logout } from "./auth.js";
import { renderHome } from "./home.js";
import { subscribeListings, subscribeFavorites, renderListingsPage, initFilters, initCreateForm, initReport, listingState, checkQuota, updateQuotaUI, startAdTimer, initClaimButton } from "./listing.js";
import { subscribeConversations, startPresence } from "./chat.js";
import { renderProfile, initProfileButtons } from "./profile.js";
import { subscribeAdmin } from "./admin.js";

let chatSubscribed = false;

function go(page) {
  if (!authState.user && page !== "login") page = "login";
  $$(".page").forEach((p) => p.classList.remove("active"));
  const el = document.getElementById(page + "Page");
  if (el) el.classList.add("active");
  $$(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.page === page));
  document.body.classList.toggle("logged-in", !!authState.user);
  window.scrollTo({ top: 0 });
  if (page === "messages" && !chatSubscribed) { chatSubscribed = true; subscribeConversations(); }
  if (page === "profile") renderProfile();
  if (page === "create") loadQuotaUI();
}

async function loadQuotaUI() {
  const quota = await checkQuota();
  updateQuotaUI(quota);
}

function initNav() {
  document.querySelectorAll("[data-page]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); go(b.dataset.page); }));
  const profileBtn = document.getElementById("profileBtn");
  if (profileBtn) profileBtn.onclick = () => go("profile");
  document.querySelectorAll("[data-close]").forEach((b) => b.onclick = () => b.closest(".modal").classList.remove("open"));
  document.querySelectorAll(".modal").forEach((m) => m.onclick = (e) => { if (e.target === m) m.classList.remove("open"); });
  const modalSearch = document.getElementById("modalSearch");
  if (modalSearch) modalSearch.oninput = (e) => { document.getElementById("fKeyword").value = e.target.value; document.getElementById("searchModal").classList.remove("open"); go("listings"); renderListingsPage(); };
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;
  const heroCreate = document.getElementById("heroCreate");
  if (heroCreate) heroCreate.onclick = () => go("create");
  const heroBrowse = document.getElementById("heroBrowse");
  if (heroBrowse) heroBrowse.onclick = () => go("listings");
}

initNav();
initFilters();
initCreateForm();
initReport();
initProfileButtons(go);
initClaimButton();

document.addEventListener("listings:updated", () => renderHome(listingState.listings, listingState.favorites));
document.addEventListener("favorites:updated", () => renderHome(listingState.listings, listingState.favorites));

// Arada reklam göster (her 2 dakikada bir)
let adShown = false;
setInterval(() => {
  if (authState.user && !adShown && Math.random() > 0.7) {
    adShown = true;
    try {
      if (window.adsbygoogle && window.adsbygoogle.push) {
        window.adsbygoogle.push({ google_ad_client: "ca-pub-3422620485038789", google_ad_slot: "AUTO_AD", google_ad_format: "autorelaxed" });
      }
    } catch (e) {}
    setTimeout(() => adShown = false, 30000);
  }
}, 120000);

initAuth(async (user) => {
  if (user) {
    startPresence();
    subscribeListings();
    subscribeFavorites();
    subscribeAdmin();
    const quota = await checkQuota();
    if (quota.remaining === 0) toast("İlan hakkın kalmamış. Hakkı yenile butonuna tıkla.", true);
    go("home");
  } else {
    chatSubscribed = false;
    go("login");
  }
});
