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
  description: 'Una valle simmetrica con lago centrale, dorsali laterali e colline che dominano gli accessi.',
  terrain: [
    [P,P,P,P,P,P,P,P,P,P,P,P],
    [P,P,H,P,P,P,P,P,P,H,P,P],
    [P,M,H,P,P,P,P,P,P,H,M,P],
    [P,M,P,P,H,W,W,H,P,P,M,P],
    [P,M,P,P,H,W,W,H,P,P,M,P],
    [P,M,H,P,P,P,P,P,P,H,M,P],
    [P,P,H,P,P,P,P,P,P,H,P,P],
    [P,P,P,P,P,P,P,P,P,P,P,P]
  ]
};

export const VERTICAL_PASS: MapDefinition = {
  id: 'vertical-pass',
  name: 'Passo del Nexus',
  mode: 'vertical-single-nexus',
  width: 8,
  height: 12,
  deploymentRows: 2,
  description: 'Un passo montano lungo e stretto: due dorsali incanalano l’avanzata intorno a un bacino centrale.',
  terrain: [
    [P,P,P,P,P,P,P,P],
    [P,H,P,P,P,P,H,P],
    [P,H,M,P,P,M,H,P],
    [P,P,M,P,P,M,P,P],
    [P,P,M,H,H,M,P,P],
    [P,P,P,W,W,P,P,P],
    [P,P,P,W,W,P,P,P],
    [P,P,M,H,H,M,P,P],
    [P,P,M,P,P,M,P,P],
    [P,H,M,P,P,M,H,P],
    [P,H,P,P,P,P,H,P],
    [P,P,P,P,P,P,P,P]
  ]
};

export const MAPS = [HORIZONTAL_VALLEY, VERTICAL_PASS];
