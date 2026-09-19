type BonattoBrandFrameProps = {
  compact?: boolean;
};

export function BonattoBrandFrame({ compact = false }: BonattoBrandFrameProps) {
  return (
    <div className={`bonatto-brand-frame ${compact ? "bonatto-brand-frame--compact" : ""}`} aria-hidden="true">
      <div className="bonatto-checker-rail" />
      <img
        src="/brand/dna/personagem-bonatto.png"
        alt=""
        className="bonatto-frame-character"
      />
      <img
        src="/brand/dna/proibido-economizar-sabor.png"
        alt=""
        className="bonatto-frame-sticker"
      />
      <img
        src="/brand/dna/pizza-nao-bonatto-oficial.png"
        alt=""
        className="bonatto-frame-tagline"
      />
    </div>
  );
}
