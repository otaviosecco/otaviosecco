---
layout: project
title: Port da engine GFootball para Unity
description: Migração da engine legada em C++ para uma simulação de futebol em C# integrada à Unity.
order: 2
permalink: /projetos-pessoais/gfootball-unity/
---

# Port da engine GFootball para Unity

## Visão geral

Projeto em desenvolvimento para portar a engine legada do GFootball, escrita em C++, para uma implementação em C# integrada à Unity.

## Objetivo

Modernizar a base da simulação sem perder o comportamento tático e as regras já implementadas na engine original.

## Arquitetura

- Simulação gerenciada em C# com estado da partida, duas equipes, bola e execução por etapas.
- Sistemas de formação, posse, passes, finalizações, defesa, goleiro, resistência e bolas paradas.
- Cenários de treino da Academy e execução de partidas entre duas IAs na Unity.
- Ponte nativa com ABI C estável para consultar a engine C++ original como referência.

## Validação do port

O comportamento da versão em C# é comparado ao da implementação legada por meio de testes de paridade. A validação inclui restauração de estados, configurações determinísticas, comparação de decisões táticas e verificações numéricas em nível de bits para cálculos sensíveis.
