"use client";

import { useCallback, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import QrScanner, { scanQrImage } from "./QrScanner";
import { createPayLink, type AmountMode } from "@/lib/paylinks";
import {
  formatInr,
  isValidVpa,
  MAX_AMOUNT_PAISE,
  MIN_AMOUNT_PAISE,
  parseAmountToPaise,
  parseUpiQr,
  type UpiPayee,
} from "@/lib/upi";

type Source = "idle" | "camera" | "manual";

export default function CreateLinkForm() {
  const [source, setSource] = useState<Source>("idle");
  const [payee, setPayee] = useState<UpiPayee | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualVpa, setManualVpa] = useState("");
  const [manualName, setManualName] = useState("");

  const [mode, setMode] = useState<AmountMode>("fixed");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);

  const handleDecoded = useCallback((text: string) => {
    const parsed = parseUpiQr(text);
    if (!parsed) {
      setScanError("That QR isn't a UPI payment QR. Try another one.");
      return false;
    }
    setScanError(null);
    setPayee(parsed);
    setSource("idle");
    return true;
  }, []);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setScanError(null);
    const text = await scanQrImage(file);
    if (!text) setScanError("No QR code found in that image.");
    else handleDecoded(text);
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const vpa = manualVpa.trim();
    if (!isValidVpa(vpa)) {
      setScanError("Enter a valid UPI ID, like name@okaxis.");
      return;
    }
    setScanError(null);
    setPayee({ pa: vpa, pn: manualName.trim().slice(0, 100), extra: {} });
    setSource("idle");
  }

  const amountPaise = parseAmountToPaise(amount);
  const amountError =
    amount === ""
      ? null
      : amountPaise === null
        ? "Enter a valid amount (up to 2 decimals)."
        : amountPaise < MIN_AMOUNT_PAISE
          ? `Minimum is ${formatInr(MIN_AMOUNT_PAISE)}.`
          : amountPaise > MAX_AMOUNT_PAISE
            ? `Maximum is ${formatInr(MAX_AMOUNT_PAISE)}.`
            : null;
  const canCreate = !!payee && amountPaise !== null && !amountError && !saving;

  async function create() {
    if (!payee || amountPaise === null) return;
    setSaving(true);
    setSaveError(null);
    try {
      const id = await createPayLink({
        ...payee,
        mode,
        amountPaise,
        note: note.trim().slice(0, 80),
      });
      setLink(`${window.location.origin}/pay/${id}`);
    } catch (err) {
      console.error(err);
      setSaveError("Couldn't create the link. Check your Firebase config and try again.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setPayee(null);
    setAmount("");
    setNote("");
    setMode("fixed");
    setLink(null);
    setCopied(false);
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (!link || !payee || amountPaise === null) return;
    const text =
      mode === "fixed"
        ? `Pay ${formatInr(amountPaise)} to ${payee.pn || payee.pa}`
        : `Pay up to ${formatInr(amountPaise)} to ${payee.pn || payee.pa}`;
    if (navigator.share) {
      await navigator.share({ title: "UPI payment link", text, url: link }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}: ${link}`)}`, "_blank");
    }
  }

  // Step 3: link created
  if (link && payee && amountPaise !== null) {
    return (
      <Card>
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
            ✓
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Payment link ready</h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "fixed" ? "Fixed amount" : "Up to"} {formatInr(amountPaise)} to{" "}
              {payee.pn || payee.pa}
            </p>
          </div>
          <div className="mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-3">
            <QRCodeSVG value={link} size={168} />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 pl-3">
            <span className="flex-1 truncate text-left font-mono text-sm text-slate-700">{link}</span>
            <button
              onClick={copy}
              className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={share}
              className="rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Share
            </button>
            <a
              href={link}
              target="_blank"
              className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open link
            </a>
          </div>
          <button onClick={reset} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Create another link
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step 1: get the payee */}
      <Card>
        <StepTitle n={1} title="Scan a UPI QR code" />
        {payee ? (
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700">
              {(payee.pn || payee.pa).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{payee.pn || "Unnamed payee"}</p>
              <p className="truncate font-mono text-sm text-slate-500">{payee.pa}</p>
            </div>
            <button
              onClick={() => setPayee(null)}
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Change
            </button>
          </div>
        ) : source === "camera" ? (
          <QrScanner onDecode={handleDecoded} onClose={() => setSource("idle")} />
        ) : source === "manual" ? (
          <form onSubmit={submitManual} className="space-y-3">
            <Input
              label="UPI ID"
              value={manualVpa}
              onChange={setManualVpa}
              placeholder="name@okaxis"
              autoCapitalize="none"
            />
            <Input label="Name (optional)" value={manualName} onChange={setManualName} placeholder="Payee name" />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSource("idle")}
                className="rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button className="rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
                Continue
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => {
                setScanError(null);
                setSource("camera");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <CameraIcon /> Scan with camera
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => fileInput.current?.click()}
                className="rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Upload QR image
              </button>
              <button
                onClick={() => {
                  setScanError(null);
                  setSource("manual");
                }}
                className="rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Enter UPI ID
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        )}
        {scanError && <p className="mt-3 text-sm text-red-600">{scanError}</p>}
      </Card>

      {/* Step 2: amount rules */}
      <Card className={payee ? "" : "pointer-events-none opacity-50"}>
        <StepTitle n={2} title="Set the amount" />
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {(
            [
              ["fixed", "Fixed amount"],
              ["max", "Up to a limit"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                mode === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mb-3 text-sm text-slate-500">
          {mode === "fixed"
            ? "The payer pays exactly this amount and can't change it."
            : "The payer enters any amount up to this limit."}
        </p>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {mode === "fixed" ? "Amount" : "Maximum amount"}
          </span>
          <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-slate-400">
            <span className="text-lg text-slate-400">₹</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0"
              className="w-full bg-transparent px-2 py-3 text-lg font-semibold text-slate-900 outline-none"
            />
          </div>
        </label>
        {amountError && <p className="mt-2 text-sm text-red-600">{amountError}</p>}
        <div className="mt-3">
          <Input label="Note (optional)" value={note} onChange={setNote} placeholder="e.g. Dinner split" maxLength={80} />
        </div>
      </Card>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}
      <button
        onClick={create}
        disabled={!canCreate}
        className="w-full rounded-2xl bg-emerald-600 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {saving ? "Creating link…" : "Create payment link"}
      </button>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition ${className}`}>
      {children}
    </section>
  );
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs text-white">
        {n}
      </span>
      {title}
    </h2>
  );
}

function Input({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-slate-400"
      />
    </label>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  );
}
