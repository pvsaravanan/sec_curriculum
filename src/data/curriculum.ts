import rawData from './curriculum_data.json';
import { CurriculumSheet } from '@/types/curriculum';

export const allSheets: CurriculumSheet[] = rawData as unknown as CurriculumSheet[];
