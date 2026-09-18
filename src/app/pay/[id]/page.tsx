import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import PayClient from "@/components/PayClient";
import { getPayLink } from "@/lib/paylinks";
import { formatInr } from "@/lib/upi";

const loadLink = cache(getPayLink);

export async function generateMetadata(props: PageProps<"/pay/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const link = await loadLink(id);
  if (!link) return { title: "Payment link not found" };
  const who = link.pn || link.pa;
  const title =
    link.mode === "fixed"
      ? `Pay ${formatInr(link.amountPaise)} to ${who}`
      : `Pay up to ${formatInr(link.amountPaise)} to ${who}`;
  return {
    title,
    description: link.note || "Tap to pay with any UPI app.",
    openGraph: { title, description: link.note || "Tap to pay with any UPI app." },
  };
}

export default async function PayPage(props: PageProps<"/pay/[id]">) {
  const { id } = await props.params;
  const link = await loadLink(id);
  if (!link) notFound();

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <PayClient link={link} />
    </main>
  );
}
