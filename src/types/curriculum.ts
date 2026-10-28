export interface Course {
  id: string;
  sno?: string | number;
  remarks?: string;
  category?: string;
  code_2024?: string;
  code_2019?: string;
  title: string;
  prerequisite?: string;
  theory_credits?: number;
  practical_credits?: number;
  total_credits: number;
  cgpa_type?: string;
  course_type?: string;
  offered_by?: string;
  specialization?: string;
  department?: string;
}

export interface CreditRequirement {
  category: string;
  regular_credits: number;
  lateral_credits: number;
  offered_credits?: number;
}

export interface CurriculumMetadata {
  department?: string;
  degree?: string;
  regulation?: string;
  title?: string;
  batches?: string[];
}

export interface CurriculumSheet {
  sheet_name: string;
  sheet_type: 'curriculum' | 'minors' | 'open_electives' | 'online_courses';
  metadata: CurriculumMetadata;
  active_batch?: string;
  batches?: Record<string, CreditRequirement[]>;
  credit_requirements: CreditRequirement[];
  courses: Course[];
}

export interface CourseProgress {
  status: 'none' | 'completed';
  grade?: string;
  semester?: number;
}

export interface SemesterRecord {
  uploaded: boolean;
  session?: string;
  credits: number;
  sgpa: string;
  courses: MarksheetCourse[];
}

export interface StudentProgress {
  mode: 'regular' | 'lateral';
  batch?: string;
  courses: Record<string, CourseProgress>;
  semesters?: Record<number, SemesterRecord>;
}

export interface MarksheetCourse {
  raw_course: string;
  course_code: string;
  course_title: string;
  grade: string;
  grade_point: string;
  credits: string;
  result_status: string;
  is_pass: boolean;
}

export interface MarksheetStudentInfo {
  college?: string;
  exam_session?: string;
  student_name?: string;
  reg_no?: string;
  semester?: string;
  gender?: string;
  program?: string;
  total_registered?: number;
  total_completed?: number;
}

export interface MarksheetResult {
  student_info: MarksheetStudentInfo;
  courses: MarksheetCourse[];
  validation?: {
    parsed_credits: number;
    marksheet_credits: number;
    credits_match: boolean;
  };
}
