/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, RefreshCw, UserCheck, UserX } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { getUsers, manageUser } from '@/features/users/api'
import { USER_STATUS } from '@/features/users/constants'
import type { User } from '@/features/users/types'
import { formatQuota, formatTimestamp } from '@/lib/format'

function isMember(user: User) {
  return user.role === 1 && user.DeletedAt == null
}

function ReviewStatus({ user }: { user: User }) {
  if (user.status === USER_STATUS.DISABLED) {
    return <Badge variant='warning'>待审核候选</Badge>
  }
  return (
    <Badge variant='default'>
      <CheckCircle2 />
      已启用
    </Badge>
  )
}

export function MemberReview() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['member-review-users'],
    queryFn: () => getUsers({ p: 1, page_size: 100, sort_by: 'created_at', sort_order: 'desc' }),
  })
  const reviewMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'enable' | 'disable' }) =>
      manageUser(id, action),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.message || '操作失败')
        return
      }
      toast.success('账号状态已更新')
      void queryClient.invalidateQueries({ queryKey: ['member-review-users'] })
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast.error('操作失败，请稍后重试'),
  })

  const members = useMemo(
    () => (data?.data?.items ?? []).filter(isMember),
    [data?.data?.items]
  )
  const pendingMembers = members.filter(
    (user) => user.status === USER_STATUS.DISABLED
  )

  const handleAction = (user: User, action: 'enable' | 'disable') => {
    reviewMutation.mutate({ id: user.id, action })
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('审核管理')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          <Alert>
            <Clock3 />
            <AlertTitle>当前为前端审核工作台</AlertTitle>
            <AlertDescription>
              后端目前只有“启用/禁用”状态，没有独立的待审核字段。因此本页暂时把禁用的普通成员作为审核候选；正式审核状态和审核记录需要后端接口配合。
            </AlertDescription>
          </Alert>

          <div className='grid gap-4 sm:grid-cols-3'>
            <Card size='sm'>
              <CardHeader>
                <CardDescription>成员总数</CardDescription>
                <CardTitle>{members.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card size='sm'>
              <CardHeader>
                <CardDescription>审核候选</CardDescription>
                <CardTitle className='text-warning'>{pendingMembers.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card size='sm'>
              <CardHeader>
                <CardDescription>Key 发放</CardDescription>
                <CardTitle className='text-muted-foreground text-base'>后端待接入</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader className='flex-row items-center justify-between gap-3'>
              <div>
                <CardTitle>组内成员</CardTitle>
                <CardDescription>审核通过后可由管理员启用账号。</CardDescription>
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={() => void refetch()}
                disabled={isFetching}
                aria-label='刷新成员列表'
              >
                <RefreshCw className={isFetching ? 'animate-spin' : undefined} />
                刷新
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className='text-muted-foreground py-8 text-center text-sm'>正在加载成员...</div>
              ) : members.length === 0 ? (
                <div className='text-muted-foreground py-8 text-center text-sm'>暂无普通成员</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>成员</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>分组</TableHead>
                      <TableHead>额度</TableHead>
                      <TableHead>注册时间</TableHead>
                      <TableHead className='text-right'>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((user) => {
                      const disabled = user.status === USER_STATUS.DISABLED
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className='flex min-w-32 items-center gap-2'>
                              <UserCheck className='text-muted-foreground size-4' />
                              <div className='min-w-0'>
                                <div className='truncate font-medium'>
                                  {user.display_name || user.username}
                                </div>
                                <div className='text-muted-foreground truncate text-xs'>
                                  @{user.username}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><ReviewStatus user={user} /></TableCell>
                          <TableCell>{user.group || '-'}</TableCell>
                          <TableCell>{formatQuota(user.quota)}</TableCell>
                          <TableCell>{formatTimestamp(user.created_at ?? 0)}</TableCell>
                          <TableCell>
                            <div className='flex justify-end gap-2'>
                              {disabled ? (
                                <Button
                                  size='sm'
                                  onClick={() => handleAction(user, 'enable')}
                                  disabled={reviewMutation.isPending}
                                >
                                  <CheckCircle2 />
                                  通过
                                </Button>
                              ) : (
                                <Button
                                  variant='destructive'
                                  size='sm'
                                  onClick={() => handleAction(user, 'disable')}
                                  disabled={reviewMutation.isPending}
                                >
                                  <UserX />
                                  停用
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
