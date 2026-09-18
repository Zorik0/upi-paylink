"use client";

import { useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { PayLink } from "@/lib/paylinks";
import {
  buildUpiQuery,
  formatInr,
  MIN_AMOUNT_PAISE,
  parseAmountToPaise,
  UPI_APPS,
  upiAppLink,
  type Platform,
} from "@/lib/upi";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  return "desktop";
}

const noopSubscribe = () => () => {};

export default function PayClient({ link }: { link: PayLink }) {
  // null during SSR and hydration; resolved on the client.
  const platform = useSyncExternalStore<Platform | null>(noopSubscribe, detectPlatform, () => null);

  const [amountInput, setAmountInput] = useState("");
  const [showQr, setShowQr] = useState(false);

  const isFixed = link.mode === "fixed";
  const enteredPaise = parseAmountToPaise(amountInput);
  const amountPaise = isFixed ? link.amountPaise : enteredPaise;

  const amountError =
    isFixed || amountInput === ""
      ? null
      : enteredPaise === null
        ? "Enter a valid amount."
        : enteredPaise < MIN_AMOUNT_PAISE
          ? `Minimum is ${formatInr(MIN_AMOUNT_PAISE)}.`
          : enteredPaise > link.amountPaise
            ? `You can pay at most ${formatInr(link.amountPaise)}.`
            : null;

  const valid =
    amountPaise !== null && amountPaise >= MIN_AMOUNT_PAISE && amountPaise <= link.amountPaise;
  const query = valid ? buildUpiQuery(link, amountPaise, link.note || undefined) : null;
  const who = link.pn || link.pa;

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-xl font-semibold text-emerald-700">
          {who.charAt(0).toUpperCase()}
        </div>
        <p className="mt-3 text-sm text-slate-500">Paying</p>
        <h1 className="text-lg font-semibold text-slate-900">{who}</h1>
        <p className="font-mono text-sm text-slate-500">{link.pa}</p>

        {isFixed ? (
          <div className="mt-6">
            <p className="text-4xl font-bold tracking-tight text-slate-900">{formatInr(link.amountPaise)}</p>
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              <LockIcon /> Fixed amount
            </p>
          </div>
        ) : (
          <div className="mt-6 text-left">
            <label className="block">
              <span className="mb-1.5 flex justify-between text-sm font-medium text-slate-700">
                Enter amount
                <span className="text-slate-500">Max {formatInr(link.amountPaise)}</span>
              </span>
              <div className="flex items-center rounded-xl border border-slate-200 px-3 focus-within:border-slate-400">
                <span className="text-2xl text-slate-400">₹</span>
                <input
                  inputMode="decimal"
                  autoFocus
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0"
                  className="w-full bg-transparent px-2 py-3 text-2xl font-bold text-slate-900 outline-none"
                />
              </div>
            </label>
            {amountError && <p className="mt-2 text-sm text-red-600">{amountError}</p>}
          </div>
        )}

        {link.note && (
          <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">“{link.note}”</p>
        )}
      </section>

      {platform === "desktop" ? (
        <DesktopQr query={query} />
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Pay using</h2>
          <div className="grid grid-cols-2 gap-2">
            {UPI_APPS.map((app) => (
              <AppButton
                key={app.id}
                label={app.name}
                color={app.color}
                href={query && platform ? upiAppLink(app, query, platform) : null}
              />
            ))}
          </div>
          <AppButton
            label="Other UPI app"
            color="#0f172a"
            href={query && platform ? upiAppLink(null, query, platform) : null}
            wide
          />
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            className="mt-3 w-full text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            {showQr ? "Hide QR code" : "Paying from another phone? Show QR"}
          </button>
          {showQr && <DesktopQr query={query} bare />}
        </section>
      )}

      <p className="px-4 text-center text-xs text-slate-400">
        Always check the name and UPI ID in your UPI app before entering your PIN.
      </p>
    </div>
  );
}

function AppButton({
  label,
  color,
  href,
  wide,
}: {
  label: string;
  color: string;
  href: string | null;
  wide?: boolean;
}) {
  const className = `flex items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-semibold transition ${
    wide ? "mt-2 w-full" : ""
  }`;
  const dot = <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />;

  if (!href) {
    return (
      <span className={`${className} cursor-not-allowed border-slate-100 text-slate-300`} aria-disabled>
        {dot}
        {label}
      </span>
    );
  }
  return (
    <a href={href} className={`${className} border-slate-200 text-slate-800 hover:bg-slate-50 active:scale-[0.98]`}>
      {dot}
      {label}
    </a>
  );
}

function DesktopQr({ query, bare }: { query: string | null; bare?: boolean }) {
  const body = query ? (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <QRCodeSVG value={`upi://pay?${query}`} size={200} />
      </div>
      <p className="text-center text-sm text-slate-500">Scan with any UPI app on your phone</p>
    </div>
  ) : (
    <p className="text-center text-sm text-slate-400">Enter an amount to get the QR code.</p>
  );

  if (bare) return <div className="mt-4">{body}</div>;
  return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">{body}</section>;
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
