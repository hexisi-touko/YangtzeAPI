/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { UserApplication } from '../types'
import { ReviewDecisionDialog } from './review-decision-dialog'

const application: UserApplication = {
  id: 12,
  user_id: 34,
  username: 'member01',
  display_name: 'Member 01',
  email: 'member01@example.com',
  user_status: 3,
  reason: 'I need API access for project integration testing.',
  status: 'pending',
  reviewer_id: null,
  reviewer_username: '',
  review_comment: '',
  reviewed_at: 0,
  issued_token_id: null,
  created_at: 1_788_310_000,
  updated_at: 1_788_310_000,
}

describe('ReviewDecisionDialog', () => {
  test('requires a rejection reason before submitting', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <ReviewDecisionDialog
        application={application}
        decision='rejected'
        pending={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />
    )

    const submit = screen.getByRole('button', { name: 'Confirm rejection' })
    expect(submit).toBeDisabled()

    await user.type(
      screen.getByRole('textbox', { name: 'Rejection reason' }),
      'Please provide a concrete project use case.'
    )
    expect(submit).toBeEnabled()

    await user.click(submit)
    expect(onSubmit).toHaveBeenCalledWith(
      'Please provide a concrete project use case.'
    )
  })

  test('allows approval without an optional review comment', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <ReviewDecisionDialog
        application={application}
        decision='approved'
        pending={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />
    )

    const submit = screen.getByRole('button', {
      name: 'Approve and issue API key',
    })
    expect(submit).toBeEnabled()

    await user.click(submit)
    expect(onSubmit).toHaveBeenCalledWith('')
  })
})
