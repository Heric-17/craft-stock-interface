import { cva } from 'class-variance-authority';

/**
 * Sizes start at 44px because this is used standing up, on a phone, with one
 * hand. Colours come from the theme tokens; there is no hex literal in a
 * component.
 *
 * In its own file so `button.tsx` exports nothing but the component, which is
 * what keeps fast refresh working.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // The main action: filled, and the only one of its kind in a group.
        primary: 'bg-primary text-primary-foreground font-semibold shadow-sm hover:opacity-90',
        secondary: 'bg-secondary text-secondary-foreground font-semibold hover:opacity-90',
        // Every other action. Tinted, never a white button with black text: it has a
        // colour at rest and fills in when it is pointed at.
        outline:
          'border border-primary/40 bg-secondary text-secondary-foreground font-semibold hover:border-primary hover:bg-primary hover:text-primary-foreground',
        ghost: 'text-accent-foreground font-medium hover:bg-accent',
        // Deleting or removing: red, filled, white and bold.
        destructive:
          'bg-destructive-strong text-destructive-foreground font-bold shadow-sm hover:opacity-90',
      },
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-11 px-3 text-xs',
        lg: 'h-12 px-6',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);
