# Clara — Clínica Sorriso

Recepcionista de IA para clínicas (odontologia primeiro). Esta demo mostra o **cérebro** da Clara num chat estilo WhatsApp, em português do Brasil.

**Honestidade:** no piloto isso roda no WhatsApp Business da clínica. Aqui é o mesmo atendimento, ainda não o número oficial.

Persona: educada, objetiva. **Não inventa preço.** **Não diagnostica.** Se não souber, transfere para um humano.

Clínica de exemplo: **Clínica Sorriso** (Savassi, Belo Horizonte).

---

## Rodar local

Requisito: Node.js 20+.

```bash
npm install
cp .env.example .env.local   # opcional
npm run dev
```

Abre [http://localhost:43180](http://localhost:43180) (porta preferida desta demo).

| Rota | O que é |
|---|---|
| `/` | Chat da paciente com a Clara |
| `/equipe` | Painel da equipe (agendamentos, recados, urgência) |

```bash
npm test          # caminhos do roteiro (feliz, não-sei, urgência)
npm run build     # checagem de produção
npm start         # serve o build na porta 43180
```

---

## Variáveis de ambiente

Veja `.env.example`.

| Variável | Obrigatória? | Efeito |
|---|---|---|
| `OPENAI_API_KEY` | Não | Sem chave: **modo roteirizado**, sólido para apresentar. Com chave: LLM (cai no roteiro se a API falhar). |
| `OPENAI_MODEL` | Não | Padrão `gpt-4o-mini`. |

Os caminhos da demo técnica (horário, preço autorizado, agendar, “não sei”, dor forte) são **determinísticos no modo roteirizado** — e a urgência / implante+sedação+24x continuam roteirizados mesmo com chave, para não furar a apresentação.

---

## Base editável da clínica

Tudo o que a Clara pode afirmar vive em [`data/clinic.json`](data/clinic.json):

- horário, endereço, estacionamento
- convênios
- serviços e **quais preços podem ser ditos**
- telefone da recepção e da urgência
- o que levar na primeira consulta
- política de remarcação
- tom e regras de segurança

Depois de editar, rode de novo (`npm run dev` ou um novo deploy). Não coloque na base um preço que a clínica não autorizou.

---

## O que a demo cobre (roteiro 10–12 min)

1. **Caminho feliz (22h):** “Oi, vocês atendem amanhã?” → preço de avaliação/limpeza **só o autorizado** → “Quero agendar” → 2–3 horários → nome + telefone → aviso no painel `/equipe`.
2. **Não sei:** “Vocês fazem implante com sedação e parcelam em 24x no cheque?” → não inventa valor; oferece recado / retorno humano.
3. **Urgência:** “Estou com dor forte agora.” → orientação de pronto-socorro, telefone, oferta de encaixe, **sem diagnóstico**.

Use os chips abaixo do campo de mensagem para clicar o roteiro no celular.

---

## Deploy na Vercel (Hobby)

1. Importe este repositório em [vercel.com](https://vercel.com) (framework **Next.js** é detectado).
2. *Root directory:* `.`  
   *Build:* `npm run build` · *Output:* padrão Next.
3. Variáveis: `OPENAI_API_KEY` só se quiser o modo LLM. A demo **funciona sem nenhuma env**.
4. Deploy. Hobby é suficiente para apresentar.

**Notas Hobby:** o painel da equipe guarda avisos em memória do serverless (some em *cold start*) **e** no `localStorage` do navegador da demo. Para um piloto real, o aviso cai no grupo/e-mail/Calendar da clínica — não neste armazenamento de apresentação.

---

## Segurança (não negociável)

- Sem preço fora de `data/clinic.json`
- Sem diagnóstico, medicamento ou “provavelmente é X”
- Urgência: humano + pronto-socorro, nunca receita
- “Não sei” elegante + handoff
- Aviso de demo / LGPD no rodapé do chat — não envie dados reais de paciente

---

## Piloto (depois desta demo)

1. WhatsApp Business da clínica  
2. FAQ + horários + o que pode falar de preço  
3. ~7–10 dias no ar; primeira quinzena de ajuste  

Clara **não** substitui a recepção inteira. Ela responde e agenda com as regras de vocês; o resto é humano.
