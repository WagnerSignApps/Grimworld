import Phaser from 'phaser';

export interface SurvivorBackground {
  name: string;
  description: string;
  skills: { [key: string]: number };
  quirks: string[];
}
 
// Survivor AI task types
type GatherTask = {
  type: 'gather';
  nodeId: string;
  resourceType: string;
  state: 'to_node' | 'gathering' | 'to_stockpile';
  targetX?: number;
  targetY?: number;
  timer?: number;
};
type DeliverBuildTask = {
  type: 'deliver_build';
  buildingId: string;
  resourceType: string;
  amount: number;
  state: 'to_stockpile' | 'to_build';
  targetX?: number;
  targetY?: number;
};
type BuildWorkTask = {
  type: 'build_work';
  buildingId: string;
  state: 'working';
  targetX?: number;
  targetY?: number;
};
type DefendTask = {
  type: 'defend';
  enemyUnitId: string;
  state: 'to_enemy' | 'attacking';
  targetX?: number;
  targetY?: number;
  timer?: number;
};
type IdleTask = { type: 'idle'; state: 'wander' };
type AITask = GatherTask | DeliverBuildTask | BuildWorkTask | DefendTask | IdleTask;
 
export interface Survivor {
  id: string;
  name: string;
  background: SurvivorBackground;
  sprite: Phaser.GameObjects.Sprite;
  nameLabel: Phaser.GameObjects.Text;
  x: number;
  y: number;
  health: number;
  sanity: number;
  hunger: number;
  mood: string;
  currentTask?: string; // legacy
  // AI fields
  task?: AITask;
  carrying?: { resourceType: string; amount: number };
  speed: number;
  skills: { [key: string]: number };
  quirks: string[];
  // Status flags
  isStarving?: boolean;
  isBreaking?: boolean;
}

export class SurvivorManager {
  private scene: Phaser.Scene;
  private survivors: Map<string, Survivor> = new Map();
  private wanderingSurvivors: Map<string, Survivor> = new Map();
  private survivorBackgrounds: SurvivorBackground[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initializeBackgrounds();
  }

  private initializeBackgrounds() {
    this.survivorBackgrounds = [
      {
        name: 'PTA Mom',
        description: 'Former helicopter parent with organizational skills',
        skills: { bureaucracy: 8, cooking: 6, repair: 3, combat: 2 },
        quirks: ['Believes Birds Aren\'t Real', 'Obsessed with HOA Rules']
      },
      {
        name: 'Plumber',
        description: 'Blue-collar worker with practical skills',
        skills: { repair: 9, tinkering: 7, bureaucracy: 2, cooking: 4 },
        quirks: ['Suspicious of Government', 'Hoards Pipe Fittings']
      },
      {
        name: 'Drive-Thru Cashier',
        description: 'Fast food veteran with customer service trauma',
        skills: { cooking: 8, bureaucracy: 5, combat: 3, repair: 2 },
        quirks: ['Addicted to McRonald\'s Sauce', 'Hates the Sound of Beeping']
      },
      {
        name: 'Mall Cop',
        description: 'Security guard with delusions of authority',
        skills: { combat: 7, bureaucracy: 6, repair: 4, cooking: 1 },
        quirks: ['Post-Apocalyptic Mall Cop', 'Believes in Conspiracy Theories']
      },
      {
        name: 'Former Senator',
        description: 'Disgraced politician with hidden connections',
        skills: { bureaucracy: 10, combat: 1, cooking: 2, repair: 3 },
        quirks: ['Government Sleeper Agent', 'Paranoid About Surveillance']
      },
      {
        name: 'Suburban Dad',
        description: 'Weekend warrior with a garage full of tools',
        skills: { repair: 6, tinkering: 8, cooking: 5, combat: 4 },
        quirks: ['Obsessed with Lawn Care', 'Believes in Chemtrails']
      },
      {
        name: 'Soccer Mom',
        description: 'Minivan-driving multitasker',
        skills: { bureaucracy: 7, cooking: 7, repair: 2, combat: 5 },
        quirks: ['Road Rage Issues', 'Hoards Snack Foods']
      },
      {
        name: 'IT Support',
        description: 'Tech worker who\'s seen too much',
        skills: { tinkering: 9, repair: 6, bureaucracy: 4, cooking: 2 },
        quirks: ['Knows About Government Backdoors', 'Caffeine Dependent']
      }
    ];
  }

  spawnInitialSurvivors(count: number) {
    const names = ['Karen', 'Bob', 'Dave', 'Linda', 'Mike', 'Susan', 'Jim', 'Nancy'];
    
    for (let i = 0; i < count; i++) {
      const background = Phaser.Utils.Array.GetRandom(this.survivorBackgrounds);
      const name = names[i] || `Survivor ${i + 1}`;
      
      this.createSurvivor(name, background, 
        Phaser.Math.Between(100, 300), 
        Phaser.Math.Between(100, 300)
      );
    }
  }

  private createSurvivor(name: string, background: SurvivorBackground, x: number, y: number, addToColony = true): Survivor {
    // Generate a simple humanoid texture with randomized outfit/skin/hair
    const key = 'survivor_' + Phaser.Utils.String.UUID();
    const g = this.scene.add.graphics();

    const skinTones = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524];
    const shirts = [0x3498db, 0xe74c3c, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22];
    const pants = [0x2c3e50, 0x7f8c8d, 0x34495e, 0x1f2a35];
    const hairs = [0x2c1b18, 0x5a3b26, 0x3c2f2f, 0x111111, 0xc48c46, 0xffffff];

    const skin = Phaser.Utils.Array.GetRandom(skinTones);
    const shirt = Phaser.Utils.Array.GetRandom(shirts);
    const pant = Phaser.Utils.Array.GetRandom(pants);
    const hair = Phaser.Utils.Array.GetRandom(hairs);

    // Draw 16x24 pixel-art figure (head 6x6, torso 8x8, legs 8x6, simple arms)
    g.fillStyle(pant);
    g.fillRect(4, 18, 3, 6); // left leg
    g.fillRect(9, 18, 3, 6); // right leg

    g.fillStyle(shirt);
    g.fillRect(3, 10, 12, 8); // torso
    g.fillRect(1, 12, 2, 5);  // left arm
    g.fillRect(15, 12, 2, 5); // right arm

    g.fillStyle(skin);
    g.fillRect(5, 4, 6, 6);   // head
    g.fillRect(1, 15, 2, 2);  // left hand
    g.fillRect(15, 15, 2, 2); // right hand

    g.fillStyle(hair);
    g.fillRect(5, 3, 6, 2);   // hair fringe
    g.fillRect(5, 4, 1, 2);   // side hair
    g.fillRect(10, 4, 1, 2);  // side hair

    g.generateTexture(key, 16, 24);
    g.destroy();

    const sprite = this.scene.add.sprite(x, y, key);
    sprite.setScale(1.5);
    sprite.setDepth(2);

    // Floating name label
    const nameLabel = this.scene.add.text(x, y - 18, name, {
      fontSize: '10px',
      color: '#ecf0f1',
      fontFamily: 'Courier New, monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5, 1);
    nameLabel.setDepth(2.2);

    const survivor: Survivor = {
      id: Phaser.Utils.String.UUID(),
      name,
      background,
      sprite,
      nameLabel,
      x,
      y,
      health: 100,
      sanity: Phaser.Math.Between(60, 90),
      hunger: Phaser.Math.Between(30, 70),
      mood: this.calculateMood(80, 60, 50),
      // Base walk speed in pixels per second
      speed: 50,
      skills: { ...background.skills },
      quirks: [...background.quirks]
    };

    if (addToColony) {
        this.survivors.set(survivor.id, survivor);
    }

    // Make sprite interactive
    sprite.setInteractive({ useHandCursor: true });
    sprite.setData('type', 'survivor');
    sprite.setData('id', survivor.id);
    sprite.on('pointerdown', () => {
      this.selectSurvivor(survivor.id)
      const ui = this.scene.scene.get('UIScene') as any;
      ui.selectedSurvivorId = survivor.id;
      ui.updateSurvivorPanel();
    });

    return survivor;
  }

  private calculateMood(health: number, sanity: number, hunger: number): string {
    const average = (health + sanity + (100 - hunger)) / 3;
    
    if (average > 80) return 'Content';
    if (average > 60) return 'Stable';
    if (average > 40) return 'Stressed';
    if (average > 20) return 'Unstable';
    return 'Breaking';
  }

  public selectSurvivor(id: string) {
    const survivor = this.survivors.get(id);
    const gameScene = this.scene as any;

    if (survivor) {
      // Highlight selected survivor
      survivor.sprite.setTint(0xffff00); // Yellow highlight
      
      // Reset other survivors
      this.survivors.forEach((other, otherId) => {
        if (otherId !== id) {
          other.sprite.clearTint();
        }
      });

      gameScene.setSelectedSurvivor?.(id);
      console.log(`Selected: ${survivor.name} (${survivor.background.name})`);
    } else {
      // Deselect all
      this.survivors.forEach(s => s.sprite.clearTint());
      gameScene.setSelectedSurvivor?.(undefined);
    }
  }

 update() {
   const dt = this.scene.game.loop.delta / 1000; // seconds
   // Update survivor needs and behaviors
   this.survivors.forEach(survivor => {
     this.updateSurvivorNeeds(survivor);
     this.updateAI(survivor, dt);
   });
 }

  private updateSurvivorNeeds(survivor: Survivor) {
    // Slowly decrease needs over time
    if (Math.random() < 0.01) { // 1% chance per frame
      survivor.hunger = Math.min(100, survivor.hunger + 1);
      
      // Starvation check
      if (survivor.hunger > 80 && !survivor.isStarving) {
        survivor.isStarving = true;
        this.scene.events.emit('survivorStateChanged', { survivor, state: 'starving' });
      } else if (survivor.hunger <= 80 && survivor.isStarving) {
        survivor.isStarving = false;
      }

      // Sanity check
      if (survivor.sanity < 20 && !survivor.isBreaking) {
          survivor.isBreaking = true;
          this.scene.events.emit('survivorStateChanged', { survivor, state: 'breaking' });
      } else if (survivor.sanity >= 20 && survivor.isBreaking) {
          survivor.isBreaking = false;
      }

      if (survivor.hunger > 80) {
        survivor.sanity = Math.max(0, survivor.sanity - 1);
      }
      
      // Update mood based on current stats
      survivor.mood = this.calculateMood(survivor.health, survivor.sanity, survivor.hunger);
    }
  }

  // New AI loop
  private updateAI(survivor: Survivor, dt: number) {
    const gameScene = this.scene as any;
    // --- Defense Mode Override ---
    if (gameScene.defenseModeActive) {
        const hostile = this.findNearestHostile(survivor);
        if (hostile) {
            // If not already defending this hostile, assign priority task
            if (!survivor.task || survivor.task.type !== 'defend' || (survivor.task as DefendTask).enemyUnitId !== hostile.id) {
                const task: DefendTask = {
                    type: 'defend',
                    enemyUnitId: hostile.id,
                    state: 'to_enemy',
                    targetX: hostile.x,
                    targetY: hostile.y
                };
                this.assignPriorityTask(survivor.id, task);
            }
        }
    }

    // pick a task if none
    if (!survivor.task) {
      this.ensureTask(survivor);
    }
    // process current task
    if (survivor.task) {
      this.processTask(survivor, dt);
    } else {
      // idle wander
      this.randomMovement(survivor);
    }
  }

  private ensureTask(survivor: Survivor) {
    const rm = (this.scene as any).getResourceManager?.();
    const cs = (this.scene as any).getCraftingSystem?.();

    // 1) If any building needs resources and we have some in stock, haul to it
    if (rm && cs && typeof cs.getBuildings === 'function' && typeof cs.needsResources === 'function') {
      const buildings: any[] = Array.from(cs.getBuildings().values());
      const needing = buildings.find(b => cs.needsResources(b.id));
      if (needing) {
        const neededTypes: string[] = (cs.getNeededResourceTypes?.(needing.id) || []) as string[];
        const resType = neededTypes.find(t => (rm.getResource(t) || 0) > 0);
        if (resType) {
          const stock = rm.getStockpile?.() || { x: survivor.x, y: survivor.y };
          survivor.task = {
            type: 'deliver_build',
            buildingId: needing.id,
            resourceType: resType,
            state: 'to_stockpile',
            targetX: stock.x,
            targetY: stock.y,
            amount: 5
          };
          return;
        }
      }
    }

    // 2) Otherwise, gather nearest resource node (priority list)
    if (rm && typeof rm.findNearestResourceNode === 'function') {
      const priorities = ['wood', 'scrap', 'plastic', 'electronics', 'fabric', 'concrete', 'fuel', 'nuggets'];
      let chosen: any;
      let chosenType: string | undefined;
      for (const t of priorities) {
        const node = rm.findNearestResourceNode(t, survivor.x, survivor.y, survivor.id);
        if (node && rm.reserveResourceNode?.(node.id, survivor.id)) {
          chosen = node;
          chosenType = t;
          break;
        }
      }
      if (chosen && chosenType) {
        survivor.task = {
          type: 'gather',
          nodeId: chosen.id,
          resourceType: chosenType,
          state: 'to_node',
          targetX: chosen.x,
          targetY: chosen.y
        };
        return;
      }
    }

    // 3) Fallback idle
    survivor.task = { type: 'idle', state: 'wander' };
  }

  private processTask(survivor: Survivor, dt: number) {
    const rm = (this.scene as any).getResourceManager?.();
    const cs = (this.scene as any).getCraftingSystem?.();
    const task = survivor.task!;
    switch (task.type) {
      case 'gather': {
        if (!rm) { survivor.task = undefined; return; }
        if (task.state === 'to_node') {
          if (this.moveTowards(survivor, task.targetX!, task.targetY!, dt)) {
            // arrived -> gather
            task.state = 'gathering';
            task.timer = 1.2; // seconds to gather
            this.playTaskAnim(survivor, 0x2ecc71);
          }
        } else if (task.state === 'gathering') {
          task.timer = (task.timer || 0) - dt;
          if (task.timer! <= 0) {
            // extract payload
            const extracted = rm.extractFromNode?.(task.nodeId!, 5, survivor.id) || 0;
            // release reservation
            rm.releaseResourceNode?.(task.nodeId!, survivor.id);
            this.clearTaskAnim(survivor);
            if (extracted > 0) {
              survivor.carrying = { resourceType: task.resourceType!, amount: extracted };
              const stock = rm.getStockpile?.() || { x: survivor.x, y: survivor.y };
              task.state = 'to_stockpile';
              task.targetX = stock.x; task.targetY = stock.y;
            } else {
              survivor.task = undefined;
            }
          }
        } else if (task.state === 'to_stockpile') {
          if (this.moveTowards(survivor, task.targetX!, task.targetY!, dt)) {
            if (survivor.carrying) {
              rm.addResource(survivor.carrying.resourceType, survivor.carrying.amount);
              survivor.carrying = undefined;
            }
            survivor.task = undefined; // job done
          }
        }
        break;
      }

      case 'deliver_build': {
        if (!rm || !cs) { survivor.task = undefined; return; }
        if (task.state === 'to_stockpile') {
          if (this.moveTowards(survivor, task.targetX!, task.targetY!, dt)) {
            // "pickup" by removing from global stock (simulate loading at stockpile)
            const needAmt = task.amount || 5;
            if (rm.hasResource(task.resourceType!, needAmt)) {
              rm.removeResource(task.resourceType!, needAmt);
              survivor.carrying = { resourceType: task.resourceType!, amount: needAmt };
              // head to building
              const b = cs.getBuilding(task.buildingId!);
              if (!b) { survivor.task = undefined; return; }
              task.state = 'to_build';
              task.targetX = b.x; task.targetY = b.y;
              this.playTaskAnim(survivor, 0xf1c40f);
            } else {
              // not enough stock, abort
              survivor.task = undefined;
            }
          }
        } else if (task.state === 'to_build') {
          if (this.moveTowards(survivor, task.targetX!, task.targetY!, dt)) {
            if (survivor.carrying) {
              const applied = cs.contributeResources(task.buildingId!, survivor.carrying.resourceType, survivor.carrying.amount);
              const leftover = survivor.carrying.amount - applied;
              if (leftover > 0) {
                rm.addResource(survivor.carrying.resourceType, leftover);
              }
              survivor.carrying = undefined;
              // start building work
              cs.workOnConstruction(task.buildingId!, survivor.id);
              survivor.task = { type: 'build_work', buildingId: task.buildingId, state: 'working', targetX: task.targetX, targetY: task.targetY };
            } else {
              survivor.task = undefined;
            }
            this.clearTaskAnim(survivor);
          }
        }
        break;
      }

      case 'build_work': {
        if (!cs) { survivor.task = undefined; return; }
        // stay near building and wait until complete or more resources needed
        const b = cs.getBuilding(task.buildingId!);
        if (!b) { survivor.task = undefined; return; }
        // keep close to the site
        this.moveTowards(survivor, task.targetX!, task.targetY!, dt);
        // if site needs more resources, switch to hauling again
        if (cs.needsResources(b.id)) {
          const needed = cs.getNeededResourceTypes(b.id);
          if (needed.length > 0) {
            const rm2 = (this.scene as any).getResourceManager?.();
            const resType = needed.find((t: string) => (rm2.getResource(t) || 0) > 0);
            if (resType) {
              const stock = rm2.getStockpile?.() || { x: survivor.x, y: survivor.y };
              survivor.task = {
                type: 'deliver_build',
                buildingId: b.id,
                resourceType: resType,
                state: 'to_stockpile',
                targetX: stock.x,
                targetY: stock.y,
                amount: 5
              };
              break;
            }
          }
        }
        // if building is completed, finish task
        if (b.status === 'completed') {
          survivor.task = undefined;
        }
        break;
      }

      case 'defend': {
        const fm2 = (this.scene as any).getFactionManager?.();
        if (!fm2) { survivor.task = undefined; break; }
        // Track current enemy position if still exists
        const unitsMap: Map<string, any> = fm2.getFactionUnits?.();
        const unit = unitsMap ? unitsMap.get((survivor.task as DefendTask).enemyUnitId) : undefined;
        if (!unit) { survivor.task = undefined; break; }
        (survivor.task as DefendTask).targetX = unit.x;
        (survivor.task as DefendTask).targetY = unit.y;

        if ((survivor.task as DefendTask).state === 'to_enemy') {
          if (this.moveTowards(survivor, unit.x, unit.y, dt)) {
            (survivor.task as DefendTask).state = 'attacking';
            (survivor.task as DefendTask).timer = 0.8;
            this.playTaskAnim(survivor, 0xe74c3c);
          }
        } else if ((survivor.task as DefendTask).state === 'attacking') {
          (survivor.task as DefendTask).timer = ((survivor.task as DefendTask).timer || 0) - dt;
          // stay close
          this.moveTowards(survivor, unit.x, unit.y, dt);
          if (((survivor.task as DefendTask).timer || 0) <= 0) {
            fm2.damageUnit?.(unit.id, 15);
            (survivor.task as DefendTask).timer = 0.8;
          }
        }
        // If enemy died, clear
        const still = fm2.getFactionUnits?.().get((survivor.task as DefendTask).enemyUnitId);
        if (!still) {
          this.clearTaskAnim(survivor);
          survivor.task = undefined;
        }
        break;
      }

      case 'idle': {
        // light wandering
        this.randomMovement(survivor);
        break;
      }
    }
  }

  private moveTowards(survivor: Survivor, tx: number, ty: number, dt: number): boolean {
    const dx = tx - survivor.x;
    const dy = ty - survivor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= Math.max(2, survivor.speed * dt)) {
      survivor.x = tx; survivor.y = ty;
      survivor.sprite.setPosition(survivor.x, survivor.y);
      survivor.nameLabel.setPosition(survivor.x, survivor.y - 18);
      return true;
    }
    const step = survivor.speed * dt;
    survivor.x += (dx / dist) * step;
    survivor.y += (dy / dist) * step;
    survivor.sprite.setPosition(survivor.x, survivor.y);
    survivor.nameLabel.setPosition(survivor.x, survivor.y - 18);
    return false;
  }

  private playTaskAnim(survivor: Survivor, tint: number) {
    this.scene.tweens.killTweensOf(survivor.sprite);
    survivor.sprite.setTint(tint);
    this.scene.tweens.add({
      targets: survivor.sprite,
      scaleX: 1.6,
      scaleY: 1.6,
      yoyo: true,
      duration: 300,
      repeat: -1
    });
  }

  private clearTaskAnim(survivor: Survivor) {
    survivor.sprite.clearTint();
    survivor.sprite.setScale(1.5);
    this.scene.tweens.killTweensOf(survivor.sprite);
  }

  private findNearestHostile(survivor: Survivor): { id: string; x: number; y: number } | undefined {
    const fm = (this.scene as any).getFactionManager?.();
    if (!fm) return undefined;
    const units: Map<string, any> = fm.getFactionUnits?.();
    const factions: Map<string, any> = fm.getFactions?.();
    if (!units || !factions) return undefined;
    let best: { id: string; x: number; y: number } | undefined;
    let bestD2 = 120 * 120;
    units.forEach((u: any, id: string) => {
      const faction = factions.get(u.faction);
      const hostile = (u.aiState === 'raiding') || (faction && faction.relationshipLevel < 0);
      if (!hostile) return;
      const dx = u.x - survivor.x;
      const dy = u.y - survivor.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = { id, x: u.x, y: u.y };
      }
    });
    return best;
  }

  // Public helper for taking damage
  public damageSurvivor(id: string, amount: number) {
    const s = this.survivors.get(id);
    if (!s) return;

    s.health = Math.max(0, s.health - amount);
    s.mood = this.calculateMood(s.health, s.sanity, s.hunger);
    this.scene.events.emit('survivorDamaged', { survivor: s, damage: amount });

    if (s.health <= 0) {
      this.scene.events.emit('survivorDied', { survivor: s });
      this.removeSurvivor(id);
    } else {
        // flash red
        s.sprite.setTintFill(0xff0000);
        this.scene.time.delayedCall(100, () => {
            // only clear tint if not selected
            if (s.sprite.tintTopLeft === 0xffff00) { // check if it's the selection tint
                // it is selected, do nothing
            } else {
                s.sprite.clearTint();
            }
        });
    }
  }

  private moveTowardsNearestResource(survivor: Survivor, resourceType: string) {
    // Simple movement towards center of map for now
    const targetX = 400;
    const targetY = 300;
    
    const dx = targetX - survivor.x;
    const dy = targetY - survivor.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 5) {
      const speed = 0.5;
      survivor.x += (dx / distance) * speed;
      survivor.y += (dy / distance) * speed;
      survivor.sprite.setPosition(survivor.x, survivor.y);
      survivor.nameLabel.setPosition(survivor.x, survivor.y - 18);
    }
  }

  private randomMovement(survivor: Survivor) {
    if (Math.random() < 0.1) { // 10% chance to move
      const moveDistance = 2;
      const angle = Math.random() * Math.PI * 2;
      
      survivor.x += Math.cos(angle) * moveDistance;
      survivor.y += Math.sin(angle) * moveDistance;
      
      // Keep within bounds
      survivor.x = Math.max(50, Math.min(750, survivor.x));
      survivor.y = Math.max(50, Math.min(550, survivor.y));
      
      survivor.sprite.setPosition(survivor.x, survivor.y);
      survivor.nameLabel.setPosition(survivor.x, survivor.y - 18);
    }
  }

 // Construction helpers
 public findNearestIdleSurvivor(x: number, y: number): string | undefined {
   let nearestId: string | undefined;
   let nearestDist = Number.MAX_VALUE;
   this.survivors.forEach(s => {
     if (!s.task && !s.currentTask) {
       const dx = s.x - x;
       const dy = s.y - y;
       const d2 = dx * dx + dy * dy;
       if (d2 < nearestDist) {
         nearestDist = d2;
         nearestId = s.id;
       }
     }
   });
   return nearestId;
 }

 public recomputeMoods(): void {
   this.survivors.forEach(s => {
     s.mood = this.calculateMood(s.health, s.sanity, s.hunger);
   });
 }

 // Public methods
  getSurvivors(): Map<string, Survivor> {
    return this.survivors;
  }

  getSurvivor(id: string): Survivor | undefined {
    return this.survivors.get(id);
  }

  addSurvivor(name: string, x: number, y: number): Survivor {
    const background = Phaser.Utils.Array.GetRandom(this.survivorBackgrounds);
    return this.createSurvivor(name, background, x, y);
  }

  removeSurvivor(id: string) {
    const survivor = this.survivors.get(id);
    if (survivor) {
      survivor.sprite.destroy();
      if (survivor.nameLabel) {
        survivor.nameLabel.destroy();
      }
      this.survivors.delete(id);
    }
  }

  getSurvivorCount(): number {
    return this.survivors.size;
  }

  public generateWanderer() {
    // Don't generate too many
    if (this.wanderingSurvivors.size >= 5) return;

    const background = Phaser.Utils.Array.GetRandom(this.survivorBackgrounds);
    const name = `Wanderer ${Phaser.Math.Between(100, 999)}`;

    // Create the survivor off-screen and invisible
    const wanderer = this.createSurvivor(name, background, -100, -100, false);
    wanderer.sprite.setVisible(false);

    this.wanderingSurvivors.set(wanderer.id, wanderer);
    console.log(`Generated wanderer: ${name}`);
  }

  public getWanderingSurvivors(): Map<string, Survivor> {
    return this.wanderingSurvivors;
  }

  public recruitWanderer(id: string): boolean {
    const wanderer = this.wanderingSurvivors.get(id);
    if (!wanderer) return false;

    // Remove from wanderers and add to main survivors
    this.wanderingSurvivors.delete(id);
    this.survivors.set(id, wanderer);

    // Make visible and move to stockpile
    const rm = (this.scene as any).getResourceManager();
    const stockpile = rm.getStockpile();
    wanderer.x = stockpile.x + Phaser.Math.Between(-10, 10);
    wanderer.y = stockpile.y + Phaser.Math.Between(-10, 10);
    wanderer.sprite.setPosition(wanderer.x, wanderer.y);
    wanderer.sprite.setVisible(true);
    wanderer.nameLabel.setVisible(true);

    this.scene.events.emit('survivorRecruited', wanderer);
    return true;
  }

  public assignPriorityTask(survivorId: string, task: AITask) {
    const survivor = this.survivors.get(survivorId);
    if (!survivor) return;

    // Clear existing task and any reservations
    if (survivor.task?.type === 'gather') {
      const rm = (this.scene as any).getResourceManager?.();
      rm?.releaseResourceNode?.(survivor.task.nodeId, survivor.id);
    }
    this.clearTaskAnim(survivor);

    survivor.task = task;

    // Visual feedback for the order
    const orderMarker = this.scene.add.ring(survivor.x, survivor.y, 10, 12, 0xffff00, 1);
    orderMarker.setDepth(0);
    this.scene.tweens.add({
        targets: orderMarker,
        radius: 20,
        alpha: 0,
        duration: 400,
        onComplete: () => orderMarker.destroy()
    });
  }
}