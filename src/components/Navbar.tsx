'use client';

import React from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';

interface NavbarProps {
  currentSheetName: string | null;
  onGoToSelector: () => void;
  onOpenMarksheetModal: () => void;
  onQuickOpen: (sheetName: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onGoToSelector,
}) => {
  return (
    <header className="bg-[#FAF7F0] border-b-2 border-[#18181B] sticky top-0 z-40 no-print py-4 sm:py-5 px-2 sm:px-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer group" onClick={onGoToSelector}>
          <div className="w-12 h-12 relative shrink-0 group-hover:scale-105 transition-transform">
            <Image
              src="/saveetha_logo.png"
              alt="Saveetha Engineering College Logo"
              width={48}
              height={48}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-xl tracking-tight text-[#18181B]">
                SEC Curriculum
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-white border-2 border-[#18181B] text-[#18181B] shadow-brutal-sm">
                R19 & R24
              </span>
            </div>
            <p className="text-xs text-zinc-600 font-medium hidden sm:block">
              Flexible Choice Based Credit System (FCBCS)
            </p>
          </div>
        </div>

        {/* User Profile on the right */}
        <div className="flex items-center">
          <div
            className="w-10 h-10 rounded-full bg-white border-2 border-[#18181B] shadow-brutal-sm flex items-center justify-center text-[#18181B] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-pointer"
            title="Student Profile"
          >
            <User className="w-5 h-5 text-[#18181B]" />
          </div>
        </div>

      </div>
    </header>
  );
};
