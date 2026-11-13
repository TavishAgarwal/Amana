"use client";
// Mock counsellor sign-in (C1). A real deployment uses the national-ID provider with a counsellor role.
import { useEffect, useState } from "react";
export const COUNSELLORS = ["c-001", "c-002"];
export function useCounsellor(): [string, (c: string) => void] {
  const [c, setC] = useState("c-001");
  useEffect(() => { try { const v = localStorage.getItem("counsellor"); if (v && COUNSELLORS.includes(v)) setC(v); } catch { /* ignore */ } }, []);
  return [c, (v: string) => { setC(v); try { localStorage.setItem("counsellor", v); } catch { /* ignore */ } }];
}
