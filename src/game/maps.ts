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
  height: 8,
  deploymentRows: 2,
  description:
    'Arena larga con un canale centrale, due attraversamenti principali, coperture compatte e colline laterali. La griglia segue il disegno della battle map illustrata.',
  terrain: [
    [P, P, P, P, P, P, P, P, P, P, P, P],
    [P, H, P, P, P, W, W, P, P, P, H, P],
    [P, M, H, P, P, P, P, P, P, H, M, P],
    [P, P, M, P, P, W, W, P, P, M, P, P],
    [P, P, M, P, P, W, W, P, P, M, P, P],
    [P, M, H, P, P, P, P, P, P, H, M, P],
    [P, H, P, P, P, W, W, P, P, P, H, P],
    [P, P, P, P, P, P, P, P, P, P, P, P]
  ]
};

export const VERTICAL_PASS: MapDefinition = {
  id: 'vertical-pass',
  name: 'Passo del Nexus',
  mode: 'vertical-single-nexus',
  width: 8,
  height: 12,
  deploymentRows: 2,
  description:
    'Arena verticale con fiume trasversale, ponte centrale, blocchi di rovine compatti e posizioni elevate simmetriche. La griglia segue il disegno della battle map illustrata.',
  terrain: [
    [P, P, P, P, P, P, P, P],
    [P, H, P, P, P, P, H, P],
    [P, M, H, P, P, H, M, P],
    [P, M, M, P, P, M, M, P],
    [P, P, M, P, P, M, P, P],
    [W, W, W, P, P, W, W, W],
    [W, W, W, P, P, W, W, W],
    [P, P, M, P, P, M, P, P],
    [P, M, M, P, P, M, M, P],
    [P, M, H, P, P, H, M, P],
    [P, H, P, P, P, P, H, P],
    [P, P, P, P, P, P, P, P]
  ]
};

export const MAPS: MapDefinition[] = [HORIZONTAL_VALLEY, VERTICAL_PASS];
