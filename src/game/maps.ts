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
    'Arena larga 12x7: fiume centrale, due ponti, rovine compatte e corsie laterali. Terreno e sfondo sono allineati alla battle map approvata.',
  terrain: [
    [P, P, P, P, P, W, W, P, P, P, P, P],
    [P, H, M, P, P, P, P, P, P, M, H, P],
    [P, M, H, M, P, W, W, P, M, H, M, P],
    [P, P, M, P, P, W, W, P, P, M, P, P],
    [P, M, H, M, P, W, W, P, M, H, M, P],
    [P, H, M, P, P, P, P, P, P, M, H, P],
    [P, P, P, P, P, W, W, P, P, P, P, P]
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
    'Arena verticale 7x12: fiume trasversale, ponte centrale, rovine simmetriche e poche posizioni elevate leggibili. Terreno e sfondo sono allineati.',
  terrain: [
    [P, P, P, P, P, P, P],
    [P, P, P, P, P, P, P],
    [P, P, P, M, P, P, P],
    [P, H, P, P, P, H, P],
    [P, M, P, P, P, M, P],
    [W, W, W, P, W, W, W],
    [W, W, W, P, W, W, W],
    [P, M, P, P, P, M, P],
    [P, H, P, P, P, H, P],
    [P, P, P, M, P, P, P],
    [P, P, P, P, P, P, P],
    [P, P, P, P, P, P, P]
  ]
};

export const MAPS: MapDefinition[] = [HORIZONTAL_VALLEY, VERTICAL_PASS];
