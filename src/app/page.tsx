import CreateLinkForm from "@/components/CreateLinkForm";
import { InstallPrompt } from "@/components/Pwa";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">UPI PayLink</h1>
        <p className="mt-1 text-sm text-slate-500">
          Scan any UPI QR, set the amount, and share a link anyone can pay with a tap.
        </p>
      </header>
      <InstallPrompt />
      <CreateLinkForm />
    </main>
  );
}
