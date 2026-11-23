# Fluxo: converter um mapa de imagem em cena

**Quando usar:** o mestre já tem um mapa (imagem) e quer movê-lo, editá-lo por objetos ou usá-lo com a IA.

```
Mapa de imagem → Segmentar → Revisar máscaras → Confirmar custo → Inpainting + recortes → Nova cena + novo mapa
```

1. Em Mapas, escolher o mapa e **"Converter em cena"** (`ConverterCena`). Requer o provedor de **segmentação** e, para qualidade total, um provedor de imagem com **inpainting**.
2. **Segmentar** (`POST /api/ia/segmentar`): o servidor lê a imagem do documento do mapa e devolve **máscaras sugeridas** (até 12 objetos), o uso atual e se o provedor reconstrói o fundo.
3. **Revisar:** o mestre **aceita**, recusa, **junta** ou **divide** segmentos; dá nome a cada um.
4. **Estimativa/confirmar:** a conversão consome gerações do teto; o mestre confirma.
5. **Converter** (`POST /api/ia/inpaint`): reconstrói o fundo sob os objetos aceitos (em lotes de 4), recorta cada objeto como sprite, cria os assets (marcados `convertidoDe`), uma **cena** e um **novo mapa**.
6. **Resultado:** o mapa original permanece intacto; o novo mapa é de cena e pode ser editado, ter cobertura, ser liberado ou exportado.

**Falhas e fallbacks**
- *Sem inpainting no provedor:* conversão **parcial** com aviso; objetos continuam no fundo.
- *Reconstrução ruim (>20 % de magenta restante):* falha; tudo o que foi criado é desfeito.
- *Objeto cortado/encoberto:* sprite marcado `incompleto` (pode ser completado por IA depois).

Detalhes: [ia-conversao-imagem-em-cena](../features/ia-conversao-imagem-em-cena.md), [mapas-e-imagens](../features/mapas-e-imagens.md).
