/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import type { UserApplicationStatus } from '../types'

type ReviewApplicant = {
  id: number
  username: string
}

type ReviewDecisionDialogProps = {
  application: ReviewApplicant | null
  decision: Exclude<UserApplicationStatus, 'pending'> | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (reviewComment: string) => void
}

export function ReviewDecisionDialog(props: ReviewDecisionDialogProps) {
  const { t } = useTranslation()
  const [reviewComment, setReviewComment] = useState('')
  const open = props.application !== null && props.decision !== null
  const rejecting = props.decision === 'rejected'

  useEffect(() => {
    if (open) setReviewComment('')
  }, [open, props.application?.id, props.decision])

  const submitDisabled =
    props.pending || (rejecting && reviewComment.trim().length === 0)

  return (
    <Dialog
      open={open}
      onOpenChange={props.onOpenChange}
      title={rejecting ? t('Reject application') : t('Approve application')}
      description={t('Review application from {{username}}', {
        username: props.application?.username ?? '',
      })}
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={props.pending}
          >
            {t('Cancel')}
          </Button>
          <Button
            variant={rejecting ? 'destructive' : 'default'}
            onClick={() => props.onSubmit(reviewComment.trim())}
            disabled={submitDisabled}
          >
            {rejecting
              ? t('Confirm rejection')
              : t('Approve and issue API key')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label htmlFor='review-comment'>
          {rejecting ? t('Rejection reason') : t('Review comment (optional)')}
        </Label>
        <Textarea
          id='review-comment'
          value={reviewComment}
          onChange={(event) => setReviewComment(event.target.value)}
          placeholder={
            rejecting
              ? t('Explain why this application was rejected')
              : t('Add an internal review note')
          }
          maxLength={500}
          rows={4}
          aria-required={rejecting}
        />
        <div className='text-muted-foreground text-right text-xs'>
          {reviewComment.length}/500
        </div>
      </div>
    </Dialog>
  )
}
