/** Shared, browser-safe catalog contract. Quantities use the ingredient's canonical unit. */
export type Unit = 'g' | 'ml' | 'each';
export type Category = 'vegetable' | 'meat_egg' | 'staple' | 'seasoning';
export type Supermarket = 'Tesco' | 'Sainsburys';

export interface Ingredient {
  id: string;
  nameZh: string;
  nameEn: string;
  aliases: string[];
  category: Category;
  unit: Unit;
  usage: string;
  substitutionNote?: string;
  /** Availability varies; this is guidance, never a live stock claim. */
  shoppingNote?: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  /** Optional preparation instruction; quantities remain in the canonical unit. */
  preparation?: string;
}

export interface Recipe {
  id: string;
  nameZh: string;
  description: string;
  servings: number;
  minutes: number;
  difficulty: 'easy' | 'medium';
  ingredients: RecipeIngredient[];
  steps: string[];
  source: 'built-in' | 'custom';
  /** Optional regional context; custom recipes do not need it. */
  region?: string;
  /** Cooking references for regional or viral dishes. Recipe text and quantities are original. */
  inspirationUrls?: string[];
  /** The first five recipes have complete tested product coverage. */
  demoReady: boolean;
}

export interface Substitution {
  id: string;
  ingredientId: string;
  replacementId: string;
  recipeIds: string[];
  context: string;
  /** Multiply the original amount by this ratio to obtain the replacement's canonical unit. */
  quantityRatio: number;
  /** Additional ingredients for a combined replacement, scaled from the original amount. */
  extraReplacements?: { ingredientId: string; quantityRatio: number }[];
  quantityAdvice: string;
  tasteDifference: string;
  /** Similar: close role and flavour; functional: same cooking role but clear flavour change; variant: changes the dish. */
  suitability?: 'similar' | 'functional' | 'variant';
  /** Editorial evidence for the pairing. Ratios and recipe-specific use are our own estimates. */
  sourceUrls?: string[];
  equivalent: boolean;
}

export interface Product {
  id: string;
  ingredientId: string;
  supermarket: Supermarket;
  nameEn: string;
  packLabel: string;
  packQuantity: number;
  packUnit: Unit;
  priceGbp: number;
  priceRecordedOn: string; // YYYY-MM-DD
  productUrl: string;
  /** All prices are dated demo references, not live prices or availability. */
  priceKind: 'reference';
}
