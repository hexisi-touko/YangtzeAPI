/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { api } from '@/lib/api'

import type {
  UserApplicationDecisionResponse,
  UserApplicationListResponse,
  UserApplicationStatus,
  PasswordResetApplicationListResponse,
} from './types'

export async function getUserApplications(params?: {
  status?: UserApplicationStatus
  page?: number
  pageSize?: number
}): Promise<UserApplicationListResponse> {
  const res = await api.get('/api/user/applications', {
    params: {
      status: params?.status,
      p: params?.page ?? 1,
      page_size: params?.pageSize ?? 100,
    },
  })
  return res.data
}

export async function reviewUserApplication(
  applicationId: number,
  decision: Exclude<UserApplicationStatus, 'pending'>,
  reviewComment: string
): Promise<UserApplicationDecisionResponse> {
  const res = await api.post(
    `/api/user/applications/${applicationId}/${decision === 'approved' ? 'approve' : 'reject'}`,
    { review_comment: reviewComment }
  )
  return res.data
}

export async function getPasswordResetApplications(params?: {
  status?: UserApplicationStatus
  page?: number
  pageSize?: number
}): Promise<PasswordResetApplicationListResponse> {
  const res = await api.get('/api/user/password-reset-applications', {
    params: {
      status: params?.status,
      p: params?.page ?? 1,
      page_size: params?.pageSize ?? 100,
    },
  })
  return res.data
}

export async function reviewPasswordResetApplication(
  applicationId: number,
  decision: Exclude<UserApplicationStatus, 'pending'>,
  reviewNote: string
): Promise<UserApplicationDecisionResponse> {
  const res = await api.post(
    `/api/user/password-reset-applications/${applicationId}/${decision === 'approved' ? 'approve' : 'reject'}`,
    { review_comment: reviewNote }
  )
  return res.data
}
