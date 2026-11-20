import type { InputFrame, InputState } from './types';

export class InputFormatError extends Error {}

/**
 * Input playback: frames only change the fields they mention, everything else
 * keeps its previous value. Ticks must be strictly increasing (contract C).
 */
export class InputTrack {
  private readonly frames: InputFrame[];
  private index = 0;
  private state: InputState = {
    move: [0, 0],
    camYawDeg: 0,
    jump: false,
    interact: false,
    pulse: false,
  };

  constructor(frames: InputFrame[] = []) {
    let previous = -1;
    for (const frame of frames) {
      if (!Number.isInteger(frame.tick) || frame.tick < 0) {
        throw new InputFormatError(`invalid frame tick: ${String(frame.tick)}`);
      }
      if (frame.tick <= previous) {
        throw new InputFormatError(`frame ticks must strictly increase (tick ${frame.tick})`);
      }
      previous = frame.tick;
      if (frame.move) {
        const [x, z] = frame.move;
        if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 1 || Math.abs(z) > 1) {
          throw new InputFormatError(`move must be within [-1, 1] at tick ${frame.tick}`);
        }
      }
      if (frame.cam_yaw_deg !== undefined && !Number.isFinite(frame.cam_yaw_deg)) {
        throw new InputFormatError(`invalid cam_yaw_deg at tick ${frame.tick}`);
      }
    }
    this.frames = frames;
  }

  /** Input state used by the step that produces tick `tick`. */
  at(tick: number): InputState {
    while (this.index < this.frames.length && this.frames[this.index].tick <= tick) {
      const frame = this.frames[this.index];
      if (frame.move) this.state.move = [frame.move[0], frame.move[1]];
      if (frame.cam_yaw_deg !== undefined) this.state.camYawDeg = frame.cam_yaw_deg;
      if (frame.jump !== undefined) this.state.jump = frame.jump;
      if (frame.interact !== undefined) this.state.interact = frame.interact;
      if (frame.pulse !== undefined) this.state.pulse = frame.pulse;
      this.index += 1;
    }
    return this.state;
  }
}

export function parseInputs(raw: unknown): InputFrame[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { frames?: unknown }).frames)) {
    throw new InputFormatError('inputs file must be an object with a "frames" array');
  }
  const frames = (raw as { frames: InputFrame[] }).frames;
  for (const frame of frames) {
    if (!frame || typeof frame !== 'object') {
      throw new InputFormatError('each input frame must be an object');
    }
  }
  return frames;
}
