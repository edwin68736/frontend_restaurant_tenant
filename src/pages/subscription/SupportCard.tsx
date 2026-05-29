import { Mail, Phone } from 'lucide-react'
import type { SupportConfig } from '@/services/subscription.service'
import { buildSupportWhatsAppHref, openExternalUrl } from '@/utils/supportWhatsApp'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

type Channel = {
  key: string
  label: string
  text: string
  href: string
  external?: boolean
  icon: React.ReactNode
  cardClass: string
  iconWrapClass: string
}

function buildChannels(support: SupportConfig): Channel[] {
  const channels: Channel[] = []
  const waHref = buildSupportWhatsAppHref(support)
  if (waHref) {
    channels.push({
      key: 'whatsapp',
      label: 'WhatsApp',
      text: support.whatsapp ?? '',
      href: waHref,
      external: true,
      icon: <WhatsAppIcon className="w-5 h-5" />,
      cardClass: 'border-emerald-200 bg-emerald-50/80 hover:bg-emerald-50',
      iconWrapClass: 'bg-emerald-500 text-white',
    })
  }
  if (support.email) {
    channels.push({
      key: 'email',
      label: 'Correo',
      text: support.email,
      href: `mailto:${support.email}`,
      icon: <Mail size={20} />,
      cardClass: 'border-blue-200 bg-blue-50/80 hover:bg-blue-50',
      iconWrapClass: 'bg-blue-600 text-white',
    })
  }
  if (support.phone) {
    channels.push({
      key: 'phone',
      label: 'Teléfono',
      text: support.phone,
      href: `tel:${support.phone}`,
      icon: <Phone size={20} />,
      cardClass: 'border-violet-200 bg-violet-50/80 hover:bg-violet-50',
      iconWrapClass: 'bg-violet-600 text-white',
    })
  }
  return channels
}

export default function SupportCard({ support }: { support: SupportConfig }) {
  const channels = buildChannels(support)

  if (channels.length === 0) {
    return <p className="text-xs text-gray-500">Contacte a soporte Tukifac.</p>
  }

  return (
    <ul className="space-y-2">
      {channels.map(ch => (
        <li key={ch.key}>
          <a
            href={ch.href}
            target={ch.external ? '_blank' : undefined}
            rel={ch.external ? 'noreferrer' : undefined}
            onClick={(e) => {
              if (!ch.external) return
              e.preventDefault()
              void openExternalUrl(ch.href)
            }}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${ch.cardClass}`}
          >
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ch.iconWrapClass}`}>
              {ch.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-800">{ch.label}</span>
              <span className="block text-xs text-gray-600 truncate">{ch.text}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
