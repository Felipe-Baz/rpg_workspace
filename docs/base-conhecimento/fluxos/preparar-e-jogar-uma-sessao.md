# Fluxo: preparar e jogar uma sessão

**Objetivo:** ir do preparo ao registro da sessão, sem trocar de ferramenta no meio do jogo.

## 1. Preparo (modo "estou preparando")
- **Mundo/Fichas:** cadastrar NPCs, inimigos e itens do mestre (nascem ocultos).
- **Missões:** criar/avançar etapas; etapas `pendente` ficam ocultas aos jogadores.
- **Mapas:** subir, criar cena (ou converter uma imagem), definir **coberturas** e **zonas**; exportar para VTT se for usar outra mesa virtual.
- **Segredos/Sessões:** anotar a trama e a nota secreta da próxima sessão.
- **Liberar** ao grupo só o que já é para ser visto (mapas, imagens, fichas).

## 2. Jogo (modo "estou jogando")
1. Clicar em **"Iniciar sessão"** (sidebar) → Sessão ao vivo.
2. **Iniciativa**, **dados**, **cronômetro** e **notas rápidas** na mesma tela; atalhos para Mapas, Mundo, Missões, NPCs, Inimigos, Segredos.
3. Revelar áreas do mapa (coberturas) e liberar fichas/mapas conforme a história anda. O jogador recebe aviso de novidade em tempo real.

## 3. Encerramento
1. **"Encerrar e registrar"** pede confirmação.
2. Cria uma **sessão nova** com a data de hoje (`Sessão N`) em `mesa.sessoes`.
3. As **notas rápidas** viram a **nota secreta** da sessão (`segredos/mestre.notasSessoes[id]`) e o campo é limpo.
4. Vai para Sessões; o mestre escreve o **resumo público**, que alimenta o diário dos jogadores.
5. Missões e fichas são atualizadas para a próxima rodada.

**Atenção:** iniciativa, rolagens e notas rápidas ficam no `localStorage` do navegador do mestre; encerrar a sessão é o que as leva para o Firestore (apenas as notas).

Veja: [sessao-ao-vivo](../features/sessao-ao-vivo.md), [sessoes-e-segredos](../features/sessoes-e-segredos.md), [mapas-e-imagens](../features/mapas-e-imagens.md), [liberacao-de-conteudo](../features/liberacao-de-conteudo.md).
