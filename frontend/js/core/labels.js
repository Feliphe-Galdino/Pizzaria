export const TAGS = {
  vegetariano: { label: "Vegetariana", icon: "leaf" },
  picante: { label: "Picante", icon: "pepper" },
  novo: { label: "Novidade", icon: "spark" },
  "mais-pedido": { label: "Favorita da casa", icon: "star" },
  "sem-lactose": { label: "Sem lactose", icon: "leaf" },
};

export const ORDER_STATUS = {
  received: "Recebido",
  preparing: "No forno",
  ready: "Pronto para retirada",
  out_for_delivery: "Saiu para entrega",
  completed: "Entregue",
  canceled: "Cancelado",
};

export const PAYMENT = { pix: "Pix", card: "Cartão na entrega", cash: "Dinheiro" };
export const FULFILLMENT = { delivery: "Entrega", pickup: "Retirada" };
