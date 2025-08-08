import Phaser from 'phaser';

export enum TileType {
  CONCRETE = 'tile_concrete',
  ASPHALT = 'tile_asphalt',
  GRASS = 'tile_grass',
  MCRONALDS = 'tile_mcronalds',
  DRAINAGE = 'tile_drainage'
}

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  sprite: Phaser.GameObjects.Sprite;
  walkable: boolean;
  buildable: boolean;
  resources?: string[];
}

export class TileMap {
  private scene: Phaser.Scene;
  private tiles: Tile[][] = [];
  private width: number = 0;
  private height: number = 0;
  private tileSize: number = 32;
  private vegetation: Phaser.GameObjects.Sprite[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  generateSuburbanMap(mapWidth: number, mapHeight: number) {
    this.width = mapWidth;
    this.height = mapHeight;
    this.tiles = [];

    // Initialize tile grid
    for (let x = 0; x < mapWidth; x++) {
      this.tiles[x] = [];
      for (let y = 0; y < mapHeight; y++) {
        this.tiles[x][y] = this.createTile(x, y, this.getRandomTileType(x, y));
      }
    }

    // Generate suburban features
    this.generateRoads();
    this.generateCulDeSacs();
    this.generateFastFoodRuins();
    this.generateDrainageSystems();
  }

  private createTile(x: number, y: number, type: TileType): Tile {
    const sprite = this.scene.add.sprite(
      x * this.tileSize + this.tileSize / 2,
      y * this.tileSize + this.tileSize / 2,
      type
    );
    sprite.setDepth(0);

    const tile: Tile = {
      x,
      y,
      type,
      sprite,
      walkable: this.isWalkable(type),
      buildable: this.isBuildable(type),
      resources: this.getTileResources(type)
    };

    return tile;
  }

  private getRandomTileType(x: number, y: number): TileType {
    // Create a more realistic suburban layout
    const noise = this.simpleNoise(x * 0.1, y * 0.1);
    
    if (noise > 0.7) {
      return TileType.CONCRETE;
    } else if (noise > 0.4) {
      return TileType.ASPHALT;
    } else if (noise < -0.3) {
      return TileType.DRAINAGE;
    } else {
      return TileType.GRASS;
    }
  }

  private generateRoads() {
    // Generate main roads every 8-12 tiles
    for (let x = 0; x < this.width; x += Phaser.Math.Between(8, 12)) {
      for (let y = 0; y < this.height; y++) {
        if (this.tiles[x] && this.tiles[x][y]) {
          this.setTileType(x, y, TileType.ASPHALT);
          // Add sidewalks
          if (x > 0) this.setTileType(x - 1, y, TileType.CONCRETE);
          if (x < this.width - 1) this.setTileType(x + 1, y, TileType.CONCRETE);
        }
      }
    }

    // Generate cross streets
    for (let y = 0; y < this.height; y += Phaser.Math.Between(6, 10)) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[x] && this.tiles[x][y]) {
          this.setTileType(x, y, TileType.ASPHALT);
          // Add sidewalks
          if (y > 0) this.setTileType(x, y - 1, TileType.CONCRETE);
          if (y < this.height - 1) this.setTileType(x, y + 1, TileType.CONCRETE);
        }
      }
    }
  }

  private generateCulDeSacs() {
    // Add some cul-de-sacs at dead ends
    const culDeSacCount = Math.floor((this.width * this.height) / 400);
    
    for (let i = 0; i < culDeSacCount; i++) {
      const centerX = Phaser.Math.Between(5, this.width - 5);
      const centerY = Phaser.Math.Between(5, this.height - 5);
      const radius = 3;

      // Create circular cul-de-sac
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          const x = centerX + dx;
          const y = centerY + dy;

          if (distance <= radius && x >= 0 && x < this.width && y >= 0 && y < this.height) {
            if (distance <= radius - 1) {
              this.setTileType(x, y, TileType.ASPHALT);
            } else {
              this.setTileType(x, y, TileType.CONCRETE);
            }
          }
        }
      }
    }
  }

  private generateFastFoodRuins() {
    // Scatter some McRonald's ruins
    const ruinCount = Math.floor((this.width * this.height) / 200);
    
    for (let i = 0; i < ruinCount; i++) {
      const x = Phaser.Math.Between(1, this.width - 3);
      const y = Phaser.Math.Between(1, this.height - 3);

      // Create 2x2 fast food ruin
      for (let dx = 0; dx < 2; dx++) {
        for (let dy = 0; dy < 2; dy++) {
          if (x + dx < this.width && y + dy < this.height) {
            this.setTileType(x + dx, y + dy, TileType.MCRONALDS);
          }
        }
      }
    }
  }

  private generateDrainageSystems() {
    // Add drainage ditches along some roads
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        if (this.tiles[x][y].type === TileType.ASPHALT) {
          // Random chance to add drainage nearby
          if (Math.random() < 0.1) {
            const drainX = x + Phaser.Math.Between(-2, 2);
            const drainY = y + Phaser.Math.Between(-2, 2);
            
            if (drainX >= 0 && drainX < this.width && drainY >= 0 && drainY < this.height) {
              this.setTileType(drainX, drainY, TileType.DRAINAGE);
            }
          }
        }
      }
    }
  }

  private setTileType(x: number, y: number, type: TileType) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      const tile = this.tiles[x][y];
      tile.type = type;
      tile.sprite.setTexture(type);
      tile.walkable = this.isWalkable(type);
      tile.buildable = this.isBuildable(type);
      tile.resources = this.getTileResources(type);
    }
  }

  private isWalkable(type: TileType): boolean {
    switch (type) {
      case TileType.CONCRETE:
      case TileType.ASPHALT:
      case TileType.GRASS:
        return true;
      case TileType.MCRONALDS:
      case TileType.DRAINAGE:
        return false;
      default:
        return true;
    }
  }

  private isBuildable(type: TileType): boolean {
    switch (type) {
      case TileType.GRASS:
        return true;
      case TileType.CONCRETE:
        return true;
      default:
        return false;
    }
  }

  private getTileResources(type: TileType): string[] {
    switch (type) {
      case TileType.MCRONALDS:
        return ['nuggets', 'sauce'];
      case TileType.DRAINAGE:
        return ['scrap'];
      case TileType.GRASS:
        return ['organic_matter'];
      default:
        return [];
    }
  }

  private simpleNoise(x: number, y: number): number {
    // Simple pseudo-random noise function
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }

  // Vegetation scatter
  public scatterVegetation(treeChance: number = 0.07, bushChance: number = 0.1) {
    // clear old vegetation
    if (this.vegetation && this.vegetation.length) {
      this.vegetation.forEach(v => v.destroy());
    }
    this.vegetation = [];

    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const tile = this.tiles[x][y];
        if (tile.type === TileType.GRASS) {
          const wx = x * this.tileSize + this.tileSize / 2 + Phaser.Math.Between(-6, 6);
          const wy = y * this.tileSize + this.tileSize / 2 + Phaser.Math.Between(-6, 6);

          if (Math.random() < treeChance) {
            const s = this.scene.add.sprite(wx, wy, 'tree_oak');
            s.setDepth(1);
            this.vegetation.push(s);
          } else if (Math.random() < bushChance) {
            const s = this.scene.add.sprite(wx, wy, 'bush');
            s.setDepth(1);
            this.vegetation.push(s);
          }
        }
      }
    }
  }

  // Public methods
  getTile(x: number, y: number): Tile | null {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.tiles[x][y];
    }
    return null;
  }

  getTileAtWorldPos(worldX: number, worldY: number): Tile | null {
    const tileX = Math.floor(worldX / this.tileSize);
    const tileY = Math.floor(worldY / this.tileSize);
    return this.getTile(tileX, tileY);
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getTileSize(): number {
    return this.tileSize;
  }
}