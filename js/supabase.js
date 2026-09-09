// NEXCPM — Supabase (Sadece fotoğraf yükleme)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://mutynjtvdpsjspwilouv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11dHluanR2ZHBzanNwd2lsb3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MTY0NTcsImV4cCI6MjEwNDM5MjQ1N30.iHU-u63OeX7hZ8tXYuPfBd1z45Xbq5QwhDN1ydh0Qpg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const BUCKET = "nex";

export async function uploadListingImage(userId, listingId, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "");
  const path = `${userId}/${listingId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) {
    console.error("Supabase hatası:", error);
    throw new Error("Fotoğraf yüklenemedi: " + error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
