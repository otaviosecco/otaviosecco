---
layout: project
title: Port da engine GFootball para Unity
description: Port incremental da engine legada em C++ para uma simulação de futebol independente em C# e Unity.
order: 2
permalink: /projetos-pessoais/gfootball-unity/
---

# Port da engine GFootball para Unity

## Visão geral

Este projeto é um port incremental da engine do **Google Research Football (GFootball)**, originalmente escrita em C++, para uma simulação independente em C# integrada à Unity.

O objetivo não é apenas executar a biblioteca antiga dentro da Unity. A nova engine reproduz a partida, a física e a tomada de decisão dos jogadores em código gerenciado, enquanto a versão C++ permanece disponível como referência para detectar diferenças de comportamento durante a migração.

## Objetivo

Modernizar a base da simulação sem perder as regras, os sistemas táticos e as decisões emergentes da engine original. O port também cria uma base mais simples de integrar a cenas, ferramentas e experiências interativas na Unity.

## Preparação e correções na engine original

Antes de iniciar a tradução para C#, trabalhei na própria base C++ para estabilizar comportamentos que seriam usados como referência:

- Corrigi a importação das formações para que `position`, `start_position`, função, estado de controle e demais propriedades sejam copiadas do mesmo jogador. Antes disso, um defensor podia receber a posição de um slot ofensivo.
- Corrigi a escolha dos jogadores de apoio no kickoff. A seleção agora acontece somente depois que toda a formação foi posicionada, evitando escolher um defensor que ainda estava provisoriamente perto da origem.
- Adicionei regras ofensivas opcionais à IA nativa: desconto progressivo para passes em direção a jogadores impedidos e maior propensão ao chute em situações de um contra um.
- Isolei essas regras atrás de uma configuração explícita e serializável. Assim, partidas normais podem utilizá-las sem alterar silenciosamente Academy Levels, cenários customizados ou testes existentes.
- Testei mudanças de recomposição defensiva e pressão, mas mantive a lógica original quando os experimentos pioraram o comportamento coletivo.

Essas correções deixaram o legado mais previsível e forneceram uma base confiável para comparar a nova implementação.

## Passo a passo do port

1. **Preservação do legado:** mantive a engine C++ dentro do projeto como fonte de comportamento e referência para a migração.
2. **Estabilização da referência:** corrigi os problemas de formação e kickoff e tornei as novas regras táticas configuráveis, mantendo compatibilidade com os cenários antigos.
3. **Criação do oráculo nativo:** construí a `libGFootballOracle.so`, uma biblioteca que encapsula o `GameEnv` original atrás de uma ABI C pequena e estável. Nenhum tipo interno de C++ atravessa essa fronteira.
4. **Integração com a Unity:** implementei uma ponte em C# com P/Invoke para criar partidas, aplicar ações, avançar a simulação, obter observações e capturar ou restaurar snapshots.
5. **Separação dos artefatos:** removi as extensões CPython da pasta importada pela Unity e mantive apenas a biblioteca própria do oráculo como plugin do Editor.
6. **Construção da engine gerenciada:** defini em C# o estado dos jogadores, bola, placar, eventos, ações e o contrato de `Reset`/`Step` da simulação.
7. **Migração por subsistemas:** portei gradualmente formação, percepção, imagem mental, posse, passes, dribles, finalizações, defesa, goleiro, resistência e bolas paradas.
8. **Normalização dos dados:** converti coordenadas, escalas, velocidades, papéis e índices de jogadores entre o espaço legado e o utilizado na Unity.
9. **Validação de paridade:** executo as duas engines com seeds, estados e ações controladas para localizar o primeiro frame em que seus comportamentos divergem.
10. **Execução na Unity:** a implementação C# já permite partidas entre duas IAs, partidas completas com 11 jogadores por equipe e cenários reduzidos da Academy.

## Estrutura do projeto

```text
GFootball/
├── Assets/GFootball/
│   ├── Engine/          # Simulação C#, regras e IA tática
│   ├── Port/            # Cálculos traduzidos com paridade numérica
│   ├── Oracle/          # Ponte nativa e comparação entre as engines
│   └── Tests/Editor/    # Testes da simulação, do port e do oráculo
├── Assets/legacy/football/
│   └── third_party/gfootball_engine/
│       ├── src/         # Engine C++ original e correções realizadas
│       └── unity_oracle/ # ABI C criada para a integração
├── Assets/Plugins/x86_64/
│   └── libGFootballOracle.so
└── NativeArtifacts/python/
    └── ...              # Extensões Python isoladas do importador da Unity
```

### `Engine`

É a implementação que executa sem depender da engine C++. Contém o loop da partida, o ambiente com `Reset` e `Step`, a física da bola, regras de reinício e os planejadores responsáveis pelas decisões táticas.

### `Port`

Reúne traduções que precisam preservar até detalhes de ponto flutuante do código original. Um exemplo são os cálculos usados para avaliar impedimento e situações de chute no um contra um.

### `Oracle`

É a camada de compatibilidade entre C# e C++. Ela valida a versão da ABI, controla uma sessão nativa e transforma observações do legado no mesmo formato usado pela engine gerenciada.

### `Tests`

Os testes cobrem tanto regras isoladas quanto sequências completas: formação, posse, escolhas de passe, drible, finalização, stamina, impedimento, reinícios, cenários Academy e reprodução determinística de partidas.

## Validação do port

A validação acontece em três níveis:

- **Testes de comportamento:** verificam regras e decisões da implementação C# de forma isolada.
- **Paridade numérica:** compara cálculos C# diretamente com funções da biblioteca C++, inclusive em nível de bits para valores de ponto flutuante sensíveis.
- **Replay de partida:** as duas engines recebem o mesmo estado inicial e as mesmas ações. O comparador acompanha tick, placar, posse, estado da partida, bola e jogadores e informa o primeiro frame divergente.

Snapshots da engine nativa permitem repetir exatamente um estado, enquanto seeds e ordem de processamento configuráveis ajudam a investigar problemas de determinismo.

## Estado atual

O projeto continua em desenvolvimento. A engine gerenciada já executa partidas e cenários Academy com IA tática própria, e o oráculo nativo fornece a infraestrutura para validar cada etapa do port. O trabalho atual é ampliar a equivalência entre os subsistemas e evoluir a apresentação da partida na Unity.
