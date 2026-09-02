/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
  KeyRound,
  Loader2,
  MonitorCog,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
  if (status === 2) {
    return { label: '待管理员处理', variant: 'warning' as const }
  }
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
  const desktopBridge =
    typeof window === 'undefined' ? undefined : window.yangtzeDesktop
  const [clientStatus, setClientStatus] = useState<Awaited<
    ReturnType<NonNullable<typeof desktopBridge>['getCodexStatus']>
  > | null>(null)
  const [clientAction, setClientAction] = useState<
    'configure' | 'detect' | null
  >(null)
  const serviceUrl = useMemo(
    () => (typeof window === 'undefined' ? '' : window.location.origin),
    []
  )
  let clientStatusLabel = t('未检测到桌面客户端')
  if (desktopBridge) clientStatusLabel = t('尚未完成配置')
  if (clientStatus?.locallyConfigured) clientStatusLabel = t('本地配置已写入')
  if (clientStatus?.externalProviderActive) clientStatusLabel = t('当前供应商已切换')
  if (clientStatus?.configured) clientStatusLabel = t('配置正常')

  const copyServiceUrl = async () => {
    if (!serviceUrl || !navigator.clipboard) return
    await navigator.clipboard.writeText(serviceUrl)
    toast.success('服务地址已复制')
  }

  useEffect(() => {
    if (!desktopBridge) return
    let active = true
    void desktopBridge.getCodexStatus().then((result) => {
      if (active) setClientStatus(result)
    })
    return () => {
      active = false
    }
  }, [desktopBridge])

  const runClientAction = async (action: 'configure' | 'detect') => {
    if (!desktopBridge) {
      toast.error(t('请在桌面客户端中打开此页面'))
      return
    }
    setClientAction(action)
    try {
      const result =
        action === 'configure'
          ? await desktopBridge.configureCodex()
          : await desktopBridge.detectCodex()
      setClientStatus(result)
      if (result.success && result.configured) {
        toast.success(result.message || t('Codex 配置正常'))
      } else {
        toast.error(result.message || t('Codex 配置检测未通过'))
      }
    } catch {
      toast.error(t('桌面客户端操作失败，请重新打开客户端'))
    } finally {
      setClientAction(null)
    }
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
                <CardTitle>
                  {(user?.request_count ?? 0).toLocaleString()}
                </CardTitle>
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
                  <span className='min-w-0 truncate'>
                    {serviceUrl || '当前地址不可用'}
                  </span>
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
                  {isAdmin ? '当前账号已创建' : '管理员已发放'}{' '}
                  {isLoading ? '...' : apiKeys.length} 个 Key。
                </CardDescription>
              </CardHeader>
              <CardContent className='flex flex-wrap gap-2'>
                <Button size='sm' render={<a href='/keys' />}>
                  {isAdmin ? '管理我的 Key' : '查看我的 Key'}
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
              <CardTitle className='flex items-center gap-2'>
                <MonitorCog className='size-4' />
                {t('Codex 客户端配置')}
              </CardTitle>
              <CardDescription>
                {desktopBridge
                  ? t(
                      '由桌面客户端安全地配置本机 Codex，现有设置会先备份再更新。'
                    )
                  : t('请通过桌面客户端登录后使用配置和检测功能。')}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge
                  variant={clientStatus?.configured ? 'default' : 'outline'}
                >
                  {clientStatusLabel}
                </Badge>
                {clientStatus?.serviceReachable === true && (
                  <Badge variant='outline'>
                    <CheckCircle2 />
                    {t('API 连接正常')}
                  </Badge>
                )}
                {clientStatus?.ccSwitchDetected && (
                  <Badge variant='outline'>{t('已兼容 CC Switch')}</Badge>
                )}
                {clientStatus?.codexHome && (
                  <span className='text-muted-foreground text-xs'>
                    {t('配置目录：{{path}}', { path: clientStatus.codexHome })}
                  </span>
                )}
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Button
                  size='sm'
                  onClick={() => void runClientAction('configure')}
                  disabled={!desktopBridge || clientAction !== null}
                >
                  {clientAction === 'configure' ? (
                    <Loader2 className='animate-spin' />
                  ) : (
                    <Settings2 />
                  )}
                  {t('配置 Codex')}
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => void runClientAction('detect')}
                  disabled={!desktopBridge || clientAction !== null}
                >
                  {clientAction === 'detect' ? (
                    <Loader2 className='animate-spin' />
                  ) : (
                    <RefreshCw />
                  )}
                  {t('重新检测')}
                </Button>
                <span className='text-muted-foreground text-xs'>
                  {clientStatus?.message ||
                    (clientStatus?.externalProviderActive
                      ? t('CC Switch 已切换到其他供应商，点击配置 Codex 可切回本服务')
                      : t('配置时会使用管理员审核后发放的唯一 API Key'))}
                </span>
              </div>
            </CardContent>
          </Card>

          {isAdmin && (
            <Alert>
              <ShieldCheck />
              <AlertTitle>管理员预览提示</AlertTitle>
              <AlertDescription>
                你当前登录的是管理员账号，因此仍能看到管理员菜单。普通成员登录后只会看到成员入口、Key
                管理、用量记录和个人资料。
              </AlertDescription>
            </Alert>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
