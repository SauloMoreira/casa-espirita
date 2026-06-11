// ============================================================================
// Utilitários puros de responsividade — fonte única dos breakpoints validados
// na frente de operação móvel. Usados pelos testes responsivos dedicados para
// garantir comportamento consistente em celular, tablet, notebook e desktop.
// NÃO contém regra de negócio: apenas classificação de viewport e layout.
// ============================================================================

export type DeviceClass = "mobile" | "tablet" | "notebook" | "desktop";

/** Breakpoints Tailwind usados no projeto (em px). */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

/** Cenários obrigatórios de validação responsiva (largura x altura). */
export const VIEWPORTS: Record<DeviceClass, { w: number; h: number; label: string }[]> = {
  mobile: [
    { w: 375, h: 812, label: "iPhone X/11/12 mini" },
    { w: 390, h: 844, label: "iPhone 12/13/14" },
  ],
  tablet: [{ w: 768, h: 1024, label: "iPad retrato" }],
  notebook: [
    { w: 1280, h: 720, label: "Notebook HD" },
    { w: 1366, h: 768, label: "Notebook WXGA" },
    { w: 1440, h: 900, label: "Notebook WXGA+" },
  ],
  desktop: [
    { w: 1536, h: 864, label: "Desktop HD+" },
    { w: 1920, h: 1080, label: "Full HD" },
  ],
};

/** Lista achatada de todos os viewports obrigatórios. */
export function todosViewports() {
  return (Object.keys(VIEWPORTS) as DeviceClass[]).flatMap((cls) =>
    VIEWPORTS[cls].map((v) => ({ ...v, cls })),
  );
}

/** Classifica uma largura de viewport na classe de dispositivo correspondente. */
export function classificarDispositivo(width: number): DeviceClass {
  if (width < BREAKPOINTS.md) return "mobile";
  if (width < BREAKPOINTS.lg) return "tablet";
  if (width < BREAKPOINTS["2xl"]) return "notebook";
  return "desktop";
}

/** True quando a navegação inferior (bottom nav) do assistido deve aparecer. */
export function usaBottomNav(width: number): boolean {
  // Bottom nav é exibido apenas abaixo de `md` (mobile), igual ao AppLayout.
  return width < BREAKPOINTS.md;
}

/**
 * Número de colunas esperado para uma grade que segue o padrão
 * `grid lg:grid-cols-2` (assistido painel/agenda/avisos).
 */
export function colunasGridLg(width: number): 1 | 2 {
  return width >= BREAKPOINTS.lg ? 2 : 1;
}

/**
 * Número de colunas esperado para os cards de tratamentos
 * (`grid xl:grid-cols-2`): só vira 2 colunas a partir de `xl`.
 */
export function colunasGridXl(width: number): 1 | 2 {
  return width >= BREAKPOINTS.xl ? 2 : 1;
}

/**
 * Colunas dos cards-resumo do painel (`grid-cols-2 lg:grid-cols-4`).
 */
export function colunasStatCards(width: number): 2 | 4 {
  return width >= BREAKPOINTS.lg ? 4 : 2;
}

/**
 * Garante que um contêiner com `max-w-screen-xl` (1280px) não estique demais:
 * retorna a largura efetiva do conteúdo dado o viewport.
 */
export function larguraConteudo(width: number, maxW = BREAKPOINTS.xl): number {
  return Math.min(width, maxW);
}

/** Há risco de overflow horizontal se o conteúdo mínimo exceder a viewport. */
export function temOverflowHorizontal(larguraMinimaConteudo: number, width: number): boolean {
  return larguraMinimaConteudo > width;
}
