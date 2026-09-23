export type PlayerId = 0 | 1;

export type GameMode = 'horizontal-dual-nexus' | 'vertical-single-nexus';

export type TerrainType = 'plain' | 'water' | 'mountain' | 'hill';

export type CardType = 'unit' | 'structure' | 'spell';

export interface Position {
  x: number;
  y: number;
}

export interface BaseCard {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  text?: string;
}

export interface UnitCard extends BaseCard {
  type: 'unit';
  life: number;
  movement: number;
  range: number;
  attack: number;
  tags?: string[];
}

export interface StructureCard extends BaseCard {
  type: 'structure';
  life: number;
  range: number;
  attack: number;
  placement: string;
}

export interface SpellCard extends BaseCard {
  type: 'spell';
  effect: 'damage' | 'slow' | 'teleport' | 'buff-move' | 'conditional-damage';
  value: number;
}

export type CardDefinition = UnitCard | StructureCard | SpellCard;

export interface DeckDefinition {
  id: string;
  name: string;
  description: string;
  cardIds: string[];
}

export interface MapDefinition {
  id: string;
  name: string;
  mode: GameMode;
  width: number;
  height: number;
  terrain: TerrainType[][];
  deploymentRows: number;
  description: string;
}

export interface NexusState {
  owner: PlayerId;
  position: Position;
  life: number;
  maxLife: number;
}

export interface UnitState {
  instanceId: string;
  owner: PlayerId;
  cardId: string;
  position: Position;
  life: number;
  movedThisTurn: boolean;
  attackedThisTurn: boolean;
}

export interface StructureState {
  instanceId: string;
  owner: PlayerId;
  cardId: string;
  position: Position;
  life: number;
}

export interface PlayerState {
  mana: number;
  personalTurn: number;
  deckId: string;
}

export interface GameState {
  mode: GameMode;
  mapId: string;
  activePlayer: PlayerId;
  round: number;
  players: [PlayerState, PlayerState];
  nexuses: NexusState[];
  units: UnitState[];
  structures: StructureState[];
  winner: PlayerId | null;
}
