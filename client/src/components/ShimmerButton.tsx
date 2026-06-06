import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  borderRadius?: string;
  /** CSS color value for the button background. Defaults to the primary brand red. */
  bgColor?: string;
}

/**
 * ShimmerButton — replica o efeito "Shimmer Line Button" do Framer:
 *
 * Estrutura:
 *   <div class="shimmer-wrapper">   ← conic-gradient rotacionando (a "linha de luz")
 *     <button>                      ← fundo sólido vermelho, recuado 1.5px
 *       {children}
 *     </button>
 *   </div>
 *
 * O wrapper tem o conic-gradient como background.
 * O botão interno cobre quase tudo, deixando apenas 1.5px de borda visível (o shimmer).
 *
 * Usamos ref + useEffect para forçar backgroundColor diretamente no DOM,
 * evitando que o Tailwind sobrescreva via cascade.
 */
export function ShimmerButton({
  children,
  className,
  borderRadius = "9999px",
  bgColor,
  onClick,
  disabled,
  type,
  style,
  ...props
}: ShimmerButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (btnRef.current) {
      // Usa var(--primary) diretamente — a variável é OKLCH, não HSL
      btnRef.current.style.setProperty(
        "background-color",
        bgColor ?? "var(--primary)",
        "important"
      );
      btnRef.current.style.setProperty("color", "white", "important");
    }
  }, [bgColor]);

  return (
    <div
      className="shimmer-wrapper inline-flex"
      style={{
        borderRadius,
        padding: "1.5px",
        boxShadow: `0 0 28px 6px hsl(var(--primary) / 0.40), 0 4px 16px hsl(var(--primary) / 0.25)`,
      }}
    >
      <button
        ref={btnRef}
        onClick={onClick}
        disabled={disabled}
        type={type}
        {...props}
        className={cn(
          "relative inline-flex items-center justify-center gap-2",
          "px-8 py-3.5 text-base font-bold",
          "cursor-pointer select-none outline-none",
          "transition-transform duration-200 active:scale-95 hover:scale-[1.03]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        style={{
          borderRadius: `calc(${borderRadius} - 1.5px)`,
          ...style,
        }}
      >
        {children}
      </button>
    </div>
  );
}
