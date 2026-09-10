import { ref, push, set, get, update, remove, onValue, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { db } from "./firebase.js";
import { $, esc, toast, firebaseMsg } from "./utils.js";
import { authState } from "./auth.js";

export const chatState = { conversations: {}, activeChat: null, typingTimer: null, listeners: {} };

export async function startChat(otherUid, otherName, listingId) {
  const ids = [authState.user.uid, otherUid].sort();
  const cid = ids.join("_");
  const blockSnap = await get(ref(db, `blocks/${authState.user.uid}/${otherUid}`));
  if (blockSnap.exists()) return toast("Bu kullanıcıyı engelledin.", true);
  try {
    await update(ref(db, `conversations/${cid}/members`), { [authState.user.uid]: true, [otherUid]: true });
    await update(ref(db, `conversations/${cid}`), { otherUid, otherName, listingId: listingId || "", lastAt: serverTimestamp(), lastText: "Yeni sohbet" });
    chatState.activeChat = cid;
  } catch (e) { toast(firebaseMsg(e), true); }
}

export function subscribeConversations() {
  if (!authState.user) return;
  onValue(ref(db, "conversations"), (snap) => {
    chatState.conversations = {};
    snap.forEach((c) => { if (c.val().members?.[authState.user.uid]) chatState.conversations[c.key] = c.val(); });
    renderConversationsPage();
  });
}

function renderConversationsPage() {
  const list = $("#conversationList");
  const empty = $("#conversationEmpty");
  if (!list) return;
  const entries = Object.entries(chatState.conversations).sort((a, b) => (b[1].lastAt || 0) - (a[1].lastAt || 0));
  
  if (entries.length === 0) {
    list.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }
  empty?.classList.add("hidden");
  
  list.innerHTML = entries.map(([cid, c]) => {
    const unread = (c[`unread_${authState.user.uid}`] || 0) > 0;
    const time = c.lastAt ? new Date(c.lastAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "";
    const initial = (c.otherName || "?").slice(0, 1).toUpperCase();
    return `
      <div class="conversation-item" data-cid="${cid}">
        <div class="conversation-item-avatar">${initial}</div>
        <div class="conversation-item-body">
          <b>${esc(c.otherName || "Kullanıcı")}</b>
          <p>${esc(c.lastText || "Sohbet")}</p>
        </div>
        <div class="conversation-item-meta">
          ${unread ? `<span class="conversation-item-unread">${c[`unread_${authState.user.uid}`]}</span>` : ""}
          <small>${time}</small>
        </div>
      </div>
    `;
  }).join("");
  
  document.querySelectorAll(".conversation-item").forEach((item) => {
    item.onclick = () => openChatDetail(item.dataset.cid);
  });
}

export function openChatDetail(cid) {
  chatState.activeChat = cid;
  const c = chatState.conversations[cid] || {};
  const other = c.otherUid;
  
  // Sayfayı aç
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  $("#chatDetailPage").classList.add("active");
  
  // Header bilgileri
  $("#chatDetailName").textContent = c.otherName || "Kullanıcı";
  $("#chatDetailAvatar").textContent = (c.otherName || "?").slice(0, 1).toUpperCase();
  
  // Önceki listener'ları temizle
  Object.values(chatState.listeners).forEach((off) => off && off());
  chatState.listeners = {};
  
  // Okunmamışı sıfırla
  update(ref(db, `conversations/${cid}`), { [`unread_${authState.user.uid}`]: 0 });
  
  // Mesajları dinle
  chatState.listeners.msg = onValue(ref(db, `messages/${cid}`), (snap) => {
    const box = $("#chatDetailMessages");
    if (!box) return;
    box.innerHTML = "";
    snap.forEach((m) => {
      const v = m.val();
      const isMine = v.uid === authState.user.uid;
      const row = document.createElement("div");
      row.className = "chat-detail-bubble-row" + (isMine ? " mine" : "");
      const time = v.createdAt ? new Date(v.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "";
      const status = isMine ? `<span class="chat-detail-bubble-status">${v.read ? "✓✓ Görüldü" : "✓ Gönderildi"}</span>` : "";
      const like = v.like ? `<div style="font-size:20px">❤️</div>` : "";
      const text = v.text ? esc(v.text) : "";
      row.innerHTML = `<div class="chat-detail-bubble ${isMine ? "mine" : ""}">${text}${like}<span class="chat-detail-bubble-time">${time}</span>${status}</div>`;
      box.appendChild(row);
    });
    box.scrollTop = box.scrollHeight;
    snap.forEach((m) => { const v = m.val(); if (!v.read && v.uid !== authState.user.uid) update(ref(db, `messages/${cid}/${m.key}`), { read: true, readAt: serverTimestamp() }); });
  });
  
  // Yazıyor dinle
  chatState.listeners.typing = onValue(ref(db, `typing/${cid}/${other}`), (s) => {
    const t = $("#chatDetailTyping");
    if (t) t.textContent = s.val() ? "yazıyor…" : "";
  });
  
  // Çevrimiçi dinle
  chatState.listeners.presence = onValue(ref(db, `presence/${other}`), (s) => {
    const st = $("#chatDetailStatus");
    if (!st) return;
    st.textContent = s.exists() ? "çevrimiçi" : "çevrimdışı";
    st.className = s.exists() ? "online" : "";
  });
  
  // Geri butonu
  $("#chatBackBtn").onclick = () => {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    $("#messagesPage").classList.add("active");
    chatState.activeChat = null;
    Object.values(chatState.listeners).forEach((off) => off && off());
    chatState.listeners = {};
    renderConversationsPage();
  };
  
  // Menü butonu
  $("#chatMenuBtn").onclick = (e) => {
    e.stopPropagation();
    const dropdown = $("#chatMenuDropdown");
    dropdown.classList.toggle("hidden");
    dropdown.style.top = "60px";
    dropdown.style.right = "16px";
    $("#chatBlockBtn").onclick = () => blockUser(other, c.otherName);
    $("#chatReportBtn").onclick = () => {
      dropdown.classList.add("hidden");
      $("#chatReportModal").classList.add("open");
      $("#sendChatReport").onclick = async () => {
        const reason = $("#chatReportReason").value.trim();
        if (!reason) return toast("Neden yaz.", true);
        await push(ref(db, "chatReports"), { reportedUid: other, reporter: authState.user.uid, reason: reason.slice(0, 500), createdAt: serverTimestamp() });
        $("#chatReportModal").classList.remove("open");
        $("#chatReportReason").value = "";
        toast("Kullanıcı bildirildi.");
      };
    };
  };
  
  // Mesaj gönder
  $("#chatDetailCompose").onsubmit = async (e) => {
    e.preventDefault();
    const text = $("#chatDetailInput").value.trim();
    if (!text) return;
    const blockSnap = await get(ref(db, `blocks/${authState.user.uid}/${other}`));
    if (blockSnap.exists()) return toast("Bu kullanıcıyı engelledin.", true);
    try {
      await push(ref(db, `messages/${cid}`), { uid: authState.user.uid, text: text.slice(0, 500), read: false, createdAt: serverTimestamp() });
      await update(ref(db, `conversations/${cid}`), { lastText: text.slice(0, 80), lastAt: serverTimestamp(), [`unread_${other}`]: (chatState.conversations[cid]?.[`unread_${other}`] || 0) + 1 });
      $("#chatDetailInput").value = "";
      set(ref(db, `typing/${cid}/${authState.user.uid}`), false);
    } catch (err) { toast(firebaseMsg(err), true); }
  };
  
  // Beğeni gönder
  $("#chatDetailLike").onclick = async () => {
    const blockSnap = await get(ref(db, `blocks/${authState.user.uid}/${other}`));
    if (blockSnap.exists()) return toast("Bu kullanıcıyı engelledin.", true);
    await push(ref(db, `messages/${cid}`), { uid: authState.user.uid, text: "", like: true, read: false, createdAt: serverTimestamp() });
    await update(ref(db, `conversations/${cid}`), { lastText: "❤️", lastAt: serverTimestamp(), [`unread_${other}`]: (chatState.conversations[cid]?.[`unread_${other}`] || 0) + 1 });
  };
  
  // Yazıyor göster
  $("#chatDetailInput").oninput = () => {
    set(ref(db, `typing/${cid}/${authState.user.uid}`), true);
    clearTimeout(chatState.typingTimer);
    chatState.typingTimer = setTimeout(() => set(ref(db, `typing/${cid}/${authState.user.uid}`), false), 2000);
  };
  
  // Input focus = klavye açılır, mesajlar yukarı kayar
  $("#chatDetailInput").onfocus = () => {
    setTimeout(() => {
      const box = $("#chatDetailMessages");
      if (box) box.scrollTop = box.scrollHeight;
    }, 300);
  };
}

async function blockUser(uid, name) {
  if (!confirm(`${name || "Bu kullanıcı"} engellenecek. Emin misin?`)) return;
  try {
    await set(ref(db, `blocks/${authState.user.uid}/${uid}`), { at: serverTimestamp() });
    $("#chatMenuDropdown").classList.add("hidden");
    toast("Kullanıcı engellendi.");
    chatState.activeChat = null;
    $("#chatDetailPage").classList.remove("active");
    $("#messagesPage").classList.add("active");
    renderConversationsPage();
  } catch (e) { toast(firebaseMsg(e), true); }
}

export function startPresence() {
  const connected = ref(db, ".info/connected");
  const me = ref(db, `presence/${authState.user.uid}`);
  onValue(connected, (s) => {
    if (s.val() === true) {
      set(me, { username: authState.profile.username, at: serverTimestamp() });
      onDisconnect(me).remove();
      onDisconnect(ref(db, `lastSeen/${authState.user.uid}`)).set(serverTimestamp());
    }
  });
  onValue(ref(db, "presence"), (snap) => {
    const n = snap.exists() ? Object.keys(snap.val()).length : 0;
    $("#activeCount").textContent = n;
    const h = $("#heroActive"); if (h) h.textContent = n;
  });
}

document.addEventListener("click", (e) => {
  const dropdown = $("#chatMenuDropdown");
  const btn = $("#chatMenuBtn");
  if (dropdown && !dropdown.contains(e.target) && (!btn || !btn.contains(e.target))) dropdown.classList.add("hidden");
});
