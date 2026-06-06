export const BRAND_ASSETS = {
  comboBanner: "/brand/banner-combo.png",
  icon: "/brand/bonatto-icon-novo.png",
  driverLogo: "/brand/bonatto-logo-driver.jpg",
  homeLogo: "/brand/bonatto-logo-home.jpg",
  heroLogo: "/brand/bonatto-logo-nova.png",
  whiteLogo: "/brand/logo-branca.webp",
  mascot: "/brand/mascote-caixas.webp",
  courier: "/brand/motoboy-bonatto.png",
  navbarBg: "/brand/navbar-bg-vermelho.png",
  palmito: "/brand/palmito-2-circular.png",
  palmitoMenu: "/brand/palmito-cardapio.png",
  palmitoWordmark: "/brand/palmito-logo-tipografica.png",
  pizzaHero: "/brand/pizza-hero.webp",
} as const;

export const CATEGORY_MEDIA = {
  pizzas: "/brand/pizza-1-margherita.jpg",
  calzones: "/brand/pizza-14.png",
  lasanhas: "/brand/pizza-15.jpg",
  empanados: "/brand/pizza-16.jpg",
  sorvetes: "/brand/pizza-10.webp",
  bebidas: "/brand/pizza-8.jpg",
  extras: "/brand/pizza-12.jpg",
  promocoes: "/brand/banner-combo.png",
} as const;

export const PIZZA_GALLERY = [
  "/brand/pizza-1-margherita.jpg",
  "/brand/pizza-2-calabresa.jpg",
  "/brand/pizza-3-portuguesa.jpg",
  "/brand/pizza-4-frango.jpg",
  "/brand/pizza-5-mussarela.jpg",
  "/brand/pizza-6-pepperoni.jpg",
  "/brand/pizza-7-quatro-queijos.webp",
  "/brand/pizza-8.jpg",
  "/brand/pizza-9.jpg",
  "/brand/pizza-10.webp",
  "/brand/pizza-11.jpg",
  "/brand/pizza-12.jpg",
  "/brand/pizza-13.jpeg",
  "/brand/pizza-14.png",
  "/brand/pizza-15.jpg",
  "/brand/pizza-16.jpg",
  "/brand/pizza-17.jpg",
] as const;

export const HOME_CATEGORY_CARDS = [
  { name: "Pizzas", emoji: "🍕", img: CATEGORY_MEDIA.pizzas, desc: "Mais de 20 sabores" },
  { name: "Calzones", emoji: "🥙", img: CATEGORY_MEDIA.calzones, desc: "Recheados e crocantes" },
  { name: "Lasanhas", emoji: "🍝", img: CATEGORY_MEDIA.lasanhas, desc: "Feitas na hora" },
  { name: "Bebidas", emoji: "🥤", img: CATEGORY_MEDIA.bebidas, desc: "Geladas e refrescantes" },
  { name: "Sorvetes", emoji: "🍦", img: CATEGORY_MEDIA.sorvetes, desc: "Para adoçar o fim" },
  { name: "Empanados", emoji: "🍗", img: CATEGORY_MEDIA.empanados, desc: "Crocantes e saborosos" },
] as const;

export const APP_HIGHLIGHTS = [
  {
    label: "Pedido em poucos toques",
    value: "3 passos",
    description: "Fluxo desenhado para abrir, escolher e pagar sem atrito.",
  },
  {
    label: "Entrega com acompanhamento",
    value: "Tempo real",
    description: "Status do pedido, push e rota do motoboy na mesma experiência.",
  },
  {
    label: "Arquitetura pronta para escalar",
    value: "40k+ MAU",
    description: "Assets locais, PWA, shell nativa e backend desacoplado para produção.",
  },
] as const;

export const MAGNIFIC_ICON_RECIPES = [
  { name: "pizza-category", term: "pizza slice outline premium app icon" },
  { name: "delivery-tracking", term: "delivery scooter route modern outline icon" },
  { name: "loyalty-club", term: "crown reward premium loyalty icon" },
  { name: "checkout-fast", term: "credit card lightning checkout icon" },
  { name: "support-chat", term: "chat bubble concierge modern icon" },
] as const;

export const FALLBACK_PIZZA_IMAGE = BRAND_ASSETS.pizzaHero;
