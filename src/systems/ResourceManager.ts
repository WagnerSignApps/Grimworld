import Phaser from 'phaser';

export interface Resource {
  id: string;
  name: string;
  description: string;
  icon: string;
  stackable: boolean;
  maxStack: number;
}

export interface ResourceNode {
  id: string;
  x: number;
  y: number;
  resourceType: string;
  amount: number;
  maxAmount: number;
  regenerationRate: number;
  sprite: Phaser.GameObjects.Sprite;
  harvestable: boolean;
  lastHarvested: number;
  reservedBy?: string; // survivorId that reserved this node
}

export class ResourceManager {
  private scene: Phaser.Scene;
  private resources: Map<string, number> = new Map();
  private resourceNodes: Map<string, ResourceNode> = new Map();
  private resourceTypes: Map<string, Resource> = new Map();
  private stockpileX: number = 0;
  private stockpileY: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initializeResourceTypes();
    this.initializeStartingResources();
  }

  private initializeResourceTypes() {
    const resourceTypes: Resource[] = [
      {
        id: 'nuggets',
        name: 'Nuggets',
        description: 'Processed chicken-like substance. Primary food source.',
        icon: 'nugget_icon',
        stackable: true,
        maxStack: 999
      },
      {
        id: 'sauce',
        name: 'Special Sauce',
        description: 'Mysterious condiment with addictive properties.',
        icon: 'sauce_icon',
        stackable: true,
        maxStack: 999
      },
      {
        id: 'scrap',
        name: 'Scrap Metal',
        description: 'Salvaged materials from suburban decay.',
        icon: 'scrap_icon',
        stackable: true,
        maxStack: 999
      },
      {
        id: 'electronics',
        name: 'Electronics',
        description: 'Circuit boards, wires, and tech components.',
        icon: 'electronics_icon',
        stackable: true,
        maxStack: 999
      },
      {
        id: 'plastic',
        name: 'Plastic',
        description: 'Recycled containers and packaging materials.',
        icon: 'plastic_icon',
        stackable: true,
        maxStack: 999
      },
      {
        id: 'fabric',
        name: 'Fabric',
        description: 'Cloth scraps from abandoned clothing stores.',
        icon: 'fabric_icon',
        stackable: true,
        maxStack: 999
      },
      {
        id: 'concrete',
        name: 'Concrete',
        description: 'Broken chunks of suburban infrastructure.',
        icon: 'concrete_icon',
        stackable: true,
        maxStack: 999
      },
      {
        id: 'fuel',
        name: 'Fuel',
        description: 'Gasoline siphoned from abandoned vehicles.',
        icon: 'fuel_icon',
        stackable: true,
        maxStack: 999
      },
      {
        id: 'wood',
        name: 'Wood',
        description: 'Timber from suburban trees and fences.',
        icon: 'wood_icon',
        stackable: true,
        maxStack: 999
      }
    ];

    resourceTypes.forEach(resource => {
      this.resourceTypes.set(resource.id, resource);
    });
  }

  private initializeStartingResources() {
    this.resources.set('nuggets', 50);
    this.resources.set('sauce', 25);
    this.resources.set('scrap', 15);
    this.resources.set('electronics', 5);
    this.resources.set('plastic', 10);
    this.resources.set('fabric', 8);
    this.resources.set('concrete', 20);
    this.resources.set('fuel', 12);
    this.resources.set('wood', 20);
  }

  generateResourceNodes(tileMap: any) {
    const width = tileMap.getWidth();
    const height = tileMap.getHeight();
    const tileSize = tileMap.getTileSize();

    // Generate scrap piles near McRonald's ruins
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const tile = tileMap.getTile(x, y);
        if (tile && tile.type === 'tile_mcronalds') {
          // Chance to spawn resource nodes nearby
          this.trySpawnResourceNode(x, y, tileSize, 'scrap', 0.3);
          this.trySpawnResourceNode(x, y, tileSize, 'electronics', 0.15);
          this.trySpawnResourceNode(x, y, tileSize, 'plastic', 0.2);
        }
        
        if (tile && tile.type === 'tile_drainage') {
          this.trySpawnResourceNode(x, y, tileSize, 'scrap', 0.4);
          this.trySpawnResourceNode(x, y, tileSize, 'concrete', 0.25);
        }

        if (tile && tile.type === 'tile_grass') {
          this.trySpawnResourceNode(x, y, tileSize, 'fabric', 0.1);
          this.trySpawnResourceNode(x, y, tileSize, 'wood', 0.25);
        }
      }
    }
  }

  private trySpawnResourceNode(tileX: number, tileY: number, tileSize: number, resourceType: string, chance: number) {
    if (Math.random() < chance) {
      const offsetX = Phaser.Math.Between(-tileSize, tileSize);
      const offsetY = Phaser.Math.Between(-tileSize, tileSize);
      
      const worldX = tileX * tileSize + tileSize / 2 + offsetX;
      const worldY = tileY * tileSize + tileSize / 2 + offsetY;

      this.createResourceNode(resourceType, worldX, worldY);
    }
  }

  private createResourceNode(resourceType: string, x: number, y: number): ResourceNode {
    // Create visual representation
    const sprite = this.scene.add.sprite(x, y, 'tile_concrete');
    sprite.setScale(0.5);
    sprite.setAlpha(0.8);
    sprite.setDepth(1); // resources above tiles

    // Color code by resource type
    const colors: { [key: string]: number } = {
      scrap: 0x8B4513,
      electronics: 0x00CED1,
      plastic: 0xFF69B4,
      fabric: 0x9370DB,
      concrete: 0x696969,
      fuel: 0xFF4500,
      wood: 0x8B5A2B
    };

    sprite.setTint(colors[resourceType] || 0xFFFFFF);

    const node: ResourceNode = {
      id: Phaser.Utils.String.UUID(),
      x,
      y,
      resourceType,
      amount: Phaser.Math.Between(10, 30),
      maxAmount: 50,
      regenerationRate: 0.1, // Resources per second
      sprite,
      harvestable: true,
      lastHarvested: 0,
      reservedBy: undefined
    };

    // Make interactive
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => this.harvestResourceNode(node.id));

    this.resourceNodes.set(node.id, node);
    return node;
  }

  harvestResourceNode(nodeId: string, survivorId?: string, depleteRemove: boolean = false): boolean {
    const node = this.resourceNodes.get(nodeId);
    if (!node || !node.harvestable || node.amount <= 0) return false;

    const harvestAmount = Math.min(5, node.amount);
    node.amount -= harvestAmount;
    node.lastHarvested = Date.now();

    // Add to resources
    this.addResource(node.resourceType, harvestAmount);

    // Update visual
    if (node.amount <= 0) {
      node.harvestable = false;

      if (depleteRemove) {
        // Remove node entirely
        node.sprite.destroy();
        this.resourceNodes.delete(node.id);
      } else {
        // Dim and schedule regeneration
        node.sprite.setAlpha(0.3);
        this.scene.time.delayedCall(30000, () => { // 30 seconds
          node.amount = Math.min(node.maxAmount, node.amount + 10);
          node.sprite.setAlpha(0.8);
          node.harvestable = true;
        });
      }
    }

    // Update UI
    this.updateResourceUI();
    return true;
  }

  addResource(resourceType: string, amount: number) {
    const current = this.resources.get(resourceType) || 0;
    this.resources.set(resourceType, current + amount);
    this.updateResourceUI();
  }

  removeResource(resourceType: string, amount: number): boolean {
    const current = this.resources.get(resourceType) || 0;
    if (current >= amount) {
      this.resources.set(resourceType, current - amount);
      this.updateResourceUI();
      return true;
    }
    return false;
  }

  hasResource(resourceType: string, amount: number): boolean {
    const current = this.resources.get(resourceType) || 0;
    return current >= amount;
  }

  getResource(resourceType: string): number {
    return this.resources.get(resourceType) || 0;
  }

  getAllResources(): Map<string, number> {
    return new Map(this.resources);
  }

  getResourceNodes(): Map<string, ResourceNode> {
    return this.resourceNodes;
  }

  removeResourceNode(nodeId: string) {
    const node = this.resourceNodes.get(nodeId);
    if (node) {
      node.sprite.destroy();
      this.resourceNodes.delete(nodeId);
      this.updateResourceUI();
    }
  }

  // Stockpile management (where survivors deliver resources)
  setStockpile(x: number, y: number) {
    this.stockpileX = x;
    this.stockpileY = y;
  }

  getStockpile(): { x: number; y: number } {
    return { x: this.stockpileX, y: this.stockpileY };
  }

  // Node reservation so multiple survivors don't target the same node
  reserveResourceNode(nodeId: string, survivorId: string): boolean {
    const node = this.resourceNodes.get(nodeId);
    if (!node || !node.harvestable) return false;
    if (node.reservedBy && node.reservedBy !== survivorId) return false;
    node.reservedBy = survivorId;
    return true;
  }

  releaseResourceNode(nodeId: string, survivorId: string) {
    const node = this.resourceNodes.get(nodeId);
    if (node && node.reservedBy === survivorId) {
      node.reservedBy = undefined;
    }
  }

  // Find nearest available node of a resource type
  findNearestResourceNode(resourceType: string, x: number, y: number, allowReservedBy?: string): ResourceNode | undefined {
    let best: ResourceNode | undefined;
    let bestD2 = Number.MAX_VALUE;
    this.resourceNodes.forEach(node => {
      if (!node.harvestable) return;
      if (node.resourceType !== resourceType) return;
      if (node.reservedBy && node.reservedBy !== allowReservedBy) return;
      const dx = node.x - x;
      const dy = node.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = node;
      }
    });
    return best;
  }

  // Extract resources from a node WITHOUT depositing to stockpile immediately.
  // Returns the actual amount extracted.
  extractFromNode(nodeId: string, amount: number, survivorId?: string): number {
    const node = this.resourceNodes.get(nodeId);
    if (!node || !node.harvestable || node.amount <= 0) return 0;

    // Respect reservation (if provided)
    if (survivorId && node.reservedBy && node.reservedBy !== survivorId) return 0;

    const extracted = Math.max(0, Math.min(amount, node.amount));
    node.amount -= extracted;
    node.lastHarvested = Date.now();

    if (node.amount <= 0) {
      node.harvestable = false;
      // Remove node entirely when depleted for survivor-driven extraction
      node.sprite.destroy();
      this.resourceNodes.delete(node.id);
    }

    return extracted;
  }

  update() {
    // Regenerate resource nodes over time
    this.resourceNodes.forEach(node => {
      if (node.amount < node.maxAmount && Date.now() - node.lastHarvested > 5000) {
        if (Math.random() < node.regenerationRate / 60) { // Per frame chance
          node.amount = Math.min(node.maxAmount, node.amount + 1);
          
          if (!node.harvestable && node.amount > 0) {
            node.harvestable = true;
            node.sprite.setAlpha(0.8);
          }
        }
      }
    });
  }

  private updateResourceUI() {
    // Update UI scene if available
    const uiScene = this.scene.scene.get('UIScene') as any;
    if (uiScene && uiScene.updateResources) {
      uiScene.updateResources(this.resources);
    }
  }

  // Public methods for crafting system
  getResourceType(id: string): Resource | undefined {
    return this.resourceTypes.get(id);
  }

  getAllResourceTypes(): Map<string, Resource> {
    return this.resourceTypes;
  }
}