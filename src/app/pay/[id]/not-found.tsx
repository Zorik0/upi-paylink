import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Payment link not found</h1>
      <p className="mt-2 text-sm text-slate-500">
        This link doesn&apos;t exist. Ask the sender to share it again.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
      >
        Create a payment link
      </Link>
    </main>
  );
}
