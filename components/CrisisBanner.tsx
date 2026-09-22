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
    <div className="mx-auto my-4 max-w-2xl border border-rose-400/50 bg-rose-500/10 p-5 shadow-elevated backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-rose-500/15 p-2 text-rose-500">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="flex-1 text-card-foreground">
          <h3 className="text-base font-semibold text-rose-500">
            You Are Deeply Valued — Immediate Care & Support
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-card-foreground/80">
            Please know you do not have to walk through this intense pain alone.
            Free, confidential support from trained human crisis counselors is
            available right now, 24/7:
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a
              href="tel:988"
              className="flex items-center gap-2.5 border border-rose-400/40 bg-card px-3 py-2.5 text-sm font-medium text-rose-500 transition hover:bg-rose-500/10"
            >
              <Phone className="h-4 w-4 shrink-0 text-rose-500" />
              <div>
                <span className="font-semibold">Call or Text 988</span>
                <span className="block text-xs text-muted-foreground">
                  Suicide & Crisis Lifeline
                </span>
              </div>
            </a>

            <a
              href="sms:741741?body=HOME"
              className="flex items-center gap-2.5 border border-rose-400/40 bg-card px-3 py-2.5 text-sm font-medium text-rose-500 transition hover:bg-rose-500/10"
            >
              <Heart className="h-4 w-4 shrink-0 text-rose-500" />
              <div>
                <span className="font-semibold">Text HOME to 741741</span>
                <span className="block text-xs text-muted-foreground">
                  Crisis Text Line (24/7)
                </span>
              </div>
            </a>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Pastor Mike is an AI companion and cannot provide medical or
            emergency intervention. If you or someone you know is in immediate
            physical danger, please call your local emergency services (e.g.
            911).
          </p>
        </div>
      </div>
    </div>
  );
};
