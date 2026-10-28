'use client';

import React, { useState, useEffect } from 'react';
import { allSheets } from '@/data/curriculum';
import { StudentProgress, CurriculumSheet } from '@/types/curriculum';
import { Navbar } from '@/components/Navbar';
import { ProgramSelector } from '@/components/ProgramSelector';
import { ProgramDashboard } from '@/components/ProgramDashboard';
import { MarksheetModal } from '@/components/MarksheetModal';

export default function Home() {
  const [activeSheetName, setActiveSheetName] = useState<string | null>(null);
  const [isMarksheetModalOpen, setIsMarksheetModalOpen] = useState(false);
  const [marksheetModalSem, setMarksheetModalSem] = useState<number>(6);
  const [progressState, setProgressState] = useState<Record<string, StudentProgress>>({});
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Load last opened curriculum if available
    const last = localStorage.getItem('sec_last_curriculum');
    if (last && allSheets.some((s) => s.sheet_name === last)) {
      // Optional: don't force jump, but allow it
    }
  }, []);

  const getStorageKey = (sheetName: string) => `sec_progress_${sheetName}`;

  const defaultProgress: StudentProgress = { mode: 'regular', courses: {}, semesters: {} };

  const getProgressForSheet = (sheetName: string): StudentProgress => {
    if (progressState[sheetName]) return progressState[sheetName];
    if (typeof window === 'undefined') return defaultProgress;

    try {
      const raw = localStorage.getItem(getStorageKey(sheetName));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.courses) {
          delete parsed.courses['NA'];
          delete parsed.courses['-'];
          delete parsed.courses[''];
          delete parsed.courses['XXXXXX_19XXXXX'];
          Object.keys(parsed.courses).forEach((k) => {
            if (parsed.courses[k]?.status === 'in_progress') delete parsed.courses[k];
          });
        }
        return parsed as StudentProgress;
      }
    } catch (e) {
      console.error('Error loading progress:', e);
    }
    return defaultProgress;
  };

  const handleUpdateProgress = (sheetName: string, updated: StudentProgress) => {
    setProgressState((prev) => ({ ...prev, [sheetName]: updated }));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(getStorageKey(sheetName), JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving progress:', e);
      }
    }
  };

  const handleSelectSheet = (sheetName: string) => {
    setActiveSheetName(sheetName);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sec_last_curriculum', sheetName);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGoToSelector = () => {
    setActiveSheetName(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenMarksheetModalForSem = (semNum: number | null) => {
    setMarksheetModalSem(semNum || 6);
    setIsMarksheetModalOpen(true);
  };

  const activeSheet: CurriculumSheet =
    allSheets.find((s) => s.sheet_name === activeSheetName) || allSheets[0];

  const currentProgress = activeSheetName ? getProgressForSheet(activeSheetName) : defaultProgress;

  return (
    <>
      <Navbar
        currentSheetName={activeSheetName}
        onGoToSelector={handleGoToSelector}
        onOpenMarksheetModal={() => handleOpenMarksheetModalForSem(null)}
        onQuickOpen={handleSelectSheet}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {!activeSheetName ? (
          <ProgramSelector
            allSheets={allSheets}
            onSelectSheet={handleSelectSheet}
            getProgressForSheet={getProgressForSheet}
          />
        ) : (
          <ProgramDashboard
            currentSheet={activeSheet}
            allSheets={allSheets}
            onGoToSelector={handleGoToSelector}
            onSelectSheet={handleSelectSheet}
            onOpenMarksheetModalForSem={handleOpenMarksheetModalForSem}
            progress={currentProgress}
            onUpdateProgress={handleUpdateProgress}
          />
        )}
      </main>

      <footer className="bg-[#FAF7F0] border-t-2 border-[#18181B] py-8 mt-12 text-center text-xs text-zinc-600 no-print">
        <div className="max-w-7xl mx-auto px-4 space-y-1.5 font-medium">
          <p className="font-heading font-bold text-[#18181B] text-sm">
            Saveetha Engineering College (Autonomous) • Learners UG Curriculum Dashboard
          </p>
          <p>
            Next.js App Router Edition • Official Curriculum Release: February 2025 • Student Progress Tracker
          </p>
        </div>
      </footer>

      {isClient && (
        <MarksheetModal
          isOpen={isMarksheetModalOpen}
          onClose={() => setIsMarksheetModalOpen(false)}
          allSheets={allSheets}
          currentSheet={activeSheet}
          onSelectSheet={handleSelectSheet}
          progress={currentProgress}
          onUpdateProgress={handleUpdateProgress}
          initialSemester={marksheetModalSem}
        />
      )}
    </>
  );
}
