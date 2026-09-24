import { MapDefinition, TerrainType } from './types';

const P: TerrainType = 'plain';
const W: TerrainType = 'water';
const M: TerrainType = 'mountain';
const H: TerrainType = 'hill';

export const HORIZONTAL_VALLEY: MapDefinition = {
  id: 'horizontal-valley',
  name: 'Valle dei Due Fronti',
  mode: 'horizontal-dual-nexus',
  width: 12,
  height: 7,
  deploymentRows: 2,
  description:
    'Arena 12x7 tracciata direttamente sulle caselle visibili della battle map: fiume centrale, due ponti e rovine coerenti con lo sfondo.',
  terrain: [
    [P, P, P, P, P, W, W, P, P, P, P, P],
    [P, H, M, P, P, P, P, P, P, M, H, P],
    [P, P, H, H, M, W, W, M, H, H, P, P],
    [P, P, P, P, M, W, W, M, P, P, P, P],
    [P, P, M, P, M, W, W, M, P, M, P, P],
    [P, H, M, P, P, P, P, P, P, M, H, P],
    [P, P, P, H, M, W, W, M, H, P, P, P]
  ]
};

export const VERTICAL_PASS: MapDefinition = {
  id: 'vertical-pass',
  name: 'Passo del Nexus',
  mode: 'vertical-single-nexus',
  width: 7,
  height: 12,
  deploymentRows: 2,
  description:
    'Arena verticale 7x12 tracciata sulle caselle visibili della battle map: fiume a due righe, ponte a due colonne e rovine nelle celle illustrate.',
  terrain: [
    [P, P, P, P, P, P, P],
    [P, H, P, M, M, P, H],
    [P, P, P, P, P, P, P],
    [P, H, M, P, P, M, H],
    [P, P, M, P, P, M, P],
    [W, W, W, P, P, W, W],
    [W, W, W, P, P, W, W],
    [P, P, M, P, P, M, P],
    [P, H, P, P, P, H, P],
    [P, P, P, M, M, P, P],
    [P, H, P, M, M, P, H],
    [P, P, P, P, P, P, P]
  ]
};

export const MAPS: MapDefinition[] = [HORIZONTAL_VALLEY, VERTICAL_PASS];
