'use client'

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  LoaderCircle,
  XCircle,
} from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      theme='light'
      className='toaster group font-sans'
      icons={{
        success: (
          <CheckCircle2 className='size-4 text-black' strokeWidth={1.5} />
        ),
        info: <Info className='size-4 text-black' strokeWidth={1.5} />,
        warning: (
          <AlertTriangle className='size-4 text-black' strokeWidth={1.5} />
        ),
        error: <XCircle className='size-4 text-white' strokeWidth={1.5} />,
        loading: (
          <LoaderCircle
            className='size-4 animate-spin text-black'
            strokeWidth={1.5}
          />
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            '!rounded-none !border-2 !border-black !bg-white !text-black !shadow-none !font-medium',
          title: '!font-semibold !tracking-tight',
          description: '!text-neutral-600',
          actionButton:
            '!rounded-none !border-2 !border-black !bg-black !text-white hover:!bg-white hover:!text-black',
          cancelButton:
            '!rounded-none !border-2 !border-black !bg-white !text-black hover:!bg-black hover:!text-white',
          closeButton:
            '!rounded-none !border-2 !border-black !bg-white !text-black hover:!bg-black hover:!text-white',
        },
      }}
      style={
        {
          '--normal-bg': '#ffffff',
          '--normal-text': '#000000',
          '--normal-border': '#000000',
          '--success-bg': '#ffffff',
          '--success-border': '#000000',
          '--success-text': '#000000',
          '--info-bg': '#ffffff',
          '--info-border': '#000000',
          '--info-text': '#000000',
          '--warning-bg': '#ffffff',
          '--warning-border': '#000000',
          '--warning-text': '#000000',
          '--error-bg': '#000000',
          '--error-border': '#000000',
          '--error-text': '#ffffff',
          '--border-radius': '0px',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
