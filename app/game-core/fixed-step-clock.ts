export const DEFAULT_FIXED_STEP_HZ = 120;
export const DEFAULT_MAX_CATCH_UP_STEPS = 12;

export interface FrameScheduler {
  now(): number;
  requestFrame(callback: (timestamp: number) => void): unknown;
  cancelFrame(handle: unknown): void;
}

export interface FixedStepClockOptions {
  onStep: (stepMilliseconds: number) => void;
  hz?: number;
  maxCatchUpSteps?: number;
  scheduler?: FrameScheduler;
}

export type FixedStepClockState = "idle" | "running" | "paused" | "disposed";

const browserFrameScheduler = (): FrameScheduler => ({
  now: () => performance.now(),
  requestFrame: (callback) => {
    if (typeof requestAnimationFrame !== "function") {
      throw new Error("requestAnimationFrame is unavailable; provide a scheduler.");
    }
    return requestAnimationFrame(callback);
  },
  cancelFrame: (handle) => {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(handle as number);
    }
  },
});

export class FixedStepClock {
  readonly hz: number;
  readonly stepMilliseconds: number;
  readonly maxCatchUpSteps: number;

  private readonly onStep: (stepMilliseconds: number) => void;
  private readonly scheduler: FrameScheduler;
  private frameHandle: unknown | null = null;
  private lastTimestamp: number | null = null;
  private accumulator = 0;
  private currentState: FixedStepClockState = "idle";

  constructor(options: FixedStepClockOptions) {
    const hz = options.hz ?? DEFAULT_FIXED_STEP_HZ;
    const maxCatchUpSteps =
      options.maxCatchUpSteps ?? DEFAULT_MAX_CATCH_UP_STEPS;
    if (!Number.isFinite(hz) || hz <= 0) {
      throw new RangeError("Fixed-step clock hz must be greater than zero.");
    }
    if (!Number.isInteger(maxCatchUpSteps) || maxCatchUpSteps <= 0) {
      throw new RangeError(
        "Fixed-step clock maxCatchUpSteps must be a positive integer.",
      );
    }
    this.hz = hz;
    this.stepMilliseconds = 1000 / hz;
    this.maxCatchUpSteps = maxCatchUpSteps;
    this.onStep = options.onStep;
    this.scheduler = options.scheduler ?? browserFrameScheduler();
  }

  get state() {
    return this.currentState;
  }

  get isRunning() {
    return this.currentState === "running";
  }

  start() {
    if (this.currentState === "running" || this.currentState === "disposed") {
      return;
    }
    this.clearTiming();
    this.currentState = "running";
    this.lastTimestamp = this.scheduler.now();
    this.scheduleFrame();
  }

  pause() {
    if (this.currentState !== "running") return;
    this.cancelScheduledFrame();
    this.clearTiming();
    this.currentState = "paused";
  }

  resume() {
    if (this.currentState !== "paused") return;
    this.start();
  }

  dispose() {
    if (this.currentState === "disposed") return;
    this.cancelScheduledFrame();
    this.clearTiming();
    this.currentState = "disposed";
  }

  private readonly frame = (timestamp: number) => {
    this.frameHandle = null;
    if (this.currentState !== "running") return;
    this.advance(timestamp);
    this.scheduleFrame();
  };

  private advance(timestamp: number) {
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      return;
    }
    const elapsed = Math.max(0, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;
    this.accumulator += elapsed;

    const availableSteps = Math.floor(
      (this.accumulator + this.stepMilliseconds * 1e-9) /
        this.stepMilliseconds,
    );
    const steps = Math.min(availableSteps, this.maxCatchUpSteps);
    if (availableSteps > this.maxCatchUpSteps) {
      // Discard stale whole steps so a throttled tab cannot burst for several
      // frames after the first capped catch-up frame.
      this.accumulator %= this.stepMilliseconds;
      if (
        this.accumulator < this.stepMilliseconds * 1e-9 ||
        this.stepMilliseconds - this.accumulator <
          this.stepMilliseconds * 1e-9
      ) {
        this.accumulator = 0;
      }
    } else {
      this.accumulator -= steps * this.stepMilliseconds;
      if (Math.abs(this.accumulator) < this.stepMilliseconds * 1e-9) {
        this.accumulator = 0;
      }
    }

    for (let index = 0; index < steps; index += 1) {
      if (this.currentState !== "running") break;
      this.onStep(this.stepMilliseconds);
    }
  }

  private scheduleFrame() {
    if (this.currentState !== "running" || this.frameHandle !== null) return;
    this.frameHandle = this.scheduler.requestFrame(this.frame);
  }

  private cancelScheduledFrame() {
    if (this.frameHandle === null) return;
    this.scheduler.cancelFrame(this.frameHandle);
    this.frameHandle = null;
  }

  private clearTiming() {
    this.lastTimestamp = null;
    this.accumulator = 0;
  }
}
