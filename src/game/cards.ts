import { CardDefinition, DeckDefinition } from './types';

export const CARDS: Record<string, CardDefinition> = {
  arcane_apprentice: {
    id: 'arcane_apprentice', name: 'Apprendista Arcano', type: 'unit', cost: 2,
    life: 4, movement: 2, range: 3, attack: 2
  },
  battle_mage: {
    id: 'battle_mage', name: 'Mago da Battaglia', type: 'unit', cost: 3,
    life: 5, movement: 2, range: 3, attack: 3,
    text: 'Se non si muove, ottiene +1 Range per questo turno.'
  },
  frost_weaver: {
    id: 'frost_weaver', name: 'Tessitore del Gelo', type: 'unit', cost: 3,
    life: 4, movement: 2, range: 3, attack: 2,
    text: 'Quando colpisce un\'unità, quella unità perde 1 Movimento nel suo prossimo turno.'
  },
  arcane_elemental: {
    id: 'arcane_elemental', name: 'Elementale Arcano', type: 'unit', cost: 4,
    life: 8, movement: 2, range: 2, attack: 3,
    text: 'Ignora i costi aggiuntivi dei terreni rallentanti.'
  },
  archmage: {
    id: 'archmage', name: 'Arcimago', type: 'unit', cost: 6,
    life: 7, movement: 2, range: 4, attack: 4,
    text: 'La prima Magia giocata durante il tuo turno costa 1 Mana in meno.'
  },
  arcane_tower: {
    id: 'arcane_tower', name: 'Torre Arcana', type: 'structure', cost: 4,
    life: 9, range: 4, attack: 2, placement: 'Entro 4 caselle da un proprio Nexus.'
  },
  mana_crystal: {
    id: 'mana_crystal', name: 'Cristallo del Mana', type: 'structure', cost: 3,
    life: 6, range: 0, attack: 0, placement: 'Nelle prime 3 righe del proprio lato.',
    text: 'Ogni 3 propri turni genera +1 Mana.'
  },
  fireball: {
    id: 'fireball', name: 'Palla di Fuoco', type: 'spell', cost: 3,
    effect: 'damage', value: 4, text: 'Infligge 4 danni a un bersaglio valido.'
  },
  ice_chains: {
    id: 'ice_chains', name: 'Catene di Ghiaccio', type: 'spell', cost: 2,
    effect: 'slow', value: 2, text: 'Un\'unità nemica perde 2 Movimento nel prossimo turno.'
  },
  translocation: {
    id: 'translocation', name: 'Traslazione', type: 'spell', cost: 3,
    effect: 'teleport', value: 3, text: 'Sposta una tua unità fino a 3 caselle valide.'
  },

  squire: {
    id: 'squire', name: 'Scudiero', type: 'unit', cost: 2,
    life: 5, movement: 2, range: 1, attack: 2
  },
  paladin: {
    id: 'paladin', name: 'Paladino', type: 'unit', cost: 3,
    life: 7, movement: 2, range: 1, attack: 3, tags: ['paladin']
  },
  shield_guardian: {
    id: 'shield_guardian', name: 'Guardiano dello Scudo', type: 'unit', cost: 3,
    life: 9, movement: 1, range: 1, attack: 2,
    text: 'Gli alleati adiacenti subiscono 1 danno in meno dagli attacchi a distanza.'
  },
  nexus_knight: {
    id: 'nexus_knight', name: 'Cavaliere del Nexus', type: 'unit', cost: 4,
    life: 8, movement: 3, range: 1, attack: 4, tags: ['paladin'],
    text: 'Se si muove almeno 2 caselle prima di attaccare, ottiene +1 Attacco.'
  },
  order_crossbow: {
    id: 'order_crossbow', name: 'Balestriere dell\'Ordine', type: 'unit', cost: 3,
    life: 5, movement: 2, range: 4, attack: 2
  },
  bastion_champion: {
    id: 'bastion_champion', name: 'Campione del Bastione', type: 'unit', cost: 6,
    life: 12, movement: 2, range: 1, attack: 5, tags: ['paladin'],
    text: 'Dopo aver eliminato un\'unità recupera 2 Vita.'
  },
  watch_tower: {
    id: 'watch_tower', name: 'Torre di Guardia', type: 'structure', cost: 4,
    life: 10, range: 4, attack: 3, placement: 'Entro 3 caselle da un proprio Nexus.'
  },
  nexus_chapel: {
    id: 'nexus_chapel', name: 'Cappella del Nexus', type: 'structure', cost: 4,
    life: 8, range: 0, attack: 0, placement: 'Entro 3 caselle da un proprio Nexus.',
    text: 'A fine turno cura 1 Vita a un alleato adiacente.'
  },
  holy_punishment: {
    id: 'holy_punishment', name: 'Punizione Sacra', type: 'spell', cost: 2,
    effect: 'conditional-damage', value: 2,
    text: 'Infligge 2 danni, oppure 4 se il bersaglio è adiacente a un tuo Paladino.'
  },
  rally: {
    id: 'rally', name: 'Adunata', type: 'spell', cost: 3,
    effect: 'buff-move', value: 1,
    text: 'Fino a 3 unità alleate ottengono +1 Movimento questo turno.'
  }
};

const twice = (ids: string[]) => ids.flatMap((id) => [id, id]);

export const STARTER_DECKS: DeckDefinition[] = [
  {
    id: 'arcane',
    name: 'Arcanisti del Nexus',
    description: 'Magie, controllo della distanza e pressione a lungo raggio.',
    cardIds: twice([
      'arcane_apprentice', 'battle_mage', 'frost_weaver', 'arcane_elemental',
      'archmage', 'arcane_tower', 'mana_crystal', 'fireball', 'ice_chains', 'translocation'
    ])
  },
  {
    id: 'bastion',
    name: 'Ordine del Bastione',
    description: 'Paladini resistenti, pressione melee e supporto ranged.',
    cardIds: twice([
      'squire', 'paladin', 'shield_guardian', 'nexus_knight',
      'order_crossbow', 'bastion_champion', 'watch_tower', 'nexus_chapel',
      'holy_punishment', 'rally'
    ])
  }
];

export function validateDeck(deck: DeckDefinition): string[] {
  const errors: string[] = [];
  if (deck.cardIds.length !== 20) errors.push('Il mazzo deve contenere esattamente 20 carte.');

  const counts = new Map<string, number>();
  for (const cardId of deck.cardIds) {
    if (!CARDS[cardId]) errors.push('Carta sconosciuta: ' + cardId);
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
  }

  for (const [cardId, count] of counts) {
    if (count > 2) errors.push(cardId + ' supera il limite di 2 copie.');
  }

  return errors;
}
