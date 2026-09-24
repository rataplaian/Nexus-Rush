import { ImageSourcePropType } from 'react-native';
import { GameMode } from '../game/types';

export const APPROVED_HORIZONTAL_BATTLEMAP: ImageSourcePropType =
  require('../../assets/maps/nexus-rush-horizontal.png');

export const APPROVED_VERTICAL_BATTLEMAP: ImageSourcePropType =
  require('../../assets/maps/nexus-rush-vertical.png');

export function mapBackground(mode: GameMode): ImageSourcePropType {
  return mode === 'horizontal-dual-nexus'
    ? APPROVED_HORIZONTAL_BATTLEMAP
    : APPROVED_VERTICAL_BATTLEMAP;
}
