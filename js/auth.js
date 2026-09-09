// NEXCPM — Kimlik doğrulama ve kullanıcı yönetimi
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { ref, set, get, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";
import { $, toast, syntheticEmail, avatar, firebaseMsg } from "./utils.js";

export const authState = { user: null, profile: null, loginMode: true, isAdmin: false };

export function renderAuth() {
  $("#authTitle").textContent = authState.loginMode ? "Hoş geldin." : "Hesap oluştur.";
  $("#authSub").textContent = authState.loginMode
    ? "E-posta yok. Sadece kullanıcı adı ve şifre."
    : "Kullanıcı adını seç, e-postasız hesabını oluştur.";
  $("#authSubmit").textContent = authState.loginMode ? "Giriş Yap" : "Kayıt Ol";
  $("#toggleAuth").textContent = authState.loginMode
    ? "Hesabın yok mu? Kayıt ol"
    : "Zaten hesabın var mı? Giriş yap";
}

export function initAuth(onReady) {
  renderAuth();
  $("#toggleAuth").onclick = () => { authState.loginMode = !authState.loginMode; renderAuth(); };

  $("#authForm").onsubmit = async (e) => {
    e.preventDefault();
    const u = $("#username").value.trim();
    const p = $("#password").value;
    const btn = $("#authSubmit");

    if (!u || !p) {
      toast("Kullanıcı adı ve şifre gerekli.", true);
      return;
    }

    btn.disabled = true;
    btn.textContent = authState.loginMode ? "Giriş yapılıyor…" : "Hesap oluşturuluyor…";

    try {
      const email = syntheticEmail(u);

      if (authState.loginMode) {
        // GİRİŞ
        await signInWithEmailAndPassword(auth, email, p);
        toast("Giriş yapıldı ✓");
      } else {
        // KAYIT
        const cred = await createUserWithEmailAndPassword(auth, email, p);
        await set(ref(db, `users/${cred.user.uid}`), {
          username: u,
          isAdmin: false,
          banned: false,
          createdAt: serverTimestamp()
        });
        toast("Hesabın oluşturuldu ✓");
      }
    } catch (err) {
      console.error("Auth hatası:", err);
      toast(firebaseMsg(err), true);
    } finally {
      btn.disabled = false;
      renderAuth();
    }
  };

  onAuthStateChanged(auth, async (user) => {
    authState.user = user;

    if (user) {
      try {
        const snap = await get(ref(db, `users/${user.uid}`));

        if (snap.exists()) {
          authState.profile = snap.val();
        } else {
          // Profil yoksa oluştur
          const username = user.email.split("@")[0];
          authState.profile = { username, isAdmin: false, banned: false };
          await set(ref(db, `users/${user.uid}`), {
            username,
            isAdmin: false,
            banned: false,
            createdAt: serverTimestamp()
          });
        }

        // Ban kontrolü
        if (authState.profile.banned) {
          await signOut(auth);
          toast("Hesabın engellendi.", true);
          return;
        }

        // Admin kontrolü - Firebase'den isAdmin alanı
        authState.isAdmin = authState.profile.isAdmin === true;

        // UI güncelle
        $("#headerUser").textContent = authState.profile.username;
        $("#headerAvatar").textContent = avatar(authState.profile.username);
        $("#profileBtn").classList.remove("hidden");
        document.body.classList.add("logged-in");

      } catch (err) {
        console.error("Profil hatası:", err);
      }
    } else {
      authState.profile = null;
      authState.isAdmin = false;
      $("#headerUser").textContent = "Giriş";
      $("#headerAvatar").textContent = "?";
      $("#profileBtn").classList.add("hidden");
      document.body.classList.remove("logged-in");
    }

    onReady(user);
  });
}

export async function logout() {
  try {
    await signOut(auth);
    toast("Çıkış yapıldı.");
  } catch (e) {
    toast(firebaseMsg(e), true);
  }
}