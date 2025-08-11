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
  private survivorDetailContainer!: Phaser.GameObjects.Container;
  private survivorMask!: Phaser.Display.Masks.GeometryMask;
  private survivorMaskGfx!: Phaser.GameObjects.Graphics;
  private selectedSurvivorId?: string;

  // Event log
  private eventLogContainer!: Phaser.GameObjects.Container;
  private eventEntries: Phaser.GameObjects.Text[] = [];
  private eventLogMask!: Phaser.Display.Masks.GeometryMask;
  private eventMaskGfx!: Phaser.GameObjects.Graphics;
  private eventScrollOffset: number = 0;

  // Tooltips
  private tooltipBg!: Phaser.GameObjects.Rectangle;
  private tooltipText!: Phaser.GameObjects.Text;

// Time display
private timeText!: Phaser.GameObjects.Text;
  private researchProgressText!: Phaser.GameObjects.Text;

  // Action Buttons
  private defendButton!: Phaser.GameObjects.Rectangle;
  private defendButtonLabel!: Phaser.GameObjects.Text;

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
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.updateSurvivorPanel() });
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.refreshBuildBars() });
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.refreshResearchProgress() });

    // Resize handling for responsive layout
    this.scale.on('resize', (gameSize: any) => {
      this.relayout(gameSize.width, gameSize.height);
    });

    // Initial log
    this.addEventLogEntry('Colony established in suburban wasteland...');
    this.addEventLogEntry('The HOA is watching...');

    // Connect to GameClock
    const gameScene = this.scene.get('GameScene') as any;
    if (gameScene && gameScene.getGameClock) {
      const clock = gameScene.getGameClock();
      // Update time display when hour changes
      clock.events.on('hourChanged', (time: { day: number; hour: number }) => {
        this.timeText.setText(`Day ${time.day} - ${String(time.hour).padStart(2, '0')}:00`);
      });
      // Set initial time
      this.timeText.setText(clock.getTimeString());
    }

    // Listen for game events
    gameScene.events.on('buildingPlaced', (building: any, recipe: any) => {
      this.addEventLogEntry(`Placed blueprint for ${recipe.name}.`);
    });
    gameScene.events.on('buildingCompleted', (building: any, recipe: any) => {
      this.addEventLogEntry(`${recipe.name} has been built.`);
    });
    gameScene.events.on('recipeUnlocked', (recipe: any) => {
        this.addEventLogEntry(`New technology unlocked: You can now build ${recipe.name}!`);
    });
    gameScene.events.on('survivorRecruited', (survivor: any) => {
        this.addEventLogEntry(`${survivor.name} has joined the colony.`);
    });

    const tradeManager = gameScene.getTradeManager();
    if (tradeManager) {
        tradeManager.events.on('traderArrived', (trader: any) => {
            this.addEventLogEntry(`A ${trader.type}, ${trader.name}, has arrived to trade.`);
        });
        tradeManager.events.on('traderLeft', (trader: any) => {
            this.addEventLogEntry(`${trader.name} has left.`);
        });
        tradeManager.events.on('tradeCompleted', (trade: any) => {
            this.addEventLogEntry('Trade successful.');
        });
        tradeManager.events.on('tradeScam', (scam: any) => {
            this.addEventLogEntry(`SCAM! ${scam.trader.name} shorted you ${scam.amount} ${scam.resource}!`);
        });
        tradeManager.events.on('tradeBonus', (bonus: any) => {
            this.addEventLogEntry(`BONUS! ${bonus.trader.name} threw in an extra ${bonus.amount} ${bonus.resource}!`);
        });
    }

    // Listen for combat events
    gameScene.events.on('survivorDamaged', (data: any) => {
        // This could get spammy, so maybe only log sometimes
        if (Math.random() < 0.3) {
            this.addEventLogEntry(`${data.survivor.name} took ${data.damage} damage!`);
        }
    });
    gameScene.events.on('unitDamaged', (data: any) => {
        if (Math.random() < 0.3) {
            this.addEventLogEntry(`${data.unit.name} took ${data.damage} damage!`);
        }
    });
    gameScene.events.on('survivorDied', (data: any) => {
        this.addEventLogEntry(`TRAGEDY! ${data.survivor.name} has fallen in battle.`);
    });
    gameScene.events.on('unitDied', (data: any) => {
        this.addEventLogEntry(`${data.unit.name} has been defeated.`);
    });
    gameScene.events.on('survivorStateChanged', (data: any) => {
        if (data.state === 'starving') {
            this.addEventLogEntry(`${data.survivor.name} is starving!`);
        } else if (data.state === 'breaking') {
            this.addEventLogEntry(`${data.survivor.name} is having a mental break!`);
        }
    });
  }

  private showResearchMenu() {
    const { width, height } = this.cameras.main;
    const gameScene = this.scene.get('GameScene') as any;
    const researchSystem = gameScene.getResearchSystem();
    if (!researchSystem) return;

    // Create research menu overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width * 0.9, height * 0.8, 0x2c3e50, 0.98)
      .setStrokeStyle(2, 0x34495e)
      .setName('researchMenuOverlay');

    this.add.text(width / 2, height * 0.15, 'RESEARCH & DEVELOPMENT', {
      fontSize: '24px',
      color: '#ecf0f1',
      fontFamily: this.fontFamily
    }).setOrigin(0.5).setName('researchMenuTitle');

    // Close button
    const closeBtn = this.add.text(width * 0.95 - 20, height * 0.1 + 20, 'X', { fontSize: '20px', color: '#e74c3c' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.closeResearchMenu())
        .setName('researchMenuClose');

    const projects = Array.from(researchSystem.getProjects().values());
    const projectObjects: Map<string, Phaser.GameObjects.Container> = new Map();

    // Simple grid layout
    const columns = 3;
    const colWidth = (width * 0.9) / columns;
    const rowHeight = 120;
    let col = 0;
    let row = 0;

    projects.forEach(p => {
        const x = width * 0.1 + col * colWidth + colWidth / 2;
        const y = height * 0.25 + row * rowHeight;

        const container = this.add.container(x, y).setName('researchNode');
        const status = researchSystem.getProjectStatus(p.id);
        const canStart = researchSystem.canStartResearch(p.id);

        let bgColor = 0x1a2833;
        let strokeColor = 0x34495e;
        if (status === 'completed') { bgColor = 0x27ae60; }
        else if (status === 'in_progress') { bgColor = 0x3498db; }
        else if (status === 'available') { strokeColor = 0xf1c40f; }

        const bg = this.add.rectangle(0, 0, colWidth * 0.8, rowHeight - 10, bgColor, 0.9).setStrokeStyle(2, strokeColor);
        container.add(bg);

        container.add(this.add.text(0, -40, p.name, { fontSize: '12px', color: '#ecf0f1', fontFamily: this.fontFamily, align: 'center', wordWrap: {width: colWidth * 0.7} }).setOrigin(0.5));

        const costText = Object.entries(p.cost).map(([res, amt]) => `${amt} ${res}`).join(', ');
        container.add(this.add.text(0, 20, `Cost: ${costText}`, { fontSize: '10px', color: '#bdc3c7', fontFamily: this.fontFamily }).setOrigin(0.5));

        if (status === 'available') {
            const startButton = this.add.text(0, 40, 'BEGIN RESEARCH', { fontSize: '11px', color: canStart ? '#2ecc71' : '#7f8c8d', fontFamily: this.fontFamily }).setOrigin(0.5);
            container.add(startButton);
            if (canStart) {
                bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
                    researchSystem.startResearch(p.id);
                    this.closeResearchMenu();
                    this.showResearchMenu(); // Refresh
                });
            }
        } else if (status === 'completed') {
            container.add(this.add.text(0, 40, 'COMPLETED', { fontSize: '11px', color: '#ecf0f1', fontFamily: this.fontFamily }).setOrigin(0.5));
        }

        projectObjects.set(p.id, container);
        col++;
        if (col >= columns) {
            col = 0;
            row++;
        }
    });
  }

  private closeResearchMenu() {
    const elementsToRemove = ['researchMenuOverlay', 'researchMenuTitle', 'researchMenuClose', 'researchNode'];
    elementsToRemove.forEach(name => {
      const children = this.children.getAll();
      children.filter(c => c.name === name).forEach(c => c.destroy());
    });
  }

  public showGameTooltip(x: number, y: number, text: string) {
      this.showTooltip(text, x, y);
  }

  public hideGameTooltip() {
      this.hideTooltip();
  }

  private updateDefendButton(isDefenseMode: boolean) {
      if (!this.defendButton) return;

      if (isDefenseMode) {
          this.defendButton.setFillStyle(0xe74c3c, 0.95);
          this.defendButtonLabel.setColor('#ffffff');
          this.defendButtonLabel.setText('DEFENDING');
      } else {
          this.defendButton.setFillStyle(0x233242, 0.95);
          this.defendButtonLabel.setColor('#e74c3c');
          this.defendButtonLabel.setText('DEFEND');
      }
  }

  private showTradeMenu() {
    const { width, height } = this.cameras.main;
    const gameScene = this.scene.get('GameScene') as any;
    const tradeManager = gameScene.getTradeManager();
    const resourceManager = gameScene.getResourceManager();
    if (!tradeManager) return;

    const trader = tradeManager.currentTrader;

    const overlay = this.add.rectangle(width / 2, height / 2, 700, 500, 0x2c3e50, 0.98)
      .setStrokeStyle(2, 0x34495e)
      .setName('tradeMenuOverlay');

    const title = this.add.text(width / 2, height / 2 - 220, 'TRADE', { fontSize: '20px', color: '#ecf0f1', fontFamily: this.fontFamily }).setOrigin(0.5).setName('tradeMenuTitle');
    const closeBtn = this.add.text(width / 2 + 330, height / 2 - 230, 'X', { fontSize: '20px', color: '#e74c3c' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closeTradeMenu()).setName('tradeMenuClose');

    if (!trader) {
        this.add.text(width / 2, height / 2, 'No trader is currently visiting.', { fontSize: '14px', color: '#bdc3c7', fontFamily: this.fontFamily, align: 'center' }).setOrigin(0.5).setName('tradeMenuNode');
        return;
    }

    title.setText(`Trading with ${trader.name} (${trader.type})`);

    const playerOffer = new Map<string, number>();
    const traderOffer = new Map<string, number>();

    const allResources = Array.from(resourceManager.getAllResourceTypes().keys());

    const redrawSummary = () => {
        // This function will be complex, for now, we'll just log the offer
        console.log('Player gives:', playerOffer, 'Trader gives:', traderOffer);
    };

    let y = height / 2 - 150;
    allResources.forEach(res => {
        const container = this.add.container(width/2, y).setName('tradeMenuNode');

        // Resource Name
        container.add(this.add.text(0, 0, this.pretty(res), {fontSize: '12px'}).setOrigin(0.5));

        // Player side
        const playerAmount = resourceManager.getResource(res);
        container.add(this.add.text(-150, 0, `You have: ${playerAmount}`, {fontSize: '10px'}).setOrigin(0.5));
        const playerOfferText = this.add.text(-250, 0, '0', {fontSize: '12px'}).setOrigin(0.5);
        container.add(playerOfferText);

        const pMinus = this.add.text(-280, 0, '-', {fontSize: '16px'}).setOrigin(0.5).setInteractive({useHandCursor: true}).on('pointerdown', () => {
            const current = playerOffer.get(res) || 0;
            if (current > 0) playerOffer.set(res, current - 1);
            playerOfferText.setText(String(playerOffer.get(res) || 0));
            redrawSummary();
        });
        const pPlus = this.add.text(-220, 0, '+', {fontSize: '16px'}).setOrigin(0.5).setInteractive({useHandCursor: true}).on('pointerdown', () => {
            const current = playerOffer.get(res) || 0;
            if (current < playerAmount) playerOffer.set(res, current + 1);
            playerOfferText.setText(String(playerOffer.get(res) || 0));
            redrawSummary();
        });
        container.add([pMinus, pPlus]);

        // Trader side
        const traderAmount = trader.inventory.get(res) || 0;
        container.add(this.add.text(150, 0, `They have: ${traderAmount}`, {fontSize: '10px'}).setOrigin(0.5));
        const traderOfferText = this.add.text(250, 0, '0', {fontSize: '12px'}).setOrigin(0.5);
        container.add(traderOfferText);

        const tMinus = this.add.text(220, 0, '-', {fontSize: '16px'}).setOrigin(0.5).setInteractive({useHandCursor: true}).on('pointerdown', () => {
            const current = traderOffer.get(res) || 0;
            if (current > 0) traderOffer.set(res, current - 1);
            traderOfferText.setText(String(traderOffer.get(res) || 0));
            redrawSummary();
        });
        const tPlus = this.add.text(280, 0, '+', {fontSize: '16px'}).setOrigin(0.5).setInteractive({useHandCursor: true}).on('pointerdown', () => {
            const current = traderOffer.get(res) || 0;
            if (current < traderAmount) traderOffer.set(res, current + 1);
            traderOfferText.setText(String(traderOffer.get(res) || 0));
            redrawSummary();
        });
        container.add([tMinus, tPlus]);

        y += 30;
    });

    const confirmButton = this.add.rectangle(width/2, height/2 + 220, 150, 40, 0x27ae60).setName('tradeMenuNode').setInteractive({useHandCursor:true});
    this.add.text(width/2, height/2 + 220, 'CONFIRM TRADE', {fontSize: '14px'}).setOrigin(0.5).setName('tradeMenuNode');

    confirmButton.on('pointerdown', () => {
        // Simplified value calculation
        let playerValue = 0;
        playerOffer.forEach((amount, res) => playerValue += amount * tradeManager.getTraderValue(res));
        let traderValue = 0;
        traderOffer.forEach((amount, res) => traderValue += amount * tradeManager.getTraderValue(res));

        if (playerValue >= traderValue * 0.8) { // Allow some leeway
            const success = tradeManager.executeTrade(playerOffer, traderOffer);
            if (success) {
                this.closeTradeMenu();
            } else {
                this.addEventLogEntry('Trade failed. Check resource amounts.');
            }
        } else {
            this.addEventLogEntry('Trader considers this a bad deal.');
        }
    });
  }

  private closeTradeMenu() {
    const elementsToRemove = ['tradeMenuOverlay', 'tradeMenuTitle', 'tradeMenuClose', 'tradeMenuNode'];
    elementsToRemove.forEach(name => {
      const children = this.children.getAll();
      children.filter(c => c.name === name).forEach(c => c.destroy());
    });
  }

  private showRecruitMenu() {
    const { width, height } = this.cameras.main;
    const gameScene = this.scene.get('GameScene') as any;
    const survivorManager = gameScene.getSurvivorManager();
    const resourceManager = gameScene.getResourceManager();
    if (!survivorManager || !resourceManager) return;

    const overlay = this.add.rectangle(width / 2, height / 2, 500, 400, 0x2c3e50, 0.98)
      .setStrokeStyle(2, 0x34495e)
      .setName('recruitMenuOverlay');

    this.add.text(width / 2, height / 2 - 170, 'RECRUIT WANDERERS', {
      fontSize: '20px',
      color: '#ecf0f1',
      fontFamily: this.fontFamily
    }).setOrigin(0.5).setName('recruitMenuTitle');

    const closeBtn = this.add.text(width / 2 + 230, height / 2 - 180, 'X', { fontSize: '20px', color: '#e74c3c' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.closeRecruitMenu())
        .setName('recruitMenuClose');

    const wanderers = Array.from(survivorManager.getWanderingSurvivors().values());

    if (wanderers.length === 0) {
        this.add.text(width / 2, height / 2, 'No wanderers available.\nCheck back later.', {
            fontSize: '14px', color: '#bdc3c7', fontFamily: this.fontFamily, align: 'center'
        }).setOrigin(0.5).setName('recruitMenuNode');
        return;
    }

    let y = height / 2 - 120;
    wanderers.forEach(w => {
        const container = this.add.container(width / 2, y).setName('recruitMenuNode');
        const bg = this.add.rectangle(0, 0, 480, 60, 0x1a2833, 0.9).setStrokeStyle(1, 0x34495e);
        container.add(bg);

        container.add(this.add.text(-230, -10, `${w.name} (${w.background.name})`, { fontSize: '12px', color: '#ecf0f1', fontFamily: this.fontFamily }));

        const RECRUIT_COST = { nuggets: 20, sauce: 10 };
        const costText = Object.entries(RECRUIT_COST).map(([res, amt]) => `${amt} ${res}`).join(', ');
        container.add(this.add.text(-230, 10, `Cost: ${costText}`, { fontSize: '10px', color: '#bdc3c7', fontFamily: this.fontFamily }));

        const canAfford = Object.entries(RECRUIT_COST).every(([res, amt]) => resourceManager.hasResource(res, amt));

        const recruitButton = this.add.rectangle(180, 0, 100, 30, canAfford ? 0x27ae60 : 0x7f8c8d, 0.8)
            .setStrokeStyle(1, canAfford ? '#2ecc71' : '#95a5a6')
            .setInteractive({ useHandCursor: true });

        container.add(recruitButton);
        container.add(this.add.text(180, 0, 'RECRUIT', {fontSize: '11px', color: '#fff'}).setOrigin(0.5));

        recruitButton.on('pointerdown', () => {
            if (canAfford) {
                Object.entries(RECRUIT_COST).forEach(([res, amt]) => resourceManager.removeResource(res, amt));
                survivorManager.recruitWanderer(w.id);
                this.closeRecruitMenu();
            } else {
                this.addEventLogEntry('Not enough resources to recruit.');
            }
        });

        y += 70;
    });
  }

  private closeRecruitMenu() {
    const elementsToRemove = ['recruitMenuOverlay', 'recruitMenuTitle', 'recruitMenuClose', 'recruitMenuNode'];
    elementsToRemove.forEach(name => {
      const children = this.children.getAll();
      children.filter(c => c.name === name).forEach(c => c.destroy());
    });
  }

  private refreshResearchProgress() {
      const gameScene = this.scene.get('GameScene') as any;
      const researchSystem = gameScene.getResearchSystem?.();
      if (!researchSystem) {
          this.researchProgressText.setText('');
          return;
      }

      const { project, progress } = researchSystem.getActiveResearch();
      if (project) {
          this.researchProgressText.setText(`Researching: ${project.name} (${(progress * 100).toFixed(0)}%)`);
      } else {
          this.researchProgressText.setText('No active research project.');
      }
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

    // Date/time placeholder
    this.timeText = this.add.text(width - 16, 12, 'Day 1 - 08:00', {
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

    buttons.forEach(buttonData => {
      const colorInt = parseInt(buttonData.color.replace('#', '0x'));
      const btn = this.add.rectangle(buttonData.x, height - 40, 90, 32, 0x233242, 0.95)
        .setStrokeStyle(1, colorInt)
        .setInteractive({ useHandCursor: true })
        .setDepth(110)
        .on('pointerover', () => btn.setFillStyle(0x2d3f50, 0.95))
        .on('pointerout', () => btn.setFillStyle(0x233242, 0.95))
        .on('pointerdown', () => {
          btn.setFillStyle(0x1a2833, 0.95);
          this.handleActionButton(buttonData.action);
        });

      const label = this.add.text(buttonData.x, height - 40, buttonData.text, {
        fontSize: '11px',
        color: buttonData.color,
        fontFamily: this.fontFamily
      }).setOrigin(0.5).setDepth(111);

      // Store defend button reference
      if (buttonData.action === 'defend') {
          this.defendButton = btn;
          this.defendButtonLabel = label;
      }

      // Tooltip
      btn.on('pointerover', (p: Phaser.Input.Pointer) => this.showTooltip(`${buttonData.text} actions`, p.x, p.y));
      btn.on('pointerout', () => this.hideTooltip());
      label.setInteractive({ useHandCursor: true })
        .on('pointerover', (p: Phaser.Input.Pointer) => this.showTooltip(`${buttonData.text} actions`, p.x, p.y))
        .on('pointerout', () => this.hideTooltip());
    });

    // Speed controls
    this.add.text(width - 200, height - 55, 'SPEED:', {
      fontSize: '10px',
      color: '#bdc3c7',
      fontFamily: 'Courier New, monospace'
    });

    const speedButtons: Phaser.GameObjects.Rectangle[] = [];
    const speedOptions = [
      { text: 'PAUSE', scale: 0 },
      { text: '1x', scale: 1 },
      { text: '2x', scale: 2 },
      { text: '3x', scale: 3 }
    ];

    const setActiveButton = (activeIndex: number) => {
      speedButtons.forEach((btn, i) => {
        if (i === activeIndex) {
          btn.setFillStyle(0x3498db, 0.95).setStrokeStyle(1, 0xecf0f1);
        } else {
          btn.setFillStyle(0x233242, 0.95).setStrokeStyle(1, 0x95a5a6);
        }
      });
    };

    speedOptions.forEach((speed, index) => {
      const x = width - 150 + (index * 34);
      const speedBtn = this.add.rectangle(x, height - 40, 28, 22, 0x233242, 0.95)
        .setStrokeStyle(1, 0x95a5a6)
        .setInteractive({ useHandCursor: true })
        .setDepth(110);

      this.add.text(x, height - 40, speed.text, {
        fontSize: '9px',
        color: '#95a5a6',
        fontFamily: this.fontFamily
      }).setOrigin(0.5).setDepth(111);

      speedBtn.on('pointerdown', () => {
        const gameScene = this.scene.get('GameScene') as any;
        if (gameScene && gameScene.getGameClock) {
          const clock = gameScene.getGameClock();
          clock.setTimeScale(speed.scale);
          setActiveButton(index);
        }
      });
      speedButtons.push(speedBtn);
    });

    // Set initial active button
    setActiveButton(1); // Default to 1x speed

    // Research progress text
    this.researchProgressText = this.add.text(width - 220, height - 20, '', {
        fontSize: '10px',
        color: '#3498db',
        fontFamily: this.fontFamily,
        align: 'right'
    }).setOrigin(1, 0.5);
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
    this.survivorDetailContainer = this.add.container(0, 250).setVisible(false); // Positioned below list
    this.survivorPanel.add([this.survivorListContainer, this.survivorDetailContainer]);


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
        this.showResearchMenu();
        break;
      case 'recruit':
        this.showRecruitMenu();
        break;
      case 'trade':
        this.showTradeMenu();
        break;
      case 'defend':
        gameScene.defenseModeActive = !gameScene.defenseModeActive;
        this.addEventLogEntry(`Defense mode ${gameScene.defenseModeActive ? 'ACTIVATED' : 'DEACTIVATED'}.`);
        // We'll need to update the button's appearance, which requires a reference to it.
        // This will be handled by restructuring the button creation slightly.
        this.updateDefendButton(gameScene.defenseModeActive);
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
              this.addEventLogEntry(`Build mode activated for: ${recipe.name}. Click on map to place.`);
            });
          } else {
            btn.on('pointerdown', () => {
              const missing: string[] = [];
              for (const [res, amt] of Object.entries(recipe.requirements)) {
                if (!gameScene.getResourceManager().hasResource(res, amt)) {
                  const current = gameScene.getResourceManager().getResource(res);
                  missing.push(`${amt - current} ${res}`);
                }
              }
              if (missing.length > 0) {
                this.addEventLogEntry(`Cannot build ${recipe.name}. Missing: ${missing.join(', ')}.`);
              }
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

  private updateSurvivorPanel() {
    const gs = this.scene.get('GameScene') as any;
    const sm = gs?.getSurvivorManager?.();
    if (!sm) return;
    const list: Map<string, any> = sm.getSurvivors?.();
    if (!list) return;

    // Clear previous rows
    this.survivorListContainer.removeAll(true);

    let y = 0;
    list.forEach((s: any) => {
      const isSelected = s.id === this.selectedSurvivorId;
      const rowBg = this.add.rectangle(110, y + 14, 200, 28, isSelected ? 0x34495e : 0x233242, 0.8)
        .setStrokeStyle(1, isSelected ? 0xecf0f1 : 0x34495e)
        .setDepth(110)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.selectedSurvivorId = s.id;
          sm.selectSurvivor(s.id);
          this.updateSurvivorPanel(); // Redraw to show selection and details
        });

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

    // Update details view if a survivor is selected
    if (this.selectedSurvivorId) {
      this.showSurvivorDetails(this.selectedSurvivorId);
    } else {
      this.survivorDetailContainer.setVisible(false);
    }
  }

  private showSurvivorDetails(survivorId: string) {
    const gs = this.scene.get('GameScene') as any;
    const sm = gs?.getSurvivorManager?.();
    const survivor = sm?.getSurvivor?.(survivorId);
    if (!survivor) {
      this.survivorDetailContainer.setVisible(false);
      return;
    }

    this.survivorDetailContainer.removeAll(true);
    this.survivorDetailContainer.setVisible(true);

    const { name, background, health, sanity, hunger, skills, task } = survivor;

    // Reposition based on list height
    const listHeight = this.survivorListContainer.getBounds().height;
    this.survivorDetailContainer.setY(listHeight + 10);

    const detailBg = this.add.rectangle(110, 100, 200, 200, 0x1a2833, 0.9)
        .setOrigin(0.5, 0);
    this.survivorDetailContainer.add(detailBg);

    let y = 10;
    const addText = (label: string, value: string, color = '#ecf0f1') => {
        this.survivorDetailContainer.add(this.add.text(10, y, `${label}:`, { fontSize: '10px', color: '#bdc3c7', fontFamily: this.fontFamily }));
        this.survivorDetailContainer.add(this.add.text(100, y, value, { fontSize: '10px', color: color, fontFamily: this.fontFamily }));
        y += 14;
    };

    addText('Name', name);
    addText('Health', `${health}/100`, health > 50 ? '#2ecc71' : '#e74c3c');
    addText('Sanity', `${sanity}/100`, sanity > 50 ? '#3498db' : '#f39c12');
    addText('Hunger', `${hunger}/100`, hunger < 50 ? '#2ecc71' : '#e67e22');
    y += 5;
    addText('Task', task ? task.type : 'idle');
    addText('Background', background.name);
    y += 5;

    // Skills
    this.survivorDetailContainer.add(this.add.text(10, y, 'Skills:', { fontSize: '11px', color: '#ecf0f1', fontFamily: this.fontFamily }));
    y += 16;
    for (const [skill, level] of Object.entries(skills)) {
        addText(`- ${skill}`, `${level}`);
    }
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