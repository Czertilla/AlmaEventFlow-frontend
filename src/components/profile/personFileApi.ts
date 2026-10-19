import type { AxiosResponse } from 'axios'
import {
  createMyContactProfileV1ContactsMyPost,
  createPersonContactProfileV1PersonsPersonIdContactsPost,
  createProfileProfileV1ProfilesPost,
  createStudentProfileV1StudentsPost,
  deleteContactProfileV1ContactsIdDelete,
  deleteMyContactProfileV1ContactsMyContactIdDelete,
  deleteMyStudentProfileV2StudentsMyDelete,
  deleteStudentProfileV1StudentsStudentIdDelete,
  getMyContactsProfileV1ContactsMyGet,
  getMyPersonProfileV1PersonsMyGet,
  getMyProfileProfileV1ProfilesMyGet,
  getMyStudentProfileV2StudentsMyGet,
  getPersonContactsProfileV1PersonsPersonIdContactsGet,
  getPersonProfileV1PersonsPersonIdGet,
  getProfileProfileV1ProfilesProfileIdGet,
  getStudentProfileV1StudentsStudentIdGet,
  patchContactProfileV1ContactsIdPatch,
  patchMyContactProfileV1ContactsMyContactIdPatch,
  patchMyPersonProfileV1PersonsMyPatch,
  patchPersonProfileV1PersonsPersonIdPatch,
  patchProfileProfileV1ProfilesProfileIdPatch,
  patchStudentProfileV1StudentsStudentIdPatch,
  putMyProfileProfileV1ProfilesMyPut,
  putMyStudentProfileV2StudentsMyPut,
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

export function myPersonFileApi(): PersonFileApi {
  return {
    getPerson: () => data(getMyPersonProfileV1PersonsMyGet()),
    patchPerson: (body) => data(patchMyPersonProfileV1PersonsMyPatch(body)),
    getProfile: () => data(getMyProfileProfileV1ProfilesMyGet()),
    saveProfile: (body) => data(putMyProfileProfileV1ProfilesMyPut(body)),
    getStudent: () => data(getMyStudentProfileV2StudentsMyGet()),
    saveStudent: (body) => data(putMyStudentProfileV2StudentsMyPut(body)),
    removeStudent: () => done(deleteMyStudentProfileV2StudentsMyDelete()),
    listContacts: async () => (await getMyContactsProfileV1ContactsMyGet({ limit: 100 })).data.items,
    addContact: (body) => done(createMyContactProfileV1ContactsMyPost(body)),
    saveContact: (id, body) => data(patchMyContactProfileV1ContactsMyContactIdPatch(id, body)),
    removeContact: (id) => done(deleteMyContactProfileV1ContactsMyContactIdDelete(id)),
  }
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
