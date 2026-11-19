# Mundo do Tabuleiro (`mundodotabuleiro.com.br`) — Guia Rápido

Este site é **100% estático** (HTML, CSS e JavaScript puro), então funciona sem servidor complexo nem banco de dados, em qualquer hospedagem moderna gratuita.

---

## 1. Como testar o site no seu computador agora

1. Na pasta do projeto (`mundo_do_tabuleiro`), dê dois cliques em **`Abrir-Site-Local.bat`**.
2. Uma janela preta do servidor local vai abrir e o seu navegador abrirá o site automaticamente em `http://127.0.0.1:8080/`.
3. Para parar o servidor depois de testar, basta fechar a janela preta.

> **Por que usar o `.bat` localmente?**
> Os jogos **ÍMPAR** e **Zero Two Five** usam JavaScript em módulos (`type="module"`). Por segurança, o navegador bloqueia módulos quando um arquivo é aberto direto como `file://`, mas tudo funciona perfeitamente via servidor local ou quando publicado na internet.

---

## 2. Como adicionar novos jogos no futuro

Quando criar um novo jogo web:

1. Copie a pasta do novo jogo para dentro da pasta `mundo_do_tabuleiro/` (por exemplo, `mundo_do_tabuleiro/meu_novo_jogo/`).
2. Abra o arquivo `js/games.js` e adicione um novo bloco dentro de `window.MUNDO_GAMES = [ ... ]`, copiando o modelo de `impar` ou `zero-two-five`:
   - `id`: identificador único sem espaços (ex.: `'meu-jogo'`), usado na URL `?jogo=meu-jogo`
   - `title`, `tagline`, `description`, `players`, `duration`, `age`, `tags`, `highlight`
   - `cover`: caminho da imagem de capa
   - `manualPdf`: caminho do manual PDF (se houver)
   - `editions`: lista com `{ id, label, badge, url }` apontando para o `index.html` do jogo
   - `quickRules`: seções do resumo rápido exibido na gaveta **Regras Rápidas**
3. Salve o `js/games.js` — o novo jogo já aparece automaticamente na página inicial, no seletor rápido do palco e nas URLs!

---

## 3. Como publicar no ar e ligar o domínio `mundodotabuleiro.com.br`

Você não precisa pagar servidor caro — o site roda perfeitamente em planos gratuitos com HTTPS automático:

### Opção A — Cloudflare Pages ou Netlify (mais simples, sem precisar usar terminal)
1. **Dica para subir mais rápido:** antes de subir, você pode apagar (ou não enviar) apenas os arquivos pesados de desktop que não rodam no navegador (`impar/Computador/`, `impar/Computador_2D/`, `zero_two_five/ZeroTwoFive.exe`, `zero_two_five/ZeroTwoFive_Web.zip`, `zero_two_five/web_dist/`, `zero_two_five/desktop/`). Eles já estão listados no `.gitignore`.
2. Crie uma conta gratuita na **Netlify** (`app.netlify.com`) ou **Cloudflare Pages** (`dash.cloudflare.com`).
3. Arraste a pasta do projeto (ou conecte um repositório do GitHub com o projeto). O site já sobe com SSL/HTTPS no ar em segundos.
4. No painel da Netlify ou Cloudflare, vá em **Custom Domains** (Domínios Personalizados) e adicione:
   - `mundodotabuleiro.com.br`
   - `www.mundodotabuleiro.com.br`

### Opção B — Ligando o domínio no Registro.br
Depois de comprar `mundodotabuleiro.com.br` no **Registro.br**:
1. **Se usar Cloudflare Pages (recomendado):** basta copiar os dois servidores DNS que a Cloudflare mostrar e colar no painel do Registro.br em **DNS → Alterar servidores DNS**. Tudo (domínio + `www` + certificado HTTPS) é configurado automaticamente.
2. **Se usar Netlify / Vercel:** no Registro.br, acesse **DNS → Editar Zona** e adicione o registro `A` e o `CNAME` (`www`) exatamente como o painel da Netlify/Vercel indicar.

Em poucas horas após a propagação do DNS, qualquer pessoa acessando **`https://mundodotabuleiro.com.br`** já chega escolhendo os jogos e jogando na hora!
