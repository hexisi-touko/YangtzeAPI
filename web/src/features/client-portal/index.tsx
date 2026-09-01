/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { useQuery } from '@tanstack/react-query'
import {
  Clipboard,
  ExternalLink,
  KeyRound,
  MonitorCog,
  Server,
  ShieldCheck,
} from 'lucide-react'
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
import { getApiKeys } from '@/features/keys/api'
import { formatQuota } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

function getStatusLabel(status?: number) {
  if (status === 1) return { label: '已启用', variant: 'default' as const }
  if (status === 2) return { label: '待管理员处理', variant: 'warning' as const }
  return { label: '未知', variant: 'outline' as const }
}

export function ClientPortal() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { data, isLoading } = useQuery({
    queryKey: ['client-portal-api-keys', user?.id],
    queryFn: () => getApiKeys({ p: 1, size: 10 }),
    enabled: Boolean(user),
  })

  const status = getStatusLabel(user?.status)
  const apiKeys = data?.data?.items ?? []
  const isAdmin = (user?.role ?? 0) >= ROLE.ADMIN
  const serviceUrl = useMemo(
    () => (typeof window === 'undefined' ? '' : window.location.origin),
    []
  )

  const copyServiceUrl = async () => {
    if (!serviceUrl || !navigator.clipboard) return
    await navigator.clipboard.writeText(serviceUrl)
    toast.success('服务地址已复制')
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('客户端配置')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          <Alert>
            <MonitorCog />
            <AlertTitle>成员端工作台</AlertTitle>
            <AlertDescription>
              {isAdmin
                ? '这是成员将使用的工作台预览。请用普通成员账号登录，核对实际成员视角。'
                : '这里集中展示你的账号状态、New API 地址和客户端配置入口。正式的 EXE 自动配置功能接入后，会继续沿用这个页面。'}
            </AlertDescription>
          </Alert>

          <div className='grid gap-4 md:grid-cols-3'>
            <Card size='sm'>
              <CardHeader>
                <CardDescription>账号状态</CardDescription>
                <CardTitle className='flex items-center gap-2'>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className='text-muted-foreground text-sm'>
                {user?.display_name || user?.username || '-'}
              </CardContent>
            </Card>
            <Card size='sm'>
              <CardHeader>
                <CardDescription>可用额度</CardDescription>
                <CardTitle>{formatQuota(user?.quota ?? 0)}</CardTitle>
              </CardHeader>
              <CardContent className='text-muted-foreground text-sm'>
                已使用 {formatQuota(user?.used_quota ?? 0)}
              </CardContent>
            </Card>
            <Card size='sm'>
              <CardHeader>
                <CardDescription>调用次数</CardDescription>
                <CardTitle>{(user?.request_count ?? 0).toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent className='text-muted-foreground text-sm'>
                当前账号累计请求
              </CardContent>
            </Card>
          </div>

          <div className='grid gap-4 lg:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Server className='size-4' />
                  New API 服务地址
                </CardTitle>
                <CardDescription>客户端请求应指向此地址。</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='bg-muted flex items-center justify-between gap-3 rounded-md px-3 py-2 font-mono text-sm'>
                  <span className='min-w-0 truncate'>{serviceUrl || '当前地址不可用'}</span>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    onClick={copyServiceUrl}
                    disabled={!serviceUrl}
                    aria-label='复制服务地址'
                  >
                    <Clipboard />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <KeyRound className='size-4' />
                  API Key
                </CardTitle>
                <CardDescription>
                  当前账号已创建 {isLoading ? '...' : apiKeys.length} 个 Key。
                </CardDescription>
              </CardHeader>
              <CardContent className='flex flex-wrap gap-2'>
                <Button size='sm' render={<a href='/keys' />}>
                  管理我的 Key
                  <ExternalLink />
                </Button>
                <span className='text-muted-foreground self-center text-xs'>
                  Key 只在本账号权限范围内生效
                </span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>客户端接入状态</CardTitle>
              <CardDescription>
                EXE 客户端和自动写入 Codex 根目录的功能将在客户端项目接入后启用。
              </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-wrap items-center gap-3'>
              <Button variant='outline' disabled>
                下载客户端（待接入）
              </Button>
              <Badge variant='outline'>前端入口已准备</Badge>
            </CardContent>
          </Card>

          {isAdmin && (
            <Alert>
              <ShieldCheck />
              <AlertTitle>管理员预览提示</AlertTitle>
              <AlertDescription>
                你当前登录的是管理员账号，因此仍能看到管理员菜单。普通成员登录后只会看到成员入口、Key 管理、用量记录和个人资料。
              </AlertDescription>
            </Alert>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
