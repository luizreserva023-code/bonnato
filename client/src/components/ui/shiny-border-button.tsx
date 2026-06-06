import React from 'react';

interface ShinyBorderButtonProps {
  text: string;
  onClick?: () => void;
  className?: string;
}

const ShinyBorderButton = ({ text, onClick, className = '' }: ShinyBorderButtonProps) => {
  return (
    <div
      className={`relative w-full ${className}`}
      style={{ animation: 'shiny-pulse 2.2s ease-in-out infinite' }}
    >
      {/* Anel de pulse externo */}
      <div
        className="absolute inset-0 rounded-[16px] pointer-events-none"
        style={{ animation: 'shiny-ring 2.2s ease-in-out infinite' }}
      />

      <button
        onClick={onClick}
        className="group relative p-[3px] rounded-[16px] border-none cursor-pointer transition-all w-full"
        style={{
          background: 'radial-gradient(circle 80px at 80% -10%, #ff4444, #1a0000)',
        }}
      >
        {/* Glow canto superior direito */}
        <div
          className="absolute top-0 right-0 w-[65%] h-[60%] rounded-[120px] -z-10 transition-all duration-300"
          style={{ boxShadow: '0 0 20px rgba(220,38,38,0.35)' }}
        />

        {/* Blob vermelho canto inferior esquerdo */}
        <div
          className="absolute bottom-0 left-0 w-[50px] h-[50%] rounded-[17px] transition-all duration-300 ease-out group-hover:w-[90px]"
          style={{
            background: 'radial-gradient(circle 60px at 0% 100%, #ff2222, rgba(255,60,0,0.4), transparent)',
            boxShadow: '-2px 9px 40px rgba(220,38,38,0.4)',
          }}
        />

        {/* Conteúdo interno */}
        <div
          className="relative px-[25px] py-[16px] rounded-[14px] text-white font-black z-10 transition-all duration-300 text-center text-lg"
          style={{
            background: 'radial-gradient(circle 80px at 80% -50%, #3a0000, #0a0000)',
          }}
        >
          {text}
          {/* Camada de brilho interno */}
          <div
            className="absolute inset-0 rounded-[14px] -z-[1]"
            style={{
              background: 'radial-gradient(circle 60px at 0% 100%, rgba(255,60,0,0.12), rgba(180,0,0,0.08), transparent)',
            }}
          />
        </div>
      </button>
    </div>
  );
};

export default ShinyBorderButton;
