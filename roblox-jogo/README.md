# Jogo Roblox — Matar Inimigos, Ganhar XP e Nível

Jogo simples feito com **apenas 3 scripts Lua**:

1. `ServerScriptService/GerenciadorDeJogo.server.lua` — **Script** (servidor).
   Cria os status do jogador (`leaderstats`: Nível, XP, Mortes), gera os
   inimigos no mapa, controla a vida deles e, quando um inimigo morre, dá XP
   e conta de mortes para quem o matou. Também sobe de nível automaticamente
   quando o XP passa do necessário (`nível * 100`).

2. `StarterGui/InterfaceDeStatus.client.lua` — **LocalScript** (cliente).
   Monta a GUI (painel com Nível, barra de XP e Mortes) inteiramente por
   código e mostra avisos de "+XP" e "NÍVEL X!" na tela.

3. `StarterPack/EspadaDoCacador/DanoDaEspada.server.lua` — **Script** dentro
   de uma `Tool` (a espada). Detecta o golpe (`Activated`), causa dano só em
   modelos marcados com a tag `"Inimigo"` e marca quem foi o autor do dano
   (para o script 1 saber a quem dar o XP).

## Como montar no Roblox Studio

1. **ServerScriptService**
   - Insira um `Script` chamado `GerenciadorDeJogo` dentro de
     `ServerScriptService` e cole o conteúdo de
     `ServerScriptService/GerenciadorDeJogo.server.lua`.

2. **StarterGui**
   - Insira um `LocalScript` chamado `InterfaceDeStatus` dentro de
     `StarterGui` e cole o conteúdo de
     `StarterGui/InterfaceDeStatus.client.lua`.

3. **StarterPack (a ferramenta/espada)**
   - Dentro de `StarterPack`, insira uma `Tool` e renomeie para
     `EspadaDoCacador`.
   - Dentro da `Tool`, insira uma `Part` chamada exatamente `Handle`
     (é o "cabo"/lâmina que o personagem segura e que detecta o toque).
     Dê um tamanho tipo `1x4x0.2` e a forma/cor que quiser.
   - Ainda dentro da `Tool`, insira um `Script` chamado `DanoDaEspada` e
     cole o conteúdo de
     `StarterPack/EspadaDoCacador/DanoDaEspada.server.lua`.

Pronto — ao dar Play, o jogador já nasce com a espada na mochila, os
inimigos aparecem nos pontos de spawn, e golpeá-los com a espada equipada
(clique para ativar a ferramenta) causa dano. Ao morrer, o inimigo dá XP e
mortes ao jogador que o matou, e reaparece depois de alguns segundos.

## Configurações rápidas

Todas no topo de cada script:

- `VIDA_INIMIGO`, `XP_MIN_POR_INIMIGO`/`XP_MAX_POR_INIMIGO`, `TEMPO_RESPAWN`
  em `GerenciadorDeJogo.server.lua`.
- `DANO`, `TEMPO_DE_GOLPE`, `COOLDOWN` em `DanoDaEspada.server.lua`.
- Fórmula de XP necessário por nível (`nível * 100`) na função
  `xpNecessarioParaNivel`, presente tanto no script do servidor quanto no
  da GUI (ela só é usada ali para desenhar a barra).
