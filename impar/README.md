# ÍMPAR — Jogo de Estratégia (2D Minimalista & 3D)

Jogo digital oficial baseado no manual de **ÍMPAR** (Ênyo Saldanha e Eurico Cunha), para **3 a 5 jogadores**.

## Versões disponíveis
- **2D Minimalista + Salas Online (`/impar_2d/`)**: Jogue **Contra a IA**, em **Mesa Local** ou **Online (Salas)** com código de sala, link de convite e senha opcional (via WebRTC P2P / PeerJS, 100% compatível com hospedagem estática no GitHub Pages).
- **3D Desktop (`/app/` e `/Computador/Impar.exe`)**: Mesa e peças 3D em Three.js.

## Publicar na Web via GitHub Pages
1. Crie um repositório no GitHub (ex.: `impar`) e envie os arquivos deste projeto para a branch `main` (você pode usar **GitHub Desktop**, `git` no terminal ou o upload direto pelo site do GitHub).
2. No repositório do GitHub, acesse **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **Deploy from a branch**, escolha a branch **`main`** e a pasta **`/ (root)`**, e clique em **Save**.
4. Após alguns instantes, o jogo ficará disponível em `https://<seu-usuario>.github.io/<nome-do-repo>/`.

> O arquivo raiz `index.html` redireciona automaticamente (preservando links de convite `?sala=XXXXX`) para `./impar_2d/index.html`.
