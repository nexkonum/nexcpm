# NEXCPM — Car Parking Multiplayer İlan Pazarı

Siyah-beyaz, premium ilan platformu. Vanilla JS + Firebase + Supabase Storage.

## Yeni Özellikler
- İlan formu sadeleştirildi: **İsim + Açıklama + 1 fotoğraf**
- **Günlük 1 ilan hakkı** — reklam izleyerek +1 hak kazanılır
- **Küçük reklam banneri** — girişten 45sn sonra ve 2 dakikada bir gösterilir
- Giriş sonrası otomatik ana menüye yönlendirme

## Dosya yapısı
- `index.html` — tek sayfa uygulama
- `css/style.css` — tüm stiller
- `js/` — ES modülleri

## Kurulum
1. Firebase Console → Authentication → Email/Password: **Açık**
2. Realtime Database oluştur, `database.rules.json` içeriğini yapıştır
3. Supabase → Storage → `listing-images` adında **public** bucket oluştur
4. `js/firebase.js` içindeki config'i kendi projenle değiştir
5. `js/firebase.js` içindeki `ADMIN_UIDS` listesine kendi Firebase UID'ni ekle
6. Siteyi statik hosta yükle (Cloudflare Pages, Netlify, Firebase Hosting…)

## Güvenlik
- Supabase **Secret Key hiçbir yerde kullanılmaz**, yalnızca Publishable Key.
- Fotoğraflar Supabase Storage'a yüklenir; Firebase'e yalnızca public URL kaydedilir.
- Asıl erişim kontrolü Firebase Security Rules ile sağlanır.