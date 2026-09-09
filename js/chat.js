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
    renderConversations();
  });
}

function renderConversations() {
  const list = $("#conversationList");
  if (!list) return;
  const entries = Object.entries(chatState.conversations).sort((a, b) => (b[1].lastAt || 0) - (a[1].lastAt || 0));
  list.innerHTML = entries.map(([cid, c]) => {
    const unread = (c[`unread_${authState.user.uid}`] || 0) > 0;
    const time = c.lastAt ? new Date(c.lastAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "";
    return `<div class="conversation ${chatState.activeChat === cid ? "active" : ""}" data-cid="${cid}">
      <div style="flex:1;min-width:0"><b>${esc(c.otherName || "Kullanıcı")}</b><p>${esc(c.lastText || "Sohbet")}</p></div>
      <div style="text-align:right">${unread ? '<span class="unread-dot" style="margin-bottom:4px"></span>' : ""}<small style="color:#666;font-size:10px">${time}</small></div>
    </div>`;
  }).join("") || `<div class="empty" style="color:#666;padding:40px 20px"><h3>Sohbet yok</h3></div>`;
  document.querySelectorAll(".conversation").forEach((x) => x.onclick = () => openChat(x.dataset.cid));
  if (chatState.activeChat && chatState.conversations[chatState.activeChat]) openChat(chatState.activeChat);
}

export function openChat(cid) {
  chatState.activeChat = cid;
  const c = chatState.conversations[cid] || {};
  const other = c.otherUid;
  const panel = $("#chatPanel");
  if (!panel) return;
  
  Object.values(chatState.listeners).forEach((off) => off && off());
  chatState.listeners = {};

  panel.innerHTML = `
    <div class="chat-head">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;border-radius:50%;background:#333;display:grid;place-items:center;color:#fff;font-weight:800;font-size:16px">${(c.otherName || "?").slice(0,1).toUpperCase()}</div>
        <div><div style="font-size:15px">${esc(c.otherName || "Sohbet")}</div><small id="chatStatus">çevrimdışı</small></div>
      </div>
      <button class="chat-menu-btn" id="chatMenuBtn">⋯</button>
    </div>
    <div id="chatMessages" class="chat-messages"></div>
    <div class="typing" id="typingIndicator"></div>
    <form class="chat-compose" id="chatCompose">
      <input id="chatInput" maxlength="500" placeholder="Mesaj yaz…" autocomplete="off">
      <button type="button" id="likeBtn" style="background:none;color:#fff;font-size:22px;padding:0 8px">❤️</button>
      <button type="submit">Gönder</button>
    </form>`;

  $("#chatMenuBtn").onclick = (e) => {
    e.stopPropagation();
    const dropdown = $("#chatMenuDropdown");
    dropdown.classList.toggle("hidden");
    dropdown.style.top = "54px";
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

  update(ref(db, `conversations/${cid}`), { [`unread_${authState.user.uid}`]: 0 });

  chatState.listeners.msg = onValue(ref(db, `messages/${cid}`), (snap) => {
    const box = $("#chatMessages");
    if (!box) return;
    box.innerHTML = "";
    snap.forEach((m) => {
      const v = m.val();
      const isMine = v.uid === authState.user.uid;
      const row = document.createElement("div");
      row.className = "bubble-row" + (isMine ? " mine" : "");
      const time = v.createdAt ? new Date(v.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "";
      const status = isMine ? `<span class="msg-status">${v.read ? "✓✓ Görüldü" : "✓ Gönderildi"}</span>` : "";
      const like = v.like ? `<div style="font-size:18px;margin-top:4px">❤️</div>` : "";
      row.innerHTML = `<div class="bubble ${isMine ? "mine" : ""}">${esc(v.text)}${like}<span class="msg-time">${time}</span>${status}</div>`;
      box.appendChild(row);
    });
    box.scrollTop = box.scrollHeight;
    snap.forEach((m) => { const v = m.val(); if (!v.read && v.uid !== authState.user.uid) update(ref(db, `messages/${cid}/${m.key}`), { read: true, readAt: serverTimestamp() }); });
  });

  chatState.listeners.typing = onValue(ref(db, `typing/${cid}/${other}`), (s) => {
    const t = $("#typingIndicator");
    if (t) t.textContent = s.val() ? "yazıyor…" : "";
  });

  chatState.listeners.presence = onValue(ref(db, `presence/${other}`), (s) => {
    const st = $("#chatStatus");
    if (!st) return;
    st.textContent = s.exists() ? "çevrimiçi" : "çevrimdışı";
    st.className = s.exists() ? "online" : "";
  });

  $("#chatCompose").onsubmit = async (e) => {
    e.preventDefault();
    const text = $("#chatInput").value.trim();
    if (!text) return;
    const blockSnap = await get(ref(db, `blocks/${authState.user.uid}/${other}`));
    if (blockSnap.exists()) return toast("Bu kullanıcıyı engelledin.", true);
    try {
      await push(ref(db, `messages/${cid}`), { uid: authState.user.uid, text: text.slice(0, 500), read: false, createdAt: serverTimestamp() });
      await update(ref(db, `conversations/${cid}`), { lastText: text.slice(0, 80), lastAt: serverTimestamp(), [`unread_${other}`]: (chatState.conversations[cid]?.[`unread_${other}`] || 0) + 1 });
      $("#chatInput").value = "";
      set(ref(db, `typing/${cid}/${authState.user.uid}`), false);
    } catch (err) { toast(firebaseMsg(err), true); }
  };

  $("#likeBtn").onclick = async () => {
    const blockSnap = await get(ref(db, `blocks/${authState.user.uid}/${other}`));
    if (blockSnap.exists()) return toast("Bu kullanıcıyı engelledin.", true);
    await push(ref(db, `messages/${cid}`), { uid: authState.user.uid, text: "", like: true, read: false, createdAt: serverTimestamp() });
    await update(ref(db, `conversations/${cid}`), { lastText: "❤️", lastAt: serverTimestamp(), [`unread_${other}`]: (chatState.conversations[cid]?.[`unread_${other}`] || 0) + 1 });
  };

  $("#chatInput").oninput = () => {
    set(ref(db, `typing/${cid}/${authState.user.uid}`), true);
    clearTimeout(chatState.typingTimer);
    chatState.typingTimer = setTimeout(() => set(ref(db, `typing/${cid}/${authState.user.uid}`), false), 2000);
  };
}

async function blockUser(uid, name) {
  if (!confirm(`${name || "Bu kullanıcı"} engellenecek. Emin misin?`)) return;
  try {
    await set(ref(db, `blocks/${authState.user.uid}/${uid}`), { at: serverTimestamp() });
    $("#chatMenuDropdown").classList.add("hidden");
    toast("Kullanıcı engellendi.");
    chatState.activeChat = null;
    $("#chatPanel").innerHTML = '<div class="chat-empty-full"><div class="chat-empty-icon">◌</div><p>Bir sohbet seç</p></div>';
    renderConversations();
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
                                      
