/** Catálogo de juegos FisioActiv. */
export interface GameCatalogItem {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  accent: string;
  accentSoft: string;
  tag: string;
}

export const GAMES_CATALOG: GameCatalogItem[] = [
  {
    id: 'balloons',
    title: 'Globos',
    subtitle: 'Alcanza y revienta globos con tus manos en tiempo real.',
    route: '/game',
    accent: '#0d6b63',
    accentSoft: '#12877d',
    tag: 'Alcance',
  },
  {
    id: 'dodge',
    title: 'Esquiva Zonas',
    subtitle: 'Esquiva figuras grandes: agáchate, salta y muévete fuera de la zona.',
    route: '/dodge',
    accent: '#c45c26',
    accentSoft: '#e07a3d',
    tag: 'Movimiento',
  },
];
