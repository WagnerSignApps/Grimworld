import Phaser from 'phaser';

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  type: 'conspiracy' | 'faction' | 'resource' | 'survivor' | 'weather' | 'special';
  severity: 'minor' | 'major' | 'critical';
  effects: EventEffect[];
  choices?: EventChoice[];
  duration?: number; // in milliseconds
  triggerConditions?: string[];
}

export interface EventEffect {
  type: 'resource' | 'relationship' | 'survivor_stat' | 'conspiracy_heat' | 'spawn_unit' | 'spawn_raid';
  target?: string;
  value: number;
  description: string;
}

export interface EventChoice {
  text: string;
  effects: EventEffect[];
  requirements?: string[];
}

export class EventManager {
  private scene: Phaser.Scene;
  private activeEvents: Map<string, GameEvent> = new Map();
  private eventHistory: GameEvent[] = [];
  private conspiracyHeat: number = 0;
  private eventPool: GameEvent[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initializeEventPool();
  }

  private initializeEventPool() {
    this.eventPool = [
      // Conspiracy Events
      {
        id: 'microwave_tower_activation',
        title: '5G Tower Activation',
        description: 'A nearby microwave tower begins emitting strange signals. Survivors report headaches and paranoid thoughts.',
        type: 'conspiracy',
        severity: 'major',
        effects: [
          { type: 'conspiracy_heat', value: 25, description: 'Conspiracy heat increases' },
          { type: 'survivor_stat', target: 'sanity', value: -15, description: 'All survivors lose sanity' }
        ],
        choices: [
          {
            text: 'Investigate the tower',
            effects: [
              { type: 'conspiracy_heat', value: 10, description: 'More conspiracy heat' },
              { type: 'resource', target: 'scrap', value: 20, description: 'Find electronic components' }
            ]
          },
          {
            text: 'Build signal jammers',
            effects: [
              { type: 'resource', target: 'scrap', value: -30, description: 'Use scrap materials' },
              { type: 'survivor_stat', target: 'sanity', value: 10, description: 'Survivors feel safer' }
            ],
            requirements: ['scrap >= 30']
          },
          {
            text: 'Ignore it',
            effects: [
              { type: 'survivor_stat', target: 'sanity', value: -5, description: 'Ongoing mental effects' }
            ]
          }
        ]
      },
      {
        id: 'hoa_inspection',
        title: 'HOA Annual Inspection',
        description: 'The USDA arrives for a "routine" HOA compliance check. They seem very interested in your colony setup.',
        type: 'faction',
        severity: 'major',
        effects: [
          { type: 'relationship', target: 'usda', value: -10, description: 'USDA becomes more suspicious' }
        ],
        choices: [
          {
            text: 'Comply with all regulations',
            effects: [
              { type: 'relationship', target: 'usda', value: 5, description: 'USDA approval' },
              { type: 'resource', target: 'nuggets', value: -20, description: 'Compliance costs' }
            ]
          },
          {
            text: 'Bribe the inspector',
            effects: [
              { type: 'resource', target: 'sauce', value: -15, description: 'Bribe payment' },
              { type: 'conspiracy_heat', value: -10, description: 'Reduced suspicion' }
            ],
            requirements: ['sauce >= 15']
          },
          {
            text: 'Refuse entry',
            effects: [
              { type: 'relationship', target: 'usda', value: -25, description: 'USDA hostility' },
              { type: 'conspiracy_heat', value: 30, description: 'Marked as non-compliant' }
            ]
          }
        ]
      },
      {
        id: 'grimace_procession',
        title: 'Grimace Cult Procession',
        description: 'Purple-robed cultists march through the area, chanting about the "Great Purple One" and offering nuggets to passersby.',
        type: 'faction',
        severity: 'minor',
        effects: [
          { type: 'relationship', target: 'grimace_cult', value: 5, description: 'Cult notices your colony' },
          { type: 'spawn_unit', target: 'grimace_cult', value: 1, description: 'A Grimace priest appears nearby' }
        ],
        choices: [
          {
            text: 'Join the procession',
            effects: [
              { type: 'relationship', target: 'grimace_cult', value: 20, description: 'Cult approval' },
              { type: 'resource', target: 'nuggets', value: 10, description: 'Receive blessed nuggets' },
              { type: 'survivor_stat', target: 'sanity', value: -5, description: 'Disturbing experience' }
            ]
          },
          {
            text: 'Accept their offerings',
            effects: [
              { type: 'resource', target: 'nuggets', value: 15, description: 'Free nuggets' },
              { type: 'relationship', target: 'grimace_cult', value: 10, description: 'Friendly gesture' }
            ]
          },
          {
            text: 'Hide from them',
            effects: [
              { type: 'conspiracy_heat', value: -5, description: 'Avoid attention' }
            ]
          }
        ]
      },
      {
        id: 'food_shortage',
        title: 'McRonald\'s Supply Shortage',
        description: 'The local McRonald\'s depot has run out of nuggets. Survivors are getting hungry and desperate.',
        type: 'resource',
        severity: 'major',
        effects: [
          { type: 'resource', target: 'nuggets', value: -30, description: 'Food supplies dwindle' },
          { type: 'survivor_stat', target: 'hunger', value: 20, description: 'Survivors get hungrier' }
        ],
        choices: [
          {
            text: 'Raid the depot',
            effects: [
              { type: 'resource', target: 'nuggets', value: 50, description: 'Acquire emergency supplies' },
              { type: 'conspiracy_heat', value: 15, description: 'Criminal activity noticed' },
              { type: 'relationship', target: 'usda', value: -15, description: 'Law enforcement response' }
            ]
          },
          {
            text: 'Trade with other factions',
            effects: [
              { type: 'resource', target: 'scrap', value: -25, description: 'Trade materials' },
              { type: 'resource', target: 'nuggets', value: 20, description: 'Acquire food' },
              { type: 'relationship', target: 'bunker', value: 5, description: 'Trading relationship' }
            ],
            requirements: ['scrap >= 25']
          },
          {
            text: 'Ration existing supplies',
            effects: [
              { type: 'survivor_stat', target: 'sanity', value: -10, description: 'Morale drops' },
              { type: 'survivor_stat', target: 'hunger', value: 10, description: 'Controlled hunger' }
            ]
          }
        ]
      },
      {
        id: 'black_helicopter',
        title: 'Black Helicopter Flyover',
        description: 'Unmarked black helicopters circle overhead. Are they surveilling your colony, or is it just routine patrol?',
        type: 'conspiracy',
        severity: 'minor',
        effects: [
          { type: 'conspiracy_heat', value: 15, description: 'Government attention' },
          { type: 'survivor_stat', target: 'sanity', value: -8, description: 'Paranoia increases' },
          { type: 'spawn_raid', target: 'usda', value: 2, description: 'USDA agents investigate your area' }
        ],
        choices: [
          {
            text: 'Wave at them',
            effects: [
              { type: 'conspiracy_heat', value: -5, description: 'Appear innocent' },
              { type: 'survivor_stat', target: 'sanity', value: 5, description: 'Defiant humor' }
            ]
          },
          {
            text: 'Take cover',
            effects: [
              { type: 'conspiracy_heat', value: 5, description: 'Suspicious behavior' },
              { type: 'survivor_stat', target: 'sanity', value: -3, description: 'Increased fear' }
            ]
          },
          {
            text: 'Document everything',
            effects: [
              { type: 'conspiracy_heat', value: 10, description: 'Evidence gathering noticed' },
              { type: 'resource', target: 'information', value: 5, description: 'Gather intelligence' }
            ]
          }
        ]
      },
      {
        id: 'fast_food_blizzard',
        title: 'McFlurry Storm',
        description: 'A mysterious weather phenomenon covers the area in purple ice cream and broken dreams. The Grimace Cult sees this as a sign.',
        type: 'weather',
        severity: 'critical',
        effects: [
          { type: 'resource', target: 'sauce', value: 30, description: 'Collect fallen sauce' },
          { type: 'relationship', target: 'grimace_cult', value: 15, description: 'Cult sees divine intervention' },
          { type: 'survivor_stat', target: 'sanity', value: -20, description: 'Surreal experience' }
        ],
        duration: 60000 // 1 minute
      },
      {
        id: 'neon_youth_rave',
        title: 'Underground Rave',
        description: 'The Neon Youth are throwing a massive rave in the abandoned Chuck E. Cheese. The bass is shaking the ground.',
        type: 'faction',
        severity: 'minor',
        effects: [
          { type: 'relationship', target: 'neon_youth', value: 10, description: 'Party invitation' }
        ],
        choices: [
          {
            text: 'Join the rave',
            effects: [
              { type: 'relationship', target: 'neon_youth', value: 25, description: 'Party with the youth' },
              { type: 'survivor_stat', target: 'sanity', value: 15, description: 'Stress relief' },
              { type: 'survivor_stat', target: 'hunger', value: 10, description: 'Party snacks' }
            ]
          },
          {
            text: 'Complain about the noise',
            effects: [
              { type: 'relationship', target: 'neon_youth', value: -15, description: 'Buzzkill reputation' },
              { type: 'relationship', target: 'brigade_401k', value: 10, description: 'Retirees approve' }
            ]
          },
          {
            text: 'Ignore it',
            effects: [
              { type: 'survivor_stat', target: 'sanity', value: -5, description: 'Sleep deprivation' }
            ]
          }
        ]
      },
      {
        id: 'usda_raid',
        title: 'USDA Zoning Raid',
        description: 'The USDA has flagged your settlement for numerous violations. An enforcement team has been dispatched!',
        type: 'faction',
        severity: 'critical',
        effects: [
            { type: 'spawn_raid', target: 'usda', value: 3, description: 'A USDA enforcement team is raiding your base.' },
            { type: 'relationship', target: 'usda', value: -20, description: ''}
        ],
        triggerConditions: ['conspiracy_heat >= 50']
      }
    ];
  }

  triggerRandomEvent() {
    // Filter events based on current conditions
    const availableEvents = this.eventPool.filter(event => 
      this.checkEventConditions(event)
    );

    if (availableEvents.length === 0) return;

    const event = Phaser.Utils.Array.GetRandom(availableEvents);
    this.triggerEvent(event);
  }

  triggerEvent(event: GameEvent) {
    // Create a copy to avoid modifying the original
    const eventInstance: GameEvent = {
      ...event,
      id: event.id + '_' + Date.now()
    };

    this.activeEvents.set(eventInstance.id, eventInstance);
    this.eventHistory.push(eventInstance);

    // Apply immediate effects
    this.applyEventEffects(eventInstance.effects);

    // Show event in UI (would need UI scene reference)
    this.displayEvent(eventInstance);

    // Set up duration timer if specified
    if (eventInstance.duration) {
      this.scene.time.delayedCall(eventInstance.duration, () => {
        this.resolveEvent(eventInstance.id);
      });
    }
  }

  private checkEventConditions(event: GameEvent): boolean {
    if (!event.triggerConditions) return true;

    // Check various conditions
    for (const condition of event.triggerConditions) {
      if (condition.includes('conspiracy_heat')) {
        const threshold = parseInt(condition.split('>=')[1] || condition.split('<=')[1] || '0');
        if (condition.includes('>=') && this.conspiracyHeat < threshold) return false;
        if (condition.includes('<=') && this.conspiracyHeat > threshold) return false;
      }
      // Add more condition checks as needed
    }

    return true;
  }

  private applyEventEffects(effects: EventEffect[]) {
    const rm = (this.scene as any).getResourceManager?.();
    const fm = (this.scene as any).getFactionManager?.();
    const sm = (this.scene as any).getSurvivorManager?.();
    const uiScene = this.scene.scene.get('UIScene') as any;

    effects.forEach(effect => {
      switch (effect.type) {
        case 'conspiracy_heat': {
          this.conspiracyHeat = Math.max(0, Math.min(100, this.conspiracyHeat + effect.value));
          if (uiScene && uiScene.updateConspiracyLevel) {
            uiScene.updateConspiracyLevel(this.conspiracyHeat);
          }
          break;
        }
        case 'resource': {
          if (rm && effect.target) {
            if (effect.value >= 0) {
              rm.addResource(effect.target, effect.value);
            } else {
              rm.removeResource(effect.target, Math.abs(effect.value));
            }
            // Keep UI in sync immediately
            if (uiScene && uiScene.updateResources) {
              uiScene.updateResources(rm.getAllResources());
            }
          } else {
            console.log(`Resource ${effect.target}: ${effect.value > 0 ? '+' : ''}${effect.value}`);
          }
          break;
        }
        case 'relationship': {
          if (fm && effect.target) {
            fm.modifyRelationship(effect.target, effect.value);
          } else {
            console.log(`Faction ${effect.target} relationship: ${effect.value > 0 ? '+' : ''}${effect.value}`);
          }
          break;
        }
        case 'survivor_stat': {
          if (sm && effect.target) {
            const smAny = sm as any;
            const survivorsMap: Map<string, any> | undefined = smAny.getSurvivors?.();
            if (survivorsMap && survivorsMap.forEach) {
              survivorsMap.forEach((s: any) => {
                if (effect.target === 'sanity') {
                  s.sanity = Math.max(0, Math.min(100, s.sanity + effect.value));
                } else if (effect.target === 'hunger') {
                  s.hunger = Math.max(0, Math.min(100, s.hunger + effect.value));
                } else if (effect.target === 'health') {
                  s.health = Math.max(0, Math.min(100, s.health + effect.value));
                }
                if (typeof smAny.calculateMood === 'function') {
                  s.mood = smAny.calculateMood(s.health, s.sanity, s.hunger);
                }
              });
            }
          } else {
            console.log(`Survivor ${effect.target}: ${effect.value > 0 ? '+' : ''}${effect.value}`);
          }
          break;
        }
        case 'spawn_unit': {
          if (fm && effect.target && (fm as any).spawnFactionUnits) {
            (fm as any).spawnFactionUnits(effect.target, Math.max(1, effect.value || 1));
          }
          break;
        }
        case 'spawn_raid': {
          if (fm && effect.target && (fm as any).spawnRaid) {
            (fm as any).spawnRaid(effect.target, Math.max(1, effect.value || 1));
          } else if (fm && effect.target && (fm as any).spawnFactionUnits) {
            // Fallback: spawn units and they may flip to raiding by relationship logic
            (fm as any).spawnFactionUnits(effect.target, Math.max(1, effect.value || 1));
          }
          break;
        }
      }
    });
  }

  private displayEvent(event: GameEvent) {
    // This would integrate with the UI system
    console.log(`EVENT: ${event.title}`);
    console.log(event.description);
    
    if (event.choices) {
      console.log('Choices:');
      event.choices.forEach((choice, index) => {
        console.log(`${index + 1}. ${choice.text}`);
      });
    }

    // Update UI scene if available
    const uiScene = this.scene.scene.get('UIScene') as any;
    if (uiScene && uiScene.addEventLogEntry) {
      uiScene.addEventLogEntry(event.title);
    }
  }

  makeEventChoice(eventId: string, choiceIndex: number) {
    const event = this.activeEvents.get(eventId);
    if (!event || !event.choices || choiceIndex >= event.choices.length) return;

    const choice = event.choices[choiceIndex];
    
    // Check requirements
    if (choice.requirements) {
      const canChoose = choice.requirements.every(req => this.checkRequirement(req));
      if (!canChoose) {
        console.log('Requirements not met for this choice');
        return;
      }
    }

    // Apply choice effects
    this.applyEventEffects(choice.effects);

    // Remove event from active events
    this.resolveEvent(eventId);
  }

  private checkRequirement(requirement: string): boolean {
    // Simple requirement checking - would need resource manager integration
    if (requirement.includes('>=')) {
      const [resource, value] = requirement.split(' >= ');
      // Would check actual resource values here
      return true; // Placeholder
    }
    return true;
  }

  private resolveEvent(eventId: string) {
    this.activeEvents.delete(eventId);
  }

  update() {
    // Update conspiracy heat effects
    this.updateConspiracyEffects();
    
    // Random event triggering
    if (Math.random() < 0.0005) { // 0.05% chance per frame
      this.triggerRandomEvent();
    }
  }

  private updateConspiracyEffects() {
    // Update UI conspiracy meter
    const uiScene = this.scene.scene.get('UIScene') as any;
    if (uiScene && uiScene.updateConspiracyLevel) {
      uiScene.updateConspiracyLevel(this.conspiracyHeat);
    }

    // Apply conspiracy heat effects
    if (this.conspiracyHeat > 75) {
      if (Math.random() < 0.002) { // Increased chance for major event
        this.triggerSpecificEvent('usda_raid');
      }
    }
    else if (this.conspiracyHeat > 50) {
      // High conspiracy heat - more government attention
      if (Math.random() < 0.001) {
        this.triggerSpecificEvent('hoa_inspection');
      }
    }
  }

  triggerSpecificEvent(eventId: string) {
    const event = this.eventPool.find(e => e.id === eventId);
    if (event) {
      this.triggerEvent(event);
    }
  }

  // Public methods
  getConspiracyHeat(): number {
    return this.conspiracyHeat;
  }

  setConspiracyHeat(value: number) {
    this.conspiracyHeat = Math.max(0, Math.min(100, value));
  }

  getActiveEvents(): Map<string, GameEvent> {
    return this.activeEvents;
  }

  getEventHistory(): GameEvent[] {
    return this.eventHistory;
  }
}