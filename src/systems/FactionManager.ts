import Phaser from 'phaser';

export interface Faction {
  id: string;
  name: string;
  description: string;
  color: number;
  relationshipLevel: number; // -100 to 100
  territory: { x: number, y: number, radius: number }[];
  units: FactionUnit[];
  traits: string[];
  resources: { [key: string]: number };
}

export interface FactionUnit {
  id: string;
  name: string;
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  health: number;
  faction: string;
  equipment: string[];
  aiState?: 'idle' | 'patrol' | 'raiding';
}

export class FactionManager {
  private scene: Phaser.Scene;
  private factions: Map<string, Faction> = new Map();
  private factionUnits: Map<string, FactionUnit> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initializeFactions();
  }

  private initializeFactions() {
    // The USDA (United Suburban Defense Agency)
    this.createFaction({
      id: 'usda',
      name: 'USDA',
      description: 'Government remnant obsessed with zoning law and HOA regulations',
      color: 0x2c3e50,
      relationshipLevel: -20,
      territory: [
        { x: 100, y: 100, radius: 80 },
        { x: 500, y: 200, radius: 60 }
      ],
      units: [],
      traits: ['Bureaucratic', 'Well-Armed', 'Authoritarian'],
      resources: { ammunition: 100, fuel: 50, bureaucracy: 200 }
    });

    // The Cult of Grimace
    this.createFaction({
      id: 'grimace_cult',
      name: 'Cult of Grimace',
      description: 'Believes Grimace is a godhead. Their rituals involve nugget offerings.',
      color: 0x8e44ad,
      relationshipLevel: 0,
      territory: [
        { x: 300, y: 400, radius: 100 }
      ],
      units: [],
      traits: ['Fanatical', 'Unpredictable', 'Ritualistic'],
      resources: { nuggets: 150, sauce: 75, faith: 300 }
    });

    // B.U.N.K.E.R.
    this.createFaction({
      id: 'bunker',
      name: 'B.U.N.K.E.R.',
      description: 'Paranoid libertarian survivalists holed up in gas stations.',
      color: 0x27ae60,
      relationshipLevel: 10,
      territory: [
        { x: 600, y: 300, radius: 70 }
      ],
      units: [],
      traits: ['Paranoid', 'Well-Supplied', 'Isolationist'],
      resources: { ammunition: 200, food: 100, fuel: 150 }
    });

    // Neon Youth
    this.createFaction({
      id: 'neon_youth',
      name: 'Neon Youth',
      description: 'Glowstick-wielding anarchists living in rave-based society.',
      color: 0xe74c3c,
      relationshipLevel: 30,
      territory: [
        { x: 200, y: 500, radius: 90 }
      ],
      units: [],
      traits: ['Chaotic', 'Energetic', 'Anti-Authority'],
      resources: { electronics: 80, drugs: 60, music: 200 }
    });

    // The 401K Brigade
    this.createFaction({
      id: 'brigade_401k',
      name: '401K Brigade',
      description: 'Retired suburbanites with military-grade golf carts.',
      color: 0xf39c12,
      relationshipLevel: -10,
      territory: [
        { x: 450, y: 150, radius: 85 }
      ],
      units: [],
      traits: ['Organized', 'Defensive', 'Wealthy'],
      resources: { money: 500, equipment: 120, medicine: 80 }
    });

    // Spawn initial units for each faction
    this.factions.forEach(faction => {
      this.spawnFactionUnits(faction.id, Phaser.Math.Between(2, 5));
    });
  }

  private createFaction(factionData: Faction) {
    this.factions.set(factionData.id, factionData);
  }

  public spawnFactionUnits(factionId: string, count: number) {
    const faction = this.factions.get(factionId);
    if (!faction) return;

    for (let i = 0; i < count; i++) {
      // Pick a random territory to spawn in
      const territory = Phaser.Utils.Array.GetRandom(faction.territory);
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * territory.radius;
      
      const x = territory.x + Math.cos(angle) * distance;
      const y = territory.y + Math.sin(angle) * distance;

      this.createFactionUnit(factionId, x, y);
    }
  }

  private createFactionUnit(factionId: string, x: number, y: number): FactionUnit {
    const faction = this.factions.get(factionId);
    if (!faction) throw new Error(`Faction ${factionId} not found`);

    // Create sprite with faction color
    const sprite = this.scene.add.sprite(x, y, 'tile_concrete');
    sprite.setTint(faction.color);
    sprite.setScale(0.6);
    sprite.setDepth(2); // units above world props
    sprite.setDepth(2); // units above resources/vegetation, below UI

    const unit: FactionUnit = {
      id: Phaser.Utils.String.UUID(),
      name: this.generateUnitName(factionId),
      sprite,
      x,
      y,
      health: 100,
      faction: factionId,
      equipment: this.generateUnitEquipment(factionId),
      aiState: 'patrol'
    };

    this.factionUnits.set(unit.id, unit);
    faction.units.push(unit);

    // Make unit interactive
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => this.selectUnit(unit.id));

    return unit;
  }

  private generateUnitName(factionId: string): string {
    const namesByFaction: { [key: string]: string[] } = {
      usda: ['Agent Smith', 'Inspector Johnson', 'Enforcer Brown', 'Supervisor Davis'],
      grimace_cult: ['Brother Purple', 'Sister Nugget', 'Cultist McFlurry', 'Devotee Shake'],
      bunker: ['Prepper Joe', 'Survivalist Sam', 'Bunker Bob', 'Militia Mike'],
      neon_youth: ['DJ Neon', 'Raver X', 'Glowstick Gary', 'Bass Drop Betty'],
      brigade_401k: ['Retiree Rick', 'Golf Cart Greg', 'Senior Steve', 'Pension Pete']
    };

    const names = namesByFaction[factionId] || ['Generic Unit'];
    return Phaser.Utils.Array.GetRandom(names);
  }

  private generateUnitEquipment(factionId: string): string[] {
    const equipmentByFaction: { [key: string]: string[] } = {
      usda: ['SUV', 'Clipboard', 'Taser', 'HOA Handbook'],
      grimace_cult: ['Purple Robes', 'Nugget Offering', 'Ritual Dagger', 'McFlurry Cup'],
      bunker: ['Assault Rifle', 'Gas Mask', 'MRE', 'Conspiracy Theory Book'],
      neon_youth: ['Glowsticks', 'Boom Box', 'Spray Paint', 'Energy Drinks'],
      brigade_401k: ['Golf Cart', 'Golf Club', 'Retirement Fund', 'Reading Glasses']
    };

    const equipment = equipmentByFaction[factionId] || ['Basic Gear'];
    return [Phaser.Utils.Array.GetRandom(equipment)];
  }

  private selectUnit(unitId: string) {
    const unit = this.factionUnits.get(unitId);
    if (unit) {
      // Highlight selected unit
      unit.sprite.setScale(0.8);
      
      // Reset other units
      this.factionUnits.forEach((other, otherId) => {
        if (otherId !== unitId) {
          other.sprite.setScale(0.6);
        }
      });

      console.log(`Selected: ${unit.name} from ${unit.faction}`);
    }
  }

  update() {
    // Update faction behaviors and relationships
    this.updateFactionRelationships();
    this.updateFactionUnits();
  }

  private updateFactionRelationships() {
    // Slowly change relationships based on events and interactions
    if (Math.random() < 0.001) { // Very rare relationship changes
      this.factions.forEach(faction => {
        // Random relationship drift
        const drift = Phaser.Math.Between(-1, 1);
        faction.relationshipLevel = Math.max(-100, Math.min(100, faction.relationshipLevel + drift));
      });
    }
  }

  private updateFactionUnits() {
    this.factionUnits.forEach(unit => {
      this.updateUnitBehavior(unit);
    });
  }

  private updateUnitBehavior(unit: FactionUnit) {
    const faction = this.factions.get(unit.faction);
    if (!faction) return;

    // If relations are poor, some units flip to raiding
    if ((faction.relationshipLevel ?? 0) < -20 && Math.random() < 0.001) {
      unit.aiState = 'raiding';
    }

    if (unit.aiState === 'raiding') {
      // Move toward player's stockpile/base
      const rm = (this.scene as any).getResourceManager?.();
      const stock = rm?.getStockpile?.();
      if (stock) {
        this.moveUnitTowards(unit, stock.x, stock.y, 1.2);
        // Attempt to harass nearby survivors
        const sm = (this.scene as any).getSurvivorManager?.();
        const survivors: Map<string, any> | undefined = sm?.getSurvivors?.();
        if (survivors) {
          let victimId: string | undefined;
          let bestD2 = 30 * 30;
          survivors.forEach((s: any, id: string) => {
            const dx = s.x - unit.x;
            const dy = s.y - unit.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
              bestD2 = d2;
              victimId = id;
            }
          });
          if (victimId && sm.damageSurvivor) {
            sm.damageSurvivor(victimId, 2); // chip damage
          }
        }
      } else {
        // fallback patrol if no stockpile yet
        this.patrolTerritory(unit, faction);
      }
      return;
    }

    // Patrol/default behaviors
    if (Math.random() < 0.02) { // 2% tick
      if (faction.traits.includes('Paranoid')) {
        this.moveTowardsTerritory(unit, faction);
      } else if (faction.traits.includes('Chaotic')) {
        this.randomMovement(unit);
      } else if (faction.traits.includes('Defensive')) {
        this.patrolTerritory(unit, faction);
      } else {
        this.randomMovement(unit);
      }
    }
  }

  private moveTowardsTerritory(unit: FactionUnit, faction: Faction) {
    if (faction.territory.length === 0) return;

    const territory = faction.territory[0]; // Move towards first territory
    const dx = territory.x - unit.x;
    const dy = territory.y - unit.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > territory.radius) {
      const speed = 1;
      unit.x += (dx / distance) * speed;
      unit.y += (dy / distance) * speed;
      unit.sprite.setPosition(unit.x, unit.y);
    }
  }

  private patrolTerritory(unit: FactionUnit, faction: Faction) {
    if (faction.territory.length === 0) return;
    const territory = faction.territory[0];
    const angle = (Date.now() * 0.001 + parseInt(unit.id, 16) % 360) % (Math.PI * 2);
    const patrolRadius = territory.radius * 0.8;
    unit.x = territory.x + Math.cos(angle) * patrolRadius;
    unit.y = territory.y + Math.sin(angle) * patrolRadius;
    unit.sprite.setPosition(unit.x, unit.y);
  }

  private randomMovement(unit: FactionUnit) {
    const moveDistance = 3;
    const angle = Math.random() * Math.PI * 2;
    unit.x += Math.cos(angle) * moveDistance;
    unit.y += Math.sin(angle) * moveDistance;
    unit.x = Math.max(50, Math.min(750, unit.x));
    unit.y = Math.max(50, Math.min(550, unit.y));
    unit.sprite.setPosition(unit.x, unit.y);
  }

  private moveUnitTowards(unit: FactionUnit, tx: number, ty: number, speed: number) {
    const dx = tx - unit.x;
    const dy = ty - unit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    unit.x += (dx / dist) * speed;
    unit.y += (dy / dist) * speed;
    unit.sprite.setPosition(unit.x, unit.y);
  }

  // Public methods
  getFactions(): Map<string, Faction> {
    return this.factions;
  }

  damageUnit(unitId: string, amount: number) {
    const unit = this.factionUnits.get(unitId);
    if (!unit) return;

    unit.health = Math.max(0, unit.health - amount);
    this.scene.events.emit('unitDamaged', { unit, damage: amount });

    if (unit.health <= 0) {
      this.scene.events.emit('unitDied', { unit });
      unit.sprite.destroy();
      this.factionUnits.delete(unitId);
      // also remove from owning faction list
      const faction = this.factions.get(unit.faction);
      if (faction) {
        faction.units = faction.units.filter(u => u.id !== unitId);
      }
    } else {
        // flash red
        unit.sprite.setTintFill(0xff0000);
        this.scene.time.delayedCall(100, () => unit.sprite.clearTint());
    }
  }

  // Spawn a focused raid towards the player's base
  spawnRaid(factionId: string, count: number) {
    this.spawnFactionUnits(factionId, count);
    // Mark new units to raiding
    const faction = this.factions.get(factionId);
    if (!faction) return;
    faction.units.slice(-count).forEach(u => {
      u.aiState = 'raiding';
    });
  }

  getFaction(id: string): Faction | undefined {
    return this.factions.get(id);
  }

  getFactionUnits(): Map<string, FactionUnit> {
    return this.factionUnits;
  }

  getRelationshipLevel(factionId: string): number {
    const faction = this.factions.get(factionId);
    return faction ? faction.relationshipLevel : 0;
  }

  modifyRelationship(factionId: string, change: number) {
    const faction = this.factions.get(factionId);
    if (faction) {
      faction.relationshipLevel = Math.max(-100, Math.min(100, faction.relationshipLevel + change));
    }
  }

  isInFactionTerritory(x: number, y: number, factionId: string): boolean {
    const faction = this.factions.get(factionId);
    if (!faction) return false;

    return faction.territory.some(territory => {
      const distance = Math.sqrt((x - territory.x) ** 2 + (y - territory.y) ** 2);
      return distance <= territory.radius;
    });
  }
}