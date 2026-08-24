import {
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  History,
  Home,
  Library,
  ListChecks,
  MessageSquareText,
  PanelsTopLeft,
  Trophy,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { UiCapability, UserRole } from '../../app/authorizationPolicy'

export type ShellNavItem = {
  to: string
  label: string
  shortLabel?: string
  icon: LucideIcon
  requiredCapability?: UiCapability
  roles?: readonly UserRole[]
}

export type ShellNavGroup = {
  id: string
  label?: string
  items: readonly ShellNavItem[]
}

export const shellNavigation: readonly ShellNavGroup[] = [
  {
    id: 'primary',
    items: [
      { to: '/dashboard', label: 'Tổng quan', icon: Home, requiredCapability: 'USE_OWN_TRAINING' },
    ],
  },
  {
    id: 'practice',
    label: 'Luyện tập',
    items: [
      { to: '/customers', label: 'Khách hàng AI', icon: Library, requiredCapability: 'USE_OWN_TRAINING' },
      { to: '/practice/new', label: 'Luyện tập', icon: MessageSquareText, requiredCapability: 'USE_OWN_TRAINING' },
      { to: '/my-training-assignments', label: 'Bài tập được giao', icon: ListChecks, roles: ['SALE'] },
    ],
  },
  {
    id: 'tracking',
    label: 'Theo dõi',
    items: [
      { to: '/history', label: 'Lịch sử', icon: History, requiredCapability: 'USE_OWN_TRAINING' },
      { to: '/progress', label: 'Tiến độ', icon: BarChart3, requiredCapability: 'USE_OWN_TRAINING' },
      { to: '/leaderboard', label: 'Bảng xếp hạng', icon: Trophy, requiredCapability: 'VIEW_LEADERBOARD' },
    ],
  },
  {
    id: 'training-management',
    label: 'Quản lý đào tạo',
    items: [
      { to: '/training-programs', label: 'Chương trình', icon: BookOpenCheck, requiredCapability: 'MANAGE_TRAINING_PROGRAMS' },
      { to: '/training-assignments', label: 'Phân công', icon: ClipboardList, requiredCapability: 'ASSIGN_TRAINING' },
    ],
  },
  {
    id: 'content-management',
    label: 'Quản lý nội dung',
    items: [
      { to: '/manage/personas', label: 'Persona', icon: UsersRound, requiredCapability: 'MANAGE_PERSONAS' },
      { to: '/manage/scenarios', label: 'Tình huống', icon: PanelsTopLeft, requiredCapability: 'MANAGE_SCENARIOS' },
    ],
  },
]

export function isShellItemActive(pathname: string, item: ShellNavItem): boolean {
  if (item.to === '/dashboard') return pathname === item.to
  if (item.to === '/practice/new') return pathname.startsWith('/practice/')
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export function shellPageTitle(pathname: string): string {
  for (const group of shellNavigation) {
    const match = group.items.find((item) => isShellItemActive(pathname, item))
    if (match) return match.label
  }
  return 'AI Sales TestLab'
}
