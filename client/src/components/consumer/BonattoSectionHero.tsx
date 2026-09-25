import type { ReactNode } from "react";

type BonattoSectionHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  aside?: ReactNode;
};

export function BonattoSectionHero({ eyebrow, title, description, aside }: BonattoSectionHeroProps) {
  return (
    <header className="bonatto-section-hero">
      <div className="bonatto-section-hero__copy">
        <p className="bonatto-section-hero__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="bonatto-section-hero__description">{description}</p>}
      </div>
      <div className="bonatto-section-hero__aside">
        {aside ?? <img src="/brand/dna/personagem-bonatto.png" alt="" />}
      </div>
    </header>
  );
}
