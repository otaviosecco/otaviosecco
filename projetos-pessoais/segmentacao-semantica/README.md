---
layout: project
title: Segmentação semântica de imagens de satélite
description: Identificação de áreas de mata em imagens de satélite com visão computacional.
order: 5
permalink: /projetos-pessoais/segmentacao-semantica/
---

# Visão computacional: segmentação semântica de imagens de satélite

## Sobre o trabalho

Este trabalho, desenvolvido em paseria de Jerson Geraldo Neto UFRGS, investiga a identificação de áreas com e sem vegetação em imagens de satélite. A proposta combina os algoritmos *watershed* e *region growing* para atualizar informações de cobertura vegetal sem depender de um grande conjunto de imagens para treinamento.

**[Baixar o artigo completo (.doc)](artigo-segmentacao-semantica.doc)**

[Ver o código e os experimentos no GitHub](https://github.com/jgneto93/SatelliteSegmentationNet)

## Problema

Shapefiles armazenam informações georreferenciadas sobre vegetação, estradas, edificações e hidrografia. Esses dados podem ser usados na reconstrução de mapas digitais para simuladores e outras aplicações 3D, mas ficam desatualizados em relação às imagens de satélite mais recentes.

O objetivo da implementação é segmentar a cobertura vegetal presente nas imagens atuais e produzir informações que possam apoiar a atualização desses mapas.

## Processo de segmentação

O processamento combina técnicas clássicas de visão computacional:

1. Conversão da imagem e suavização para reduzir ruído.
2. Binarização pelo método de limiarização de Otsu.
3. Operações morfológicas e transformada de distância para separar fundo, primeiro plano e pixels desconhecidos.
4. Aplicação de *watershed* para criar marcadores e separar regiões conectadas.
5. Aplicação de *region growing* usando as sementes obtidas na etapa anterior.

Durante os testes, o critério do crescimento de regiões passou da média para a mediana dos pixels. O sistema de cores também foi alterado de RGB para CIELAB para reduzir a influência das diferenças de iluminação. O filtro gaussiano comum foi substituído por um filtro de preservação de bordas, que apresentou resultados visualmente melhores.

## Resultados

O aumento da janela do filtro gaussiano produziu mais regiões no *watershed*, mas também ampliou a segmentação para áreas sem vegetação. A mudança para CIELAB, o uso da mediana e o filtro de preservação de bordas melhoraram o resultado, embora regiões pequenas e variações intensas de iluminação continuassem problemáticas.

Na comparação com o shapefile da mesma região, a segmentação alcançou 32,5% de similaridade pelo índice de Jaccard. O artigo atribui esse valor às descontinuidades dentro das regiões segmentadas e às diferenças entre a vegetação visível na imagem de satélite e a informação desatualizada do shapefile.

O resultado foi considerado promissor para atualizar áreas de vegetação, mas ainda exige melhorias para lidar com regiões menores, diferenças de intensidade e falsos crescimentos provocados por *outliers*.

## Imagens do experimento

A galeria apresenta as imagens originais, as máscaras binarizadas, os resultados da segmentação e comparações entre configurações testadas no trabalho.
