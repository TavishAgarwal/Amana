"use client";
import { use } from "react";
import { useCounsellor } from "@/lib/who";
import CaseDetail from "@/components/case";

export default function CaseView({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = use(params);
  const [who] = useCounsellor();
  return <CaseDetail locale={locale} id={id} counsellor={who} />;
}
