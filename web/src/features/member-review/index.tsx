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

import { getUserApplications, reviewUserApplication } from './api'
import { ReviewDecisionDialog } from './components/review-decision-dialog'
import type { UserApplication, UserApplicationStatus } from './types'

type StatusFilter = 'all' | UserApplicationStatus
type Decision = Exclude<UserApplicationStatus, 'pending'>

const EMPTY_APPLICATIONS: UserApplication[] = []

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
        </div>

        <ReviewDecisionDialog
          application={selectedApplication}
          decision={decision}
          pending={reviewMutation.isPending}
          onOpenChange={closeDecision}
          onSubmit={submitDecision}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
