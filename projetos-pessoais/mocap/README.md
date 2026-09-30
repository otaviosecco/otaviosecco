---
layout: project
title: Visualização de dados de captura de movimento 3D com Unity
description: Retargeting, cinemática inversa e identificação de passos em dados de captura de movimento.
order: 1
permalink: /projetos-pessoais/mocap/
---

# Análise de movimento no futebol com mocap

## Visão geral

Projeto pessoal para aplicar dados de captura de movimento à animação e à análise de atletas em um ambiente 3D.

Basicamente cobre uma lacuna da minha dissertação de mestrado, na qual eu não fiz essa animação 3D, apenas renderizei os pontos das articulações e liguei com uma linha, fazendo bonecos palitos. Isso ficou na minha cabeça, como resolver?

## Ideia inicial

Conseguir, a partir de um dataset de uma jogada de baseball, automatizar a detecção de eventos que hoje, são feitas de forma manual por analistas.

Eventos como: max leg lift, pitch, batter foot positioning, strike speed, time to set outside batter box.

## Identificação de passos por velocidade angular

Como que tu detecta um passo num dataset que tem apenas as posições do corpo do boneco? 
Tem que ser feito algum cálculo! Como um smartwatch estima a quantidade de passos que você dá no dia? A resposta é *velocidade angular!*

A velocidade angular dos dados de mocap é utilizada para detectar eventos de passada e associá-los à trajetória do atleta.

- Cálculo da velocidade angular a partir dos dados de mocap.
- Identificação dos instantes relacionados a cada passo.
- Marcação dos eventos ao longo da trajetória do atleta.
- Visualização dos passos detectados no ambiente 3D.
- Futuramente pode-se usar isso como notação automática para treino de RN?!


## Retargeting e IK para personagens 3D

O retargeting transfere o movimento capturado para personagens com diferentes proporções e estruturas de esqueleto. É utilizado o template humanoid no modelo da Unity para que seja possível adaptar as medidas do corpo padrão às medidas do mocap.

- Leitura dos dados de captura de movimento.
- Mapeamento entre o esqueleto capturado e o personagem 3D.
- Aplicação de IK para corrigir a posição dos membros. * em testes, aparentemente essa aplicação é mais útil para quando faltam articulações ou posições
- Avaliação visual do movimento transferido.
