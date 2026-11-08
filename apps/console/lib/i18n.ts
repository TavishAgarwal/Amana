import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
export type Locale = "ar" | "en";
const M: Record<Locale, Record<string, string>> = { ar, en };
export const t = (l: string, k: string) => M[l === "ar" ? "ar" : "en"][k] ?? k;
export const dir = (l: string) => (l === "ar" ? "rtl" : "ltr");
