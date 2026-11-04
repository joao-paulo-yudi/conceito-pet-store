/* =====================================================================
   CONFIGURAÇÃO DO SITE — edite só este arquivo para mudar dados da loja.
   Campos vazios ("") somem do site sozinhos.
   ===================================================================== */
window.CONCEITO = {
  loja: "Conceito Pet Store",
  cidade: "Votorantim, SP",

  // WhatsApp que recebe as mensagens e as reservas (só números, com 55 + DDD)
  whatsapp: "5515981516069",
  whatsappTexto: "(15) 98151-6069",

  telefones: ["(15) 3024-0044", "(15) 98151-6099", "(15) 99133-3708"],

  // Preencha quando tiver:
  endereco: "",                 // ex.: "Av. 31 de Março, 123 · Centro"
  mapa: "",                     // link do Google Maps da loja
  horarios: [                   // aparece no rodapé
    // ["Seg a sex", "8h às 18h"],
    // ["Sábado",   "8h às 13h"],
  ],
  instagram: "",                // ex.: "https://instagram.com/conceitopetstore"
  facebook: "https://facebook.com/conceitopetstore",

  // Banco de reservas (Supabase). Enquanto estiver vazio, a reserva vai
  // direto para o WhatsApp. Cole aqui a Project URL e a anon public key.
  // NUNCA coloque a service_role aqui.
  supabaseUrl: "https://bhaclmlyvaudegseugds.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYWNsbWx5dmF1ZGVnc2V1Z2RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMDQwNjYsImV4cCI6MjEwODc4MDA2Nn0.NmdhzLuOi9Ye3etjcCxmDQ9BhwA7UMkLgS8dgOkSHGE",

  // Usado só quando o banco ainda não está ligado
  horariosPadrao: ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"],
  diasFechados: [0],            // 0 = domingo
  diasAFrente: 21,

  servicos: ["Banho", "Banho e tosa", "Tosa higiênica", "Consulta veterinária"],
  portes: ["Pequeno", "Médio", "Grande", "Gigante"]
};
