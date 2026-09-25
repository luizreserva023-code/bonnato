import type { CSSProperties } from "react";
import type { SiteTheme } from "@shared/siteBuilder";

const headingFonts: Record<SiteTheme["headingFont"], string> = {
  brand: "var(--font-display)",
  modern: '"Corra Montserra", sans-serif',
  classic: 'Georgia, "Times New Roman", serif',
};

const bodyFonts: Record<SiteTheme["bodyFont"], string> = {
  brand: "var(--font-body)",
  modern: '"Corra Montserra", sans-serif',
  friendly: 'ui-rounded, "Arial Rounded MT Bold", "Corra Montserra", sans-serif',
};

const buttonRadius: Record<SiteTheme["buttonStyle"], string> = {
  pill: "999px",
  rounded: "12px",
  square: "2px",
};

const contentWidths: Record<SiteTheme["contentWidth"], string> = {
  compact: "880px",
  standard: "1120px",
  wide: "1360px",
};

export function siteThemeStyle(theme: SiteTheme): CSSProperties {
  return {
    "--site-primary": theme.primary,
    "--site-accent": theme.accent,
    "--site-dark": theme.dark,
    "--site-surface": theme.surface,
    "--site-text": theme.text,
    "--site-heading-font": headingFonts[theme.headingFont],
    "--site-body-font": bodyFonts[theme.bodyFont],
    "--site-button-radius": buttonRadius[theme.buttonStyle],
    "--site-content-width": contentWidths[theme.contentWidth],
    background: theme.surface,
    color: theme.text,
    fontFamily: bodyFonts[theme.bodyFont],
  } as CSSProperties;
}

