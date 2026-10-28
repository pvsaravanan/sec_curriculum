'use client';

import React, { useState, useMemo } from 'react';
import { Search, BookOpen, ChevronDown, List, LayoutGrid, MapPin, ArrowRight, Zap, Check } from 'lucide-react';
import { CurriculumSheet, StudentProgress } from '@/types/curriculum';

interface ProgramSelectorProps {
  allSheets: CurriculumSheet[];
  onSelectSheet: (sheetName: string) => void;
  getProgressForSheet: (sheetName: string) => StudentProgress;
}

export const ProgramSelector: React.FC<ProgramSelectorProps> = ({
  allSheets,
  onSelectSheet,
  getProgressForSheet,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [regFilter, setRegFilter] = useState('all');
  const [deptGroup, setDeptGroup] = useState('all');
  const [cardLayout, setCardLayout] = useState<'list' | 'grid'>('list');
  const [curriculumPage, setCurriculumPage] = useState(1);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const pageSize = 6;

  // Filter sheets
  const filteredSheets = useMemo(() => {
    return allSheets.filter((sheet) => {
      // Regulation filter
      if (regFilter === 'R2024' && !sheet.sheet_name.includes('R2024')) return false;
      if (regFilter === 'R2019' && !sheet.sheet_name.includes('R2019')) return false;
      if (regFilter === '2023' && !sheet.sheet_name.includes('2023')) return false;
      if (
        regFilter === 'special' &&
        !['Minors', 'Open Electives', 'Online Courses'].includes(sheet.sheet_name)
      )
        return false;

      // Department group filter
      if (deptGroup !== 'all') {
        const name = sheet.sheet_name.toUpperCase();
        if (deptGroup === 'computing' && !(name.includes('CSE') || name.includes('IT') || name.includes('AI'))) return false;
        if (deptGroup === 'circuits' && !(name.includes('ECE') || name.includes('EEE') || name.includes('EIE') || name.includes('BME') || name.includes('MED'))) return false;
        if (deptGroup === 'core' && !(name.includes('MECH') || name.includes('CIVIL') || name.includes('CHEM') || name.includes('AGRI'))) return false;
        if (deptGroup === 'special' && !['MINORS', 'OPEN ELECTIVES', 'ONLINE COURSES'].includes(name)) return false;
      }

      // Keyword search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = sheet.sheet_name.toLowerCase();
        const dept = (sheet.metadata.department || '').toLowerCase();
        const deg = (sheet.metadata.degree || '').toLowerCase();
        return name.includes(q) || dept.includes(q) || deg.includes(q);
      }

      return true;
    });
  }, [allSheets, regFilter, deptGroup, searchQuery]);

  // Compute pagination
  const totalItems = filteredSheets.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const currentPage = Math.min(curriculumPage, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pageItems = filteredSheets.slice(startIndex, endIndex);

  // Helper for sheet summary
  const getSummary = (sheet: CurriculumSheet) => {
    const prog = getProgressForSheet(sheet.sheet_name);
    let earned = 0;
    let completedCount = 0;

    sheet.courses.forEach((c) => {
      const p = prog.courses[c.id];
      if (p && p.status === 'completed') {
        earned += c.total_credits || 0;
        completedCount++;
      }
    });

    const mode = prog.mode || 'regular';
    let totalTarget = 164;
    const batchDict = sheet.batches || { Default: sheet.credit_requirements };
    const batchKeys = Object.keys(batchDict);
    const activeKey = prog.batch && batchDict[prog.batch] ? prog.batch : (sheet.active_batch || batchKeys[batchKeys.length - 1]);
    const reqList = batchDict[activeKey] || Object.values(batchDict)[0];
    if (reqList) {
      const tot = reqList.find((r) => r.category === 'TOTAL');
      if (tot) {
        totalTarget = mode === 'lateral' ? tot.lateral_credits || 126 : tot.regular_credits || 164;
      }
    }

    return { earned, completedCount, totalTarget, activeBatch: activeKey };
  };

  // Find sheet with active progress for Quick Resume banner
  const activeResumeSheet = useMemo(() => {
    return allSheets.find((s) => getSummary(s).completedCount > 0);
  }, [allSheets]);

  const handlePageChange = (page: number) => {
    setCurriculumPage(page);
    document.getElementById('deptGroupTabs')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <section className="space-y-10 animate-fadeIn">
      {/* Hero Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-3 py-2">
        <h1 className="text-3xl sm:text-5xl font-heading font-extrabold text-[#18181B] tracking-tight">
          Find your Curriculum
        </h1>
        <p className="text-sm sm:text-base text-zinc-700 font-medium">
          Looking for your department curriculum? Pick your regulation and batch to track credits & check graduation progress today.
        </p>

        {/* Big Brutalist Search & Filter Inputs */}
        <div className="pt-4 max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-5 h-5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurriculumPage(1);
              }}
              placeholder="Search Department, Degree or Code (e.g. CSE, AI&DS, ECE)..."
              className="w-full pl-11 pr-4 py-3 bg-white border-2 border-[#18181B] rounded-lg text-sm font-semibold text-[#18181B] placeholder-zinc-500 shadow-brutal-sm focus:outline-hidden"
            />
          </div>

          <div className="relative w-full sm:w-60">
            <BookOpen className="w-5 h-5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={regFilter}
              onChange={(e) => {
                setRegFilter(e.target.value);
                setCurriculumPage(1);
              }}
              className="w-full pl-11 pr-8 py-3 bg-white border-2 border-[#18181B] rounded-lg text-sm font-bold text-[#18181B] shadow-brutal-sm focus:outline-hidden appearance-none cursor-pointer"
            >
              <option value="all">All Regulations</option>
              <option value="R2024">R2024 Regulations</option>
              <option value="R2019">R2019 Regulations</option>
              <option value="2023">2023 Curriculums</option>
              <option value="special">Minors & Electives</option>
            </select>
            <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={() => setCurriculumPage(1)}
            className="w-full sm:w-auto px-7 py-3 bg-[#FF5A5F] hover:bg-[#E04A4E] text-white font-heading font-extrabold text-sm rounded-lg border-2 border-[#18181B] shadow-brutal hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-brutal-sm transition-all"
          >
            Search
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Filters Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-[#FAF7F0] border-2 border-[#18181B] rounded-xl shadow-brutal-lg overflow-hidden">
            <div
              onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
              className="p-3.5 bg-white border-b-2 border-[#18181B] flex items-center justify-between font-heading font-bold text-base text-[#18181B] cursor-pointer lg:cursor-default"
            >
              <span>Filters</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform lg:hidden ${isMobileFilterOpen ? 'rotate-180' : ''}`}
              />
            </div>

            <div className={`p-4 space-y-5 text-xs font-semibold text-[#18181B] ${isMobileFilterOpen ? 'block' : 'hidden lg:block'}`}>
              {/* Regulation options */}
              <div className="space-y-2">
                <span className="font-heading font-extrabold text-xs uppercase tracking-wider text-zinc-600 block">
                  Regulation
                </span>
                <div className="space-y-1.5">
                  {[
                    { label: 'All Programs (33 Total)', val: 'all' },
                    { label: 'R2024 Regulations (UG 2024-2028)', val: 'R2024' },
                    { label: 'R2019 Regulations (UG 2022-2026/2027)', val: 'R2019' },
                    { label: '2023 Batches (CSE & IT)', val: '2023' },
                    { label: 'Minors & Open Electives', val: 'special' },
                  ].map((item) => (
                    <label key={item.val} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sidebarReg"
                        value={item.val}
                        checked={regFilter === item.val}
                        onChange={() => {
                          setRegFilter(item.val);
                          setCurriculumPage(1);
                        }}
                        className="w-4 h-4 accent-[#FF5A5F] border-2 border-[#18181B]"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Student Entry Mode Preview */}
              <div className="border-t-2 border-[#18181B] pt-4 space-y-2">
                <span className="font-heading font-extrabold text-xs uppercase tracking-wider text-zinc-600 block">
                  Student Entry Mode
                </span>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 bg-white border-2 border-[#18181B] rounded-lg shadow-brutal-sm">
                    <span className="block font-bold">Regular (4 Yrs)</span>
                    <span className="text-3xs text-zinc-500">156 - 170 Credits</span>
                  </div>
                  <div className="p-2 bg-white border-2 border-[#18181B] rounded-lg shadow-brutal-sm">
                    <span className="block font-bold">Lateral (3 Yrs)</span>
                    <span className="text-3xs text-zinc-500">119 - 137 Credits</span>
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-[#18181B] pt-4 space-y-1.5 text-2xs text-zinc-600">
                <p className="font-bold text-[#18181B]">✓ Live LocalStorage Persistence</p>
                <p>Checked courses and calculated CGPA save automatically in your browser.</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Content Area */}
        <div className="lg:col-span-8 space-y-5">
          {/* Pinned Quick Resume Banner */}
          {activeResumeSheet && (() => {
            const sum = getSummary(activeResumeSheet);
            const pct = sum.totalTarget > 0 ? Math.min(100, Math.round((sum.earned / sum.totalTarget) * 100)) : 0;
            return (
              <div className="bg-[#FFF1F2] border-2 border-[#18181B] rounded-xl p-4 shadow-brutal flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#FF5A5F] border-2 border-[#18181B] text-white flex items-center justify-center font-heading font-black text-lg shadow-brutal-sm">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-extrabold text-sm sm:text-base text-[#18181B]">
                        Quick Resume: {activeResumeSheet.sheet_name}
                      </span>
                      <span className="text-3xs font-bold px-2 py-0.5 rounded-md bg-[#10B981] text-white border border-[#18181B]">
                        {sum.earned} / {sum.totalTarget} Credits ({pct}%)
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 font-semibold">
                      {activeResumeSheet.metadata.degree || activeResumeSheet.metadata.department || ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onSelectSheet(activeResumeSheet.sheet_name)}
                  className="px-5 py-2.5 bg-[#FF5A5F] hover:bg-[#E04A4E] text-white font-heading font-extrabold text-xs rounded-lg border-2 border-[#18181B] shadow-brutal-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-pointer flex items-center gap-1.5 self-end sm:self-auto"
                >
                  <span>Continue Tracking</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })()}

          {/* Department Cluster Tabs & View Switcher */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pb-1" id="deptGroupTabs">
            <div className="flex flex-nowrap overflow-x-auto custom-scrollbar gap-1.5 pb-2 sm:pb-0 sm:flex-wrap w-full sm:w-auto">
              {[
                { id: 'all', label: 'All (33)' },
                { id: 'computing', label: 'Computing & IT (14)' },
                { id: 'circuits', label: 'Circuits & Bio (9)' },
                { id: 'core', label: 'Mech & Civil (7)' },
                { id: 'special', label: 'Minors & OE (3)' },
              ].map((grp) => (
                <button
                  key={grp.id}
                  onClick={() => {
                    setDeptGroup(grp.id);
                    setCurriculumPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold border-2 border-[#18181B] whitespace-nowrap transition-all cursor-pointer ${
                    deptGroup === grp.id
                      ? 'bg-[#18181B] text-white shadow-brutal-sm'
                      : 'bg-white text-[#18181B] hover:bg-zinc-100'
                  }`}
                >
                  {grp.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-xs font-heading font-bold px-2.5 py-1 rounded-md bg-white border-2 border-[#18181B] shadow-brutal-sm">
                {totalItems} results
              </span>
              <button
                onClick={() => setCardLayout('list')}
                title="List View"
                className={`p-1.5 rounded-md border-2 border-[#18181B] cursor-pointer ${
                  cardLayout === 'list' ? 'bg-[#18181B] text-white' : 'bg-white text-[#18181B]'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCardLayout('grid')}
                title="2-Column Grid View"
                className={`p-1.5 rounded-md border-2 border-[#18181B] cursor-pointer ${
                  cardLayout === 'grid' ? 'bg-[#18181B] text-white' : 'bg-white text-[#18181B]'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Program Cards Listing */}
          {pageItems.length === 0 ? (
            <div className="py-12 text-center text-zinc-600 bg-white rounded-xl border-2 border-[#18181B] shadow-brutal p-8">
              <p className="font-heading font-bold text-base text-[#18181B]">No curriculums found matching your filter</p>
              <p className="text-xs text-zinc-500 mt-1">Try selecting &quot;All (33)&quot; or adjusting your search keywords.</p>
            </div>
          ) : (
            <div className={cardLayout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
              {pageItems.map((sheet) => {
                const summary = getSummary(sheet);
                const courseCount = sheet.courses ? sheet.courses.length : 0;
                const reg = sheet.sheet_name.startsWith('R2024')
                  ? 'R2024'
                  : sheet.sheet_name.startsWith('R2019')
                  ? 'R2019'
                  : sheet.sheet_name.startsWith('2023')
                  ? '2023'
                  : 'Special';

                const tagColor =
                  reg === 'R2024'
                    ? 'bg-[#10B981] text-white'
                    : reg === 'R2019'
                    ? 'bg-[#1E3A8A] text-white'
                    : reg === '2023'
                    ? 'bg-[#D97706] text-white'
                    : 'bg-[#7C3AED] text-white';

                const pct =
                  summary.totalTarget > 0
                    ? Math.min(100, Math.round((summary.earned / summary.totalTarget) * 100))
                    : 0;

                if (cardLayout === 'grid') {
                  return (
                    <div
                      key={sheet.sheet_name}
                      className="bg-white rounded-xl p-4 sm:p-5 border-2 border-[#18181B] shadow-brutal hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-brutal-sm transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-2xs font-heading font-bold px-2 py-0.5 rounded-md border-2 border-[#18181B] ${tagColor}`}>
                            {reg}
                          </span>
                          <span className="text-2xs font-heading font-bold px-2 py-0.5 rounded-md border-2 border-[#18181B] bg-white text-[#18181B]">
                            {summary.totalTarget} Credits
                          </span>
                        </div>

                        <div>
                          <h3 className="font-heading font-extrabold text-base text-[#18181B] leading-tight">
                            {sheet.sheet_name}
                          </h3>
                          <p className="text-xs font-semibold text-zinc-500 line-clamp-1 mt-0.5">
                            {sheet.metadata.degree || sheet.metadata.department || ''}
                          </p>
                        </div>

                        <div className="text-2xs text-zinc-600 font-medium space-y-0.5">
                          <p>• Cohort: <strong className="text-[#18181B]">{summary.activeBatch}</strong></p>
                          <p>• Courses: <strong className="text-[#18181B]">{courseCount} courses</strong></p>
                        </div>

                        {summary.completedCount > 0 && (
                          <div className="pt-1">
                            <div className="flex justify-between text-3xs font-heading font-bold text-zinc-700 mb-0.5">
                              <span className="text-[#10B981]">{summary.earned}/{summary.totalTarget} Credits</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="w-full bg-[#FAF7F0] border border-[#18181B] rounded-full h-1.5 overflow-hidden">
                              <div className="bg-[#10B981] h-full rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 mt-3 border-t-2 border-zinc-100 flex items-center justify-between">
                        <span className="text-3xs font-bold text-zinc-400">SEC Autonomous</span>
                        <button
                          onClick={() => onSelectSheet(sheet.sheet_name)}
                          className="px-3.5 py-1.5 bg-[#FF5A5F] hover:bg-[#E04A4E] text-white font-heading font-bold text-xs rounded-lg border-2 border-[#18181B] shadow-brutal-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={sheet.sheet_name}
                    className="bg-white rounded-xl p-5 sm:p-6 border-2 border-[#18181B] shadow-brutal hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-brutal-sm transition-all flex flex-col md:flex-row gap-5 items-start md:items-center justify-between"
                  >
                    <div className="space-y-2.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div>
                          <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#18181B] leading-tight">
                            {sheet.sheet_name} - {sheet.metadata.degree || sheet.metadata.department || ''}
                          </h3>
                          <p className="text-xs font-semibold text-zinc-500">
                            {sheet.metadata.department || 'Saveetha Engineering College'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 ml-auto md:ml-0">
                          <span className={`text-2xs font-heading font-bold px-2 py-0.5 rounded-md border-2 border-[#18181B] ${tagColor}`}>
                            {reg}
                          </span>
                          <span className="text-2xs font-heading font-bold px-2 py-0.5 rounded-md border-2 border-[#18181B] bg-white text-[#18181B]">
                            {summary.totalTarget} Credits
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-zinc-700 font-medium pl-2 space-y-0.5 border-l-2 border-zinc-200">
                        <p>• Regulation Cohort: <strong className="text-[#18181B]">{summary.activeBatch}</strong></p>
                        <p>• Degree Requirements: <strong className="text-[#18181B]">{summary.totalTarget} Credits</strong> (Regular) | <strong className="text-[#18181B]">{courseCount} courses offered</strong></p>
                      </div>

                      {summary.completedCount > 0 && (
                        <div className="pt-1.5 max-w-md">
                          <div className="flex justify-between text-2xs font-heading font-bold text-zinc-700 mb-1">
                            <span className="text-[#10B981] flex items-center gap-1">
                              <Check className="w-3 h-3 text-[#10B981]" />
                              <span>{summary.earned} / {summary.totalTarget} Credits Earned</span>
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full bg-[#FAF7F0] border border-[#18181B] rounded-full h-2 overflow-hidden">
                            <div className="bg-[#10B981] h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="w-full md:w-auto flex flex-col sm:flex-row md:flex-col items-stretch sm:items-end justify-between md:justify-center gap-2.5 sm:gap-3">
                      <span className="text-2xs font-bold text-zinc-500 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>SEC Autonomous</span>
                      </span>
                      <button
                        onClick={() => onSelectSheet(sheet.sheet_name)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-[#FF5A5F] hover:bg-[#E04A4E] text-white font-heading font-extrabold text-xs sm:text-sm rounded-lg border-2 border-[#18181B] shadow-brutal hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-brutal-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Open Dashboard</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t-2 border-[#18181B]">
              <div className="text-xs font-heading font-bold text-zinc-600">
                Showing {totalItems > 0 ? startIndex + 1 : 0}-{endIndex} of {totalItems} programs (Page {currentPage} of {totalPages})
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-2.5 py-1 text-xs font-heading font-bold rounded-md bg-white border-2 border-[#18181B] shadow-brutal-sm ${
                    currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-zinc-100 cursor-pointer'
                  }`}
                >
                  ← Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`px-2.5 py-1 text-xs font-heading font-bold rounded-md border-2 border-[#18181B] cursor-pointer ${
                      p === currentPage
                        ? 'bg-[#FF5A5F] text-white shadow-none'
                        : 'bg-white text-[#18181B] shadow-brutal-sm hover:bg-zinc-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-2.5 py-1 text-xs font-heading font-bold rounded-md bg-white border-2 border-[#18181B] shadow-brutal-sm ${
                    currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-zinc-100 cursor-pointer'
                  }`}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
