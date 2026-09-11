import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'danger';

function classesFor(variant: Variant, fullWidth: boolean, className?: string): string {
  return [styles.button, styles[variant], fullWidth ? styles.full : '', className]
    .filter(Boolean)
    .join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  busy?: boolean;
}

export function Button({
  variant = 'secondary',
  fullWidth = false,
  busy = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={classesFor(variant, fullWidth, className)}
      disabled={disabled ?? busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
}

/** A link styled as a button, for an action that leaves the app. */
export function LinkButton({
  variant = 'secondary',
  className,
  ...rest
}: LinkButtonProps) {
  return <a className={classesFor(variant, false, className)} {...rest} />;
}
