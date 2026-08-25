import { ArrowRight, BookOpenCheck, Eye, EyeOff, LockKeyhole, Mail, MessageCircleMore, TrendingUp } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brand } from '../components/common/Brand'
import { Button } from '../components/ui/Button'
import { InlineAlert } from '../components/ui/Feedback'
import { Input } from '../components/ui/FormControls'
import { Surface } from '../components/ui/Surface'
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
    <div className="mx-auto grid min-h-[100dvh] w-full max-w-[1180px] items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.78fr)] lg:px-8 lg:py-8">
      <section className="relative hidden overflow-hidden rounded-2xl bg-[#0B4EC7] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <div className="absolute -right-24 -top-20 h-80 w-80 rounded-full border border-white/25" />
          <div className="absolute -right-10 top-14 h-56 w-56 rounded-full border border-white/20" />
        </div>
        <div className="relative">
          <div className="inline-flex rounded-xl bg-white p-3"><Brand /></div>
          <p className="mt-10 max-w-lg text-[32px] font-bold leading-[42px] tracking-[-0.03em]">
            Luyện tập hội thoại bán hàng có mục tiêu, phản hồi và tiến bộ rõ ràng.
          </p>
          <p className="mt-4 max-w-md text-sm leading-6 text-blue-100">
            Không gian đào tạo nội bộ giúp đội ngũ thực hành với khách hàng AI trong bối cảnh an toàn và có kiểm soát.
          </p>
        </div>
        <div className="relative grid gap-3 text-sm text-blue-50">
          <div className="flex items-center gap-3"><MessageCircleMore className="h-5 w-5" aria-hidden="true" /> Hội thoại mô phỏng theo tình huống</div>
          <div className="flex items-center gap-3"><BookOpenCheck className="h-5 w-5" aria-hidden="true" /> Chương trình luyện tập có cấu trúc</div>
          <div className="flex items-center gap-3"><TrendingUp className="h-5 w-5" aria-hidden="true" /> Theo dõi tiến bộ từ dữ liệu đã đánh giá</div>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8 lg:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand">TestLab workspace</p>
            <h1 className="mt-2 text-[30px] font-bold leading-[38px] tracking-[-0.025em] text-ink">
              Chào mừng bạn trở lại
            </h1>
            <p className="mt-2 text-sm leading-[22px] text-ink-secondary">
              Đăng nhập bằng tài khoản nội bộ để tiếp tục luyện tập.
            </p>
          </div>

          <Surface className="border border-border p-6 sm:p-7">
            <form className="space-y-5" onSubmit={submit} noValidate>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink" htmlFor="login-email">
                  Email công việc
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                  <Input
                    aria-describedby={error ? 'login-error' : undefined}
                    aria-label="Email"
                    autoComplete="email"
                    id="login-email"
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
                <label className="mb-2 block text-sm font-medium text-ink" htmlFor="login-password">
                  Mật khẩu
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                  <Input
                    aria-describedby={error ? 'login-error' : undefined}
                    aria-label="Mật khẩu"
                    autoComplete="current-password"
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu"
                    className="pl-10 pr-12"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      setError('')
                    }}
                  />
                  <button
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-focus/30"
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {error && <div id="login-error"><InlineAlert>{error}</InlineAlert></div>}

              <Button
                className="w-full"
                type="submit"
                disabled={loading}
                icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
              >
                {loading ? 'Đang xác thực...' : 'Đăng nhập'}
              </Button>
            </form>
          </Surface>

          <p className="mt-5 text-center text-xs leading-[18px] text-ink-muted">
            Phiên đăng nhập được bảo vệ bằng cookie HttpOnly qua backend nội bộ.
          </p>
        </div>
      </section>
    </div>
  )
}
