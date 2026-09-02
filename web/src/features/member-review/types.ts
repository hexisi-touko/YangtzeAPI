/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
export type UserApplicationStatus = 'pending' | 'approved' | 'rejected'

export interface UserApplication {
  id: number
  user_id: number
  username: string
  display_name: string
  email: string
  user_status: number
  reason: string
  status: UserApplicationStatus
  reviewer_id: number | null
  reviewer_username: string
  review_comment: string
  reviewed_at: number
  issued_token_id: number | null
  created_at: number
  updated_at: number
}

export interface UserApplicationListResponse {
  success: boolean
  message?: string
  data?: {
    items: UserApplication[]
    total: number
    page: number
    page_size: number
  }
}

export interface UserApplicationDecisionResponse {
  success: boolean
  message?: string
  data?: {
    application_id: number
    application_status: UserApplicationStatus
    reason: string
    review_comment: string
    reviewed_at: number
    created_at: number
  }
}
