import { MapDefinition, TerrainType } from './types';

const P: TerrainType = 'plain';
const W: TerrainType = 'water';
const M: TerrainType = 'mountain';

export const HORIZONTAL_VALLEY: MapDefinition = {
  id: 'horizontal-valley',
  name: 'Valle dei Due Fronti',
  mode: 'horizontal-dual-nexus',
  width: 11,
  height: 5,
  deploymentRows: 2,
  description:
    'Arena 11x5 basata sulla mappa orizzontale fornita: canale centrale, due ponti e montagne esattamente nelle celle illustrate.',
  terrain: [
    [P, P, M, P, P, P, P, P, M, P, P],
    [P, P, P, P, M, W, M, P, P, P, P],
    [P, P, P, M, P, W, P, M, P, P, P],
    [P, P, P, P, M, W, M, P, P, P, P],
    [P, P, M, P, P, P, P, P, M, P, P]
  ]
};

export const VERTICAL_PASS: MapDefinition = {
  id: 'vertical-pass',
  name: 'Passo del Nexus',
  mode: 'vertical-single-nexus',
  width: 5,
  height: 9,
  deploymentRows: 2,
  description:
    'Arena verticale 5x9 basata sulla mappa fornita: quattro righe per lato, una fascia di fiume centrale e tre ponti.',
  terrain: [
    [P, P, P, P, P],
    [P, P, P, P, P],
    [P, P, P, P, P],
    [P, M, P, M, P],
    [P, W, P, W, P],
    [P, M, P, M, P],
    [P, P, P, P, P],
    [P, P, P, P, P],
    [P, P, P, P, P]
  ]
};

export const MAPS: MapDefinition[] = [HORIZONTAL_VALLEY, VERTICAL_PASS];
