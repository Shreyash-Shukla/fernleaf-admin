'use client';

import React, { useState } from 'react';
import { Info, HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

export interface CalculationInfoProps {
  title: string;
  role: 'Admin' | 'Kitchen' | 'Dispatch' | 'Driver';
  whyNeeded: string;
  formula: string;
  whichOrdersCount: string;
  dateGrouping: string;
  exclusionsAndMissing: string;
}

export function CalculationInfo({
  title,
  role,
  whyNeeded,
  formula,
  whichOrdersCount,
  dateGrouping,
  exclusionsAndMissing,
}: CalculationInfoProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="p-1 rounded-full text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 transition-colors focus:outline-none"
        title="View calculation formula & logic"
        aria-label={`Calculation details for ${title}`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100 p-5">
          <DialogHeader className="pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                {role} Metric
              </Badge>
              <DialogTitle className="text-base font-bold text-white">
                {title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-400 mt-1">
              Exact formula and calculation specification for transparency and auditability.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs pt-2">
            <div>
              <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px] block mb-0.5">
                Why this role needs it
              </span>
              <p className="text-slate-300 leading-relaxed">{whyNeeded}</p>
            </div>

            <div>
              <span className="font-semibold text-sky-400 uppercase tracking-wider text-[10px] block mb-0.5">
                Exact Formula / Logic
              </span>
              <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-200 border border-slate-800 overflow-x-auto">
                {formula}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">
                  Which Orders Count
                </span>
                <p className="text-slate-300 text-[11px]">{whichOrdersCount}</p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">
                  Date Basis
                </span>
                <p className="text-slate-300 text-[11px]">{dateGrouping}</p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="font-semibold text-amber-400 uppercase tracking-wider text-[10px] block mb-0.5">
                Exclusions & Missing Data Handling
              </span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {exclusionsAndMissing}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
