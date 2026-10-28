import sys
import json
import re
import warnings

warnings.filterwarnings('ignore')
import logging
logging.getLogger("pdfminer").setLevel(logging.ERROR)

import pdfplumber

CODE_RE = r'(?:\d{2}[A-Z]{2,3}\d{3,4}|[A-Z]{2,3}\d{4}|\d{2}[A-Z]{1,3}\d{2,4}[A-Z]?)'
GRADE_RE = r'(?:O|A\+|A|B\+|B|C|P|F|RA|AB|W|U|SA|UA)'
PASS_GRADES = {'O', 'A+', 'A', 'B+', 'B', 'C', 'P'}
FAIL_GRADES = {'F', 'RA', 'U', 'UA', 'AB', 'W', 'SA'}
REPEAT_RE = re.compile(r'(.)\1{3,}')

COURSE_ROW_RE = re.compile(
    rf'^(?:(?:ODD|EVEN)\s+)?(?P<code>{CODE_RE})\s*[-:]\s*(?P<title>.*?)\s+'
    rf'(?P<gp>\d{{1,2}})\s+(?P<grade>{GRADE_RE})\s+(?P<credits>\d{{1,2}}(?:\.\d)?)\s*(?P<status>Pass|Fail|RA|Absent|Withdrawn|W)?\s*$',
    re.IGNORECASE,
)
COURSE_START_RE = re.compile(rf'^(?:(?:ODD|EVEN)\s+)?{CODE_RE}\s*[-:]', re.IGNORECASE)


def dedupe_chars(text):
    return REPEAT_RE.sub(r'\1', text or '')


def squash(text):
    return re.sub(r'\s+', ' ', str(text or '')).strip()


def clean_title(title):
    """Drop tokens carrying non-latin glyphs (e.g. mis-encoded Tamil) and stray separators."""
    parts = [p for p in re.split(r'\s+', squash(title)) if p]
    kept = [p for p in parts if all(ord(ch) < 0x250 for ch in p) and not re.search(r'[\"$%*+’]', p)]
    out = ' '.join(kept)
    out = re.sub(r'^[\s/\-:]+|[\s/\-:]+$', '', out)
    out = re.sub(r'\s*/\s*(?=/)', ' ', out)
    return squash(out)


def split_code_title(raw_course):
    raw_course = squash(raw_course)
    m = re.match(rf'^({CODE_RE})\s*[-:]\s*(.*)$', raw_course, re.IGNORECASE)
    if m:
        return m.group(1).upper(), clean_title(m.group(2))
    m = re.match(rf'^({CODE_RE})\s+(.+)$', raw_course, re.IGNORECASE)
    if m:
        return m.group(1).upper(), clean_title(m.group(2))
    return '', clean_title(raw_course)


def normalize_grade(grade):
    g = squash(grade).upper().replace(' ', '')
    if g in ('NONE', '-', ''):
        return ''
    return g


def derive_pass(status, grade):
    s = status.lower()
    if s:
        if 'fail' in s or s in ('ra', 'absent', 'w', 'withdrawn') or 'reappear' in s:
            return False
        if 'pass' in s:
            return True
    if grade in FAIL_GRADES:
        return False
    return grade in PASS_GRADES


def make_course(raw_course, grade, grade_pt, credits_val, status):
    code, title = split_code_title(raw_course)
    grade = normalize_grade(grade)
    status = squash(status)
    return {
        'raw_course': squash(raw_course),
        'course_code': code,
        'course_title': title,
        'grade': grade,
        'grade_point': squash(grade_pt),
        'credits': squash(credits_val),
        'result_status': status,
        'is_pass': derive_pass(status, grade),
    }


def locate_columns(header):
    cols = {'course': -1, 'grade_pt': -1, 'grade': -1, 'credit': -1, 'result': -1}
    for idx, h in enumerate(header):
        if 'course' in h:
            cols['course'] = idx
        elif 'grade' in h and 'point' in h:
            cols['grade_pt'] = idx
        elif h == 'grade' or h.startswith('grade') and 'point' not in h:
            cols['grade'] = idx
        elif 'credit' in h:
            cols['credit'] = idx
        elif 'result' in h or 'status' in h:
            cols['result'] = idx
    return cols


def cell(row, idx):
    return row[idx] if 0 <= idx < len(row) else ''


def parse_tables(page, courses):
    for table in page.extract_tables():
        if not table or len(table) < 2:
            continue
        header_row = None
        for ri, row in enumerate(table[:3]):
            header = [squash(dedupe_chars(str(c or ''))).lower() for c in row]
            cols = locate_columns(header)
            if cols['course'] != -1 and (cols['grade'] != -1 or cols['credit'] != -1):
                header_row = ri
                break
        if header_row is None:
            continue

        pending = None
        for row in table[header_row + 1:]:
            if not row:
                continue
            raw_course = squash(cell(row, cols['course']))
            if not raw_course:
                continue
            low = raw_course.lower()
            if any(k in low for k in ['credit registered', 'credit completed', 'controller of', 'sd/..']):
                continue
            grade = normalize_grade(cell(row, cols['grade']))
            credits_val = squash(cell(row, cols['credit']))
            if not grade and not credits_val:
                if pending is not None and not re.match(CODE_RE, raw_course, re.IGNORECASE):
                    pending['raw_course'] = squash(pending['raw_course'] + ' ' + raw_course)
                continue
            c = make_course(raw_course, grade, cell(row, cols['grade_pt']), credits_val, cell(row, cols['result']))
            if not c['course_code'] and not c['grade']:
                continue
            courses.append(c)
            pending = c


def parse_text_rows(full_text, courses):
    lines = [squash(dedupe_chars(l)) for l in full_text.split('\n')]
    lines = [l for l in lines if l]
    buf = ''
    for line in lines:
        starts = COURSE_START_RE.match(line)
        if starts:
            buf = line
        elif buf and not re.search(r'(Page \d+|https?://|Semester:|Program:|Controller|Sd/)', line, re.IGNORECASE):
            buf = squash(buf + ' ' + line)
        else:
            buf = ''
            continue
        m = COURSE_ROW_RE.match(buf)
        if m:
            code, title, gp, grade, credits_val, status = (m.group(k) for k in ('code', 'title', 'gp', 'grade', 'credits', 'status'))
            courses.append(make_course(f'{code}-{title}', grade, gp, credits_val, status or 'Pass'))
            buf = ''


def dedupe_courses(courses):
    seen, out = {}, []
    for c in courses:
        key = c['course_code'] or c['course_title'].lower()
        if key in seen:
            continue
        seen[key] = True
        out.append(c)
    return out


def parse_marksheet(pdf_path):
    student_info = {
        'college': 'Saveetha Engineering College (Autonomous)',
        'exam_session': '',
        'student_name': '',
        'reg_no': '',
        'semester': '',
        'gender': '',
        'program': '',
        'total_registered': 0,
        'total_completed': 0,
    }
    courses = []
    full_text = ''

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            full_text += (page.extract_text() or '') + '\n'
            parse_tables(page, courses)

    table_codes = {c['course_code'] for c in courses if c['course_code']}
    text_courses = []
    parse_text_rows(full_text, text_courses)
    for c in text_courses:
        if c['course_code'] not in table_codes:
            courses.append(c)

    courses = dedupe_courses(courses)

    lines = [squash(dedupe_chars(l)) for l in full_text.split('\n') if l.strip()]
    for idx, line in enumerate(lines):
        if 'Saveetha Engineering College' in line:
            student_info['college'] = line
        elif 'End Semester Examination' in line:
            student_info['exam_session'] = line
        elif 'Student Name:' in line:
            name_m = re.search(r'Student Name:\s*([A-Za-z\s\.]+?)(?:Reg\. No\.:|$)', line, re.IGNORECASE)
            reg_m = re.search(r'Reg\. No\.:\s*([0-9]+)', line, re.IGNORECASE)
            if name_m:
                s_name = name_m.group(1).strip()
                if idx + 1 < len(lines) and not any(k in lines[idx + 1] for k in ['Semester:', 'Program:', 'Reg. No.', 'Gender:']):
                    s_name += ' ' + lines[idx + 1].strip()
                student_info['student_name'] = squash(re.sub(r'\(.*?\)', '', s_name))
            if reg_m:
                student_info['reg_no'] = reg_m.group(1).strip()
        elif 'Program:' in line:
            prog_m = re.search(r'Program:\s*(.+)', line, re.IGNORECASE)
            if prog_m:
                student_info['program'] = prog_m.group(1).strip()
        elif 'Semester:' in line:
            sem_m = re.search(r'Semester:\s*([A-Za-z0-9]+)', line, re.IGNORECASE)
            if sem_m:
                student_info['semester'] = sem_m.group(1).strip()
            gen_m = re.search(r'Gender:\s*([A-Za-z]+)', line, re.IGNORECASE)
            if gen_m:
                student_info['gender'] = gen_m.group(1).strip()
        elif 'Gender:' in line:
            gen_m = re.search(r'Gender:\s*([A-Za-z]+)', line, re.IGNORECASE)
            if gen_m:
                student_info['gender'] = gen_m.group(1).strip()

    compact = re.sub(r'\s+', ' ', dedupe_chars(full_text))
    reg_m = re.search(r'Credit Registered\s*:\s*([0-9]+)', compact)
    comp_m = re.search(r'Credit Completed\s*:\s*([0-9]+)', compact)
    if reg_m:
        student_info['total_registered'] = int(reg_m.group(1))
    if comp_m:
        student_info['total_completed'] = int(comp_m.group(1))

    if not student_info['reg_no']:
        reg_m = re.search(r'\((?:tel:)?(\d{10,14})\)', compact)
        if reg_m:
            student_info['reg_no'] = reg_m.group(1)

    parsed_credits = 0.0
    for c in courses:
        try:
            if c['is_pass']:
                parsed_credits += float(c['credits'] or 0)
        except ValueError:
            pass

    return {
        'student_info': student_info,
        'courses': courses,
        'validation': {
            'parsed_credits': parsed_credits,
            'marksheet_credits': student_info['total_completed'],
            'credits_match': not student_info['total_completed'] or abs(parsed_credits - student_info['total_completed']) < 0.01,
        },
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No PDF file path provided'}))
        sys.exit(1)

    print(json.dumps(parse_marksheet(sys.argv[1]), indent=2, ensure_ascii=False))
