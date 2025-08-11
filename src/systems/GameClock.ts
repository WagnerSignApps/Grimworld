import Phaser from 'phaser';

export class GameClock {
  private scene: Phaser.Scene;
  private currentTime: number; // in-game minutes from the start
  private timeScale: number; // multiplier for game time progression

  public events: Phaser.Events.EventEmitter;

  // Real-world milliseconds per in-game minute
  private readonly MS_PER_MINUTE = 1000; // 1 real second = 1 game minute

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.currentTime = 8 * 60; // Start at 8:00 AM on Day 1
    this.timeScale = 1;
    this.events = new Phaser.Events.EventEmitter();
  }

  update(delta: number) {
    if (this.timeScale === 0) {
      return; // Paused
    }

    const lastHour = this.getHour();
    const lastDay = this.getDay();

    this.currentTime += (delta / this.MS_PER_MINUTE) * this.timeScale;

    const newHour = this.getHour();
    const newDay = this.getDay();

    if (newHour !== lastHour) {
      this.events.emit('hourChanged', { day: newDay, hour: newHour });
    }
    if (newDay !== lastDay) {
      this.events.emit('dayChanged', newDay);
    }
  }

  setTimeScale(scale: number) {
    this.timeScale = Math.max(0, scale);
  }

  getTimeScale(): number {
    return this.timeScale;
  }

  getCurrentTime(): { day: number; hour: number; minute: number } {
    const day = this.getDay();
    const hour = this.getHour();
    const minute = this.getMinute();
    return { day, hour, minute };
  }

  getDay(): number {
    return Math.floor(this.currentTime / (24 * 60)) + 1;
  }

  getHour(): number {
    return Math.floor((this.currentTime / 60) % 24);
  }

  getMinute(): number {
    return Math.floor(this.currentTime % 60);
  }

  getTimeString(): string {
    const day = this.getDay();
    const hour = this.getHour();
    const minute = this.getMinute();
    return `Day ${day} - ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
}
