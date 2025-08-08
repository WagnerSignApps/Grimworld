import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  preload() {
    // Create simple colored rectangles as placeholders for graphics
    this.load.image('logo', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
  }

  create() {
    const { width, height } = this.cameras.main;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a1a);

    // Title
    const title = this.add.text(width / 2, height / 4, 'GRIMWORLD', {
      fontSize: '64px',
      color: '#00ff00',
      fontFamily: 'Courier New, monospace',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, height / 4 + 80, 'Suburban Colony Simulator', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Courier New, monospace'
    }).setOrigin(0.5);

    // Flavor text
    this.add.text(width / 2, height / 2 - 50, 'The suburbs are dying.\nThe conspiracies are real.\nGrimace is watching.', {
      fontSize: '18px',
      color: '#cccccc',
      fontFamily: 'Courier New, monospace',
      align: 'center',
      lineSpacing: 10
    }).setOrigin(0.5);

    // Start button
    const startButton = this.add.rectangle(width / 2, height / 2 + 100, 300, 60, 0x2c3e50)
      .setStrokeStyle(2, 0x00ff00)
      .setInteractive({ useHandCursor: true });

    this.add.text(width / 2, height / 2 + 100, 'START NEW COLONY', {
      fontSize: '20px',
      color: '#00ff00',
      fontFamily: 'Courier New, monospace'
    }).setOrigin(0.5);

    // Button hover effects
    startButton.on('pointerover', () => {
      startButton.setFillStyle(0x34495e);
    });

    startButton.on('pointerout', () => {
      startButton.setFillStyle(0x2c3e50);
    });

    startButton.on('pointerdown', () => {
      this.scene.start('GameScene');
    });

    // Settings button
    const settingsButton = this.add.rectangle(width / 2, height / 2 + 180, 200, 50, 0x2c3e50)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true });

    this.add.text(width / 2, height / 2 + 180, 'SETTINGS', {
      fontSize: '16px',
      color: '#666666',
      fontFamily: 'Courier New, monospace'
    }).setOrigin(0.5);

    // Version info
    this.add.text(20, height - 30, 'v1.0.0 - Alpha Build', {
      fontSize: '12px',
      color: '#666666',
      fontFamily: 'Courier New, monospace'
    });

    // Conspiracy meter (easter egg)
    this.add.text(width - 20, height - 30, 'CONSPIRACY LEVEL: MAXIMUM', {
      fontSize: '12px',
      color: '#ff0000',
      fontFamily: 'Courier New, monospace'
    }).setOrigin(1, 0);

    // Add some atmospheric effects
    this.createAtmosphericEffects();
  }

  private createAtmosphericEffects() {
    const { width, height } = this.cameras.main;
    
    // Static noise effect
    const particles = this.add.particles(0, 0, 'logo', {
      x: { min: 0, max: width },
      y: { min: 0, max: height },
      scale: { min: 0.1, max: 0.3 },
      alpha: { min: 0.1, max: 0.3 },
      lifespan: 2000,
      frequency: 100,
      tint: 0x00ff00
    });

    // Flickering effect
    this.time.addEvent({
      delay: 3000,
      callback: () => {
        this.cameras.main.flash(100, 0, 255, 0, false);
      },
      loop: true
    });
  }
}