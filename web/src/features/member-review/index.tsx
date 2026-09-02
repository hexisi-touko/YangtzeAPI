/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Clock3,
  KeyRound,
  RefreshCw,
  UserCheck,
  UserX,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatTimestamp } from '@/lib/format'

import {
  getPasswordResetApplications,
  getUserApplications,
  reviewPasswordResetApplication,
  reviewUserApplication,
} from './api'
import { ReviewDecisionDialog } from './components/review-decision-dialog'
import type {
  PasswordResetApplication,
  UserApplication,
  UserApplicationStatus,
} from './types'

type StatusFilter = 'all' | UserApplicationStatus
type Decision = Exclude<UserApplicationStatus, 'pending'>

const EMPTY_APPLICATIONS: UserApplication[] = []
const EMPTY_PASSWORD_RESET_APPLICATIONS: PasswordResetApplication[] = []

function ApplicationStatusBadge(props: { status: UserApplicationStatus }) {
  const { t } = useTranslation()
  if (props.status === 'approved') {
    return (
      <Badge variant='default'>
        <CheckCircle2 />
        {t('Approved')}
      </Badge>
    )
  }
  if (props.status === 'rejected') {
    return (
      <Badge variant='destructive'>
        <XCircle />
        {t('Rejected')}
      </Badge>
    )
  }
  return (
    <Badge variant='warning'>
      <Clock3 />
      {t('Pending review')}
    </Badge>
  )
}

export function MemberReview() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [selectedApplication, setSelectedApplication] =
    useState<UserApplication | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [resetStatusFilter, setResetStatusFilter] =
    useState<StatusFilter>('pending')
  const [selectedPasswordReset, setSelectedPasswordReset] =
    useState<PasswordResetApplication | null>(null)
  const [passwordResetDecision, setPasswordResetDecision] =
    useState<Decision | null>(null)

  const applicationsQuery = useQuery({
    queryKey: ['member-applications'],
    queryFn: () => getUserApplications({ pageSize: 100 }),
  })
  const reviewMutation = useMutation({
    mutationFn: (variables: {
      applicationId: number
      decision: Decision
      reviewComment: string
    }) =>
      reviewUserApplication(
        variables.applicationId,
        variables.decision,
        variables.reviewComment
      ),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to review application'))
        return
      }
      toast.success(result.message || t('Application review completed'))
      setSelectedApplication(null)
      setDecision(null)
      void queryClient.invalidateQueries({ queryKey: ['member-applications'] })
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast.error(t('Failed to review application')),
  })
  const passwordResetApplicationsQuery = useQuery({
    queryKey: ['password-reset-applications'],
    queryFn: () => getPasswordResetApplications({ pageSize: 100 }),
  })
  const passwordResetReviewMutation = useMutation({
    mutationFn: (variables: {
      applicationId: number
      decision: Decision
      reviewNote: string
    }) =>
      reviewPasswordResetApplication(
        variables.applicationId,
        variables.decision,
        variables.reviewNote
      ),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.message || '找回密码申请处理失败')
        return
      }
      toast.success(result.message || '找回密码申请已处理')
      setSelectedPasswordReset(null)
      setPasswordResetDecision(null)
      void queryClient.invalidateQueries({
        queryKey: ['password-reset-applications'],
      })
    },
    onError: () => toast.error('找回密码申请处理失败'),
  })

  const applications = applicationsQuery.data?.data?.items ?? EMPTY_APPLICATIONS
  const counts = useMemo(
    () => ({
      all: applications.length,
      pending: applications.filter((item) => item.status === 'pending').length,
      approved: applications.filter((item) => item.status === 'approved')
        .length,
      rejected: applications.filter((item) => item.status === 'rejected')
        .length,
    }),
    [applications]
  )
  const filteredApplications = useMemo(
    () =>
      statusFilter === 'all'
        ? applications
        : applications.filter((item) => item.status === statusFilter),
    [applications, statusFilter]
  )
  const passwordResetApplications =
    passwordResetApplicationsQuery.data?.data?.items ??
    EMPTY_PASSWORD_RESET_APPLICATIONS
  const filteredPasswordResetApplications = useMemo(
    () =>
      resetStatusFilter === 'all'
        ? passwordResetApplications
        : passwordResetApplications.filter(
            (item) => item.status === resetStatusFilter
          ),
    [passwordResetApplications, resetStatusFilter]
  )

  const openDecision = (
    application: UserApplication,
    nextDecision: Decision
  ) => {
    setSelectedApplication(application)
    setDecision(nextDecision)
  }

  const closeDecision = (open: boolean) => {
    if (!open && !reviewMutation.isPending) {
      setSelectedApplication(null)
      setDecision(null)
    }
  }

  const submitDecision = (reviewComment: string) => {
    if (!selectedApplication || !decision) return
    reviewMutation.mutate({
      applicationId: selectedApplication.id,
      decision,
      reviewComment,
    })
  }

  const filters: Array<{ value: StatusFilter; label: string }> = [
    { value: 'pending', label: t('Pending') },
    { value: 'approved', label: t('Approved') },
    { value: 'rejected', label: t('Rejected') },
    { value: 'all', label: t('All') },
  ]

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Application review')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          <div className='grid gap-3 sm:grid-cols-3'>
            <Card size='sm'>
              <CardHeader>
                <CardDescription>{t('Pending applications')}</CardDescription>
                <CardTitle>{counts.pending}</CardTitle>
              </CardHeader>
            </Card>
            <Card size='sm'>
              <CardHeader>
                <CardDescription>{t('Approved applications')}</CardDescription>
                <CardTitle>{counts.approved}</CardTitle>
              </CardHeader>
            </Card>
            <Card size='sm'>
              <CardHeader>
                <CardDescription>{t('Rejected applications')}</CardDescription>
                <CardTitle>{counts.rejected}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader className='gap-3 lg:flex-row lg:items-center lg:justify-between'>
              <div>
                <CardTitle>{t('Member applications')}</CardTitle>
                <CardDescription>
                  {t(
                    'Approving an application enables the account and issues one API key.'
                  )}
                </CardDescription>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <div
                  className='bg-muted flex rounded-lg p-1'
                  role='group'
                  aria-label={t('Filter applications by status')}
                >
                  {filters.map((filter) => (
                    <Button
                      key={filter.value}
                      type='button'
                      size='sm'
                      variant={
                        statusFilter === filter.value ? 'default' : 'ghost'
                      }
                      onClick={() => setStatusFilter(filter.value)}
                    >
                      {filter.label} ({counts[filter.value]})
                    </Button>
                  ))}
                </div>
                <Button
                  variant='outline'
                  size='icon-sm'
                  onClick={() => void applicationsQuery.refetch()}
                  disabled={applicationsQuery.isFetching}
                  aria-label={t('Refresh applications')}
                  title={t('Refresh applications')}
                >
                  <RefreshCw
                    className={
                      applicationsQuery.isFetching ? 'animate-spin' : undefined
                    }
                  />
                </Button>
              </div>
            </CardHeader>
            <CardContent className='overflow-x-auto'>
              {applicationsQuery.isLoading && (
                <div className='text-muted-foreground py-10 text-center text-sm'>
                  {t('Loading applications...')}
                </div>
              )}
              {!applicationsQuery.isLoading &&
                filteredApplications.length === 0 && (
                  <div className='text-muted-foreground py-10 text-center text-sm'>
                    {t('No applications in this status')}
                  </div>
                )}
              {!applicationsQuery.isLoading &&
                filteredApplications.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Member')}</TableHead>
                        <TableHead>{t('Application reason')}</TableHead>
                        <TableHead>{t('Status')}</TableHead>
                        <TableHead>{t('Submitted at')}</TableHead>
                        <TableHead>{t('Review result')}</TableHead>
                        <TableHead className='text-right'>
                          {t('Actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredApplications.map((application) => (
                        <TableRow key={application.id}>
                          <TableCell>
                            <div className='flex min-w-40 items-center gap-2'>
                              <UserCheck className='text-muted-foreground size-4' />
                              <div className='min-w-0'>
                                <div className='truncate font-medium'>
                                  {application.display_name ||
                                    application.username}
                                </div>
                                <div className='text-muted-foreground truncate text-xs'>
                                  @{application.username}
                                  {application.email
                                    ? ` · ${application.email}`
                                    : ''}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className='max-w-md min-w-56 whitespace-pre-wrap'>
                              {application.reason}
                            </p>
                          </TableCell>
                          <TableCell>
                            <ApplicationStatusBadge
                              status={application.status}
                            />
                          </TableCell>
                          <TableCell>
                            {formatTimestamp(application.created_at)}
                          </TableCell>
                          <TableCell>
                            {application.status === 'pending' ? (
                              <span className='text-muted-foreground'>-</span>
                            ) : (
                              <div className='max-w-64 space-y-1'>
                                <div className='text-xs font-medium'>
                                  {application.reviewer_username ||
                                    t('Administrator')}
                                </div>
                                <div className='text-muted-foreground text-xs whitespace-pre-wrap'>
                                  {application.review_comment ||
                                    t('No review comment')}
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {application.status === 'pending' ? (
                              <div className='flex justify-end gap-2'>
                                <Button
                                  size='sm'
                                  onClick={() =>
                                    openDecision(application, 'approved')
                                  }
                                >
                                  <CheckCircle2 />
                                  {t('Approve')}
                                </Button>
                                <Button
                                  variant='destructive'
                                  size='sm'
                                  onClick={() =>
                                    openDecision(application, 'rejected')
                                  }
                                >
                                  <UserX />
                                  {t('Reject')}
                                </Button>
                              </div>
                            ) : (
                              <div className='text-muted-foreground text-right text-xs'>
                                {formatTimestamp(application.reviewed_at)}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='gap-3 lg:flex-row lg:items-center lg:justify-between'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <KeyRound className='size-4' />
                  找回密码申请
                </CardTitle>
                <CardDescription>
                  审核只决定是否允许重置；新密码由成员在客户端中设置。
                </CardDescription>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <div
                  className='bg-muted flex rounded-lg p-1'
                  role='group'
                  aria-label='筛选找回密码申请'
                >
                  {filters.map((filter) => (
                    <Button
                      key={filter.value}
                      type='button'
                      size='sm'
                      variant={
                        resetStatusFilter === filter.value
                          ? 'default'
                          : 'ghost'
                      }
                      onClick={() => setResetStatusFilter(filter.value)}
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>
                <Button
                  variant='outline'
                  size='icon-sm'
                  onClick={() => void passwordResetApplicationsQuery.refetch()}
                  disabled={passwordResetApplicationsQuery.isFetching}
                  aria-label='刷新找回密码申请'
                  title='刷新找回密码申请'
                >
                  <RefreshCw
                    className={
                      passwordResetApplicationsQuery.isFetching
                        ? 'animate-spin'
                        : undefined
                    }
                  />
                </Button>
              </div>
            </CardHeader>
            <CardContent className='overflow-x-auto'>
              {passwordResetApplicationsQuery.isLoading && (
                <div className='text-muted-foreground py-10 text-center text-sm'>
                  正在加载找回密码申请...
                </div>
              )}
              {!passwordResetApplicationsQuery.isLoading &&
                filteredPasswordResetApplications.length === 0 && (
                  <div className='text-muted-foreground py-10 text-center text-sm'>
                    当前状态下没有找回密码申请
                  </div>
                )}
              {!passwordResetApplicationsQuery.isLoading &&
                filteredPasswordResetApplications.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>成员</TableHead>
                        <TableHead>申请理由</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>提交时间</TableHead>
                        <TableHead>审核结果</TableHead>
                        <TableHead className='text-right'>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPasswordResetApplications.map((application) => (
                        <TableRow key={application.id}>
                          <TableCell>
                            <div className='min-w-40'>
                              <div className='truncate font-medium'>
                                {application.display_name || application.username}
                              </div>
                              <div className='text-muted-foreground truncate text-xs'>
                                @{application.username}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className='max-w-md min-w-56 whitespace-pre-wrap'>
                              {application.reason}
                            </p>
                          </TableCell>
                          <TableCell>
                            <ApplicationStatusBadge status={application.status} />
                          </TableCell>
                          <TableCell>
                            {formatTimestamp(application.created_at)}
                          </TableCell>
                          <TableCell>
                            {application.status === 'pending' ? (
                              <span className='text-muted-foreground'>-</span>
                            ) : (
                              <div className='max-w-64 space-y-1'>
                                <div className='text-xs font-medium'>
                                  {application.reviewer_username || '管理员'}
                                </div>
                                <div className='text-muted-foreground text-xs whitespace-pre-wrap'>
                                  {application.review_note || '无审核说明'}
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {application.status === 'pending' ? (
                              <div className='flex justify-end gap-2'>
                                <Button
                                  size='sm'
                                  onClick={() => {
                                    setSelectedPasswordReset(application)
                                    setPasswordResetDecision('approved')
                                  }}
                                >
                                  <CheckCircle2 />
                                  批准
                                </Button>
                                <Button
                                  variant='destructive'
                                  size='sm'
                                  onClick={() => {
                                    setSelectedPasswordReset(application)
                                    setPasswordResetDecision('rejected')
                                  }}
                                >
                                  <UserX />
                                  拒绝
                                </Button>
                              </div>
                            ) : (
                              <div className='text-muted-foreground text-right text-xs'>
                                {formatTimestamp(application.reviewed_at)}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
            </CardContent>
          </Card>
        </div>

        <ReviewDecisionDialog
          application={selectedApplication}
          decision={decision}
          pending={reviewMutation.isPending}
          onOpenChange={closeDecision}
          onSubmit={submitDecision}
        />
        <ReviewDecisionDialog
          application={selectedPasswordReset}
          decision={passwordResetDecision}
          pending={passwordResetReviewMutation.isPending}
          onOpenChange={(open) => {
            if (!open && !passwordResetReviewMutation.isPending) {
              setSelectedPasswordReset(null)
              setPasswordResetDecision(null)
            }
          }}
          onSubmit={(reviewNote) => {
            if (!selectedPasswordReset || !passwordResetDecision) return
            passwordResetReviewMutation.mutate({
              applicationId: selectedPasswordReset.id,
              decision: passwordResetDecision,
              reviewNote,
            })
          }}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
