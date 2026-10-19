import type { AxiosResponse } from 'axios'
import {
  createPersonContactProfileV1PersonsPersonIdContactsPost,
  createProfileProfileV1ProfilesPost,
  createStudentProfileV1StudentsPost,
  deleteContactProfileV1ContactsIdDelete,
  deleteStudentProfileV1StudentsStudentIdDelete,
  getPersonContactsProfileV1PersonsPersonIdContactsGet,
  getPersonProfileV1PersonsPersonIdGet,
  getProfileProfileV1ProfilesProfileIdGet,
  getStudentProfileV1StudentsStudentIdGet,
  patchContactProfileV1ContactsIdPatch,
  patchPersonProfileV1PersonsPersonIdPatch,
  patchProfileProfileV1ProfilesProfileIdPatch,
  patchStudentProfileV1StudentsStudentIdPatch,
} from '@/api/generated/almaEventFlow'
import type {
  ContactItemCreate,
  ContactItemRead,
  ContactPatchData,
  ContactRead,
  PersonPatchData,
  PersonRead,
  ProfilePutData,
  ProfileRead,
  StudentPutData,
  StudentRead,
} from '@/api/generated/almaEventFlow'

export interface PersonFileApi {
  getPerson(): Promise<PersonRead>
  patchPerson(body: PersonPatchData): Promise<PersonRead>
  getProfile(): Promise<ProfileRead>
  saveProfile(body: ProfilePutData, exists: boolean): Promise<ProfileRead>
  getStudent(): Promise<StudentRead>
  saveStudent(body: StudentPutData, exists: boolean): Promise<StudentRead>
  removeStudent(): Promise<void>
  listContacts(): Promise<ContactItemRead[]>
  addContact(body: ContactItemCreate): Promise<void>
  saveContact(id: string, body: ContactPatchData): Promise<ContactRead>
  removeContact(id: string): Promise<void>
}

const data = async <T>(response: Promise<AxiosResponse<T>>): Promise<T> => (await response).data

const done = async (response: Promise<unknown>): Promise<void> => {
  await response
}

export function adminPersonFileApi(personId: string): PersonFileApi {
  return {
    getPerson: () => data(getPersonProfileV1PersonsPersonIdGet(personId)),
    patchPerson: (body) => data(patchPersonProfileV1PersonsPersonIdPatch(personId, body)),
    getProfile: () => data(getProfileProfileV1ProfilesProfileIdGet(personId)),
    saveProfile: (body, exists) =>
      exists
        ? data(patchProfileProfileV1ProfilesProfileIdPatch(personId, body))
        : data(createProfileProfileV1ProfilesPost({ id: personId, ...body })),
    getStudent: () => data(getStudentProfileV1StudentsStudentIdGet(personId)),
    saveStudent: (body, exists) =>
      exists
        ? data(patchStudentProfileV1StudentsStudentIdPatch(personId, body))
        : data(createStudentProfileV1StudentsPost({ id: personId, ...body })),
    removeStudent: () => done(deleteStudentProfileV1StudentsStudentIdDelete(personId)),
    listContacts: async () => (await getPersonContactsProfileV1PersonsPersonIdContactsGet(personId, { limit: 100 })).data.items,
    addContact: (body) => done(createPersonContactProfileV1PersonsPersonIdContactsPost(personId, body)),
    saveContact: (id, body) => data(patchContactProfileV1ContactsIdPatch(id, body)),
    removeContact: (id) => done(deleteContactProfileV1ContactsIdDelete(id)),
  }
}
