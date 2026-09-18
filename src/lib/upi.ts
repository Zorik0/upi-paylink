export interface UpiPayee {
  /** Payee VPA, e.g. merchant@okaxis */
  pa: string;
  /** Payee name */
  pn: string;
  /** Merchant params carried over from the scanned QR (mc, tr, tid, url) */
  extra: Record<string, string>;
}

export const VPA_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;

// Params worth preserving from a merchant QR. Amount, currency and signature
// params are dropped: the link creator sets the amount, which would invalidate
// any signature anyway.
const CARRIED_PARAMS = ["mc", "tr", "tid", "url"] as const;

export const MIN_AMOUNT_PAISE = 100; // ₹1
export const MAX_AMOUNT_PAISE = 100_000_00; // ₹1,00,000 — the common UPI per-transaction cap

export function isValidVpa(vpa: string) {
  return VPA_PATTERN.test(vpa);
}

/** Parses the text content of a UPI QR (upi://pay?... or an EMVCo/BharatQR payload). */
export function parseUpiQr(raw: string): UpiPayee | null {
  const text = raw.trim();
  if (/^upi:\/\//i.test(text)) return parseUpiUri(text);
  if (/^0002\d{2}/.test(text)) return parseEmvQr(text);
  return null;
}

function parseUpiUri(text: string): UpiPayee | null {
  const query = text.slice(text.indexOf("?") + 1);
  if (!text.includes("?")) return null;

  // Lower-case keys: some QR generators emit PA= / PN=.
  const params = new Map<string, string>();
  for (const [k, v] of new URLSearchParams(query)) params.set(k.toLowerCase(), v);

  const pa = params.get("pa")?.trim() ?? "";
  if (!isValidVpa(pa)) return null;

  const extra: Record<string, string> = {};
  for (const key of CARRIED_PARAMS) {
    const value = params.get(key);
    if (value) extra[key] = value.slice(0, 100);
  }

  return { pa, pn: (params.get("pn") ?? "").trim().slice(0, 100), extra };
}

function parseTlv(data: string): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i + 4 <= data.length) {
    const tag = data.slice(i, i + 2);
    const len = Number(data.slice(i + 2, i + 4));
    if (Number.isNaN(len)) break;
    out.set(tag, data.slice(i + 4, i + 4 + len));
    i += 4 + len;
  }
  return out;
}

function parseEmvQr(text: string): UpiPayee | null {
  const root = parseTlv(text);
  let pa = "";

  // Merchant account templates live in tags 26–51; UPI puts the VPA in one of them.
  for (let tag = 26; tag <= 51 && !pa; tag++) {
    const template = root.get(String(tag));
    if (!template) continue;
    for (const value of parseTlv(template).values()) {
      if (isValidVpa(value)) {
        pa = value;
        break;
      }
    }
  }
  if (!pa) return null;

  const extra: Record<string, string> = {};
  const mcc = root.get("52");
  if (mcc && mcc !== "0000") extra.mc = mcc;

  return { pa, pn: (root.get("59") ?? "").trim().slice(0, 100), extra };
}

export function paiseToAmountParam(paise: number) {
  return (paise / 100).toFixed(2);
}

/** Parses user input like "250" or "99.5" into paise, or null when malformed. */
export function parseAmountToPaise(input: string): number | null {
  const value = input.trim();
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(value)) return null;
  return Math.round(parseFloat(value) * 100);
}

export function formatInr(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

/** The query string shared by every UPI deep link (everything after "pay?"). */
export function buildUpiQuery(payee: UpiPayee, amountPaise: number, note?: string) {
  const params: [string, string][] = [["pa", payee.pa]];
  if (payee.pn) params.push(["pn", payee.pn]);
  for (const [k, v] of Object.entries(payee.extra)) params.push([k, v]);
  params.push(["am", paiseToAmountParam(amountPaise)], ["cu", "INR"]);
  if (note) params.push(["tn", note]);
  // encodeURIComponent (not URLSearchParams) so spaces become %20 — several
  // UPI apps show a literal "+" otherwise. Some apps also reject "%40" in the
  // VPA, so "@" stays literal.
  return params
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%40/g, "@")}`)
    .join("&");
}

export type Platform = "android" | "ios" | "desktop";

export interface UpiApp {
  id: string;
  name: string;
  /** Icon in /public/apps */
  logo: string;
  androidPackage: string;
  /** App-specific scheme prefix on iOS; the query is appended after "pay?". */
  iosPrefix?: string;
  /** Shown up front; the rest sit under "More UPI apps". */
  popular?: boolean;
}

const defineApp = (id: string, name: string, androidPackage: string, extra: Partial<UpiApp> = {}): UpiApp => ({
  id,
  name,
  logo: `/apps/${id}.webp`,
  androidPackage,
  ...extra,
});

export const UPI_APPS: UpiApp[] = [
  defineApp("gpay", "Google Pay", "com.google.android.apps.nbu.paisa.user", { iosPrefix: "gpay://upi/", popular: true }),
  defineApp("phonepe", "PhonePe", "com.phonepe.app", { iosPrefix: "phonepe://", popular: true }),
  defineApp("paytm", "Paytm", "net.one97.paytm", { iosPrefix: "paytmmp://", popular: true }),
  defineApp("bhim", "BHIM", "in.org.npci.upiapp", { popular: true }),
  defineApp("amazonpay", "Amazon Pay", "in.amazon.mShop.android.shopping"),
  defineApp("cred", "CRED", "com.dreamplug.androidapp"),
  defineApp("whatsapp", "WhatsApp", "com.whatsapp"),
  defineApp("supermoney", "super.money", "money.super.payments"),
  defineApp("navi", "Navi", "com.naviapp"),
  defineApp("mobikwik", "MobiKwik", "com.mobikwik_new"),
  defineApp("freecharge", "Freecharge", "com.freecharge.android"),
  defineApp("jupiter", "Jupiter", "money.jupiter"),
  defineApp("airtel", "Airtel Thanks", "com.myairtelapp"),
  defineApp("yono", "YONO SBI", "com.sbi.lotusintouch"),
  defineApp("imobile", "ICICI iMobile", "com.csam.icici.bank.imobile"),
  defineApp("payzapp", "HDFC PayZapp", "com.hdfcbank.payzapp"),
  defineApp("axis", "Axis open", "com.axis.mobile"),
  defineApp("kotak", "Kotak 811", "com.kotak811mobilebankingapp.instantsavingsupiscanandpayrecharge"),
  defineApp("bobworld", "bob World", "com.bankofbaroda.bobworlddmb"),
];

/**
 * Apps that can be targeted directly on this platform. iOS has no package
 * targeting, so only apps with a known URL scheme are listed there.
 */
export function appsForPlatform(platform: Platform) {
  return platform === "ios" ? UPI_APPS.filter((a) => a.iosPrefix) : UPI_APPS;
}

export function upiAppLink(app: UpiApp | null, query: string, platform: Platform) {
  if (app && platform === "android") {
    // An intent URL pins the payment to one app; Android opens the Play Store
    // listing if that app isn't installed.
    return `intent://pay?${query}#Intent;scheme=upi;package=${app.androidPackage};end`;
  }
  if (app && platform === "ios" && app.iosPrefix) {
    return `${app.iosPrefix}pay?${query}`;
  }
  return `upi://pay?${query}`;
}
