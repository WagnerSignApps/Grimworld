import Phaser from 'phaser';
import { ResourceManager } from './ResourceManager';

export interface ResearchProject {
  id: string;
  name: string;
  description: string;
  cost: { [resourceType: string]: number };
  researchTime: number; // in seconds
  unlocks: { type: 'recipe'; id: string }[];
  dependencies: string[]; // IDs of other research projects required
}

export type ResearchStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export class ResearchSystem {
  private scene: Phaser.Scene;
  private resourceManager: ResourceManager;
  private projects: Map<string, ResearchProject> = new Map();
  private projectStatus: Map<string, ResearchStatus> = new Map();
  private completedUnlocks: Set<string> = new Set();

  private activeResearchId?: string;
  private researchProgress: number = 0;

  public events: Phaser.Events.EventEmitter;

  constructor(scene: Phaser.Scene, resourceManager: ResourceManager) {
    this.scene = scene;
    this.resourceManager = resourceManager;
    this.events = new Phaser.Events.EventEmitter();
    this.initializeProjects();
    this.updateAllProjectStatuses();
  }

  private initializeProjects() {
    const projects: ResearchProject[] = [
      {
        id: 'basic_defense',
        name: 'Basic Defense',
        description: 'Understand the fundamentals of suburban fortification. Unlocks Chain Link Fences.',
        cost: { scrap: 20, wood: 15 },
        researchTime: 60,
        unlocks: [{ type: 'recipe', id: 'chain_link_fence' }],
        dependencies: []
      },
      {
        id: 'advanced_defense',
        name: 'Advanced Defense',
        description: 'Use modern materials for superior protection. Unlocks Pool Moats.',
        cost: { plastic: 50, concrete: 30 },
        researchTime: 120,
        unlocks: [{ type: 'recipe', id: 'pool_moat' }],
        dependencies: ['basic_defense']
      },
      {
        id: 'tinkering_101',
        name: 'Tinkering 101',
        description: 'Learn to repurpose household electronics. Unlocks Security Cameras.',
        cost: { electronics: 30, plastic: 20 },
        researchTime: 90,
        unlocks: [{ type: 'recipe', id: 'security_camera' }],
        dependencies: []
      },
      {
        id: 'power_generation',
        name: 'Power Generation',
        description: 'Harness the latent energy in fast-food byproducts. Unlocks the Fryer-Powered Generator.',
        cost: { scrap: 40, electronics: 25, sauce: 50 },
        researchTime: 180,
        unlocks: [{ type: 'recipe', id: 'fryer_generator' }],
        dependencies: ['tinkering_101']
      },
      {
        id: 'food_science',
        name: 'Grim Food Science',
        description: 'Investigate the strange biology of the Nugget. Unlocks Nugget Farms.',
        cost: { nuggets: 100, sauce: 50, electronics: 30 },
        researchTime: 240,
        unlocks: [{ type: 'recipe', id: 'nugget_farm' }],
        dependencies: []
      },
    ];

    projects.forEach(p => {
      this.projects.set(p.id, p);
      this.projectStatus.set(p.id, 'locked');
    });
  }

  private updateAllProjectStatuses() {
    this.projects.forEach(p => {
        if (this.projectStatus.get(p.id) === 'completed') return;

        const depsMet = p.dependencies.every(depId => this.projectStatus.get(depId) === 'completed');
        if (depsMet) {
            this.projectStatus.set(p.id, 'available');
        } else {
            this.projectStatus.set(p.id, 'locked');
        }
    });
  }

  canStartResearch(projectId: string): boolean {
    const project = this.projects.get(projectId);
    if (!project || this.projectStatus.get(projectId) !== 'available' || this.activeResearchId) {
      return false;
    }

    for (const [resource, amount] of Object.entries(project.cost)) {
      if (!this.resourceManager.hasResource(resource, amount)) {
        return false;
      }
    }
    return true;
  }

  startResearch(projectId: string): boolean {
    if (!this.canStartResearch(projectId)) {
      return false;
    }

    const project = this.projects.get(projectId)!;
    for (const [resource, amount] of Object.entries(project.cost)) {
      this.resourceManager.removeResource(resource, amount);
    }

    this.activeResearchId = projectId;
    this.researchProgress = 0;
    this.projectStatus.set(projectId, 'in_progress');
    this.events.emit('researchStarted', project);
    return true;
  }

  update(delta: number) {
    if (!this.activeResearchId) return;

    const gameClock = (this.scene as any).getGameClock();
    if (!gameClock || gameClock.getTimeScale() === 0) return;

    // Progress is based on game time, not real time
    this.researchProgress += (delta / 1000) * gameClock.getTimeScale();

    const project = this.projects.get(this.activeResearchId)!;
    if (this.researchProgress >= project.researchTime) {
      this.completeResearch(this.activeResearchId);
    }
  }

  private completeResearch(projectId: string) {
    const project = this.projects.get(projectId)!;

    this.projectStatus.set(projectId, 'completed');
    project.unlocks.forEach(unlock => this.completedUnlocks.add(unlock.id));

    const completedProjectId = this.activeResearchId;
    this.activeResearchId = undefined;
    this.researchProgress = 0;

    this.updateAllProjectStatuses(); // Update availability of other projects
    this.events.emit('researchCompleted', project);
    console.log(`Research completed: ${project.name}`);
  }

  isUnlocked(recipeId: string): boolean {
    return this.completedUnlocks.has(recipeId);
  }

  getProjects(): Map<string, ResearchProject> {
    return this.projects;
  }

  getProjectStatus(projectId: string): ResearchStatus | undefined {
    return this.projectStatus.get(projectId);
  }

  getActiveResearch(): { project?: ResearchProject, progress: number } {
    if (!this.activeResearchId) return { progress: 0 };
    const project = this.projects.get(this.activeResearchId);
    const progress = this.researchProgress / (project?.researchTime || 1);
    return { project, progress: Math.min(1, progress) };
  }
}
