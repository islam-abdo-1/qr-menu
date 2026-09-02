import "server-only";

/**
 * Supabase Storage REST API — يتجاوز @supabase/supabase-js
 * لتجنب خطأ "Invalid Compact JWS" مع مفاتيح sb_secret_* (صيغة جديدة).
 * يستخدم fetch مباشرة مع Bearer token.
 */

const BUCKET = "menu-images";

function baseUrl(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "")}/storage/v1`;
}

function serviceAuth(): string {
  return `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
}

function publicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function storageUpload(
  path: string,
  bytes: Buffer | Uint8Array,
  contentType: string,
  opts?: { upsert?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const ab = bytes instanceof ArrayBuffer ? bytes : new Uint8Array(bytes).buffer as ArrayBuffer;
  const res = await fetch(`${baseUrl()}/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: serviceAuth(),
      "Content-Type": contentType,
      ...(opts?.upsert ? { "x-upsert": "true" } : {}),
    },
    body: ab,
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `${res.status} ${body}` };
  }
  return { ok: true };
}

export async function storageDownload(path: string): Promise<{ ok: boolean; data?: Buffer; error?: string }> {
  const res = await fetch(`${baseUrl()}/object/${BUCKET}/${encodeURIComponent(path)}`, {
    method: "GET",
    headers: { Authorization: serviceAuth() },
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `${res.status} ${body}` };
  }
  const arr = await res.arrayBuffer();
  return { ok: true, data: Buffer.from(arr) };
}

export async function storageDelete(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const res = await fetch(`${baseUrl()}/object/${BUCKET}/${paths.join(",")}`, {
    method: "DELETE",
    headers: { Authorization: serviceAuth() },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[storage-delete]", res.status, body);
  }
}

export function storagePublicUrl(path: string): string {
  return publicUrl(path);
}
