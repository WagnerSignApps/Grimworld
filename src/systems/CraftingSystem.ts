import Phaser from 'phaser';
import { ResourceManager } from './ResourceManager';
import { ResearchSystem } from './ResearchSystem';

export interface Recipe {
  id: string;
  name: string;
  description: string;
  category: 'defense' | 'utility' | 'production' | 'comfort' | 'conspiracy';
  requirements: { [resourceType: string]: number };
  buildTime: number; // in seconds
  skillRequired?: string;
  minSkillLevel?: number;
  unlocked: boolean; // Starts as false for tech-gated recipes
  produces?: { [resourceType: string]: number }; // For production buildings
  effects?: BuildingEffect[];
}

export interface BuildingEffect {
  type: 'mood_boost' | 'defense_bonus' | 'resource_generation' | 'conspiracy_reduction' | 'skill_training';
  value: number;
  radius?: number;
  description: string;
}

export interface Building {
  id: string;
  recipeId: string;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Sprite;
  status: 'blueprint' | 'under_construction' | 'completed' | 'damaged' | 'destroyed';
  // For legacy visuals; still used to lerp alpha/progress bars
  constructionProgress: number;
  assignedWorker?: string;
  health: number;
  maxHealth: number;
  lastProduced: number;
  productionRate: number; // items per minute
  // New construction flow
  requiredRemaining: { [resourceType: string]: number }; // resources still needed on-site
  workRemainingSeconds: number; // seconds of labor remaining after resources delivered
}

export class CraftingSystem {
  private scene: Phaser.Scene;
  private resourceManager: ResourceManager;
  private researchSystem: ResearchSystem;
  private recipes: Map<string, Recipe> = new Map();
  private buildings: Map<string, Building> = new Map();
  private selectedRecipe?: Recipe;
  private buildMode: boolean = false;

  constructor(scene: Phaser.Scene, resourceManager: ResourceManager, researchSystem: ResearchSystem) {
    this.scene = scene;
    this.resourceManager = resourceManager;
    this.researchSystem = researchSystem;
    this.initializeRecipes();
    this.listenForResearchUnlocks();
  }

  private initializeRecipes() {
    const recipes: Recipe[] = [
      // Defense Structures
      {
        id: 'chain_link_fence',
        name: 'Chain Link Fence',
        description: 'Basic perimeter defense. Keeps out casual intruders.',
        category: 'defense',
        requirements: { scrap: 10, plastic: 5 },
        buildTime: 30,
        skillRequired: 'repair',
        minSkillLevel: 2,
        unlocked: false,
        effects: [
          { type: 'defense_bonus', value: 2, radius: 1, description: 'Provides light cover' }
        ]
      },
      {
        id: 'pool_moat',
        name: 'Above-Ground Pool Moat',
        description: 'Suburban water defense. Surprisingly effective.',
        category: 'defense',
        requirements: { plastic: 25, concrete: 15, fuel: 5 },
        buildTime: 120,
        skillRequired: 'repair',
        minSkillLevel: 5,
        unlocked: false,
        effects: [
          { type: 'defense_bonus', value: 8, radius: 2, description: 'Strong defensive barrier' }
        ]
      },
      {
        id: 'security_camera',
        name: 'Security Camera',
        description: 'Monitors for faction activity. May attract government attention.',
        category: 'defense',
        requirements: { electronics: 15, scrap: 8, plastic: 3 },
        buildTime: 45,
        skillRequired: 'tinkering',
        minSkillLevel: 4,
        unlocked: false,
        effects: [
          { type: 'defense_bonus', value: 3, radius: 5, description: 'Early warning system' }
        ]
      },

      // Utility Structures
      {
        id: 'fryer_generator',
        name: 'Fryer-Powered Generator',
        description: 'Converts grease into electricity. Smells terrible.',
        category: 'utility',
        requirements: { scrap: 20, electronics: 10, sauce: 15 },
        buildTime: 90,
        skillRequired: 'tinkering',
        minSkillLevel: 6,
        unlocked: false,
        effects: [
          { type: 'resource_generation', value: 1, description: 'Generates power' }
        ]
      },
      {
        id: 'signal_jammer',
        name: 'Signal Jammer',
        description: 'Blocks government surveillance. Reduces conspiracy heat.',
        category: 'conspiracy',
        requirements: { electronics: 25, scrap: 15, fuel: 10 },
        buildTime: 75,
        skillRequired: 'tinkering',
        minSkillLevel: 7,
        unlocked: true, // Example of a default unlocked recipe
        effects: [
          { type: 'conspiracy_reduction', value: 5, radius: 10, description: 'Blocks surveillance' }
        ]
      },
      {
        id: 'water_purifier',
        name: 'Water Purifier',
        description: 'Converts drainage water into something drinkable.',
        category: 'utility',
        requirements: { scrap: 15, plastic: 10, electronics: 8 },
        buildTime: 60,
        skillRequired: 'repair',
        minSkillLevel: 4,
        unlocked: true,
        effects: [
          { type: 'mood_boost', value: 3, radius: 8, description: 'Clean water improves health' }
        ]
      },

      // Production Buildings
      {
        id: 'nugget_farm',
        name: 'Nugget Farm',
        description: 'Mysterious protein cultivation. Don\'t ask questions.',
        category: 'production',
        requirements: { plastic: 20, sauce: 30, electronics: 12 },
        buildTime: 150,
        skillRequired: 'cooking',
        minSkillLevel: 6,
        unlocked: false,
        produces: { nuggets: 10 },
        effects: [
          { type: 'resource_generation', value: 10, description: 'Produces nuggets over time' }
        ]
      },
      {
        id: 'scrap_processor',
        name: 'Scrap Processor',
        description: 'Breaks down junk into useful materials.',
        category: 'production',
        requirements: { scrap: 30, electronics: 15, concrete: 10 },
        buildTime: 100,
        skillRequired: 'tinkering',
        minSkillLevel: 5,
        unlocked: true,
        produces: { plastic: 5, electronics: 2 },
        effects: [
          { type: 'resource_generation', value: 7, description: 'Processes scrap into materials' }
        ]
      },

      // Comfort Buildings
      {
        id: 'makeshift_bed',
        name: 'Makeshift Bed',
        description: 'Comfortable sleeping arrangement. Improves rest quality.',
        category: 'comfort',
        requirements: { fabric: 15, plastic: 8, scrap: 5 },
        buildTime: 45,
        skillRequired: 'repair',
        minSkillLevel: 2,
        unlocked: true,
        effects: [
          { type: 'mood_boost', value: 5, radius: 3, description: 'Better sleep quality' }
        ]
      },
      {
        id: 'panic_room',
        name: 'Panic Room',
        description: 'Reinforced safe space for when things go wrong.',
        category: 'defense',
        requirements: { concrete: 40, scrap: 25, electronics: 10 },
        buildTime: 200,
        skillRequired: 'repair',
        minSkillLevel: 8,
        unlocked: true,
        effects: [
          { type: 'mood_boost', value: 8, radius: 5, description: 'Sense of security' },
          { type: 'defense_bonus', value: 15, radius: 1, description: 'Ultimate protection' }
        ]
      },

      // Conspiracy Buildings
      {
        id: 'conspiracy_board',
        name: 'Conspiracy Board',
        description: 'Red string connects the dots. Helps survivors understand the truth.',
        category: 'conspiracy',
        requirements: { fabric: 10, plastic: 5, electronics: 3 },
        buildTime: 30,
        skillRequired: 'bureaucracy',
        minSkillLevel: 3,
        unlocked: true,
        effects: [
          { type: 'skill_training', value: 2, description: 'Improves bureaucracy skill' },
          { type: 'conspiracy_reduction', value: 2, radius: 5, description: 'Understanding reduces fear' }
        ]
      }
    ];

    recipes.forEach(recipe => {
      this.recipes.set(recipe.id, recipe);
    });
  }

  private listenForResearchUnlocks() {
    this.researchSystem.events.on('researchCompleted', (project: any) => {
      project.unlocks.forEach((unlock: { type: string, id: string }) => {
        if (unlock.type === 'recipe') {
          this.unlockRecipe(unlock.id);
        }
      });
    });
  }

  public unlockRecipe(recipeId: string) {
    const recipe = this.recipes.get(recipeId);
    if (recipe) {
      recipe.unlocked = true;
      console.log(`Recipe unlocked: ${recipe.name}`);
      // Announce this to the UI
      this.scene.events.emit('recipeUnlocked', recipe);
    }
  }

  getAvailableRecipes(): Recipe[] {
    return Array.from(this.recipes.values()).filter(recipe => recipe.unlocked);
  }

  canCraftRecipe(recipeId: string): boolean {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return false;

    // Check resource requirements
    for (const [resourceType, amount] of Object.entries(recipe.requirements)) {
      if (!this.resourceManager.hasResource(resourceType, amount)) {
        return false;
      }
    }

    return true;
  }

  startBuilding(recipeId: string, x: number, y: number, workerId?: string): Building | null {
    const recipe = this.recipes.get(recipeId);
    if (!recipe || !this.canCraftRecipe(recipeId)) return null;

    // Do NOT consume resources up-front anymore. Survivors will haul them.
    const building = this.createBuilding(recipe, x, y, workerId);
    this.buildings.set(building.id, building);

    // Announce the placement for the UI
    this.scene.events.emit('buildingPlaced', building, recipe);

    // Auto-assign nearest idle survivor if none provided
    if (!workerId) {
      const sm = (this.scene as any).getSurvivorManager?.();
      if (sm && typeof sm.findNearestIdleSurvivor === 'function') {
        const nearestId = sm.findNearestIdleSurvivor(x, y);
        if (nearestId) {
          building.assignedWorker = nearestId;
        }
      }
    }

    return building;
  }

  private createBuilding(recipe: Recipe, x: number, y: number, workerId?: string): Building {
    // Create sprite based on building type
    const sprite = this.scene.add.sprite(x, y, 'tile_concrete');
    sprite.setScale(1.2);
    sprite.setDepth(1.4); // above tiles/resources, below units
    
    // Color code by category
    const categoryColors: { [key: string]: number } = {
      defense: 0x8B0000,
      utility: 0x4682B4,
      production: 0x228B22,
      comfort: 0x9370DB,
      conspiracy: 0xFF4500
    };

    sprite.setTint(categoryColors[recipe.category] || 0xFFFFFF);
    sprite.setAlpha(0.5); // Blueprint appearance

    const requiredRemaining: { [key: string]: number } = { ...recipe.requirements };
    const workRemainingSeconds = Math.max(1, recipe.buildTime);

    const building: Building = {
      id: Phaser.Utils.String.UUID(),
      recipeId: recipe.id,
      x,
      y,
      sprite,
      status: 'blueprint',
      constructionProgress: 0,
      assignedWorker: workerId,
      health: 100,
      maxHealth: 100,
      lastProduced: Date.now(),
      productionRate: recipe.produces ? Object.values(recipe.produces)[0] || 0 : 0,
      requiredRemaining,
      workRemainingSeconds
    };

    // Make interactive
    sprite.setInteractive({ useHandCursor: true });
    sprite.setData('type', 'building');
    sprite.setData('id', building.id);
    sprite.on('pointerdown', () => this.selectBuilding(building.id));

    return building;
  }

  private selectBuilding(buildingId: string) {
    const building = this.buildings.get(buildingId);
    if (building) {
      console.log(`Selected building: ${building.recipeId} (${building.status})`);
      // TODO: Show building info in UI
    }
  }

  update() {
    const dt = this.scene.game.loop.delta / 1000; // seconds
    this.buildings.forEach(building => {
      this.updateBuilding(building, dt);
    });
  }

  private updateBuilding(building: Building, dt: number) {
    const recipe = this.recipes.get(building.recipeId);
    if (!recipe) return;

    switch (building.status) {
      case 'blueprint': {
        // Only transition to under_construction if all reqs delivered and a worker is assigned
        const needs = this.needsResources(building.id);
        if (!needs && building.assignedWorker) {
          building.status = 'under_construction';
          building.sprite.setAlpha(0.7);
        }
        break;
      }

      case 'under_construction': {
        // Work progresses only after resources delivered
        if (!this.needsResources(building.id)) {
          const workRate = 1; // seconds per second at base rate; later scale by worker skill
          building.workRemainingSeconds = Math.max(0, building.workRemainingSeconds - workRate * dt);
          building.constructionProgress = 1 - (building.workRemainingSeconds / Math.max(1, recipe.buildTime));

          if (building.workRemainingSeconds <= 0) {
            building.status = 'completed';
            building.sprite.setAlpha(1);
            building.constructionProgress = 1;
            // Apply building effects
            this.applyBuildingEffects(building, recipe);
            // Announce completion
            this.scene.events.emit('buildingCompleted', building, recipe);
          }
        }
        break;
      }

      case 'completed': {
        // Handle production buildings
        if (recipe.produces && building.productionRate > 0) {
          const timeSinceLastProduction = Date.now() - building.lastProduced;
          const productionInterval = 60000 / building.productionRate; // ms per item

          if (timeSinceLastProduction >= productionInterval) {
            this.produceBuildingOutput(building, recipe);
            building.lastProduced = Date.now();
          }
        }
        break;
      }
    }
  }

  private applyBuildingEffects(building: Building, recipe: Recipe) {
    if (!recipe.effects) return;

    // Apply effects to nearby survivors or global state
    recipe.effects.forEach(effect => {
      switch (effect.type) {
        case 'conspiracy_reduction':
          // Reduce conspiracy heat in area
          const eventManager = (this.scene as any).getEventManager?.();
          if (eventManager) {
            eventManager.setConspiracyHeat(
              Math.max(0, eventManager.getConspiracyHeat() - effect.value)
            );
          }
          break;
        
        case 'resource_generation':
          // Handled in production logic
          break;

        // Other effects would be implemented here
      }
    });
  }

  private produceBuildingOutput(building: Building, recipe: Recipe) {
    if (!recipe.produces) return;

    for (const [resourceType, amount] of Object.entries(recipe.produces)) {
      this.resourceManager.addResource(resourceType, amount);
    }

    // Visual feedback
    this.createProductionEffect(building.x, building.y);
  }

  private createProductionEffect(x: number, y: number) {
    // Simple particle effect for production
    const effect = this.scene.add.sprite(x, y - 20, 'tile_concrete');
    effect.setScale(0.3);
    effect.setTint(0x00FF00);
    effect.setAlpha(0.8);

    this.scene.tweens.add({
      targets: effect,
      y: y - 40,
      alpha: 0,
      duration: 1000,
      onComplete: () => effect.destroy()
    });
  }

  // Public methods
  getRecipes(): Map<string, Recipe> {
    return this.recipes;
  }

  // Does this building still need resources delivered?
  needsResources(buildingId: string): boolean {
    const b = this.buildings.get(buildingId);
    if (!b) return false;
    return Object.values(b.requiredRemaining).some(v => v > 0);
  }

  getNeededResourceTypes(buildingId: string): string[] {
    const b = this.buildings.get(buildingId);
    if (!b) return [];
    return Object.entries(b.requiredRemaining)
      .filter(([_, v]) => v > 0)
      .map(([k]) => k);
  }

  // Contribute delivered resources to site (called by survivor AI)
  contributeResources(buildingId: string, resourceType: string, amount: number): number {
    const b = this.buildings.get(buildingId);
    if (!b) return 0;
    const needed = Math.max(0, (b.requiredRemaining[resourceType] ?? 0));
    if (needed <= 0) return 0;
    const applied = Math.min(needed, amount);
    b.requiredRemaining[resourceType] = needed - applied;
    return applied;
  }

  // Let worker mark a building for work (no-op for now; placeholder if needed)
  workOnConstruction(buildingId: string, workerId: string) {
    const b = this.buildings.get(buildingId);
    if (!b) return;
    if (b.status === 'blueprint' && !this.needsResources(buildingId)) {
      b.status = 'under_construction';
      b.sprite.setAlpha(0.7);
      b.assignedWorker = workerId;
    }
  }

  getBuildings(): Map<string, Building> {
    return this.buildings;
  }

  getRecipe(id: string): Recipe | undefined {
    return this.recipes.get(id);
  }

  getBuilding(id: string): Building | undefined {
    return this.buildings.get(id);
  }

  setBuildMode(enabled: boolean, recipeId?: string) {
    this.buildMode = enabled;
    if (recipeId) {
      this.selectedRecipe = this.recipes.get(recipeId);
    } else {
      this.selectedRecipe = undefined;
    }
  }

  isBuildModeActive(): boolean {
    return this.buildMode;
  }

  getSelectedRecipe(): Recipe | undefined {
    return this.selectedRecipe;
  }

  assignWorkerToBuilding(buildingId: string, workerId: string): boolean {
    const building = this.buildings.get(buildingId);
    if (building && building.status === 'blueprint') {
      building.assignedWorker = workerId;
      return true;
    }
    return false;
  }

  removeBuilding(buildingId: string) {
    const building = this.buildings.get(buildingId);
    if (building) {
      building.sprite.destroy();
      this.buildings.delete(buildingId);
    }
  }
}