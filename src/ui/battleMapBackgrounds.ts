import { ImageSourcePropType } from 'react-native';
import { GameMode } from '../game/types';
import { HORIZONTAL_MAP_DATA } from './mapHorizontalData';
import { VERTICAL_MAP_DATA } from './mapVerticalData';

export const APPROVED_HORIZONTAL_BATTLEMAP: ImageSourcePropType = {
  uri: HORIZONTAL_MAP_DATA
};

export const APPROVED_VERTICAL_BATTLEMAP: ImageSourcePropType = {
  uri: VERTICAL_MAP_DATA
};

export function mapBackground(mode: GameMode): ImageSourcePropType {
  return mode === 'horizontal-dual-nexus'
    ? APPROVED_HORIZONTAL_BATTLEMAP
    : APPROVED_VERTICAL_BATTLEMAP;
}
