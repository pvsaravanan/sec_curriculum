import { Course, CurriculumSheet, MarksheetCourse, MarksheetResult } from '@/types/curriculum';

export type MatchSource = 'curriculum' | 'open_elective' | 'online';
export type MatchMethod = 'code' | 'title' | 'fuzzy';

export interface CourseMatch {
  course: Course;
  source: MatchSource;
  method: MatchMethod;
  score: number;
}

const PLACEHOLDER_CODES = new Set(['', 'NA', 'N/A', '-', 'XXXXXX', '19XXXXX', 'TBD']);
const STOP_WORDS = new Set(['and', 'of', 'the', 'to', 'in', 'for', 'a', 'an', 'its', 'with', 'using']);
const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8' };
const FUZZY_THRESHOLD = 0.82;

export const normalizeCode = (code?: string): string => (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export const isPlaceholderCode = (code?: string): boolean => {
  const c = (code || '').trim().toUpperCase();
  return PLACEHOLDER_CODES.has(c) || /^(\d{2})?X{3,}/.test(c);
};

export const titleTokens = (title?: string): string[] =>
  (title || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOP_WORDS.has(t))
    .map((t) => ROMAN[t] || t);

export const normalizeTitle = (title?: string): string => titleTokens(title).join(' ');

const bigrams = (s: string): Map<string, number> => {
  const m = new Map<string, number>();
  const t = s.replace(/\s+/g, ' ');
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
};

const diceCoefficient = (a: string, b: string): number => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  A.forEach((n, g) => {
    overlap += Math.min(n, B.get(g) || 0);
  });
  const total = Math.max(a.length - 1, 0) + Math.max(b.length - 1, 0);
  return total > 0 ? (2 * overlap) / total : 0;
};

const tokenOverlap = (a: string[], b: string[]): number => {
  if (!a.length || !b.length) return 0;
  const B = new Set(b);
  const shared = a.filter((t) => B.has(t)).length;
  return shared / Math.max(a.length, b.length);
};

export const titleSimilarity = (a?: string, b?: string): number => {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (!ta.length || !tb.length) return 0;
  const na = ta.join(' ');
  const nb = tb.join(' ');
  if (na === nb) return 1;
  const numsA = ta.filter((t) => /^\d+$/.test(t)).join(',');
  const numsB = tb.filter((t) => /^\d+$/.test(t)).join(',');
  if (numsA !== numsB) return 0;
  return Math.max(diceCoefficient(na, nb), tokenOverlap(ta, tb));
};

interface Index {
  all: Course[];
  byCode: Map<string, Course>;
  byTitle: Map<string, Course>;
}

const buildIndex = (courses: Course[]): Index => {
  const all = courses.filter((c) => !isPlaceholderTitle(c));
  const byCode = new Map<string, Course>();
  const byTitle = new Map<string, Course>();
  all.forEach((c) => {
    [c.code_2019, c.code_2024].forEach((code) => {
      const k = normalizeCode(code);
      if (k && !isPlaceholderCode(code) && !byCode.has(k)) byCode.set(k, c);
    });
    const t = normalizeTitle(c.title);
    if (t && !byTitle.has(t)) byTitle.set(t, c);
  });
  return { all, byCode, byTitle };
};

const isPlaceholderTitle = (c: Course): boolean =>
  isPlaceholderCode(c.code_2019) &&
  isPlaceholderCode(c.code_2024) &&
  /^(open electives?|online courses?)$/.test((c.title || '').toLowerCase().trim());

const indexCache = new WeakMap<Course[], Index>();
const getIndex = (courses: Course[]): Index => {
  let idx = indexCache.get(courses);
  if (!idx) {
    idx = buildIndex(courses);
    indexCache.set(courses, idx);
  }
  return idx;
};

const findInIndex = (m: MarksheetCourse, index: Index): Omit<CourseMatch, 'source'> | null => {
  const code = normalizeCode(m.course_code);
  if (code) {
    const hit = index.byCode.get(code);
    if (hit) return { course: hit, method: 'code', score: 1 };
  }
  const title = normalizeTitle(m.course_title);
  if (title) {
    const hit = index.byTitle.get(title);
    if (hit) return { course: hit, method: 'title', score: 0.95 };

    let best: Course | null = null;
    let bestScore = 0;
    index.all.forEach((c) => {
      const s = titleSimilarity(m.course_title, c.title);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    });
    if (best && bestScore >= FUZZY_THRESHOLD) return { course: best, method: 'fuzzy', score: bestScore };
  }
  return null;
};

export interface MatchPools {
  target: CurriculumSheet;
  openElectives?: CurriculumSheet;
  online?: CurriculumSheet;
}

export const matchCourse = (m: MarksheetCourse, pools: MatchPools): CourseMatch | null => {
  const candidates: [MatchSource, Course[] | undefined][] = [
    ['curriculum', pools.target.courses],
    ['open_elective', pools.openElectives?.courses],
    ['online', pools.online?.courses],
  ];
  for (const [source, courses] of candidates) {
    if (!courses) continue;
    const hit = findInIndex(m, getIndex(courses));
    if (hit) return { ...hit, source };
  }
  return null;
};

const PROGRAM_RULES: { key: string; test: (p: string) => boolean }[] = [
  { key: 'CSE(CS)', test: (p) => /computer science/.test(p) && /cyber/.test(p) },
  { key: 'CSE(IoT)', test: (p) => /computer science/.test(p) && /(iot|internet of things)/.test(p) },
  { key: 'AI&DS', test: (p) => /artificial intelligence/.test(p) && /data science/.test(p) },
  { key: 'AI&ML', test: (p) => /artificial intelligence/.test(p) && /machine learning/.test(p) },
  { key: 'CSE', test: (p) => /computer science/.test(p) },
  { key: 'IT', test: (p) => /information technology/.test(p) },
  { key: 'MED', test: (p) => /medical electronics/.test(p) },
  { key: 'BME', test: (p) => /biomedical/.test(p) },
  { key: 'EIE', test: (p) => /electronics and instrumentation/.test(p) },
  { key: 'ECE', test: (p) => /electronics and communication/.test(p) },
  { key: 'EEE', test: (p) => /electrical and electronics/.test(p) },
  { key: 'CHEM', test: (p) => /chemical/.test(p) },
  { key: 'AGRI', test: (p) => /agricultur/.test(p) },
  { key: 'MECH', test: (p) => /mechanical/.test(p) },
  { key: 'CIVIL', test: (p) => /civil/.test(p) },
];

export const detectDepartmentKey = (program?: string): string | null => {
  const p = (program || '').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ');
  return PROGRAM_RULES.find((r) => r.test(p))?.key || null;
};

const sheetDeptKey = (sheetName: string): string => sheetName.replace(/^(R\d{4}|\d{4})-/, '');

export interface SheetResolution {
  sheet: CurriculumSheet;
  matchedCount: number;
  total: number;
}

export const resolveTargetSheet = (
  data: MarksheetResult,
  allSheets: CurriculumSheet[],
  currentSheet: CurriculumSheet
): SheetResolution => {
  const deptKey = detectDepartmentKey(data.student_info.program);
  const curricula = allSheets.filter((s) => s.sheet_type === 'curriculum');

  let best: SheetResolution | null = null;
  let bestScore = -1;

  curricula.forEach((sheet) => {
    let codeHits = 0;
    let anyHits = 0;
    const idx = getIndex(sheet.courses);
    data.courses.forEach((m) => {
      const hit = findInIndex(m, idx);
      if (hit && hit.method !== 'fuzzy') {
        anyHits++;
        if (hit.method === 'code') codeHits++;
      }
    });
    const deptMatch = deptKey !== null && sheetDeptKey(sheet.sheet_name) === deptKey;
    const score = codeHits * 10 + anyHits * 3 + (deptMatch ? 40 : 0) + (sheet.sheet_name === currentSheet.sheet_name ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { sheet, matchedCount: anyHits, total: data.courses.length };
    }
  });

  return best || { sheet: currentSheet, matchedCount: 0, total: data.courses.length };
};

export const courseMatchesQuery = (c: Course, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const compactQuery = normalizeCode(q);
  const codes = [c.code_2024, c.code_2019].map(normalizeCode).filter(Boolean);
  if (compactQuery.length >= 3 && codes.some((code) => code.includes(compactQuery))) return true;

  const haystackTokens = titleTokens(
    [c.title, c.prerequisite, c.remarks, c.category, c.course_type, c.offered_by, c.specialization, c.department].join(' ')
  );
  const haystack = haystackTokens.join(' ');
  const qTokens = titleTokens(q);
  if (!qTokens.length) return (c.title || '').toLowerCase().includes(q);

  return qTokens.every((qt) => {
    if (haystack.includes(qt)) return true;
    if (qt.length >= 5 && !/\d/.test(qt)) return haystackTokens.some((h) => h.length >= 4 && !/\d/.test(h) && diceCoefficient(qt, h) >= 0.72);
    return false;
  });
};
