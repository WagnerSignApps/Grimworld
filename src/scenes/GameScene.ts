import Phaser from 'phaser';
import { TileMap } from '../systems/TileMap';
import { SurvivorManager } from '../systems/SurvivorManager';
import { FactionManager } from '../systems/FactionManager';
import { EventManager } from '../systems/EventManager';
import { ResourceManager } from '../systems/ResourceManager';
import { CraftingSystem } from '../systems/CraftingSystem';

export class GameScene extends Phaser.Scene {
  private tileMap!: TileMap;
  private survivorManager!: SurvivorManager;
  private factionManager!: FactionManager;
  private eventManager!: EventManager;
  private resourceManager!: ResourceManager;
  private craftingSystem!: CraftingSystem;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private camera!: Phaser.Cameras.Scene2D.Camera;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Create simple colored rectangles as placeholder tiles
    this.createTileTextures();
  }

  create() {
    // Initialize camera
    this.camera = this.cameras.main;
    // Camera bounds set after map generation (dynamic to map size)

    // Initialize game systems
    this.tileMap = new TileMap(this);
    this.resourceManager = new ResourceManager(this);
    this.craftingSystem = new CraftingSystem(this, this.resourceManager);
    this.survivorManager = new SurvivorManager(this);
    this.factionManager = new FactionManager(this);
    this.eventManager = new EventManager(this);

    // Generate initial map
    this.tileMap.generateSuburbanMap(60, 40);

    // Dynamic camera bounds based on map size
    const worldWidth = this.tileMap.getWidth() * this.tileMap.getTileSize();
    const worldHeight = this.tileMap.getHeight() * this.tileMap.getTileSize();
    this.camera.setBounds(0, 0, worldWidth, worldHeight);

    // Define a stockpile (delivery point) at map center for resource hauling
    if ((this.resourceManager as any).setStockpile) {
      (this.resourceManager as any).setStockpile(worldWidth / 2, worldHeight / 2);
      // Optional: draw a subtle stockpile marker
      const sp = this.add.rectangle(worldWidth / 2, worldHeight / 2, 18, 18, 0xffd54f, 0.85)
        .setStrokeStyle(1, 0xffb300);
      sp.setDepth(1.5);
    }

    // Scatter vegetation (trees and bushes) on grass tiles
    if ((this.tileMap as any).scatterVegetation) {
      (this.tileMap as any).scatterVegetation(0.08, 0.12);
    }
    
    // Generate resource nodes
    this.resourceManager.generateResourceNodes(this.tileMap);
    
    // Spawn initial survivors
    this.survivorManager.spawnInitialSurvivors(3);

    // Set up input
    this.cursors = this.input.keyboard!.createCursorKeys();
    
    // Camera controls
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && !this.craftingSystem.isBuildModeActive()) {
        this.camera.scrollX -= (pointer.x - pointer.prevPosition.x) / this.camera.zoom;
        this.camera.scrollY -= (pointer.y - pointer.prevPosition.y) / this.camera.zoom;
      }
    });

    // Building placement
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.craftingSystem.isBuildModeActive()) {
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        const recipe = this.craftingSystem.getSelectedRecipe();
        
        if (recipe && this.craftingSystem.canCraftRecipe(recipe.id)) {
          this.craftingSystem.startBuilding(recipe.id, worldX, worldY);
          this.craftingSystem.setBuildMode(false); // Exit build mode after placing
        }
      }
    });

    // Zoom controls
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any[], deltaX: number, deltaY: number) => {
      if (deltaY > 0) {
        this.camera.zoom = Math.max(0.5, this.camera.zoom - 0.1);
      } else {
        this.camera.zoom = Math.min(2, this.camera.zoom + 0.1);
      }
    });

    // Start UI scene
    this.scene.launch('UIScene');
    // Sync starting resources with UI after UI boots
    this.time.delayedCall(50, () => {
      const ui = this.scene.get('UIScene') as any;
      if (ui && ui.updateResources) {
        ui.updateResources(this.resourceManager.getAllResources());
      }
    });

    // Start the conspiracy timer
    this.startConspiracyEvents();
  }

  update() {
    // Camera movement with arrow keys
    const speed = 5 / this.camera.zoom;
    
    if (this.cursors.left.isDown) {
      this.camera.scrollX -= speed;
    }
    if (this.cursors.right.isDown) {
      this.camera.scrollX += speed;
    }
    if (this.cursors.up.isDown) {
      this.camera.scrollY -= speed;
    }
    if (this.cursors.down.isDown) {
      this.camera.scrollY += speed;
    }

    // Update game systems
    this.survivorManager.update();
    this.eventManager.update();
    this.resourceManager.update();
    this.craftingSystem.update();
  }

  private createTileTextures() {
    // Enhanced pixel-art style textures for tiles and vegetation
    const g = this.add.graphics();

    // Sidewalk Concrete (with cracks and seams)
    g.clear();
    g.fillStyle(0x9aa0a6); // base concrete
    g.fillRect(0, 0, 32, 32);
    // slab seams
    g.fillStyle(0x7b8187);
    g.fillRect(0, 15, 32, 1);
    g.fillRect(15, 0, 1, 32);
    // cracks (small dark pixels)
    g.fillStyle(0x595e63);
    g.fillRect(6, 6, 1, 1);
    g.fillRect(7, 7, 1, 1);
    g.fillRect(18, 10, 1, 1);
    g.fillRect(19, 11, 1, 1);
    g.fillRect(22, 22, 1, 1);
    g.fillRect(10, 24, 1, 1);
    g.generateTexture('tile_concrete', 32, 32);

    // Asphalt Road (with dashed center line and edge wear)
    g.clear();
    g.fillStyle(0x2e2e2e); // asphalt base
    g.fillRect(0, 0, 32, 32);
    // faint edges
    g.fillStyle(0x3a3a3a);
    g.fillRect(0, 0, 32, 2);
    g.fillRect(0, 30, 32, 2);
    // dashed center line
    g.fillStyle(0xe6d690);
    for (let x = 2; x < 32; x += 8) {
      g.fillRect(x, 15, 4, 2);
    }
    // small pothole specks
    g.fillStyle(0x1f1f1f);
    g.fillRect(8, 8, 1, 1);
    g.fillRect(20, 12, 1, 1);
    g.fillRect(12, 22, 1, 1);
    g.generateTexture('tile_asphalt', 32, 32);

    // Textured Grass (with blades and hue variation)
    g.clear();
    g.fillStyle(0x2e7d32); // base green
    g.fillRect(0, 0, 32, 32);
    // blades
    g.fillStyle(0x3fa34d);
    for (let i = 0; i < 14; i++) {
      const bx = Phaser.Math.Between(1, 30);
      const by = Phaser.Math.Between(1, 30);
      g.fillRect(bx, by, 1, 2);
    }
    // darker clumps
    g.fillStyle(0x25692a);
    g.fillRect(6, 6, 2, 2);
    g.fillRect(24, 10, 2, 2);
    g.fillRect(14, 22, 2, 2);
    g.generateTexture('tile_grass', 32, 32);

    // McRonald's Ruins (broken tile + signage)
    g.clear();
    g.fillStyle(0x8d2c0f); // burnt orange rubble
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xffcc00); // golden arches fragment
    g.fillRect(5, 6, 22, 5);
    g.fillRect(5, 12, 3, 8);
    g.fillRect(24, 12, 3, 8);
    g.fillStyle(0x5e200b); // cracks
    g.fillRect(10, 20, 12, 1);
    g.fillRect(10, 21, 1, 3);
    g.generateTexture('tile_mcronalds', 32, 32);

    // Drainage Ditch (water with ripple and culvert)
    g.clear();
    g.fillStyle(0x3b83bd); // water
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x274b6e); // trench
    g.fillRect(4, 10, 24, 12);
    g.fillStyle(0x6fb3ff); // ripples
    g.fillRect(6, 12, 8, 1);
    g.fillRect(18, 16, 8, 1);
    g.generateTexture('tile_drainage', 32, 32);

    // Tree (oak-style): trunk + canopy
    g.clear();
    // trunk
    g.fillStyle(0x6b4f2a);
    g.fillRect(14, 28, 4, 12);
    // canopy (overlapping circles)
    g.fillStyle(0x2f7d32);
    g.fillCircle(16, 22, 10);
    g.fillStyle(0x3f9d42);
    g.fillCircle(12, 20, 8);
    g.fillCircle(20, 20, 8);
    g.generateTexture('tree_oak', 32, 48);

    // Bush
    g.clear();
    g.fillStyle(0x2d6a4f);
    g.fillCircle(10, 10, 6);
    g.fillCircle(16, 12, 6);
    g.fillCircle(22, 10, 6);
    g.fillStyle(0x3f8f6b);
    g.fillCircle(16, 10, 5);
    g.generateTexture('bush', 32, 20);

    g.destroy();
  }

  private startConspiracyEvents() {
    // Random conspiracy events
    this.time.addEvent({
      delay: Phaser.Math.Between(30000, 120000), // 30 seconds to 2 minutes
      callback: () => {
        this.eventManager.triggerRandomEvent();
        this.startConspiracyEvents(); // Reschedule
      }
    });
  }

  // Public methods for other systems to access
  getTileMap(): TileMap {
    return this.tileMap;
  }

  getSurvivorManager(): SurvivorManager {
    return this.survivorManager;
  }

  getFactionManager(): FactionManager {
    return this.factionManager;
  }

  getEventManager(): EventManager {
    return this.eventManager;
  }

  getResourceManager(): ResourceManager {
    return this.resourceManager;
  }

  getCraftingSystem(): CraftingSystem {
    return this.craftingSystem;
  }
}