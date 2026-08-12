import { ArrowRight, Eye, EyeOff, LockKeyhole, MessageSquareText, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brand } from '../components/common/Brand'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/FormControls'
import { useAuth } from '../app/AuthContext'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email) || !password.trim()) { setError('Vui lòng nhập email hợp lệ và mật khẩu.'); return }
    try { await login(email, password); navigate('/dashboard') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể đăng nhập.') }
  }

  return <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
    <section className="relative hidden overflow-hidden bg-[#07152f] p-14 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-blue-600/25 blur-3xl" /><div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative"><Brand /><div className="mt-24 max-w-xl"><span className="inline-flex rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-200">Không gian luyện tập 1vs1</span><h1 className="mt-6 text-balance text-5xl font-extrabold leading-[1.1] tracking-tight">Tự tin hơn trong mọi cuộc trò chuyện bán hàng.</h1><p className="mt-5 max-w-lg text-lg leading-8 text-slate-300">Thực hành với khách hàng AI trong những tình huống sát thực tế, an toàn và luôn sẵn sàng.</p></div></div>
      <div className="relative grid max-w-xl grid-cols-2 gap-4"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><MessageSquareText className="h-5 w-5 text-blue-300" /><p className="mt-3 text-sm font-bold">Hội thoại thực tế</p><p className="mt-1 text-xs leading-5 text-slate-400">Luyện xử lý nhu cầu và phản đối.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><ShieldCheck className="h-5 w-5 text-blue-300" /><p className="mt-3 text-sm font-bold">Không gian an toàn</p><p className="mt-1 text-xs leading-5 text-slate-400">Thử nghiệm, học hỏi, tiến bộ.</p></div></div>
    </section>
    <section className="flex min-h-screen items-center justify-center bg-white px-5 py-10 sm:px-10"><div className="w-full max-w-md"><div className="mb-10 lg:hidden"><Brand /></div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600">Chào mừng trở lại</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Đăng nhập để luyện tập</h2><p className="mt-2 text-sm leading-6 text-slate-500">Tiếp tục hành trình nâng cao kỹ năng bán hàng của bạn.</p>
      <form className="mt-8 space-y-5" onSubmit={submit} noValidate><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Email</span><Input aria-label="Email" autoComplete="email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} /></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Mật khẩu</span><div className="relative"><LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Mật khẩu" autoComplete="current-password" className="pl-10 pr-12" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} /><button aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label><div className="flex items-center justify-between"><label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"><input className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" type="checkbox" defaultChecked />Ghi nhớ đăng nhập</label><span className="text-xs text-slate-400">HttpOnly session</span></div>{error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}<Button className="w-full" type="submit" icon={<ArrowRight className="h-4 w-4" />}>Đăng nhập</Button></form><p className="mt-8 text-center text-xs leading-5 text-slate-400">Thông tin đăng nhập được gửi tới backend; trình duyệt chỉ giữ cookie phiên HttpOnly.</p></div></section>
  </div>
}
