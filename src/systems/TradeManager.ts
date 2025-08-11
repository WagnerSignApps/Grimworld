import Phaser from 'phaser';
import { ResourceManager } from './ResourceManager';

export interface Trader {
  name: string;
  type: 'FactionEmissary' | 'ShadyDealer' | 'SuburbanMom';
  // An inventory of what they have to trade. Key: resourceId, Value: amount.
  inventory: Map<string, number>;
  // A map of value modifiers. > 1 means they pay more, < 1 means they pay less.
  valueModifiers: Map<string, number>;
  scamChance: number; // 0 to 1
  bonusChance: number; // 0 to 1
}

export class TradeManager {
  private scene: Phaser.Scene;
  private resourceManager: ResourceManager;

  public currentTrader: Trader | null = null;
  public events: Phaser.Events.EventEmitter;

  constructor(scene: Phaser.Scene, resourceManager: ResourceManager) {
    this.scene = scene;
    this.resourceManager = resourceManager;
    this.events = new Phaser.Events.EventEmitter();
  }

  public generateTrader() {
    const traderTypes: Omit<Trader, 'name' | 'inventory'>[] = [
        { type: 'ShadyDealer', valueModifiers: new Map([['electronics', 1.5], ['sauce', 1.2], ['nuggets', 0.5]]), scamChance: 0.2, bonusChance: 0.05 },
        { type: 'FactionEmissary', valueModifiers: new Map([['scrap', 1.2], ['fabric', 1.1], ['fuel', 0.8]]), scamChance: 0.05, bonusChance: 0.1 },
        { type: 'SuburbanMom', valueModifiers: new Map([['nuggets', 1.3], ['fabric', 1.2], ['electronics', 0.6]]), scamChance: 0.1, bonusChance: 0.15 },
    ];

    const traderTemplate = Phaser.Utils.Array.GetRandom(traderTypes);
    const name = `${traderTemplate.type} ${Phaser.Math.Between(100, 999)}`;

    const inventory = new Map<string, number>();
    const allResources = Array.from(this.resourceManager.getAllResourceTypes().keys());
    for (let i = 0; i < 5; i++) {
        const resource = Phaser.Utils.Array.GetRandom(allResources);
        inventory.set(resource, Phaser.Math.Between(20, 100));
    }

    this.currentTrader = {
        name,
        ...traderTemplate,
        inventory
    };

    this.events.emit('traderArrived', this.currentTrader);
    console.log(`Trader arrived: ${this.currentTrader.name}`);

    // Set a timer for the trader to leave
    this.scene.time.delayedCall(180000, () => { // Trader leaves after 3 minutes
        this.dismissTrader();
    });
  }

  public dismissTrader() {
      if (this.currentTrader) {
        this.events.emit('traderLeft', this.currentTrader);
        console.log(`Trader left: ${this.currentTrader.name}`);
        this.currentTrader = null;
      }
  }

  public executeTrade(playerGives: Map<string, number>, playerReceives: Map<string, number>): boolean {
    if (!this.currentTrader) return false;

    // Check if player can afford to give
    for (const [resource, amount] of playerGives.entries()) {
        if (!this.resourceManager.hasResource(resource, amount)) return false;
    }
    // Check if trader can afford to give
    for (const [resource, amount] of playerReceives.entries()) {
        if ((this.currentTrader.inventory.get(resource) || 0) < amount) return false;
    }

    // Perform the transaction
    playerGives.forEach((amount, resource) => this.resourceManager.removeResource(resource, amount));
    playerReceives.forEach((amount, resource) => this.resourceManager.addResource(resource, amount));

    // Handle trader inventory change
    playerGives.forEach((amount, resource) => this.currentTrader!.inventory.set(resource, (this.currentTrader!.inventory.get(resource) || 0) + amount));
    playerReceives.forEach((amount, resource) => this.currentTrader!.inventory.set(resource, this.currentTrader!.inventory.get(resource)! - amount));

    // Handle random events
    if (Math.random() < this.currentTrader.scamChance) {
        // SCAM! Take back some of what the player received.
        const [scammedResource, scammedAmount] = Array.from(playerReceives.entries())[0];
        const amountToTake = Math.floor(scammedAmount * 0.5);
        this.resourceManager.removeResource(scammedResource, amountToTake);
        this.events.emit('tradeScam', { trader: this.currentTrader, resource: scammedResource, amount: amountToTake });
    } else if (Math.random() < this.currentTrader.bonusChance) {
        // BONUS! Give some extra stuff.
        const [bonusResource, bonusAmount] = Array.from(this.currentTrader.inventory.entries())[0];
        const amountToGive = Math.floor(bonusAmount * 0.1);
        if (this.currentTrader.inventory.get(bonusResource)! >= amountToGive) {
            this.resourceManager.addResource(bonusResource, amountToGive);
            this.currentTrader.inventory.set(bonusResource, this.currentTrader.inventory.get(bonusResource)! - amountToGive);
            this.events.emit('tradeBonus', { trader: this.currentTrader, resource: bonusResource, amount: amountToGive });
        }
    }

    this.events.emit('tradeCompleted', { playerGives, playerReceives });
    return true;
  }

  public getResourceBaseValue(resourceId: string): number {
      // For simplicity, all resources have a base value of 1.
      // The trader's value modifiers change the effective price.
      return 1;
  }

  public getTraderValue(resourceId: string): number {
      if (!this.currentTrader) return 1;
      const baseValue = this.getResourceBaseValue(resourceId);
      const modifier = this.currentTrader.valueModifiers.get(resourceId) || 1;
      return baseValue * modifier;
  }
}
