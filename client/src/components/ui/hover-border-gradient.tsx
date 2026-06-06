import React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: any[]) { return twMerge(clsx(inputs)) }

export function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Element = 'button',
  ...props
}: React.PropsWithChildren<
  {
    as?: React.ElementType
    containerClassName?: string
    className?: string
    duration?: number
  } & React.HTMLAttributes<HTMLElement>
>) {
  return (
    <Element
      className={cn('bonatto-border-wrap', containerClassName)}
      {...props}
    >
      <div className={cn('bonatto-border-inner', className)}>
        {children}
      </div>
    </Element>
  )
}

export default HoverBorderGradient
