import {
  resolveFacultyProfileV2FacultiesPost,
  resolveStudentDegreeProfileV2StudentDegreesPost,
  resolveStudentGroupProfileV2StudentGroupsPost,
  resolveUniversityProfileV2UniversitiesPost,
  type MyProfileWriteV3,
} from '@/api/generated/almaEventFlow'

export interface Choice<T> { id: T | null; draft: string | null }

export const pick = <T,>(id: T | null = null): Choice<T> => ({ id, draft: null })

export const MAX_GRADE = 12

/** Учёба в форме подробной информации и в чек-листе: одни поля, одни проверки. */
export interface StudyForm {
  isStudent: boolean
  studentId: string
  isBudget: boolean
  isFull: boolean
  isActive: boolean
  university: Choice<string>
  faculty: Choice<string>
  group: Choice<number>
  degree: Choice<number>
  grade: string
}

export type StudyErrorKey = 'studentId' | 'university' | 'faculty' | 'group' | 'degree' | 'grade'
export type StudyErrors = Partial<Record<StudyErrorKey, string>>

export function emptyStudy(isStudent = false): StudyForm {
  return {
    isStudent, studentId: '', isBudget: false, isFull: false, isActive: true,
    university: pick(), faculty: pick(), group: pick(), degree: pick(), grade: '',
  }
}

const named = (value: Choice<unknown>) => value.id != null || !!value.draft

export function studyErrors(form: StudyForm): StudyErrors {
  const errors: StudyErrors = {}
  if (!form.isStudent) return errors
  if (!form.studentId.trim()) errors.studentId = 'Укажите номер студенческого билета'
  if (!named(form.group)) errors.group = 'Укажите группу'
  if (form.group.id == null && named(form.group)) {
    if (!named(form.faculty)) errors.faculty = 'Укажите факультет'
    else if (form.faculty.id == null && !named(form.university)) errors.university = 'Укажите университет'
    if (!named(form.degree)) errors.degree = 'Укажите степень'
    const grade = Number(form.grade)
    if (!Number.isInteger(grade) || grade < 1 || grade > MAX_GRADE) errors.grade = `Курс от 1 до ${MAX_GRADE}`
  }
  return errors
}

/** Создаёт вписанные вручную университет, факультет, степень и группу; до сохранения их нет. */
export async function resolveStudy(form: StudyForm): Promise<void> {
  if (!form.isStudent || form.group.id != null || !form.group.draft) return
  if (!form.faculty.id && form.faculty.draft) {
    if (!form.university.id && form.university.draft) {
      form.university = pick((await resolveUniversityProfileV2UniversitiesPost({ name: form.university.draft })).data.id)
    }
    form.faculty = pick((await resolveFacultyProfileV2FacultiesPost({
      name: form.faculty.draft, university_id: form.university.id as string,
    })).data.id)
  }
  if (!form.degree.id && form.degree.draft) {
    form.degree = pick((await resolveStudentDegreeProfileV2StudentDegreesPost({ name: form.degree.draft })).data.id)
  }
  form.group = pick((await resolveStudentGroupProfileV2StudentGroupsPost({
    name: form.group.draft, degree_id: form.degree.id as number,
    faculty_id: form.faculty.id as string, grade: Number(form.grade),
  })).data.id)
}

export function studentWrite(form: StudyForm): MyProfileWriteV3['student'] {
  if (!form.isStudent || form.group.id == null) return null
  return {
    student_id: form.studentId.trim(),
    group_id: form.group.id,
    faculty_id: form.faculty.id,
    is_budget: form.isBudget,
    is_full: form.isFull,
    is_active: form.isActive,
  }
}
