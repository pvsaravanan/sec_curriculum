'use client';

import React, { useState, useEffect } from 'react';
import {
  FileUp,
  UploadCloud,
  Loader,
  AlertCircle,
  
  Check,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  CurriculumSheet,
  MarksheetResult,
  StudentProgress,
} from '@/types/curriculum';
import { matchCourse, resolveTargetSheet as pickTargetSheet, CourseMatch, MatchSource } from '@/lib/courseMatcher';

interface MarksheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  allSheets: CurriculumSheet[];
  currentSheet: CurriculumSheet;
  onSelectSheet: (sheetName: string) => void;
  progress: StudentProgress;
  onUpdateProgress: (sheetName: string, updated: StudentProgress) => void;
  initialSemester?: number;
}

const GRADE_POINTS: Record<string, number> = {
  O: 10,
  'A+': 9,
  A: 8,
  'B+': 7,
  B: 6,
  C: 5,
  P: 5,
};

const CATEGORY_MAP: Record<string, { name: string; bg: string }> = {
  HS: { name: 'Humanities & Social Sciences', bg: 'bg-[#7C3AED] text-white' },
  BS: { name: 'Basic Sciences', bg: 'bg-[#2563EB] text-white' },
  ES: { name: 'Engineering Sciences', bg: 'bg-[#0284C7] text-white' },
  PC: { name: 'Professional Core', bg: 'bg-[#18181B] text-white' },
  PE: { name: 'Professional Electives', bg: 'bg-[#D97706] text-white' },
  OE: { name: 'Open Elective (8)', bg: 'bg-[#10B981] text-white' },
  OL: { name: 'Online Course (4)', bg: 'bg-[#0284C7] text-white' },
  EEC: { name: 'Employability Enhancement', bg: 'bg-[#E11D48] text-white' },
  MC: { name: 'Mandatory Non-Credit', bg: 'bg-[#4B5563] text-white' },
  Minor: { name: 'Minor Specialization', bg: 'bg-[#9333EA] text-white' },
  Online: { name: 'Online Courses (4)', bg: 'bg-[#0284C7] text-white' },
};

export const MarksheetModal: React.FC<MarksheetModalProps> = ({
  isOpen,
  onClose,
  allSheets,
  currentSheet,
  onSelectSheet,
  progress,
  onUpdateProgress,
  initialSemester = 6,
}) => {
  const [selectedSemester, setSelectedSemester] = useState<number>(initialSemester);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inferredData, setInferredData] = useState<MarksheetResult | null>(null);
  const [targetSheet, setTargetSheet] = useState<CurriculumSheet>(currentSheet);
  const [accumulateProgress, setAccumulateProgress] = useState(true);
  const [isReplacing, setIsReplacing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedSemester(initialSemester);
    setInferredData(null);
    setErrorMessage(null);
    setIsLoading(false);
    setIsReplacing(false);
    setTargetSheet(currentSheet);
  }, [isOpen, initialSemester]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleSelectSemester = (s: number) => {
    if (s === selectedSemester) return;
    setSelectedSemester(s);
    setInferredData(null);
    setErrorMessage(null);
    setIsReplacing(false);
  };

  const savedSemester = progress.semesters?.[selectedSemester];
  const showSaved = !!savedSemester?.uploaded && !inferredData && !isLoading && !isReplacing;
  const savedPassed = (savedSemester?.courses || []).filter((m) => m.is_pass);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('bg-[#FFF1F2]', 'border-[#FF5A5F]');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('bg-[#FFF1F2]', 'border-[#FF5A5F]');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('bg-[#FFF1F2]', 'border-[#FF5A5F]');
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please select or drop a valid PDF marksheet file.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    // Auto-detect semester from file name
    const fname = file.name.toLowerCase();
    for (let s = 1; s <= 8; s++) {
      if (
        fname.includes(`${s}th`) ||
        fname.includes(`sem ${s}`) ||
        fname.includes(`sem-${s}`) ||
        fname.includes(`sem${s}`)
      ) {
        setSelectedSemester(s);
        break;
      }
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/parse-marksheet', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.details || `Server error ${res.status}`);
      }

      const data: MarksheetResult = await res.json();
      if (!data.courses || data.courses.length === 0) {
        throw new Error('No course rows could be detected in PDF.');
      }

      resolveTargetSheet(data);
      setInferredData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse marksheet';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const resolveTargetSheet = (data: MarksheetResult) => {
    setTargetSheet(pickTargetSheet(data, allSheets, currentSheet).sheet);
  };

  const computeSGPA = (courses: MarksheetResult['courses']) => {
    let graded = 0;
    let points = 0;
    courses.forEach((m) => {
      const cr = parseFloat(m.credits) || 0;
      if (m.grade && GRADE_POINTS[m.grade] !== undefined && cr > 0) {
        graded += cr;
        points += cr * GRADE_POINTS[m.grade];
      }
    });
    return graded > 0 ? (points / graded).toFixed(2) : '-';
  };

  const passedCredits = (courses: MarksheetResult['courses']) =>
    courses.reduce((sum, m) => sum + (m.is_pass ? parseFloat(m.credits) || 0 : 0), 0);

  const pools = {
    target: targetSheet,
    openElectives: allSheets.find((s) => s.sheet_type === 'open_electives'),
    online: allSheets.find((s) => s.sheet_type === 'online_courses'),
  };
  const matchRows: (CourseMatch | null)[] = inferredData ? inferredData.courses.map((m) => matchCourse(m, pools)) : [];
  const unmatchedCount = matchRows.filter((r) => !r).length;

  const handleApply = () => {
    if (!inferredData) return;

    if (currentSheet.sheet_name !== targetSheet.sheet_name) {
      onSelectSheet(targetSheet.sheet_name);
    }

    const updatedProg: StudentProgress = accumulateProgress
      ? { ...progress, courses: { ...progress.courses }, semesters: { ...(progress.semesters || {}) } }
      : { mode: 'regular', courses: {}, semesters: {} };

    const sgpaVal = computeSGPA(inferredData.courses);

    if (!updatedProg.semesters) updatedProg.semesters = {};
    updatedProg.semesters[selectedSemester] = {
      uploaded: true,
      session: inferredData.student_info.exam_session || 'End Semester Examination',
      credits: inferredData.student_info.total_completed || passedCredits(inferredData.courses),
      sgpa: sgpaVal,
      courses: inferredData.courses,
    };

    inferredData.courses.forEach((m) => {
      if (!m.is_pass) return;
      const hit = matchCourse(m, pools);
      if (!hit) return;
      updatedProg.courses[hit.course.id] = {
        status: 'completed',
        grade: m.grade || 'A',
        semester: selectedSemester,
      };
    });

    onUpdateProgress(targetSheet.sheet_name, updatedProg);

    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-[#FAF7F0] border-2 border-[#18181B] shadow-brutal-xl rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
        
        {/* Modal Header */}
        <div className="p-5 bg-white border-b-2 border-[#18181B] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-[#FF5A5F] border-2 border-[#18181B] shadow-brutal-sm flex items-center justify-center text-white">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-lg text-[#18181B] leading-tight">
                Upload Semester Marksheet
              </h3>
              <p className="text-xs text-zinc-600 font-medium">
                Infers passed courses, grades & credits directly from your official SEC marksheet PDF
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white border-2 border-[#18181B] shadow-brutal-sm flex items-center justify-center text-[#18181B] hover:bg-rose-100 transition-all cursor-pointer font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          
          {/* Step 0: Semester Target Selection */}
          <div className="bg-white p-3.5 rounded-xl border-2 border-[#18181B] shadow-brutal-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-heading font-extrabold text-xs uppercase tracking-wider text-[#18181B]">
                Assign Marksheet To Semester:
              </span>
              <span className="text-3xs font-bold px-2 py-0.5 rounded-md bg-[#FAF7F0] border border-[#18181B] text-[#18181B]">
                Semester {selectedSemester} Selected
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSelectSemester(s)}
                  className={`py-1.5 px-1 rounded-md text-xs font-heading font-bold border-2 border-[#18181B] transition-all cursor-pointer text-center ${
                    s === selectedSemester
                      ? 'bg-[#FF5A5F] text-white shadow-none'
                      : 'bg-white text-[#18181B] shadow-brutal-sm hover:bg-zinc-100'
                  }`}
                >
                  Sem {s}
                </button>
              ))}
            </div>
          </div>

          {/* Step 1: Upload Dropzone Area */}
          {showSaved && (
            <div className="bg-white rounded-xl border-2 border-[#18181B] shadow-brutal overflow-hidden animate-fadeIn">
              <div className="p-3 bg-[#FAF7F0] border-b-2 border-[#18181B] flex flex-wrap items-center justify-between gap-2">
                <span className="font-heading font-extrabold text-xs text-[#18181B]">
                  Semester {selectedSemester} - Completed Courses ({savedPassed.length})
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-2xs font-heading font-extrabold px-2 py-0.5 rounded-md bg-[#10B981] text-white border border-[#18181B]">
                    {savedSemester?.credits || 0} Credits
                  </span>
                  <span className="text-2xs font-heading font-extrabold px-2 py-0.5 rounded-md bg-[#FF5A5F] text-white border border-[#18181B]">
                    SGPA: {savedSemester?.sgpa || '-'}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto custom-scrollbar max-h-72">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-white border-b border-zinc-200 text-3xs font-heading font-extrabold uppercase text-zinc-500">
                      <th className="py-2 px-3">Code</th>
                      <th className="py-2 px-3">Course Title</th>
                      <th className="py-2 px-2 text-center">Grade</th>
                      <th className="py-2 px-2 text-center">Credits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-semibold">
                    {savedPassed.map((m, i) => (
                      <tr key={`${m.course_code}-${i}`} className="hover:bg-[#FAF7F0] transition-colors">
                        <td className="py-2.5 px-3 font-mono text-2xs font-bold text-[#18181B]">{m.course_code || '-'}</td>
                        <td className="py-2.5 px-3 font-heading font-bold text-[#18181B] whitespace-normal break-words min-w-[14rem]">{m.course_title || m.raw_course}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-md font-heading font-bold text-xs bg-[#10B981] text-white border border-[#18181B]">
                            {m.grade || 'Pass'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-xs">{m.credits || '-'}</td>
                      </tr>
                    ))}
                    {savedPassed.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-zinc-500">No completed courses recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t-2 border-[#18181B] flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsReplacing(true)}
                  className="px-4 py-2 bg-white text-[#18181B] font-heading font-bold text-xs rounded-lg border-2 border-[#18181B] shadow-brutal-sm hover:bg-zinc-100 transition-all cursor-pointer"
                >
                  Upload New Marksheet to Replace
                </button>
              </div>
            </div>
          )}

          {!showSaved && !inferredData && !isLoading && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('marksheetInput')?.click()}
              className="border-2 border-dashed border-[#18181B] bg-white rounded-xl p-8 text-center space-y-4 hover:bg-[#FAF7F0] transition-colors cursor-pointer shadow-brutal-sm"
            >
              <input
                type="file"
                id="marksheetInput"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileInput}
              />
              <div className="w-14 h-14 mx-auto rounded-xl bg-[#FAF7F0] border-2 border-[#18181B] shadow-brutal-sm flex items-center justify-center text-[#18181B]">
                <UploadCloud className="w-7 h-7 text-[#FF5A5F]" />
              </div>
              <div className="space-y-1">
                <p className="font-heading font-extrabold text-base text-[#18181B]">
                  Drop your semester marksheet PDF here
                </p>
                <p className="text-xs text-zinc-600 font-medium">
                  Supports official Saveetha Engineering College End Semester PDFs
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById('marksheetInput')?.click();
                  }}
                  className="px-5 py-2.5 bg-[#FF5A5F] hover:bg-[#E04A4E] text-white font-heading font-extrabold text-xs rounded-lg border-2 border-[#18181B] shadow-brutal-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-pointer"
                >
                  Browse PDF File
                </button>
              </div>
            </div>
          )}

          {/* Error Message Card */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border-2 border-[#E11D48] rounded-xl text-xs space-y-2">
              <div className="flex items-center gap-2 font-heading font-bold text-[#E11D48]">
                <AlertCircle className="w-4 h-4" />
                <span>Marksheet Parsing Error</span>
              </div>
              <p className="text-zinc-700 font-medium">{errorMessage}</p>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="px-3 py-1 bg-white border border-[#E11D48] text-[#E11D48] rounded font-bold hover:bg-rose-100 transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-lg bg-[#FF5A5F] border-2 border-[#18181B] shadow-brutal-sm flex items-center justify-center text-white animate-bounce">
                <Loader className="w-6 h-6 animate-spin" />
              </div>
              <p className="font-heading font-extrabold text-base text-[#18181B]">
                Parsing marksheet & inferring course results...
              </p>
              <p className="text-xs text-zinc-600">
                Extracting course codes, grades, credits, and matching against curriculum
              </p>
            </div>
          )}

          {/* Inference Results Review Area */}
          {inferredData && !isLoading && (
            <div className="space-y-5 animate-fadeIn">
              {/* Student Metadata Card */}
              <div className="bg-white rounded-xl p-4 sm:p-5 border-2 border-[#18181B] shadow-brutal space-y-3">
                <div className="flex items-center justify-between border-b-2 border-zinc-100 pb-2">
                  <span className="font-heading font-extrabold text-xs uppercase tracking-wider text-zinc-500">
                    Inferred Student Profile
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xs font-heading font-extrabold px-2.5 py-0.5 rounded-md bg-[#FF5A5F] text-white border border-[#18181B]">
                      Semester {selectedSemester}
                    </span>
                    <span className="text-2xs font-heading font-extrabold px-2.5 py-0.5 rounded-md bg-[#10B981] text-white border border-[#18181B]">
                      SGPA: {computeSGPA(inferredData.courses)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block text-2xs font-bold uppercase">Student Name</span>
                    <span className="font-heading font-black text-sm text-[#18181B]">
                      {inferredData.student_info.student_name || 'Student'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-2xs font-bold uppercase">Registration Number</span>
                    <span className="font-mono font-bold text-sm text-[#18181B]">
                      {inferredData.student_info.reg_no || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-2xs font-bold uppercase">Program</span>
                    <span className="font-bold text-xs text-[#18181B]">
                      {inferredData.student_info.program || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-2xs font-bold uppercase">Credits In Marksheet</span>
                    <span className="font-bold text-xs text-[#10B981]">
                      {inferredData.student_info.total_completed || 0} Credits Completed
                    </span>
                  </div>
                </div>
              </div>

              {/* Target Curriculum Banner */}
              <div className="p-3.5 bg-[#EFF6FF] border-2 border-[#18181B] rounded-xl shadow-brutal-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-heading font-extrabold text-[#18181B]">Target Curriculum:</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-[#18181B] text-[#18181B]">
                    {targetSheet.sheet_name}
                  </span>
                </div>
                <span className="text-2xs font-bold text-zinc-600">Auto-detected from program</span>
              </div>

              {inferredData.validation && !inferredData.validation.credits_match && (
                <div className="p-3 bg-amber-50 border-2 border-[#D97706] rounded-xl text-xs font-semibold text-[#92400E] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Detected courses add up to {inferredData.validation.parsed_credits} credits but the marksheet reports{' '}
                    {inferredData.validation.marksheet_credits}. A subject may be missing - please review the list below.
                  </span>
                </div>
              )}

              {/* Inferred Courses Table */}
              <div className="bg-white rounded-xl border-2 border-[#18181B] shadow-brutal overflow-hidden">
                <div className="p-3 bg-[#FAF7F0] border-b-2 border-[#18181B] flex items-center justify-between">
                  <span className="font-heading font-extrabold text-xs text-[#18181B]">
                    Courses Inferred ({inferredData.courses.length} detected)
                  </span>
                  <span className="text-2xs font-bold px-2 py-0.5 rounded-md bg-[#10B981] text-white border border-[#18181B]">
                    {unmatchedCount > 0 ? `${unmatchedCount} unmatched` : 'Ready to Apply'}
                  </span>
                </div>
                <div className="overflow-x-auto custom-scrollbar max-h-64">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-white border-b border-zinc-200 text-3xs font-heading font-extrabold uppercase text-zinc-500">
                        <th className="py-2 px-3">Code</th>
                        <th className="py-2 px-3">Course Title</th>
                        <th className="py-2 px-2 text-center">Grade</th>
                        <th className="py-2 px-2 text-center">Credits</th>
                        <th className="py-2 px-2">Category</th>
                        <th className="py-2 px-3">Match Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-semibold">
                      {inferredData.courses.map((m, i) => {
                        const hit = matchRows[i];
                        const cat = hit ? hit.course.category || 'PC' : '-';
                        const catMeta = CATEGORY_MAP[cat.split(' ')[0]] || { name: cat, bg: 'bg-zinc-200 text-zinc-600' };
                        const sourceLabel: Record<MatchSource, string> = {
                          curriculum: 'Curriculum',
                          open_elective: 'Open Elective',
                          online: 'Online Course',
                        };

                        return (
                          <tr key={`${m.course_code}-${i}`} className="hover:bg-[#FAF7F0] transition-colors">
                            <td className="py-2.5 px-3 font-mono text-2xs font-bold text-[#18181B]">
                              {m.course_code || '-'}
                            </td>
                            <td className="py-2.5 px-3 font-heading font-bold text-[#18181B] whitespace-normal break-words min-w-[14rem]">
                              {m.course_title || m.raw_course}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-md font-heading font-bold text-xs border border-[#18181B] ${m.is_pass ? 'bg-[#10B981] text-white' : 'bg-[#E11D48] text-white'}`}>
                                {m.grade || (m.is_pass ? 'Pass' : 'Fail')}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-xs">
                              {m.credits || '-'}
                            </td>
                            <td className="py-2.5 px-2">
                              <span className={`text-3xs font-heading font-extrabold px-1.5 py-0.5 rounded-md border border-[#18181B] ${catMeta.bg}`}>
                                {cat}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {!m.is_pass ? (
                                <span className="text-3xs font-bold px-2 py-0.5 rounded-md bg-rose-50 text-[#9F1239] border border-[#E11D48]">
                                  Not passed - skipped
                                </span>
                              ) : hit ? (
                                <span className="text-3xs font-bold px-2 py-0.5 rounded-md bg-[#ECFDF5] text-[#065F46] border border-[#10B981]" title={hit.method === 'code' ? 'Matched by course code' : hit.method === 'title' ? 'Matched by title' : `Similar title: ${hit.course.title}`}>
                                  {sourceLabel[hit.source]}
                                  {hit.method === 'code' ? ' ✓' : hit.method === 'title' ? ' (by title) ✓' : ` (~${Math.round(hit.score * 100)}%) ✓`}
                                </span>
                              ) : (
                                <span className="text-3xs font-bold px-2 py-0.5 rounded-md bg-amber-50 text-[#92400E] border border-[#D97706]">
                                  Not in curriculum
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Options & Action Buttons */}
              <div className="pt-2 space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold text-[#18181B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accumulateProgress}
                    onChange={(e) => setAccumulateProgress(e.target.checked)}
                    className="w-4 h-4 accent-[#FF5A5F] border-2 border-[#18181B]"
                  />
                  <span>Accumulate progress (keep existing completed courses from other semesters)</span>
                </label>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setInferredData(null)}
                    className="px-4 py-2.5 bg-white text-[#18181B] font-heading font-bold text-xs rounded-lg border-2 border-[#18181B] shadow-brutal-sm hover:bg-zinc-100 transition-all cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    className="px-6 py-2.5 bg-[#FF5A5F] hover:bg-[#E04A4E] text-white font-heading font-extrabold text-xs rounded-lg border-2 border-[#18181B] shadow-brutal hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-brutal-sm transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Apply to Curriculum & Track Progress</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
