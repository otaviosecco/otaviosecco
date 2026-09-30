---
layout: project
title: Análise de movimento no futebol com mocap
description: Retargeting, cinemática inversa e identificação de passos em dados de captura de movimento.
order: 1
permalink: /projetos-pessoais/mocap-futebol/
---

# Análise de movimento no futebol com mocap

## Visão geral

Projeto pessoal para aplicar dados de captura de movimento à animação e à análise de atletas em um ambiente 3D.

## Retargeting e IK para personagens 3D

O retargeting transfere o movimento capturado para personagens com diferentes proporções e estruturas de esqueleto. A cinemática inversa (IK) complementa esse processo, ajustando os membros e preservando o contato corporal esperado.

- Leitura dos dados de captura de movimento.
- Mapeamento entre o esqueleto capturado e o personagem 3D.
- Aplicação de IK para corrigir a posição dos membros.
- Avaliação visual do movimento transferido.

## Identificação de passos por velocidade angular

A velocidade angular dos dados de mocap é utilizada para detectar eventos de passada e associá-los à trajetória do atleta.

- Cálculo da velocidade angular a partir dos dados de mocap.
- Identificação dos instantes relacionados a cada passo.
- Marcação dos eventos ao longo da trajetória do atleta.
- Visualização dos passos detectados no ambiente 3D.
