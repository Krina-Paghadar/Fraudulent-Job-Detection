import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const LINKS = [
  { href: '#question', label: 'Question' },
  { href: '#data', label: 'Data' },
  { href: '#methodology', label: 'Method' },
  { href: '#models', label: 'Models' },
  { href: '#results', label: 'Results' },
  { href: '#lab', label: 'Lab' },
  { href: '#errors', label: 'Errors' },
  { href: '#conclusion', label: 'Conclusion' },
  { href: '#checker', label: 'Risk checker' },
  { href: '#reproduce', label: 'Reproduce' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className="nav" aria-label="Primary">
      <div
        className="nav-inner"
        style={scrolled ? { background: 'rgba(8,10,16,0.78)' } : undefined}
      >
        <a href="#top" className="nav-brand" onClick={() => setOpen(false)}>
          <span className="nav-dot" />
          Signal<span style={{ color: 'var(--fg-dim)', fontWeight: 400 }}>/fraud</span>
        </a>
        <div className="nav-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </div>
        <a href="#checker" className="btn btn-primary btn-sm nav-cta">Try it →</a>
        <button
          className="nav-burger"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '✕' : '☰'}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className="nav-inner nav-mobile"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
