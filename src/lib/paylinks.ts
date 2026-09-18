import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { UpiPayee } from "./upi";

export type AmountMode = "fixed" | "max";

/** Plain, serializable shape passed from the server page to client components. */
export interface PayLink extends UpiPayee {
  id: string;
  /** "fixed": payer must pay exactly amountPaise. "max": payer picks up to amountPaise. */
  mode: AmountMode;
  amountPaise: number;
  note: string;
}

const COLLECTION = "paylinks";

export async function createPayLink(input: Omit<PayLink, "id">): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    pa: input.pa,
    pn: input.pn,
    extra: input.extra,
    mode: input.mode,
    amountPaise: input.amountPaise,
    note: input.note,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getPayLink(id: string): Promise<PayLink | null> {
  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) return null;
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    pa: d.pa,
    pn: d.pn ?? "",
    extra: d.extra ?? {},
    mode: d.mode,
    amountPaise: d.amountPaise,
    note: d.note ?? "",
  };
}
