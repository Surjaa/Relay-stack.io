// JSS (CSS-in-JS) layer: design tokens and component styles.
// If JSS cannot load from the CDN, the base styles in index.html still apply.
const T = {
  gold: '#ffc857',
  teal: '#1fb8a6',
  glass: 'rgba(10, 13, 22, 0.74)',
  line: 'rgba(255, 255, 255, 0.12)',
};
// Type pairing: Space Grotesk for titles, numbers and buttons; Inter for body text.
const F = {
  display: "'Space Grotesk', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
};

export async function mountStyles() {
  try {
    const { create } = await import('https://cdn.jsdelivr.net/npm/jss@10.10.0/+esm');
    const preset = (await import('https://cdn.jsdelivr.net/npm/jss-preset-default@10.10.0/+esm')).default;
    const jss = create(preset());
    jss.createStyleSheet({
      '@global': {
        '.rs-glass': {
          background: T.glass,
          backdropFilter: 'blur(14px) saturate(140%)',
          WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          border: `1px solid ${T.line}`,
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          borderRadius: '18px',
          color: '#eef3ff',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '100%',
          overflowY: 'auto',
        },
        '.rs-title': {
          fontFamily: F.display,
          fontWeight: 800,
          letterSpacing: '0.08em',
          color: T.gold,
          textShadow: '0 0 18px rgba(255, 200, 87, 0.4)',
        },
        '.rs-kicker': { fontFamily: F.display, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.teal, fontWeight: 500, fontSize: '0.8rem' },
        '.rs-count': { fontFamily: F.display, color: T.gold, fontWeight: 500, marginLeft: '6px' },
        // 3D buttons: solid lip under the button, squashes down when pressed
        '.btn': {
          fontFamily: F.body,
          fontWeight: 600,
          borderRadius: '14px',
          transition: 'transform 0.12s ease, box-shadow 0.12s ease, filter 0.2s ease',
          '&:not(:disabled):hover': { transform: 'translateY(-2px)', filter: 'brightness(1.08)' },
          '&:not(:disabled):active': { transform: 'translateY(4px)' },
        },
        '.btn-warning': {
          border: 'none',
          background: 'linear-gradient(180deg, #ffd978, #ffb42e)',
          color: '#1a1204',
          boxShadow: '0 5px 0 #b8781a, 0 12px 24px rgba(255, 180, 40, 0.25)',
          '&:not(:disabled):active': { boxShadow: '0 1px 0 #b8781a, 0 4px 10px rgba(255, 180, 40, 0.2)' },
        },
        '.btn-outline-light': {
          background: 'rgba(255, 255, 255, 0.06)',
          boxShadow: '0 5px 0 rgba(0, 0, 0, 0.45), 0 12px 24px rgba(0, 0, 0, 0.3)',
          '&:not(:disabled):active': { boxShadow: '0 1px 0 rgba(0, 0, 0, 0.45)' },
        },
        '.btn-outline-danger': { boxShadow: '0 5px 0 rgba(0, 0, 0, 0.45)' },
        // level cards: tilt up and glow gold on hover, press in on click
        '.rs-level-card': {
          transition: 'transform 0.18s ease, border-color 0.2s ease, box-shadow 0.2s ease',
          boxShadow: '0 4px 0 rgba(0, 0, 0, 0.4)',
          '&:not(:disabled):hover': {
            transform: 'translateY(-3px)',
            borderColor: T.gold,
            boxShadow: '0 10px 26px rgba(255, 200, 87, 0.28), 0 4px 0 rgba(0, 0, 0, 0.4)',
          },
          '&:not(:disabled):active': { transform: 'translateY(2px)', boxShadow: '0 1px 0 rgba(0, 0, 0, 0.4)' },
        },
        '.rs-tab:not(:disabled):hover': { borderColor: T.gold, color: T.gold },
        '.rs-tab': {
          flex: '0 0 auto',
          minWidth: '44px',
          fontFamily: F.display,
          fontWeight: 700,
          borderRadius: '12px',
          color: '#eef3ff',
          '&.active': { background: 'linear-gradient(180deg, #ffd978, #ffb42e)', color: '#1a1204', borderColor: T.gold },
          '&:disabled': { opacity: 0.3 },
        },
        '.rs-btn': {
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          letterSpacing: '0.04em',
          fontWeight: 600,
          '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 8px 24px rgba(255, 200, 87, 0.18)' },
          '&:active': { transform: 'translateY(1px) scale(0.99)' },
          '&:focus-visible': { outline: `3px solid ${T.teal}`, outlineOffset: '3px' },
        },
        '.rs-level-card': {
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          padding: '14px 8px',
          borderRadius: '14px',
          border: `1px solid ${T.line}`,
          background: 'rgba(255, 255, 255, 0.04)',
          color: '#eef3ff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          '&:hover:not(:disabled)': { transform: 'translateY(-3px) scale(1.04)', borderColor: T.gold, boxShadow: '0 10px 26px rgba(255, 200, 87, 0.28)' },
          '&:active:not(:disabled)': { transform: 'translateY(1px) scale(0.97)' },
          '&.is-locked': { opacity: 0.35, cursor: 'not-allowed' },
        },
        '.rs-level-num': { fontFamily: F.display, fontSize: '1.4rem', fontWeight: 800, color: T.gold },
        '.rs-level-name': { fontSize: '0.8rem', opacity: 0.85 },
        '.rs-stars': { display: 'flex', gap: '2px' },
        '.rs-star': { width: '18px', height: '18px', fill: 'rgba(255, 255, 255, 0.18)' },
        '.rs-star.on': { fill: T.gold, filter: 'drop-shadow(0 0 4px rgba(255, 200, 87, 0.7))' },
        '.rs-hud': {
          position: 'fixed',
          top: '12px',
          left: '12px',
          right: '12px',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '10px 14px',
          borderRadius: '16px',
          background: 'rgba(7, 10, 18, 0.6)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${T.line}`,
          color: '#eef3ff',
        },
        '.rs-stat': { textAlign: 'center', minWidth: '58px' },
        '.rs-label': { fontSize: '0.65rem', letterSpacing: '0.18em', opacity: 0.6, textTransform: 'uppercase' },
        '.rs-value': { fontFamily: F.display, fontWeight: 700, fontSize: '1.05rem' },
        '.rs-runbar': {
          position: 'fixed',
          left: '50%',
          bottom: '22px',
          transform: 'translateX(-50%)',
          zIndex: 20,
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          padding: '10px',
          borderRadius: '999px',
          background: 'rgba(7, 10, 18, 0.6)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${T.line}`,
        },
        '.rs-toast': {
          position: 'fixed',
          left: '50%',
          top: '96px',
          transform: 'translate(-50%, -8px)',
          opacity: 0,
          zIndex: 30,
          maxWidth: '90vw',
          padding: '10px 18px',
          borderRadius: '14px',
          background: 'rgba(7, 10, 18, 0.9)',
          border: `1px solid ${T.line}`,
          color: '#eef3ff',
          fontSize: '0.9rem',
          textAlign: 'center',
          pointerEvents: 'none',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          '&.show': { opacity: 1, transform: 'translate(-50%, 0)' },
        },
        '@media (max-width: 575.98px)': {
          '.rs-hud': { top: '8px', left: '8px', right: '8px', padding: '8px 10px' },
          '.rs-runbar': { bottom: '14px' },
          '.rs-toast': { top: '80px' },
        },
      },
    }).attach();
  } catch (err) {
    console.warn('JSS did not load; using base styles only.', err);
  }
}
