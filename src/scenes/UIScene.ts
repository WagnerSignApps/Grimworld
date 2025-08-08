import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
  // Panels
  private topPanelBg!: Phaser.GameObjects.Rectangle;
  private bottomPanelBg!: Phaser.GameObjects.Rectangle;
  private sidePanelBg!: Phaser.GameObjects.Rectangle;

  // Resources UI
  private resourceTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private resourceOrder = ['nuggets', 'sauce', 'scrap', 'electronics', 'plastic', 'fabric', 'concrete', 'fuel', 'wood'];

  // Conspiracy UI
  private conspiracyMeter!: Phaser.GameObjects.Rectangle;
  private conspiracyText!: Phaser.GameObjects.Text;
  private currentConspiracyLevel: number = 0;

  // Survivors UI
  private survivorPanel!: Phaser.GameObjects.Container;
  private survivorListContainer!: Phaser.GameObjects.Container;
  private survivorMask!: Phaser.Display.Masks.GeometryMask;
  private survivorMaskGfx!: Phaser.GameObjects.Graphics;

  // Event log
  private eventLogContainer!: Phaser.GameObjects.Container;
  private eventEntries: Phaser.GameObjects.Text[] = [];
  private eventLogMask!: Phaser.Display.Masks.GeometryMask;
  private eventMaskGfx!: Phaser.GameObjects.Graphics;
  private eventScrollOffset: number = 0;

  // Tooltips
  private tooltipBg!: Phaser.GameObjects.Rectangle;
  private tooltipText!: Phaser.GameObjects.Text;

  // Build progress overlays (drawn in UI scene projected from world)
  private buildBarsContainer!: Phaser.GameObjects.Container;

  // Styles
  private readonly uiBgColor = 0x2c3e50;
  private readonly uiStrokeColor = 0x34495e;
  private readonly panelAlpha = 0.92;
  private readonly fontFamily = 'Courier New, monospace';

  constructor() {
    super({ key: 'UIScene' });
  }

  create() {
    const cam = this.cameras.main;
    cam.roundPixels = true;

    const { width, height } = cam;

    // Panels and sections
    this.createTopPanel(width, height);
    this.createBottomPanel(width, height);
    this.createSidePanel(width, height);
    this.createConspiracyMeter(width, height);
    this.createEventLog(width, height);
    this.createTooltip();

    // Build overlays
    this.buildBarsContainer = this.add.container(0, 0).setDepth(1000);

    // Timers to refresh dynamic UI
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.refreshSurvivors() });
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.refreshBuildBars() });

    // Resize handling for responsive layout
    this.scale.on('resize', (gameSize: any) => {
      this.relayout(gameSize.width, gameSize.height);
    });

    // Initial log
    this.addEventLogEntry('Colony established in suburban wasteland...');
    this.addEventLogEntry('The HOA is watching...');
  }

  private createTopPanel(width: number, height: number) {
    // Backing panel with strong contrast
    this.topPanelBg = this.add.rectangle(width / 2, 30, width, 64, this.uiBgColor, this.panelAlpha)
      .setStrokeStyle(2, this.uiStrokeColor)
      .setDepth(100);

    // Header
    this.add.text(16, 12, 'RESOURCES', {
      fontSize: '14px',
      color: '#ecf0f1',
      fontFamily: this.fontFamily
    }).setDepth(110);

    // Horizontal resource layout
    let x = 120;
    const spacing = 90;
    this.resourceOrder.forEach((resource) => {
      const txt = this.add.text(x, 14, `${this.pretty(resource)}: 0`, {
        fontSize: '11px',
        color: '#bdc3c7',
        fontFamily: this.fontFamily
      }).setDepth(110).setName(`resource_${resource}`).setInteractive({ useHandCursor: true });
      txt.on('pointerover', (p: Phaser.Input.Pointer) => this.showResourceTooltip(resource, p.x, p.y));
      txt.on('pointerout', () => this.hideTooltip());
      this.resourceTexts.set(resource, txt);
      x += spacing;
    });

    // Date/time placeholder (static for now)
    this.add.text(width - 16, 12, 'Day 1 - 08:00', {
      fontSize: '12px',
      color: '#bdc3c7',
      fontFamily: this.fontFamily
    }).setOrigin(1, 0).setDepth(110);
  }

  private createBottomPanel(width: number, height: number) {
    // Bottom action panel
    this.bottomPanelBg = this.add.rectangle(width / 2, height - 40, width, 84, this.uiBgColor, this.panelAlpha)
      .setStrokeStyle(2, this.uiStrokeColor)
      .setDepth(100);

    // Action buttons
    const buttons = [
      { text: 'BUILD', x: 80, color: '#27ae60', action: 'build' },
      { text: 'RESEARCH', x: 180, color: '#8e44ad', action: 'research' },
      { text: 'RECRUIT', x: 280, color: '#2980b9', action: 'recruit' },
      { text: 'TRADE', x: 380, color: '#f39c12', action: 'trade' },
      { text: 'DEFEND', x: 480, color: '#e74c3c', action: 'defend' }
    ];

    buttons.forEach(button => {
      const colorInt = parseInt(button.color.replace('#', '0x'));
      const btn = this.add.rectangle(button.x, height - 40, 90, 32, 0x233242, 0.95)
        .setStrokeStyle(1, colorInt)
        .setInteractive({ useHandCursor: true })
        .setDepth(110)
        .on('pointerover', () => btn.setFillStyle(0x2d3f50, 0.95))
        .on('pointerout', () => btn.setFillStyle(0x233242, 0.95))
        .on('pointerdown', () => {
          btn.setFillStyle(0x1a2833, 0.95);
          this.handleActionButton(button.action);
        });

      const label = this.add.text(button.x, height - 40, button.text, {
        fontSize: '11px',
        color: button.color,
        fontFamily: this.fontFamily
      }).setOrigin(0.5).setDepth(111);

      // Tooltip
      btn.on('pointerover', (p: Phaser.Input.Pointer) => this.showTooltip(`${button.text} actions`, p.x, p.y));
      btn.on('pointerout', () => this.hideTooltip());
      label.setInteractive({ useHandCursor: true })
        .on('pointerover', (p: Phaser.Input.Pointer) => this.showTooltip(`${button.text} actions`, p.x, p.y))
        .on('pointerout', () => this.hideTooltip());
    });

    // Speed controls
    this.add.text(width - 200, height - 55, 'SPEED:', {
      fontSize: '10px',
      color: '#bdc3c7',
      fontFamily: 'Courier New, monospace'
    });

    ['1x', '2x', '3x', 'PAUSE'].forEach((speed, index) => {
      const x = width - 150 + (index * 34);
      const speedBtn = this.add.rectangle(x, height - 40, 28, 22, 0x233242, 0.95)
        .setStrokeStyle(1, 0x95a5a6)
        .setInteractive({ useHandCursor: true })
        .setDepth(110);

      this.add.text(x, height - 40, speed, {
        fontSize: '9px',
        color: '#95a5a6',
        fontFamily: this.fontFamily
      }).setOrigin(0.5).setDepth(111);

      speedBtn.on('pointerover', () => speedBtn.setFillStyle(0x2d3f50, 0.95));
      speedBtn.on('pointerout', () => speedBtn.setFillStyle(0x233242, 0.95));
    });
  }

  private createSidePanel(width: number, height: number) {
    // Right side panel for survivor info
    this.sidePanelBg = this.add.rectangle(width - 110, height / 2, 220, height - 120, this.uiBgColor, this.panelAlpha)
      .setStrokeStyle(2, this.uiStrokeColor)
      .setDepth(100);

    this.add.text(width - 210, 80, 'SURVIVORS', {
      fontSize: '14px',
      color: '#ecf0f1',
      fontFamily: this.fontFamily
    }).setDepth(110);

    // Scrollable list
    this.survivorPanel = this.add.container(width - 220, 100).setDepth(110);
    this.survivorListContainer = this.add.container(0, 0);
    this.survivorPanel.add(this.survivorListContainer);

    // Mask for scrollable survivor list (use Graphics for GeometryMask)
    const sGfx = this.add.graphics();
    sGfx.fillStyle(0xffffff, 1);
    // Mask region aligns with survivorPanel area (x: width - 220, y: 100)
    sGfx.fillRect(width - 220, 100, 200, height - 170);
    this.survivorMaskGfx = sGfx;
    this.survivorMask = new Phaser.Display.Masks.GeometryMask(this, sGfx);
    this.survivorPanel.setMask(this.survivorMask);

    // Scroll wheel
    this.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
      const pointer = this.input.activePointer;
      if (pointer.x > width - 220 && pointer.x < width - 0 && pointer.y > 100 && pointer.y < height - 70) {
        const maxScroll = Math.max(0, this.survivorListContainer.height - (height - 170));
        this.survivorListContainer.y = Phaser.Math.Clamp(this.survivorListContainer.y - dy * 0.5, -maxScroll, 0);
      }
      // Event log scroll handled separately
    });
  }

  private createConspiracyMeter(width: number, height: number) {
    // Conspiracy heat meter
    this.add.text(20, height - 120, 'CONSPIRACY HEAT', {
      fontSize: '12px',
      color: '#ecf0f1',
      fontFamily: this.fontFamily
    }).setDepth(110);

    const meterBg = this.add.rectangle(20, height - 95, 220, 22, 0x233242, 0.95)
      .setOrigin(0, 0.5).setStrokeStyle(1, 0xe74c3c).setDepth(100);

    this.conspiracyMeter = this.add.rectangle(20, height - 95, 1, 18, 0x27ae60)
      .setOrigin(0, 0.5).setDepth(110);

    this.conspiracyText = this.add.text(250, height - 102, 'LOW', {
      fontSize: '11px',
      color: '#27ae60',
      fontFamily: this.fontFamily
    }).setDepth(110);
  }

  private createEventLog(width: number, height: number) {
    // Event log area
    this.add.text(250, height - 120, 'RECENT EVENTS', {
      fontSize: '12px',
      color: '#3498db',
      fontFamily: this.fontFamily
    }).setDepth(110);

    // Scrollable container with mask
    this.eventLogContainer = this.add.container(250, height - 112).setDepth(110);
    const eGfx = this.add.graphics();
    eGfx.fillStyle(0xffffff, 1);
    // Mask region aligns with eventLogContainer origin (x: 250, y: height - 112)
    eGfx.fillRect(250, height - 112, 540, 60);
    this.eventMaskGfx = eGfx;
    this.eventLogMask = new Phaser.Display.Masks.GeometryMask(this, eGfx);
    this.eventLogContainer.setMask(this.eventLogMask);

    // Scroll
    this.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
      const pointer = this.input.activePointer;
      if (pointer.x > 250 && pointer.x < 820 && pointer.y > height - 120 && pointer.y < height - 60) {
        this.eventScrollOffset = Phaser.Math.Clamp(this.eventScrollOffset - dy * 0.25, -200, 0);
        this.layoutEventLog();
      }
    });
  }

  public addEventLogEntry(message: string) {
    // Cap history to avoid runaway
    if (this.eventEntries.length > 50) {
      const old = this.eventEntries.shift();
      old?.destroy();
    }

    const entry = this.add.text(0, 0, `> ${message}`, {
      fontSize: '11px',
      color: '#9bd2ff',
      fontFamily: this.fontFamily,
      wordWrap: { width: 520 }
    }).setDepth(110).setAlpha(0);

    this.eventEntries.push(entry);
    this.eventLogContainer.add(entry);
    this.layoutEventLog();

    this.tweens.add({ targets: entry, alpha: 1, duration: 300 });
  }

  public updateConspiracyLevel(level: number) {
    this.currentConspiracyLevel = Phaser.Math.Clamp(level, 0, 100);
    const targetWidth = (this.currentConspiracyLevel / 100) * 220;

    // Smooth animate width and color
    let status = 'LOW';
    let color = '#27ae60';
    if (this.currentConspiracyLevel > 70) {
      status = 'MAXIMUM'; color = '#e74c3c';
    } else if (this.currentConspiracyLevel > 40) {
      status = 'HIGH'; color = '#f39c12';
    } else if (this.currentConspiracyLevel > 20) {
      status = 'MEDIUM'; color = '#e67e22';
    }

    this.tweens.add({
      targets: this.conspiracyMeter,
      displayWidth: targetWidth,
      duration: 300,
      onUpdate: () => {
        this.conspiracyMeter.setSize((this.conspiracyMeter.displayWidth || targetWidth), 18);
      }
    });
    this.conspiracyMeter.setFillStyle(parseInt(color.replace('#', '0x')));
    this.conspiracyText.setText(status);
    this.conspiracyText.setColor(color);
  }

  private createResourceDisplay() {
    // handled in createTopPanel
  }

  private handleActionButton(action: string) {
    const gameScene = this.scene.get('GameScene') as any;
    
    switch (action) {
      case 'build':
        this.showBuildMenu();
        break;
      case 'research':
        this.addEventLogEntry('Research system coming soon...');
        break;
      case 'recruit':
        this.addEventLogEntry('Recruitment system coming soon...');
        break;
      case 'trade':
        this.addEventLogEntry('Trading system coming soon...');
        break;
      case 'defend':
        this.addEventLogEntry('Defense system coming soon...');
        break;
    }
  }

  private showBuildMenu() {
    const { width, height } = this.cameras.main;
    
    // Create build menu overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width * 0.8, height * 0.7, 0x2c3e50, 0.95);
    overlay.setStrokeStyle(2, 0x34495e);
    overlay.setName('buildMenuOverlay');

    this.add.text(width / 2, height / 2 - 200, 'BUILD MENU', {
      fontSize: '24px',
      color: '#ecf0f1',
      fontFamily: 'Courier New, monospace'
    }).setOrigin(0.5).setName('buildMenuTitle');

    // Get available recipes from game scene
    const gameScene = this.scene.get('GameScene') as any;
    if (gameScene && gameScene.getCraftingSystem) {
      const craftingSystem = gameScene.getCraftingSystem();
      const recipes = Array.from(craftingSystem.getRecipes().values());
      
      // Display recipes in categories
      const categories = ['defense', 'utility', 'production', 'comfort', 'conspiracy'];
      let yOffset = -150;
      
      categories.forEach(category => {
        const categoryRecipes = recipes.filter((r: any) => r.category === category);
        if (categoryRecipes.length === 0) return;
        
        // Category header
        this.add.text(width / 2 - 250, height / 2 + yOffset, category.toUpperCase(), {
          fontSize: '14px',
          color: '#f39c12',
          fontFamily: 'Courier New, monospace'
        }).setName('buildMenuCategory');
        
        yOffset += 25;
        
        // Recipe buttons
        categoryRecipes.slice(0, 3).forEach((recipe: any, index: number) => {
          const canCraft = craftingSystem.canCraftRecipe(recipe.id);
          const btnColor = canCraft ? 0x27ae60 : 0x7f8c8d;
          const textColor = canCraft ? '#27ae60' : '#7f8c8d';
          
          const btn = this.add.rectangle(width / 2 - 200 + (index * 120), height / 2 + yOffset, 110, 40, btnColor, 0.3)
            .setStrokeStyle(1, btnColor)
            .setInteractive({ useHandCursor: canCraft })
            .setName('buildMenuButton');
          
          this.add.text(width / 2 - 200 + (index * 120), height / 2 + yOffset - 8, recipe.name, {
            fontSize: '10px',
            color: textColor,
            fontFamily: 'Courier New, monospace',
            wordWrap: { width: 100 }
          }).setOrigin(0.5).setName('buildMenuButtonText');
          
          // Show requirements
          const reqText = Object.entries(recipe.requirements)
            .map(([res, amt]) => `${res}: ${amt}`)
            .join(', ');
          
          this.add.text(width / 2 - 200 + (index * 120), height / 2 + yOffset + 8, reqText, {
            fontSize: '8px',
            color: '#bdc3c7',
            fontFamily: 'Courier New, monospace',
            wordWrap: { width: 100 }
          }).setOrigin(0.5).setName('buildMenuRequirements');
          
          if (canCraft) {
            btn.on('pointerdown', () => {
              craftingSystem.setBuildMode(true, recipe.id);
              this.closeBuildMenu();
              this.addEventLogEntry(`Build mode: ${recipe.name}`);
            });
          }
        });
        
        yOffset += 60;
      });
    }

    // Close button
    const closeBtn = this.add.rectangle(width / 2 + 250, height / 2 - 200, 60, 30, 0xe74c3c)
      .setStrokeStyle(1, 0xe74c3c)
      .setInteractive({ useHandCursor: true })
      .setName('buildMenuClose');

    this.add.text(width / 2 + 250, height / 2 - 200, 'CLOSE', {
      fontSize: '10px',
      color: '#e74c3c',
      fontFamily: 'Courier New, monospace'
    }).setOrigin(0.5).setName('buildMenuCloseText');

    closeBtn.on('pointerdown', () => this.closeBuildMenu());
  }

  private closeBuildMenu() {
    // Remove all build menu elements
    const elementsToRemove = [
      'buildMenuOverlay', 'buildMenuTitle', 'buildMenuCategory',
      'buildMenuButton', 'buildMenuButtonText', 'buildMenuRequirements',
      'buildMenuClose', 'buildMenuCloseText'
    ];
    
    elementsToRemove.forEach(name => {
      const elements = this.children.getByName(name);
      if (Array.isArray(elements)) {
        elements.forEach(element => element.destroy());
      } else if (elements) {
        elements.destroy();
      }
    });
  }

  public updateResources(resources: Map<string, number>) {
    this.resourceOrder.forEach(resourceType => {
      const textElement = this.resourceTexts.get(resourceType);
      if (textElement) {
        const amount = resources.get(resourceType) || 0;
        textElement.setText(`${this.pretty(resourceType)}: ${amount}`);
        // Color code: green > 50, yellow 20-50, red < 20
        const col = amount > 50 ? '#27ae60' : amount >= 20 ? '#f39c12' : '#e74c3c';
        textElement.setColor(col);
      }
    });
  }
  // Responsive relayout
  private relayout(width: number, height: number) {
    // Panels
    this.topPanelBg.setPosition(width / 2, 30).setSize(width, 64);
    this.bottomPanelBg.setPosition(width / 2, height - 40).setSize(width, 84);
    this.sidePanelBg.setPosition(width - 110, height / 2).setSize(220, height - 120);

    // Rebuild survivor mask
    if (this.survivorMaskGfx) {
      this.survivorMaskGfx.clear();
      this.survivorMaskGfx.fillStyle(0xffffff, 1);
      this.survivorMaskGfx.fillRect(width - 220, 100, 200, height - 170);
    }
    // Rebuild event log mask
    if (this.eventMaskGfx) {
      this.eventMaskGfx.clear();
      this.eventMaskGfx.fillStyle(0xffffff, 1);
      this.eventMaskGfx.fillRect(250, height - 112, 540, 60);
    }
  }

  private layoutEventLog() {
    let y = this.eventScrollOffset;
    this.eventEntries.forEach(t => {
      t.setPosition(0, y);
      y += t.height + 4;
    });
  }

  private pretty(id: string): string {
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  private createTooltip() {
    this.tooltipBg = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.85)
      .setStrokeStyle(1, 0x666666)
      .setDepth(10000)
      .setVisible(false);
    this.tooltipText = this.add.text(0, 0, '', {
      fontSize: '10px',
      color: '#ecf0f1',
      fontFamily: this.fontFamily,
      wordWrap: { width: 260 }
    }).setDepth(10001).setVisible(false);
  }

  private showTooltip(text: string, x: number, y: number) {
    this.tooltipText.setText(text);
    const pad = 6;
    const tw = this.tooltipText.width + pad * 2;
    const th = this.tooltipText.height + pad * 2;
    this.tooltipBg.setSize(tw, th);
    this.tooltipBg.setPosition(x + tw / 2 + 8, y - th / 2);
    this.tooltipText.setPosition(this.tooltipBg.x - tw / 2 + pad, this.tooltipBg.y - th / 2 + pad);
    this.tooltipBg.setVisible(true);
    this.tooltipText.setVisible(true);
  }

  private hideTooltip() {
    this.tooltipBg.setVisible(false);
    this.tooltipText.setVisible(false);
  }

  private showResourceTooltip(resource: string, x: number, y: number) {
    const game = this.scene.get('GameScene') as any;
    const rm = game?.getResourceManager?.();
    const type = rm?.getResourceType?.(resource);
    const amount = rm?.getResource?.(resource) ?? 0;
    const txt = type ? `${this.pretty(resource)}\n${type.description}\nAmount: ${amount}` : `${this.pretty(resource)}: ${amount}`;
    this.showTooltip(txt, x, y);
  }

  private refreshSurvivors() {
    const gs = this.scene.get('GameScene') as any;
    const sm = gs?.getSurvivorManager?.();
    if (!sm) return;
    const list: Map<string, any> = sm.getSurvivors?.();
    if (!list) return;

    // Clear previous rows
    this.survivorListContainer.removeAll(true);

    let y = 0;
    list.forEach((s: any) => {
      const rowBg = this.add.rectangle(110, y + 14, 200, 28, 0x233242, 0.6).setDepth(110);
      const name = this.add.text(6, y + 4, s.name, {
        fontSize: '11px', color: '#ecf0f1', fontFamily: this.fontFamily
      }).setDepth(111);
      const moodCol = s.mood === 'Content' ? '#27ae60'
        : s.mood === 'Stable' ? '#2ecc71'
        : s.mood === 'Stressed' ? '#f39c12'
        : s.mood === 'Unstable' ? '#e67e22' : '#e74c3c';
      const mood = this.add.text(6, y + 16, s.mood, {
        fontSize: '10px', color: moodCol, fontFamily: this.fontFamily
      }).setDepth(111);
      const taskText = s.task ? s.task.type : (s.currentTask || 'idle');
      const task = this.add.text(120, y + 10, taskText, {
        fontSize: '10px', color: '#9bd2ff', fontFamily: this.fontFamily
      }).setDepth(111);

      this.survivorListContainer.add([rowBg, name, mood, task]);
      y += 32;
    });
  }

  private refreshBuildBars() {
    // Clear previous bars
    this.buildBarsContainer.removeAll(true);
    const gs = this.scene.get('GameScene') as any;
    const cs = gs?.getCraftingSystem?.();
    if (!cs) return;

    const cam = (gs as Phaser.Scene).cameras.main;
    const buildings: Map<string, any> = cs.getBuildings?.();
    if (!buildings) return;

    buildings.forEach((b: any) => {
      if (b.status === 'blueprint' || b.status === 'under_construction') {
        const progress = Phaser.Math.Clamp(b.constructionProgress || 0, 0, 1);
        const sx = (b.x - cam.scrollX) * cam.zoom;
        const sy = (b.y - cam.scrollY) * cam.zoom;
        const barW = 44;
        const barH = 6;
        const bg = this.add.rectangle(sx, sy - 28, barW, barH, 0x233242, 0.95).setDepth(2000);
        const fg = this.add.rectangle(sx - barW / 2 + (barW * progress) / 2, sy - 28, barW * progress, barH - 2, 0x27ae60, 1).setDepth(2001);
        fg.setOrigin(0.5, 0.5);
        this.buildBarsContainer.add([bg, fg]);
      }
    });
  }
}