"use client";

import React from "react";
import { Phone, AlertCircle, Heart } from "lucide-react";
import { SafetyCheckResult } from "@/lib/ai/safety";

interface CrisisBannerProps {
  safety: SafetyCheckResult;
  onDismiss?: () => void;
}

export const CrisisBanner: React.FC<CrisisBannerProps> = ({ safety }) => {
  if (!safety.isCrisis) return null;

  return (
    <div className="mx-auto my-4 max-w-2xl rounded-2xl border border-rose-300 bg-rose-50/80 p-5 shadow-sm">
      <div className="flex items-start gap-3.5">
        <div className="rounded-xl bg-rose-100 p-2 text-rose-600 shrink-0">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="flex-1 text-[#1a1a1a]">
          <h3 className="text-base font-extrabold text-rose-700">
            You Are Deeply Valued — Immediate Care &amp; Support
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[#4b5563]">
            Please know you do not have to walk through this intense pain alone.
            Free, confidential support from trained human crisis counselors is
            available right now, 24/7:
          </p>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <a
              href="tel:988"
              className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-rose-700 shadow-2xs transition hover:bg-rose-50"
            >
              <Phone className="h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <span className="font-bold">Call or Text 988</span>
                <span className="block text-xs font-normal text-[#6b7280]">
                  Suicide &amp; Crisis Lifeline
                </span>
              </div>
            </a>

            <a
              href="sms:741741?body=HOME"
              className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-rose-700 shadow-2xs transition hover:bg-rose-50"
            >
              <Heart className="h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <span className="font-bold">Text HOME to 741741</span>
                <span className="block text-xs font-normal text-[#6b7280]">
                  Crisis Text Line (24/7)
                </span>
              </div>
            </a>
          </div>

          <p className="mt-3 text-xs text-[#6b7280]">
            Pastor Mike is an AI pastoral companion and cannot provide emergency medical intervention. If you or someone you know is in immediate physical danger, please call your local emergency services (e.g. 911).
          </p>
        </div>
      </div>
    </div>
  );
};
