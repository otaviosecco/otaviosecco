---
layout: project
title: Dissertação de Mestrado — Ambiente de Realidade Virtual para Treinamento de Atletas de Futebol
description: Desenvolvimento e avaliação de um ambiente imersivo em realidade virtual para treinamento de atletas de futebol.
order: 2
permalink: /projetos-pessoais/dissertacao-mestrado/
---

# Desenvolvimento e Avaliação de um Ambiente de Realidade Virtual para Treinamento de Atletas de Futebol

## Sobre a dissertação

Essa postagem discute de forma mais informal a minha Dissertação desenvolvida no Mestrado em Ciência da Computação da Universidade Federal do Rio Grande do Sul (UFRGS), entre novembro de 2022 e dezembro de 2025.

O trabalho investiga o uso de um ambiente imersivo em realidade virtual no treinamento de atletas de futebol. A proposta utiliza dados de captura de movimento de uma partida para recriar situações esportivas em um ambiente desenvolvido com Unity3D.

## Objetivo

Desenvolver e avaliar uma ferramenta de treinamento capaz de apresentar situações de jogo em realidade virtual, apoiando o desenvolvimento da tomada de decisão e de habilidades motoras de atletas de futebol.

## Desenvolvimento

O protótipo foi construído por meio de um processo iterativo de desenvolvimento e validação. Seus principais elementos foram:

- Desenvolvimento do ambiente imersivo em Unity3D.
- Uso de dados de captura de movimento de uma partida de futebol.
- Representação das articulações dos atletas e de seus movimentos no ambiente virtual.
- Criação de situações voltadas ao treinamento de tomada de decisão e habilidades motoras.

## Avaliação

O ambiente foi validado com atletas profissionais. Essa etapa integrou o processo de construção do protótipo e permitiu avaliar sua aplicação no treinamento de futebol. Apesar da ferramenta ser bem recebida com um feedback verbal positivo dos usuários durante a execução dos testes, percebeu-se durante a análise de dados que os sintomas de cybersickness (enjoo virutal) tornariam a aplicação dessa feramenta no ambiente esportivo um tanto quanto imprática. Para que realmente seja aplicada, essa barreira precisa ser reduzida, isso pode ser feito com maior tempo de preparação, menor peso e melhor fixação do hardware na cabeça do usuário, novas estratégias para não utilizar movimentação contínua. 

## Publicação relacionada

Parte do processo iterativo de construção e validação do protótipo foi apresentada no SVR 2025 no trabalho *Towards an effective VR System for Training Soccer Athletes*.

## Continuidade

Durante a defesa, uma das questões apontadas pela banca foi, o por que eu optei por utilizar uma representação em boneco palito ao invés de usar algo como retargeting ou skinning. Minha resposta na hora foi que o tempo e a complexidade de implementação não comprensariam esforço levando em consideração também que a principal priorade estava sendo corrigir os bugs durante o fluxo de execução.
Isso ficou na minha cabeça, e com o passar do tempo e novos dados, o projeto pessoal [Cálculo de Estatísticas Avançadas de Baseball + Reskining Dados de Mocap](../mocap/) explora uma evolução da visualização dos dados de captura de movimento, com retargeting, cinemática inversa e até identificação de passos utilizando a velocidade angular dos keypoints.
