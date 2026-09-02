/**
 * خيارات كوكي الجلسة الموحدة — SEC-009:
 * `secure` صراحةً في كل البيئات: `true` في الإنتاج (HTTPS) و`false` محليًا (HTTP).
 */
export type SessionCookieOptions = {
  maxAge: number;
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
};

export function getSessionCookieOptions(maxAge: number): SessionCookieOptions {
  return {
    maxAge,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
