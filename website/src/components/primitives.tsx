import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/** Scroll-triggered reveal. Respects prefers-reduced-motion. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  lead,
  id,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  id?: string;
}) {
  return (
    <header className="section-header" id={id}>
      <Reveal>
        <span className="eyebrow">{eyebrow}</span>
      </Reveal>
      <Reveal delay={0.06}>
        <h2 className="section-title">{title}</h2>
      </Reveal>
      {lead && (
        <Reveal delay={0.12}>
          <p className="section-lead">{lead}</p>
        </Reveal>
      )}
    </header>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'violet' | 'teal' | 'danger' | 'safe' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
