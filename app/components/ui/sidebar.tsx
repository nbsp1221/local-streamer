import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import { cn } from '~/lib/utils'

const sidebarVariants = cva(
  'flex h-full w-[--sidebar-width] flex-col overflow-hidden',
  {
    variants: {
      variant: {
        sidebar: 'bg-sidebar',
        floating: 'bg-sidebar border border-sidebar-border shadow-lg',
      },
    },
    defaultVariants: {
      variant: 'sidebar',
    },
  }
)

interface SidebarContextProps {
  state: 'open' | 'closed'
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.')
  }

  return context
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(({ defaultOpen = true, open: openProp, onOpenChange, className, style, children, ...props }, ref) => {
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === 'function' ? value(open) : value
      if (onOpenChange) {
        onOpenChange(openState)
      } else {
        _setOpen(openState)
      }
    },
    [onOpenChange, open]
  )

  const [openMobile, setOpenMobile] = React.useState(false)

  // This is for a11y - responsive mobile detection
  const [isMobile, setIsMobile] = React.useState(false)
  
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    // Check initially
    checkMobile()
    
    // Add resize listener
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state: open ? 'open' : 'closed',
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        style={
          {
            '--sidebar-width': '16rem',
            '--sidebar-width-icon': '3rem',
            '--sidebar-width-mobile': '18rem',
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          'group/sidebar-wrapper flex min-h-svh w-full',
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
})
SidebarProvider.displayName = 'SidebarProvider'

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    variant?: VariantProps<typeof sidebarVariants>['variant']
    collapsible?: 'offcanvas' | 'icon' | 'none'
  }
>(({ variant = 'sidebar', collapsible = 'offcanvas', className, children, ...props }, ref) => {
  const { isMobile, state, setOpen, openMobile, setOpenMobile } = useSidebar()

  if (collapsible === 'none') {
    return (
      <div
        className={cn(sidebarVariants({ variant }), className)}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <>
        {openMobile && (
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpenMobile(false)}
          />
        )}
        <div
          data-mobile="true"
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-[--sidebar-width-mobile] border-r border-sidebar-border bg-sidebar transition-transform duration-200 ease-in-out',
            openMobile ? 'translate-x-0' : '-translate-x-full',
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      </>
    )
  }

  if (collapsible === 'offcanvas') {
    // Mobile: Overlay behavior
    if (isMobile) {
      return (
        <>
          {state === 'open' && (
            <div
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
          )}
          <div
            ref={ref}
            data-state={state}
            className={cn(
              'fixed inset-y-0 left-0 z-50 w-[--sidebar-width] transform border-r border-sidebar-border bg-sidebar transition-transform duration-200 ease-in-out',
              state === 'closed' ? '-translate-x-full' : 'translate-x-0',
              className
            )}
            {...props}
          >
            {children}
          </div>
        </>
      )
    }
    
    // Desktop: Push content behavior - relative positioning within flex container
    return (
      <div
        ref={ref}
        data-state={state}
        className={cn(
          'relative h-full w-[--sidebar-width] transform border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-linear',
          state === 'closed' && 'w-0 border-r-0 overflow-hidden',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      data-state={state}
      className={cn(
        'relative h-full w-[--sidebar-width] transform border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-linear',
        state === 'closed' && collapsible === 'icon' && 'w-[--sidebar-width-icon]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
Sidebar.displayName = 'Sidebar'

const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      ref={ref}
      className={cn('inline-flex items-center justify-center', className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    />
  )
})
SidebarTrigger.displayName = 'SidebarTrigger'

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
      className
    )}
    {...props}
  />
))
SidebarContent.displayName = 'SidebarContent'

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col gap-2 p-2', className)}
    {...props}
  />
))
SidebarHeader.displayName = 'SidebarHeader'

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col gap-2 p-2', className)}
    {...props}
  />
))
SidebarFooter.displayName = 'SidebarFooter'

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn('flex w-full min-w-0 flex-col gap-1', className)}
    {...props}
  />
))
SidebarMenu.displayName = 'SidebarMenu'

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<'li'>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn('group/menu-item relative', className)}
    {...props}
  />
))
SidebarMenuItem.displayName = 'SidebarMenuItem'

const sidebarMenuButtonVariants = cva(
  'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        outline:
          'bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]',
      },
      size: {
        default: 'h-8 text-sm',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-sm group-data-[collapsible=icon]:!h-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & {
    asChild?: boolean
    isActive?: boolean
    variant?: VariantProps<typeof sidebarMenuButtonVariants>['variant']
    size?: VariantProps<typeof sidebarMenuButtonVariants>['size']
    tooltip?: string | React.ComponentProps<typeof Slot>
  }
>(({ asChild = false, isActive = false, variant = 'default', size = 'default', tooltip: _tooltip, className, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      ref={ref}
      className={cn(
        sidebarMenuButtonVariants({ variant, size }),
        isActive &&
          'bg-sidebar-accent text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground',
        className
      )}
      {...props}
    />
  )
})
SidebarMenuButton.displayName = 'SidebarMenuButton'

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
}