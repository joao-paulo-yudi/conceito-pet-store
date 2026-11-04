# Conceito Pet Store

Site da Conceito Pet Store, pet shop em Votorantim (SP) com banho e tosa com leva e traz, consultório veterinário, farmácia, hotel e boutique.

O site apresenta os serviços da loja e permite que o cliente reserve um horário de banho e tosa online.

## Funcionalidades

- **Reserva de horários:** o cliente escolhe serviço, porte do pet, dia e horário. Os horários já ocupados aparecem indisponíveis.
- **Envio pelo WhatsApp:** a reserva gera uma mensagem pronta para a loja.
- **Painel da loja (`/painel`):** área com login onde a equipe confirma, conclui ou cancela reservas, fecha dias e horários e ajusta a agenda e a quantidade de pets por horário.
- **Regras no banco:** clientes só veem se um horário está livre ou cheio; dados pessoais ficam visíveis apenas no painel. O banco impede reservas duplicadas na última vaga, em dias fechados ou em horários passados.
- **Acessibilidade:** respeita a preferência "reduzir movimento" do sistema e oferece um botão para pausar as animações.

## Tecnologias

- HTML, CSS e JavaScript puro, sem framework e sem build.
- [Supabase](https://supabase.com) para o banco de reservas e o login do painel.
- Hospedagem na [Vercel](https://vercel.com).

## Estrutura

```
site/                  site publicado
  index.html           página principal
  painel/              painel de gestão das reservas
  assets/js/config.js  dados da loja (endereço, horários, serviços, contatos)
  assets/              estilos, scripts, fontes e imagens
supabase-schema.sql    tabelas, regras de acesso e funções do banco
logo/                  logo da loja em vetor (SVG e PNG)
```
