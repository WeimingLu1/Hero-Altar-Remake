import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FIXED_STEP_HZ,
  DEFAULT_MAX_CATCH_UP_STEPS,
  FixedStepClock,
  type FrameScheduler,
} from "../app/game-core/fixed-step-clock";

class FakeFrameScheduler implements FrameScheduler {
  time = 0;
  nextHandle = 1;
  callbacks = new Map<number, (timestamp: number) => void>();
  cancelled: number[] = [];

  now() {
    return this.time;
  }

  requestFrame(callback: (timestamp: number) => void) {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancelFrame(handle: unknown) {
    const id = handle as number;
    this.cancelled.push(id);
    this.callbacks.delete(id);
  }

  advance(milliseconds: number) {
    this.time += milliseconds;
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of callbacks) callback(this.time);
  }
}

test("默认以 120Hz 固定步长运行并始终只排一个 RAF", () => {
  const scheduler = new FakeFrameScheduler();
  const steps: number[] = [];
  const clock = new FixedStepClock({
    scheduler,
    onStep: (step) => steps.push(step),
  });
  assert.equal(clock.hz, DEFAULT_FIXED_STEP_HZ);
  assert.equal(clock.stepMilliseconds, 1000 / 120);
  clock.start();
  clock.start();
  assert.equal(clock.state, "running");
  assert.equal(scheduler.callbacks.size, 1);
  scheduler.advance(1000 / 120);
  assert.equal(steps.length, 1);
  assert.equal(steps[0], 1000 / 120);
  assert.equal(scheduler.callbacks.size, 1);
});

test("长帧最多补算十二步并丢弃陈旧整步", () => {
  const scheduler = new FakeFrameScheduler();
  let steps = 0;
  const clock = new FixedStepClock({
    scheduler,
    onStep: () => {
      steps += 1;
    },
  });
  clock.start();
  scheduler.advance(1000);
  assert.equal(steps, DEFAULT_MAX_CATCH_UP_STEPS);
  scheduler.advance(0);
  assert.equal(steps, DEFAULT_MAX_CATCH_UP_STEPS);
  scheduler.advance(1000 / 120);
  assert.equal(steps, DEFAULT_MAX_CATCH_UP_STEPS + 1);
});

test("暂停和恢复都会清空累计时间且不会补跑后台阶段", () => {
  const scheduler = new FakeFrameScheduler();
  let steps = 0;
  const clock = new FixedStepClock({
    scheduler,
    onStep: () => {
      steps += 1;
    },
  });
  const halfStep = 1000 / 240;
  clock.start();
  scheduler.advance(halfStep);
  assert.equal(steps, 0);
  clock.pause();
  assert.equal(clock.state, "paused");
  assert.equal(scheduler.callbacks.size, 0);
  scheduler.time += 60_000;
  clock.resume();
  scheduler.advance(halfStep);
  assert.equal(steps, 0);
  scheduler.advance(halfStep);
  assert.equal(steps, 1);
});

test("dispose 终止调度且不能重新启动", () => {
  const scheduler = new FakeFrameScheduler();
  let steps = 0;
  const clock = new FixedStepClock({
    scheduler,
    onStep: () => {
      steps += 1;
    },
  });
  clock.start();
  clock.dispose();
  assert.equal(clock.state, "disposed");
  assert.equal(scheduler.callbacks.size, 0);
  assert.equal(scheduler.cancelled.length, 1);
  clock.start();
  clock.resume();
  scheduler.advance(1000);
  assert.equal(steps, 0);
});

test("步进回调可在执行中安全暂停且参数会被校验", () => {
  const scheduler = new FakeFrameScheduler();
  let steps = 0;
  const clockRef: { current: FixedStepClock | null } = { current: null };
  const clock = new FixedStepClock({
    scheduler,
    onStep: () => {
      steps += 1;
      clockRef.current?.pause();
    },
  });
  clockRef.current = clock;
  clock.start();
  scheduler.advance(100);
  assert.equal(steps, 1);
  assert.equal(clock.state, "paused");
  assert.equal(scheduler.callbacks.size, 0);
  assert.throws(
    () => new FixedStepClock({ hz: 0, scheduler, onStep: () => {} }),
    RangeError,
  );
  assert.throws(
    () =>
      new FixedStepClock({
        maxCatchUpSteps: 1.5,
        scheduler,
        onStep: () => {},
      }),
    RangeError,
  );
});
