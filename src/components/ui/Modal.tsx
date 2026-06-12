'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Dialog.Content
          className={cn(
            // Mobile: full-width bottom sheet sliding up from bottom
            'fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl',
            // Desktop: centered modal
            'sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:w-full sm:max-w-md',
            'bg-white border border-gray-200 shadow-xl',
            'max-h-[92dvh] overflow-y-auto overscroll-contain p-6',
            'focus:outline-none',
            className
          )}
        >
          {(title || description) && (
            <div className="flex items-start justify-between mb-5">
              <div>
                {title && (
                  <Dialog.Title className="text-base font-semibold text-gray-900">
                    {title}
                  </Dialog.Title>
                )}
                {description && (
                  <Dialog.Description className="text-sm text-gray-500 mt-0.5">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
