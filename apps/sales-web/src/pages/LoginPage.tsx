import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brand } from '../components/common/Brand'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/FormControls'
import { useAuth } from '../app/AuthContext'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email) || !password.trim()) {
      setError('Vui lòng nhập email hợp lệ và mật khẩu.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đăng nhập.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 sm:px-0">
      <div className="text-center mb-8">
        <div className="inline-flex justify-center mb-3">
          <Brand />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Đăng nhập hệ thống
        </h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          Nền tảng luyện tập kỹ năng bán hàng AI TestLab V3
        </p>
      </div>

      <Card className="p-6 sm:p-8 bg-surface">
        <form className="space-y-4" onSubmit={submit} noValidate>
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
              Email công việc
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input
                aria-label="Email"
                autoComplete="email"
                type="email"
                placeholder="name@company.com"
                className="pl-10"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setError('')
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input
                aria-label="Mật khẩu"
                autoComplete="current-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="pl-10 pr-10"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError('')
                }}
              />
              <button
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-muted hover:text-ink transition duration-150"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-secondary">
              <input
                className="h-3.5 w-3.5 rounded border-border text-brand focus:ring-brand"
                type="checkbox"
                defaultChecked
              />
              Ghi nhớ đăng nhập
            </label>
            <span className="text-[11px] text-ink-muted">Phiên HttpOnly bảo mật</span>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          <Button
            className="w-full mt-2"
            type="submit"
            disabled={loading}
            icon={<ArrowRight className="h-4 w-4" />}
          >
            {loading ? 'Đang xác thực...' : 'Đăng nhập'}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-xs text-ink-muted">
        Phiên đăng nhập được quản lý bằng cookie HttpOnly qua backend nội bộ.
      </p>
    </div>
  )
}
