'use client';

import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Download,
  FileUp,
  Award,
  CheckCircle2,
  Sparkles,
  GraduationCap,
  BarChart2,
  ChevronDown,
  CheckCheck,
  BookmarkCheck,
  Search,
  Check,
  Circle,
} from 'lucide-react';
import { CurriculumSheet, Course, StudentProgress, CourseProgress } from '@/types/curriculum';
import { ChartsSection } from './ChartsSection';
import { courseMatchesQuery } from '@/lib/courseMatcher';

interface ProgramDashboardProps {
  currentSheet: CurriculumSheet;
  allSheets: CurriculumSheet[];
  onGoToSelector: () => void;
  onSelectSheet: (sheetName: string) => void;
  onOpenMarksheetModalForSem: (semNum: number | null) => void;
  progress: StudentProgress;
  onUpdateProgress: (sheetName: string, updated: StudentProgress) => void;
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
  OE: { name: 'Open Elective (8) + Online (4)', bg: 'bg-[#10B981] text-white' },
  OL: { name: 'Online Course (4)', bg: 'bg-[#0284C7] text-white' },
  EEC: { name: 'Employability Enhancement', bg: 'bg-[#E11D48] text-white' },
  MC: { name: 'Mandatory Non-Credit', bg: 'bg-[#4B5563] text-white' },
  Minor: { name: 'Minor Specialization', bg: 'bg-[#9333EA] text-white' },
  Online: { name: 'Online Courses (4)', bg: 'bg-[#0284C7] text-white' },
};

export const ProgramDashboard: React.FC<ProgramDashboardProps> = ({
  currentSheet,
  allSheets,
  onGoToSelector,
  onSelectSheet,
  onOpenMarksheetModalForSem,
  progress,
  onUpdateProgress,
}) => {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState('all');
  const [courseTypeFilter, setCourseTypeFilter] = useState('all');
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [areChartsVisible, setAreChartsVisible] = useState(false);

  // Active batch requirements
  const batchDict = currentSheet.batches || { Default: currentSheet.credit_requirements };
  const batchKeys = Object.keys(batchDict);
  const activeBatch = progress.batch && batchDict[progress.batch]
    ? progress.batch
    : currentSheet.active_batch || batchKeys[batchKeys.length - 1];

  const creditRequirements = batchDict[activeBatch] || currentSheet.credit_requirements;

  // Compute total target
  const isLateral = progress.mode === 'lateral';
  const totalReqObj = creditRequirements.find((r) => r.category === 'TOTAL');
  const targetCredits = totalReqObj
    ? isLateral
      ? totalReqObj.lateral_credits || 126
      : totalReqObj.regular_credits || 164
    : 164;

  // Load specialized elective sheets for cross-referencing
  const openElectivesSheet = useMemo(() => allSheets.find((s) => s.sheet_name === 'Open Electives'), [allSheets]);
  const onlineCoursesSheet = useMemo(() => allSheets.find((s) => s.sheet_name === 'Online Courses'), [allSheets]);
  const openElectiveCourses = useMemo(() => openElectivesSheet?.courses || [], [openElectivesSheet]);
  const onlineCourses = useMemo(() => onlineCoursesSheet?.courses || [], [onlineCoursesSheet]);

  // Compute earned credits and course counts
  const {
    earnedCredits,
    completedCount,
    pendingCount,
    earnedByCat,
    gradedCredits,
    weightedGradePoints,
  } = useMemo(() => {
    let earned = 0;
    let compCount = 0;
    let grCred = 0;
    let wPoints = 0;
    const byCat: Record<string, number> = {};

    // Check department courses, plus any marked courses from Open Electives (OE) and Online Courses (OL)
    const allTrackedCourses = [
      ...currentSheet.courses,
      ...openElectiveCourses.filter((c) => progress.courses[c.id]),
      ...onlineCourses.filter((c) => progress.courses[c.id]),
    ];

    allTrackedCourses.forEach((c) => {
      const p = progress.courses[c.id];
      const cr = c.total_credits || 0;
      if (p && p.status === 'completed') {
        earned += cr;
        compCount++;
        const mainCat = (c.category || 'PC').split(' ')[0];
        byCat[mainCat] = (byCat[mainCat] || 0) + cr;

        if (p.grade && GRADE_POINTS[p.grade] !== undefined) {
          grCred += cr;
          wPoints += cr * GRADE_POINTS[p.grade];
        }
      }
    });

    const totalCourses = currentSheet.courses.length;
    const pendCount = totalCourses - compCount;

    return {
      earnedCredits: earned,
      completedCount: compCount,
      pendingCount: pendCount,
      earnedByCat: byCat,
      gradedCredits: grCred,
      weightedGradePoints: wPoints,
    };
  }, [currentSheet, openElectiveCourses, onlineCourses, progress]);

  const creditPercent = targetCredits > 0 ? Math.min(100, Math.round((earnedCredits / targetCredits) * 100)) : 0;
  const remainingCredits = Math.max(0, targetCredits - earnedCredits);
  const estimatedCGPA = gradedCredits > 0 ? (weightedGradePoints / gradedCredits).toFixed(2) : '-';

  // Filtered courses for table
  const filteredCourses = useMemo(() => {
    let sourceCourses: Course[] = [];

    if (currentSheet.sheet_type === 'curriculum') {
      if (activeCategoryFilter === 'OE') {
        // When Open Elective is selected, display all 104 Open Elective courses!
        sourceCourses = [...openElectiveCourses, ...onlineCourses];
      } else if (activeCategoryFilter === 'OL') {
        // When Online Course is selected, display all 204 approved Online Courses!
        sourceCourses = onlineCourses;
      } else if (activeCategoryFilter === 'all') {
        // Department courses (filtering dummy XXXXXX placeholders)
        const deptCourses = currentSheet.courses.filter(
          (c) => !(c.code_2024 === 'XXXXXX' || c.code_2019 === '19XXXXX' || c.title.toLowerCase() === 'open electives' || c.title.toLowerCase() === 'online courses')
        );
        const markedOE = openElectiveCourses.filter((c) => progress.courses[c.id] && progress.courses[c.id].status !== 'none');
        const markedOL = onlineCourses.filter((c) => progress.courses[c.id] && progress.courses[c.id].status !== 'none');

        if (courseSearchQuery.trim()) {
          sourceCourses = [...deptCourses, ...openElectiveCourses, ...onlineCourses];
        } else {
          sourceCourses = [...deptCourses, ...markedOE, ...markedOL];
        }
      } else {
        sourceCourses = currentSheet.courses;
      }
    } else {
      sourceCourses = currentSheet.courses;
    }

    return sourceCourses.filter((c) => {
      const p = progress.courses[c.id] || { status: 'none' };

      // Category filter (if not already filtered by sourceCourses)
      if (activeCategoryFilter !== 'all' && activeCategoryFilter !== 'OE' && activeCategoryFilter !== 'OL') {
        const mainCat = (c.category || 'PC').split(' ')[0];
        if (mainCat !== activeCategoryFilter && c.category !== activeCategoryFilter) return false;
      }

      // Status filter
      if (activeStatusFilter === 'completed' && p.status !== 'completed') return false;
      if (activeStatusFilter === 'pending' && p.status && p.status !== 'none') return false;

      // Course Type
      if (courseTypeFilter !== 'all') {
        const ct = (c.course_type || '').toLowerCase();
        if (courseTypeFilter === 'theory' && !ct.includes('theory')) return false;
        if (courseTypeFilter === 'tip' && !ct.includes('tip') && !ct.includes('int')) return false;
        if (courseTypeFilter === 'practical' && !ct.includes('practical') && !ct.includes('lab')) return false;
      }

      if (!courseMatchesQuery(c, courseSearchQuery)) return false;

      return true;
    });
  }, [currentSheet, openElectiveCourses, onlineCourses, progress, activeCategoryFilter, activeStatusFilter, courseTypeFilter, courseSearchQuery]);

  // Actions
  const handleToggleCourse = (courseId: string) => {
    const cur = progress.courses[courseId] || { status: 'none' };
    let nextStatus: CourseProgress['status'] = 'completed';
    let nextGrade = cur.grade || 'A';

    if (cur.status === 'completed') {
      nextStatus = 'none';
      nextGrade = '';
    }

    const updated = {
      ...progress,
      courses: {
        ...progress.courses,
        [courseId]: { status: nextStatus, grade: nextGrade, semester: cur.semester },
      },
    };
    onUpdateProgress(currentSheet.sheet_name, updated);
  };

  const handleUpdateGrade = (courseId: string, grade: string) => {
    const cur = progress.courses[courseId] || { status: 'completed' };
    const updated = {
      ...progress,
      courses: {
        ...progress.courses,
        [courseId]: { ...cur, grade },
      },
    };
    onUpdateProgress(currentSheet.sheet_name, updated);
  };

  const handleSetMode = (mode: 'regular' | 'lateral') => {
    onUpdateProgress(currentSheet.sheet_name, { ...progress, mode });
  };

  const handleSetBatch = (batchName: string) => {
    onUpdateProgress(currentSheet.sheet_name, { ...progress, batch: batchName });
  };

  const handleClearSemester = (semNum: number) => {
    if (!confirm(`Are you sure you want to clear tracked results for Semester ${semNum}?`)) return;
    const newSemesters = { ...(progress.semesters || {}) };
    delete newSemesters[semNum];

    const newCourses = { ...progress.courses };
    Object.keys(newCourses).forEach((k) => {
      if (newCourses[k] && newCourses[k].semester === semNum) {
        delete newCourses[k];
      }
    });

    onUpdateProgress(currentSheet.sheet_name, { ...progress, courses: newCourses, semesters: newSemesters });
  };

  const handleResetSheet = () => {
    if (!confirm(`Are you sure you want to reset all tracked progress for ${currentSheet.sheet_name}? This cannot be undone.`)) return;
    onUpdateProgress(currentSheet.sheet_name, { mode: 'regular', courses: {}, semesters: {} });
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(progress, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `sec_progress_${currentSheet.sheet_name}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleBatchCore = () => {
    if (!confirm('Mark all Professional Core (PC), Basic Sciences (BS), and Engineering Sciences (ES) courses as Completed?')) return;
    const newCourses = { ...progress.courses };
    currentSheet.courses.forEach((c) => {
      const cat = (c.category || '').toUpperCase();
      if (cat.startsWith('PC') || cat.startsWith('BS') || cat.startsWith('ES')) {
        newCourses[c.id] = { status: 'completed', grade: 'A' };
      }
    });
    onUpdateProgress(currentSheet.sheet_name, { ...progress, courses: newCourses });
  };

  const handleBatch1stYear = () => {
    if (!confirm('Mark all 1st Year courses (Humanities HS, Basic Sciences BS, Engineering Sciences ES) as Completed?')) return;
    const newCourses = { ...progress.courses };
    currentSheet.courses.forEach((c) => {
      const cat = (c.category || '').toUpperCase();
      if (cat.startsWith('HS') || cat.startsWith('BS') || cat.startsWith('ES')) {
        newCourses[c.id] = { status: 'completed', grade: 'A' };
      }
    });
    onUpdateProgress(currentSheet.sheet_name, { ...progress, courses: newCourses });
  };

  // Categories list for audit
  const categoriesToShow = creditRequirements.filter(
    (r) =>
      r.category !== 'TOTAL' &&
      (isLateral
        ? r.lateral_credits > 0 || r.regular_credits > 0
        : r.regular_credits > 0 || (r.offered_credits || 0) > 0)
  );

  const oeReq = creditRequirements.find((r) => r.category === 'OE');
  const olReq = creditRequirements.find((r) => r.category === 'OL');
  const reqOf = (r?: { regular_credits: number; lateral_credits: number }) =>
    r ? (isLateral ? r.lateral_credits || r.regular_credits || 0 : r.regular_credits || 0) : 0;
  const onlineRequired = reqOf(olReq) || 4;
  const openOnlyRequired = reqOf(oeReq) || 8;
  const openOnlyEarned = Math.min(earnedByCat['OE'] || 0, openOnlyRequired);
  const onlineEarned = Math.min(earnedByCat['OL'] || 0, onlineRequired);

  const auditCategories = categoriesToShow
    .filter((r) => r.category !== 'OL')
    .map((r) => {
      if (r.category === 'OE') {
        return { category: 'OE', required: openOnlyRequired + onlineRequired, earned: openOnlyEarned + onlineEarned };
      }
      return { category: r.category, required: reqOf(r), earned: earnedByCat[r.category] || 0 };
    });

  return (
    <section className="space-y-8 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border-2 border-[#18181B] shadow-brutal-lg flex flex-col lg:flex-row gap-5 items-start lg:items-center justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onGoToSelector}
              className="inline-flex items-center gap-1 text-xs font-heading font-bold text-[#18181B] bg-white hover:bg-zinc-100 border-2 border-[#18181B] shadow-brutal-sm px-2.5 py-1 rounded-md transition-all mr-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Curriculums</span>
            </button>
            <span className="text-xs px-2.5 py-1 rounded-md font-bold bg-[#10B981] text-white border-2 border-[#18181B]">
              {currentSheet.metadata.regulation || 'AUTONOMOUS'}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md font-bold bg-[#FAF7F0] text-[#18181B] border-2 border-[#18181B]">
              {currentSheet.sheet_type === 'curriculum'
                ? 'Department Curriculum'
                : currentSheet.sheet_type === 'minors'
                ? 'Minor Specialization'
                : currentSheet.sheet_type === 'open_electives'
                ? 'Open Electives'
                : 'Online Courses'}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md font-bold bg-[#FF5A5F] text-white border-2 border-[#18181B]">
              {activeBatch}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#18181B] tracking-tight">
            {currentSheet.metadata.department || currentSheet.sheet_name}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 font-semibold">
            {currentSheet.metadata.degree || 'Curriculum'} • {currentSheet.metadata.title || ''}
          </p>
        </div>

        {/* Controls Toolbar */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
          {batchKeys.length > 1 && (
            <div className="relative w-full sm:w-auto">
              <select
                value={activeBatch}
                onChange={(e) => handleSetBatch(e.target.value)}
                className="w-full sm:w-auto text-xs font-heading font-bold bg-white border-2 border-[#18181B] rounded-lg px-3 py-2 pr-8 text-[#18181B] shadow-brutal-sm focus:outline-hidden cursor-pointer"
              >
                {batchKeys.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}

          {currentSheet.sheet_type === 'curriculum' && (
            <div className="flex items-center w-full sm:w-auto bg-[#FAF7F0] p-1 rounded-lg border-2 border-[#18181B] text-xs font-heading font-bold">
              <button
                onClick={() => handleSetMode('regular')}
                className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-md transition-all ${
                  !isLateral
                    ? 'border-2 border-[#18181B] bg-white text-[#18181B] shadow-brutal-sm'
                    : 'text-zinc-700 hover:text-[#18181B] border-2 border-transparent'
                }`}
              >
                Regular (4 Yrs)
              </button>
              <button
                onClick={() => handleSetMode('lateral')}
                className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-md transition-all ${
                  isLateral
                    ? 'border-2 border-[#18181B] bg-white text-[#18181B] shadow-brutal-sm'
                    : 'text-zinc-700 hover:text-[#18181B] border-2 border-transparent'
                }`}
              >
                Lateral Entry (3 Yrs)
              </button>
            </div>
          )}

          <div className="relative w-full sm:w-auto">
            <select
              value={currentSheet.sheet_name}
              onChange={(e) => onSelectSheet(e.target.value)}
              className="w-full sm:w-auto text-xs font-heading font-bold bg-white border-2 border-[#18181B] rounded-lg px-3 py-2 pr-8 text-[#18181B] shadow-brutal-sm focus:outline-hidden cursor-pointer"
            >
              {allSheets.map((s) => (
                <option key={s.sheet_name} value={s.sheet_name}>
                  {s.sheet_name} - {s.metadata.degree || s.metadata.department || ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <button
              onClick={() => onOpenMarksheetModalForSem(null)}
              title="Upload Semester Marksheet (PDF)"
              className="flex-1 sm:flex-none justify-center px-3 py-2 rounded-lg bg-[#FF5A5F] hover:bg-[#E04A4E] text-white border-2 border-[#18181B] shadow-brutal-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none font-heading font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileUp className="w-4 h-4" />
              <span>Upload Marksheet</span>
            </button>
            <button
              onClick={handleResetSheet}
              title="Reset saved progress for this curriculum"
              className="p-2 rounded-lg bg-white border-2 border-[#18181B] shadow-brutal-sm hover:bg-rose-100 text-[#18181B] transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportJSON}
              title="Export Progress (JSON)"
              className="p-2 rounded-lg bg-white border-2 border-[#18181B] shadow-brutal-sm hover:bg-zinc-100 text-[#18181B] transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Key Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white p-5 rounded-xl border-2 border-[#18181B] shadow-brutal flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-zinc-600 text-xs font-heading font-extrabold uppercase tracking-wider mb-1.5">
              <span>Credits Earned</span>
              <Award className="w-4 h-4 text-[#FF5A5F]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-heading font-black text-[#18181B]">{earnedCredits}</span>
              <span className="text-xs sm:text-sm font-bold text-zinc-500">/ {targetCredits} Target</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-[#FAF7F0] border-2 border-[#18181B] rounded-full h-3 overflow-hidden p-0.5">
              <div className="bg-[#10B981] h-full rounded-full transition-all duration-300" style={{ width: `${creditPercent}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-2xs font-bold text-zinc-600">
              <span>{creditPercent}% Completed</span>
              <span>{remainingCredits} needed</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border-2 border-[#18181B] shadow-brutal flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-zinc-600 text-xs font-heading font-extrabold uppercase tracking-wider mb-1.5">
              <span>Courses Completed</span>
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-heading font-black text-[#10B981]">{completedCount}</span>
              <span className="text-xs sm:text-sm font-bold text-zinc-500">/ {currentSheet.courses.length} Total</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 text-2xs font-bold text-zinc-700">
            <span className="inline-flex items-center gap-1 text-zinc-500">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 border border-[#18181B]" />
              <span>{pendingCount} Pending</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border-2 border-[#18181B] shadow-brutal flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-zinc-600 text-xs font-heading font-extrabold uppercase tracking-wider mb-1.5">
              <span>Estimated CGPA</span>
              <Sparkles className="w-4 h-4 text-[#D97706]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-heading font-black text-[#18181B]">{estimatedCGPA}</span>
              <span className="text-xs sm:text-sm font-bold text-zinc-500">/ 10.0 Scale</span>
            </div>
          </div>
          <p className="mt-4 text-2xs font-bold text-zinc-500">
            {gradedCredits > 0 ? `Calculated from ${gradedCredits} graded credits` : 'Mark grades on completed courses to calculate'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border-2 border-[#18181B] shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-600 text-xs font-heading font-extrabold uppercase tracking-wider mb-1.5">
            <span>Degree Status</span>
            <GraduationCap className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div>
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-heading font-bold ${
                earnedCredits >= targetCredits && targetCredits > 0
                  ? 'bg-[#10B981] text-white border-2 border-[#18181B]'
                  : creditPercent >= 75
                  ? 'bg-[#7C3AED] text-white border-2 border-[#18181B]'
                  : creditPercent >= 50
                  ? 'bg-[#2563EB] text-white border-2 border-[#18181B]'
                  : completedCount > 0
                  ? 'bg-[#D97706] text-white border-2 border-[#18181B]'
                  : 'bg-[#FAF7F0] border-2 border-[#18181B] text-[#18181B]'
              }`}
            >
              <span>
                {earnedCredits >= targetCredits && targetCredits > 0
                  ? 'Degree Target Met'
                  : creditPercent >= 75
                  ? 'Final Year Ready'
                  : creditPercent >= 50
                  ? 'Halfway Milestone'
                  : completedCount > 0
                  ? 'Getting Started'
                  : 'Not Started'}
              </span>
            </div>
            <p className="mt-2 text-2xs font-semibold text-zinc-600">
              {earnedCredits >= targetCredits && targetCredits > 0
                ? 'Congratulations! You satisfied graduation requirements.'
                : `${remainingCredits} credits remaining to complete degree`}
            </p>
          </div>
        </div>
      </div>

      {/* Semester Marksheets & SGPA Vault (Semesters 1 - 8) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-heading font-extrabold text-[#18181B] tracking-tight">
                Semester Marksheets & SGPA (Semesters 1 – 8)
              </h3>
              <span className="text-2xs font-bold px-2 py-0.5 rounded-md bg-white border-2 border-[#18181B] shadow-brutal-sm text-[#18181B]">
                {Object.values(progress.semesters || {}).filter((s) => s.uploaded).length} of 8 Uploaded
              </span>
            </div>
            <p className="text-xs text-zinc-600 font-medium">
              Upload semester marksheets individually to track credit flow, SGPA, and cumulative progress
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenMarksheetModalForSem(null)}
              className="text-xs font-heading font-bold px-3.5 py-1.5 rounded-lg bg-[#FF5A5F] hover:bg-[#E04A4E] text-white border-2 border-[#18181B] shadow-brutal-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Upload Semester Marksheet</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => {
            const semData = progress.semesters?.[s];
            const isUploaded = semData?.uploaded;

            return (
              <div
                key={s}
                className="bg-white rounded-xl p-3 border-2 border-[#18181B] shadow-brutal flex flex-col justify-between hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-heading font-extrabold text-[#18181B] whitespace-nowrap">Sem {s}</span>
                    {isUploaded ? (
                      <span className="text-3xs font-bold whitespace-nowrap px-1.5 py-0.5 rounded-md bg-[#10B981] text-white border border-[#18181B]">
                        ✓ Added
                      </span>
                    ) : (
                      <span className="text-3xs font-bold whitespace-nowrap px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-500 border border-zinc-300">
                        Pending
                      </span>
                    )}
                  </div>

                  {isUploaded ? (
                    <div className="space-y-0.5 my-1.5">
                      <span className="font-heading font-black text-xs text-[#18181B] block">
                        {semData.credits || 0} Credits
                      </span>
                      <span className="text-3xs font-heading font-bold text-[#FF5A5F] block">
                        SGPA: {semData.sgpa || '-'}
                      </span>
                      <span className="text-3xs text-zinc-500 font-semibold block">
                        {semData.courses?.length || 0} Courses
                      </span>
                    </div>
                  ) : (
                    <div className="py-2.5 text-center">
                      <span className="text-3xs font-bold text-zinc-400 block">Not uploaded</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-1">
                  {isUploaded ? (
                    <>
                      <button
                        onClick={() => onOpenMarksheetModalForSem(s)}
                        className="text-3xs font-heading font-bold px-2 py-1 rounded-md bg-[#FAF7F0] hover:bg-zinc-100 border border-[#18181B] text-[#18181B] flex-1 text-center cursor-pointer"
                      >
                        Manage
                      </button>
                      <button
                        onClick={() => handleClearSemester(s)}
                        title="Clear this semester"
                        className="text-3xs font-bold px-1.5 py-1 rounded-md bg-white hover:bg-rose-50 border border-zinc-300 text-zinc-500 hover:text-rose-600 cursor-pointer"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onOpenMarksheetModalForSem(s)}
                      className="text-3xs font-heading font-bold px-2 py-1 rounded-md bg-[#FF5A5F] hover:bg-[#E04A4E] text-white border border-[#18181B] shadow-2xs w-full text-center cursor-pointer"
                    >
                      + Upload
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Credit Audit Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h3 className="text-lg sm:text-xl font-heading font-extrabold text-[#18181B] tracking-tight">
              Category Credit Audit
            </h3>
            <p className="text-xs text-zinc-600 font-medium">Click any category card to filter courses below</p>
          </div>
          {activeCategoryFilter !== 'all' && (
            <button
              onClick={() => setActiveCategoryFilter('all')}
              className="text-xs font-heading font-bold bg-white text-[#18181B] border-2 border-[#18181B] shadow-brutal-sm px-3 py-1 rounded-lg self-start sm:self-auto cursor-pointer"
            >
              Filtered: {activeCategoryFilter} (Click to Clear)
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {auditCategories.map((req) => {
            const catCode = req.category;
            const { required, earned } = req;
            const isMet = required > 0 && earned >= required;
            const catMeta = CATEGORY_MAP[catCode] || { name: catCode, bg: 'bg-[#18181B] text-white' };
            const pct = required > 0 ? Math.min(100, Math.round((earned / required) * 100)) : earned > 0 ? 100 : 0;
            const isActive = activeCategoryFilter === catCode;

            return (
              <div
                key={catCode}
                onClick={() => setActiveCategoryFilter(isActive ? 'all' : catCode)}
                className={`bg-white rounded-xl p-3 border-2 border-[#18181B] transition-all cursor-pointer hover:translate-x-[1px] hover:translate-y-[1px] flex flex-col justify-between ${
                  isActive ? 'bg-[#FFF1F2] ring-2 ring-[#FF5A5F] shadow-none' : 'shadow-brutal hover:shadow-brutal-sm'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-2xs px-2 py-0.5 rounded-md font-heading font-extrabold border-2 border-[#18181B] ${catMeta.bg}`}>
                      {catCode}
                    </span>
                    {isMet && <CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
                  </div>
                  <p className="text-3xs text-zinc-600 font-bold line-clamp-1" title={catMeta.name}>
                    {catMeta.name}
                  </p>
                </div>

                <div className="mt-2.5">
                  <div className="flex items-baseline justify-between text-2xs font-heading font-extrabold">
                    <span className={isMet ? 'text-[#10B981]' : 'text-[#18181B]'}>{earned}</span>
                    <span className="text-zinc-400">/ {required}</span>
                  </div>
                  <div className="w-full bg-[#FAF7F0] border border-[#18181B] rounded-full h-2 overflow-hidden mt-1 p-0.5">
                    <div
                      className={`${isMet ? 'bg-[#10B981]' : 'bg-[#FF5A5F]'} h-full rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {catCode === 'OE' && (
                    <p className="text-3xs text-zinc-600 font-bold mt-1 leading-tight">
                      Open {openOnlyEarned}/{openOnlyRequired} · Online {onlineEarned}/{onlineRequired}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visual Charts Accordion */}
      <div className="bg-white rounded-xl border-2 border-[#18181B] shadow-brutal overflow-hidden">
        <button
          onClick={() => setAreChartsVisible(!areChartsVisible)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-[#FAF7F0] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 font-heading font-extrabold text-sm sm:text-base text-[#18181B]">
            <BarChart2 className="w-5 h-5 text-[#FF5A5F]" />
            <span>Visual Credit Analytics</span>
            <span className="text-2xs px-2 py-0.5 rounded-md font-bold bg-[#FAF7F0] border border-[#18181B] text-[#18181B]">
              Charts
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-[#18181B] transition-transform ${areChartsVisible ? 'rotate-180' : ''}`}
          />
        </button>

        {areChartsVisible && (
          <ChartsSection
            categories={auditCategories.map((req) => ({
              category: req.category,
              target: req.required,
              earned: req.earned,
            }))}
            statusCounts={{
              completed: completedCount,
              pending: pendingCount,
            }}
          />
        )}
      </div>

      {/* Curriculum Course Checklist */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div>
            <h3 className="text-lg sm:text-xl font-heading font-extrabold text-[#18181B] tracking-tight">
              Curriculum Course Checklist
            </h3>
            <p className="text-xs text-zinc-600 font-medium">
              {activeCategoryFilter === 'OE'
                ? `Showing ${filteredCourses.length} Open Elective + Online courses (12 credits: 8 open + 4 online)`
                : activeCategoryFilter === 'OL'
                ? `Showing ${filteredCourses.length} of ${onlineCourses.length} Approved Online courses (4 credits target)`
                : `Showing ${filteredCourses.length} courses`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleBatchCore}
              className="text-2xs sm:text-xs font-heading font-bold px-3 py-1.5 rounded-lg bg-white border-2 border-[#18181B] shadow-brutal-sm hover:translate-x-[1px] hover:translate-y-[1px] text-[#18181B] transition-all flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Mark Core Completed</span>
            </button>
            <button
              onClick={handleBatch1stYear}
              className="text-2xs sm:text-xs font-heading font-bold px-3 py-1.5 rounded-lg bg-white border-2 border-[#18181B] shadow-brutal-sm hover:translate-x-[1px] hover:translate-y-[1px] text-[#18181B] transition-all flex items-center gap-1 cursor-pointer"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-[#FF5A5F]" />
              <span>Mark 1st Year Completed</span>
            </button>
          </div>
        </div>

        {/* Category Pills Quick Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
          {[
            { id: 'all', label: 'All Categories' },
            { id: 'HS', label: 'HS' },
            { id: 'BS', label: 'BS' },
            { id: 'ES', label: 'ES' },
            { id: 'PC', label: 'PC' },
            { id: 'PE', label: 'PE' },
            { id: 'OE', label: 'Open Electives (12 incl. 4 Online)' },
            { id: 'OL', label: 'Online Only (4)' },
            { id: 'EEC', label: 'EEC' },
            { id: 'MC', label: 'MC' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-md text-2xs font-heading font-bold border-2 border-[#18181B] whitespace-nowrap transition-all cursor-pointer ${
                activeCategoryFilter === cat.id
                  ? 'bg-[#18181B] text-white shadow-brutal-sm'
                  : 'bg-white text-[#18181B] hover:bg-zinc-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Filter Controls Row */}
        <div className="bg-white p-4 rounded-xl border-2 border-[#18181B] shadow-brutal flex flex-col lg:flex-row gap-3 items-center justify-between">
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={courseSearchQuery}
              onChange={(e) => setCourseSearchQuery(e.target.value)}
              placeholder="Search course title or code (e.g. 19CS301, Python)..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF7F0] border-2 border-[#18181B] rounded-lg font-semibold text-[#18181B] focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full lg:w-auto overflow-x-auto custom-scrollbar pb-1 lg:pb-0">
            <span className="text-2xs font-heading font-extrabold uppercase text-zinc-600 mr-1 hidden sm:inline">
              Status:
            </span>
            {[
              { id: 'all', label: 'All' },
              { id: 'completed', label: 'Completed' },
              { id: 'pending', label: 'Not Started' },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setActiveStatusFilter(btn.id)}
                className={`px-3 py-1 rounded-md text-xs font-heading font-bold border-2 border-[#18181B] transition-all cursor-pointer ${
                  activeStatusFilter === btn.id
                    ? 'bg-[#18181B] text-white'
                    : 'bg-white text-[#18181B] hover:bg-zinc-100'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            <select
              value={courseTypeFilter}
              onChange={(e) => setCourseTypeFilter(e.target.value)}
              className="text-xs font-heading font-bold bg-[#FAF7F0] border-2 border-[#18181B] rounded-lg px-3 py-2 text-[#18181B] focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Course Types</option>
              <option value="theory">Theory</option>
              <option value="tip">Integrated / TIP</option>
              <option value="practical">Practical / Lab</option>
            </select>
          </div>
        </div>

        {/* Course Table */}
        <div className="bg-white rounded-xl border-2 border-[#18181B] shadow-brutal overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs min-w-[760px]">
              <thead>
                <tr className="bg-[#FAF7F0] border-b-2 border-[#18181B] text-2xs uppercase tracking-wider text-[#18181B] font-heading font-extrabold">
                  <th className="py-3 px-3 w-16 text-center">Status</th>
                  <th className="py-3 px-2 w-28">Grade</th>
                  <th className="py-3 px-2 w-12 text-center">S.No</th>
                  <th className="py-3 px-2 w-24">Category</th>
                  <th className="py-3 px-3 w-32">Course Code</th>
                  <th className="py-3 px-4 min-w-[240px]">Course Title</th>
                  <th className="py-3 px-3 w-28">Prerequisite</th>
                  <th className="py-3 px-2 w-20 text-center">Credits</th>
                  <th className="py-3 px-3 w-28">Type</th>
                  <th className="py-3 px-3 min-w-[150px]">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-zinc-200">
                {filteredCourses.map((c: Course) => {
                  const p = progress.courses[c.id] || { status: 'none', grade: '' };
                  const status = p.status || 'none';
                  const grade = p.grade || '';

                  const mainCat = (c.category || 'PC').split(' ')[0];
                  const catMeta = CATEGORY_MAP[mainCat] || { name: mainCat, bg: 'bg-[#18181B] text-white' };

                  const thCred = c.theory_credits || 0;
                  const prCred = c.practical_credits || 0;
                  const totCred = c.total_credits || 0;

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-[#FAF7F0] transition-colors ${
                        status === 'completed' ? 'bg-[#ECFDF5]/50' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {status === 'completed' ? (
                            <button
                              onClick={() => handleToggleCourse(c.id)}
                              title="Click to cycle status"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[#10B981] text-white border-2 border-[#18181B] shadow-brutal-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleCourse(c.id)}
                              title="Click to cycle status"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white text-zinc-400 border-2 border-[#18181B] shadow-brutal-sm hover:text-[#18181B] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-pointer"
                            >
                              <Circle className="w-4 h-4" />
                            </button>
                          )}
                          {status === 'completed' && p.semester && (
                            <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#FAF7F0] border border-[#18181B] text-3xs font-heading font-extrabold text-[#18181B]">
                              Sem {p.semester}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-2">
                        <select
                          value={grade}
                          onChange={(e) => handleUpdateGrade(c.id, e.target.value)}
                          disabled={status !== 'completed'}
                          className={`text-xs font-heading font-bold rounded-md border-2 border-[#18181B] py-1 px-1.5 transition-all ${
                            status === 'completed'
                              ? 'bg-white text-[#18181B] shadow-brutal-sm cursor-pointer'
                              : 'bg-zinc-100 text-zinc-400 pointer-events-none'
                          }`}
                        >
                          <option value="">- Grade -</option>
                          <option value="O">O (10)</option>
                          <option value="A+">A+ (9)</option>
                          <option value="A">A (8)</option>
                          <option value="B+">B+ (7)</option>
                          <option value="B">B (6)</option>
                          <option value="C">C (5)</option>
                          <option value="P">Pass</option>
                        </select>
                      </td>

                      <td className="py-2.5 px-2 text-center text-zinc-500 font-mono text-2xs font-bold">
                        {c.sno || '-'}
                      </td>

                      <td className="py-2.5 px-2">
                        <span
                          className={`text-2xs px-2 py-0.5 rounded-md font-heading font-extrabold border-2 border-[#18181B] ${catMeta.bg}`}
                          title={catMeta.name}
                        >
                          {c.category || 'PC'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-2xs">
                        <div className="space-y-1">
                          {c.code_2024 && c.code_2024 !== 'NA' && (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-white border border-[#18181B] text-[#18181B] font-bold" title="R2024 Code">
                              {c.code_2024}
                            </span>
                          )}
                          {c.code_2019 && c.code_2019 !== 'NA' && (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-[#FAF7F0] border border-[#18181B] text-[#18181B] font-bold" title="R2019 Code">
                              {c.code_2019}
                            </span>
                          )}
                          {!c.code_2024 && !c.code_2019 && <span className="text-zinc-400">-</span>}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 font-heading font-bold text-[#18181B] leading-snug">
                        {c.title}
                      </td>

                      <td className="py-2.5 px-3 text-zinc-600 text-2xs">
                        {c.prerequisite && c.prerequisite !== '-' && c.prerequisite !== 'NA' ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-[#18181B] font-bold">
                            {c.prerequisite}
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>

                      <td className="py-2.5 px-2 text-center font-mono">
                        <span className="font-black text-[#18181B] text-xs">{totCred}</span>
                        {(thCred > 0 || prCred > 0) && (
                          <span className="text-3xs text-zinc-500 block">
                            ({thCred}-{prCred})
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-2xs font-semibold text-zinc-700">
                        {c.course_type || 'Theory'}
                      </td>

                      <td className="py-2.5 px-3 text-3xs text-zinc-600 italic max-w-xs">
                        {c.remarks || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
