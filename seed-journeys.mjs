import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const db = await mysql.createConnection(process.env.DATABASE_URL);

const journeys = [
  {
    name: "🛒 Recuperação de Carrinho Abandonado",
    description: "Envia mensagem 15 min após abandono. Se o cliente comprar, encerra. Caso contrário, envia mais uma mensagem com link do pedido após 25 min.",
    trigger: "checkout_abandoned",
    status: "active",
    steps: JSON.stringify([
      { id: "s1", type: "wait", label: "Aguardar 15 minutos", delayMinutes: 15 },
      { id: "s2", type: "condition", label: "Verificar se já comprou", condition: "purchased_since_start", onTrue: "stop", onFalse: "continue" },
      { id: "s3", type: "send_whatsapp", label: "Mensagem 1 - Lembrete", message: "Oi {nome}! 🍕 Você deixou itens no seu carrinho na Bonatto Pizza. Que tal finalizar seu pedido? Acesse: {link}" },
      { id: "s4", type: "send_push", label: "Push - Carrinho esperando", title: "🛒 Seu carrinho está esperando!", message: "Finalize seu pedido na Bonatto Pizza e aproveite nossas pizzas fresquinhas!" },
      { id: "s5", type: "wait", label: "Aguardar mais 25 minutos", delayMinutes: 25 },
      { id: "s6", type: "condition", label: "Verificar se comprou após 1ª mensagem", condition: "purchased_since_start", onTrue: "stop", onFalse: "continue" },
      { id: "s7", type: "send_whatsapp", label: "Mensagem 2 - Urgência com link", message: "Oi {nome}! 🍕 Ainda dá tempo! Seu carrinho ainda está salvo. Finalize agora: {link}\n\nQualquer dúvida é só chamar! 😊" },
    ]),
  },
  {
    name: "😴 Reativação - Inativo 15 dias",
    description: "Clientes que não compram há 15 dias. Envia mensagem de saudade e oferta.",
    trigger: "tag_inativo_15",
    status: "active",
    steps: JSON.stringify([
      { id: "s1", type: "send_whatsapp", label: "Mensagem de saudade", message: "Oi {nome}! 🍕 Sentimos sua falta aqui na Bonatto Pizza! Faz um tempinho que você não pede nada... Que tal uma pizza hoje? Acesse nosso cardápio: {link}" },
      { id: "s2", type: "send_push", label: "Push - Sentimos sua falta", title: "🍕 Sentimos sua falta!", message: "Volte para a Bonatto Pizza e peça sua pizza favorita!" },
    ]),
  },
  {
    name: "💤 Reativação - Inativo 30 dias",
    description: "Clientes que não compram há 30 dias. Mensagem com oferta especial.",
    trigger: "tag_inativo_30",
    status: "active",
    steps: JSON.stringify([
      { id: "s1", type: "send_whatsapp", label: "Oferta especial para reativar", message: "Oi {nome}! 🍕 Faz 30 dias que você não pede na Bonatto Pizza... Preparamos uma surpresa especial pra você voltar! Use o cupom VOLTEI no seu próximo pedido e ganhe um desconto especial. Acesse: {link}" },
      { id: "s2", type: "add_tag", label: "Adicionar tag indeciso", tag: "indeciso" },
    ]),
  },
  {
    name: "🔴 Reativação - Inativo 60 dias",
    description: "Clientes inativos há 60 dias. Última tentativa com oferta agressiva.",
    trigger: "tag_inativo_60",
    status: "active",
    steps: JSON.stringify([
      { id: "s1", type: "send_whatsapp", label: "Última tentativa - oferta agressiva", message: "Oi {nome}! 🍕 Faz 2 meses que você não aparece por aqui! Queremos muito te ver de volta. Temos novidades no cardápio e uma oferta exclusiva esperando por você. Acesse: {link}\n\nQualquer dúvida é só responder essa mensagem! 😊" },
      { id: "s2", type: "send_push", label: "Push - Última chance", title: "🔴 Última oferta especial para você!", message: "60 dias sem pedir na Bonatto Pizza. Temos uma surpresa especial esperando por você!" },
    ]),
  },
  {
    name: "🎉 Boas-vindas ao Novo Cliente",
    description: "Enviado após o primeiro pedido. Apresenta o restaurante e incentiva o segundo pedido.",
    trigger: "first_order",
    status: "active",
    steps: JSON.stringify([
      { id: "s1", type: "wait", label: "Aguardar 30 minutos após o pedido", delayMinutes: 30 },
      { id: "s2", type: "send_whatsapp", label: "Mensagem de boas-vindas", message: "Oi {nome}! 🍕 Seja bem-vindo(a) à família Bonatto Pizza! Esperamos que tenha adorado seu pedido. Nos conte o que achou! E para o próximo pedido, lembre-se: você pode acompanhar em tempo real pelo nosso app. Até a próxima! 😊" },
      { id: "s3", type: "add_tag", label: "Confirmar tag Novo", tag: "novo" },
    ]),
  },
  {
    name: "📢 Promoção Semanal",
    description: "Jornada manual para disparar promoções semanais para toda a base de clientes.",
    trigger: "manual",
    status: "draft",
    steps: JSON.stringify([
      { id: "s1", type: "send_whatsapp", label: "Mensagem de promoção", message: "Oi {nome}! 🍕 Essa semana temos uma promoção especial na Bonatto Pizza! Aproveite antes que acabe. Acesse nosso cardápio: {link}" },
      { id: "s2", type: "send_push", label: "Push de promoção", title: "🎉 Promoção especial esta semana!", message: "Confira as ofertas exclusivas da Bonatto Pizza. Por tempo limitado!" },
    ]),
  },
];

for (const j of journeys) {
  const [existing] = await db.execute("SELECT id FROM journeys WHERE name = ?", [j.name]);
  if (existing.length > 0) {
    console.log(`Jornada já existe: ${j.name}`);
    continue;
  }
  await db.execute(
    "INSERT INTO journeys (name, description, `trigger`, status, steps, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
    [j.name, j.description, j.trigger, j.status, j.steps]
  );
  console.log(`✅ Criada: ${j.name}`);
}

await db.end();
console.log("✅ Seed de jornadas concluído!");
