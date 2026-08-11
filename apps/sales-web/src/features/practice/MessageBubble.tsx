import type { ChatMessage } from '../../types/training'

export function MessageBubble({ message }: { message: ChatMessage }) {
  const sale = message.sender === 'SALE'
  return <div className={`flex ${sale ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] sm:max-w-[75%] ${sale ? 'items-end' : 'items-start'} flex flex-col`}><span className="mb-1.5 px-1 text-[11px] font-bold text-slate-400">{sale ? 'Bạn' : 'Khách hàng AI'}</span><div className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${sale ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700'}`}>{message.content}</div><span className="mt-1.5 px-1 text-[10px] text-slate-400">{new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span></div></div>
}
