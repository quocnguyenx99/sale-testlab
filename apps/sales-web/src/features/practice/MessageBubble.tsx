import type { ChatMessage } from '../../types/training'

export function MessageBubble({ message }: { message: ChatMessage }) {
  const sale = message.sender === 'SALE'

  return (
    <div className={`flex ${sale ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[88%] sm:max-w-[78%] flex-col ${sale ? 'items-end' : 'items-start'}`}>
        <span className={`mb-1 px-1 text-[11px] font-semibold ${sale ? 'text-brand' : 'text-ink-muted'}`}>
          {sale ? 'Bạn' : 'Khách hàng AI'}
        </span>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words shadow-subtle ${
            sale
              ? 'rounded-tr-sm border border-brand-border/60 bg-brand-soft text-indigo-950'
              : 'rounded-tl-sm border border-border bg-surface-subtle text-ink'
          }`}
        >
          {message.content}
        </div>
        <span className="mt-1 px-1 text-[10px] text-ink-muted tabular-nums">
          {new Date(message.createdAt).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  )
}
