/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// FPGA Simulation Engine in TypeScript
// Replicates the synchronous behavior of the clk_en, debounce, pwm8, scenes, and ctrl_fsm Verilog modules in real-time.

export interface SimState {
  // Inputs
  rst_btn: boolean;
  pir_raw: boolean;
  ldr_dark_raw: boolean;
  overcur_raw: boolean;
  btn_raw: boolean[]; // btn0_raw, btn1_raw, btn2_raw, btn3_raw
  sw_raw: boolean[];  // SW0, SW1, SW2, SW3 (sw_raw[3:0])
  uart_rx_line: boolean;

  // Intermediates (debounced and synced)
  rst_n: boolean;
  pir_sync: boolean;
  dark_sync: boolean;
  overcur_sync: boolean;
  btn_pressed_strobe: boolean[];
  btn_prev_level: boolean[];
  manual_event_strobe: boolean;

  // Timers and counters
  tick_1k: boolean;
  tick_10: boolean;
  clk_counter: number;
  pwm_counter: number; // 0..255
  auto_idle_timer: number; // in 10Hz ticks
  sched_time_cnt: number; // custom schedule countdown
  alarm_strobe_timer: number; // for emergency flashlight strobe

  // FSM & Outputs
  fsm_state: 'S_MANUAL' | 'S_SCHED' | 'S_AUTO' | 'S_ALARM';
  active_scene_id: number; // ROM Scene Index Lookup
  duty_L: number[]; // 4 lighting channels: L0, L1, L2, L3 (0-255)
  duty_F: number[]; // 2 fan channels: F0, F1 (0-255)
  relays: boolean[]; // R0, R1, R2, R3
  alarm_led: boolean;
}

export interface WaveSample {
  timeNs: number;
  clk: boolean;
  rst_n: boolean;
  pir_raw: boolean;
  pir_sync: boolean;
  ldr_dark_raw: boolean;
  dark_sync: boolean;
  overcur_raw: boolean;
  overcur_sync: boolean;
  manual_evt: boolean;
  fsm_state: number; // 0, 1, 2, 3
  L0_PWM: boolean;
  F0_PWM: boolean;
  R0: boolean;
  R1: boolean;
  ALARM_LED: boolean;
}

// Initial state creator
export function createInitialSimState(): SimState {
  return {
    rst_btn: false,
    pir_raw: false,
    ldr_dark_raw: false,
    overcur_raw: false,
    btn_raw: [false, false, false, false],
    sw_raw: [false, false, false, false],
    uart_rx_line: true, // idle high

    rst_n: true,
    pir_sync: false,
    dark_sync: false,
    overcur_sync: false,
    btn_pressed_strobe: [false, false, false, false],
    btn_prev_level: [false, false, false, false],
    manual_event_strobe: false,

    tick_1k: false,
    tick_10: false,
    clk_counter: 0,
    pwm_counter: 0,
    auto_idle_timer: 300, // ~30 seconds in 10Hz ticks
    sched_time_cnt: 0,
    alarm_strobe_timer: 0,

    fsm_state: 'S_MANUAL',
    active_scene_id: 0,
    duty_L: [0, 0, 0, 0],
    duty_F: [0, 0, 0, 0],
    relays: [false, false, false, false],
    alarm_led: false
  };
}

// ROM Presets lookups matching scenes.v
export function lookupScene(idx: number) {
  switch (idx) {
    case 0: // ALL OFF
      return { L: [0, 0, 0, 0], F: [0, 0], R: [false, false, false, false] };
    case 1: // COZY EVENING
      return { L: [64, 32, 16, 0], F: [40, 0], R: [true, true, false, false] };
    case 2: // WORK MODE
      return { L: [230, 200, 50, 0], F: [180, 120], R: [true, true, true, true] };
    case 3: // NIGHT SAFE
      return { L: [12, 0, 0, 12], F: [0, 0], R: [false, false, false, false] };
    case 4: // MOVIE NIGHT
      return { L: [10, 10, 8, 8], F: [50, 0], R: [false, false, true, false] };
    case 5: // ECO INTELLIGENT
      return { L: [45, 45, 0, 0], F: [80, 80], R: [true, false, false, true] };
    case 6: // ALARM SAFETY FLASHING
      return { L: [255, 255, 255, 255], F: [0, 0], R: [false, false, false, false] };
    default:
      return { L: [0, 0, 0, 0], F: [0, 0], R: [false, false, false, false] };
  }
}

// Run single time step (simulating hardware tick evaluation)
export function stepSimEngine(state: SimState, commandInjection?: { cmd: number; val: number }): SimState {
  const next = { ...state };

  // Set local active-low reset from active-high button
  next.rst_n = !next.rst_btn;

  if (!next.rst_n) {
    // Reset behaviors matching Verilog always blocks
    next.pir_sync = false;
    next.dark_sync = false;
    next.overcur_sync = false;
    next.btn_pressed_strobe = [false, false, false, false];
    next.btn_prev_level = [false, false, false, false];
    next.manual_event_strobe = false;
    next.pwm_counter = 0;
    next.auto_idle_timer = 300;
    next.sched_time_cnt = 0;
    next.fsm_state = 'S_MANUAL';
    next.active_scene_id = 0;
    next.duty_L = [0, 0, 0, 0];
    next.duty_F = [0, 0];
    next.relays = [false, false, false, false];
    next.alarm_led = false;
    return next;
  }

  // Speed scaling timing division simulation
  next.clk_counter = (next.clk_counter + 1) % 50; // virtual 50MHz scaling
  next.tick_1k = (next.clk_counter % 5 === 0);   // scaled tick enabling 1kHz
  next.tick_10 = (next.clk_counter === 0);       // scaled tick enabling 10Hz

  // 1. Synchronizer & Debouncer Simulation
  if (next.tick_10) {
    next.pir_sync = next.pir_raw;
    next.dark_sync = next.ldr_dark_raw;
    next.overcur_sync = next.overcur_raw;

    // Detect push button rising trigger pulses
    next.manual_event_strobe = false;
    for (let i = 0; i < 4; i++) {
      const active = next.btn_raw[i];
      if (active && !next.btn_prev_level[i]) {
        next.btn_pressed_strobe[i] = true;
        next.manual_event_strobe = true;
      } else {
        next.btn_pressed_strobe[i] = false;
      }
      next.btn_prev_level[i] = active;
    }
  } else {
    next.btn_pressed_strobe = [false, false, false, false];
    next.manual_event_strobe = false;
  }

  // 2. Schedule Event Simulation (tod counter countdown)
  let sched_triggered = false;
  let sched_scene_to_load = 1; // Cozy Evening

  if (next.tick_10) {
    next.sched_time_cnt++;
    if (next.sched_time_cnt >= 480) { // Fires every ~48 seconds in simulator scale
      next.sched_time_cnt = 0;
      sched_triggered = true;
      sched_scene_to_load = Math.random() > 0.5 ? 3 : 1; // Alternates Cozy Evening (1) & Night Safe (3)
    }
  }

  // 3. Command Packets Processing (Simulated UART Bridge)
  let cmd_valid = false;
  let cmd_scene_id = 7;
  let cmd_duty_write = 0;
  let cmd_alarm_clear = false;

  if (commandInjection) {
    cmd_valid = true;
    if (commandInjection.cmd === 0x03) {
      cmd_scene_id = commandInjection.val;
    } else if (commandInjection.cmd === 0x01) {
      cmd_duty_write = commandInjection.val;
    } else if (commandInjection.cmd === 0x05) {
      cmd_alarm_clear = true;
    }
  }

  // 4. FSM Transitions & Priority Resolver
  const current_fsm = next.fsm_state;
  let next_fsm = current_fsm;

  if (next.overcur_sync) {
    next_fsm = 'S_ALARM';
  } else {
    switch (current_fsm) {
      case 'S_MANUAL':
        if (next.pir_sync && next.dark_sync) {
          next_fsm = 'S_AUTO';
        } else if (sched_triggered) {
          next_fsm = 'S_SCHED';
        }
        break;

      case 'S_SCHED':
        if (next.manual_event_strobe || cmd_valid) {
          next_fsm = 'S_MANUAL';
        } else if (next.pir_sync && next.dark_sync) {
          next_fsm = 'S_AUTO';
        }
        break;

      case 'S_AUTO':
        if (next.manual_event_strobe || cmd_valid) {
          next_fsm = 'S_MANUAL';
        } else if (sched_triggered) {
          next_fsm = 'S_SCHED';
        } else if (next.auto_idle_timer === 0 && !next.pir_sync) {
          next_fsm = 'S_MANUAL';
        }
        break;

      case 'S_ALARM':
        if (cmd_alarm_clear && !next.overcur_sync) {
          next_fsm = 'S_MANUAL';
        }
        break;
    }
  }

  next.fsm_state = next_fsm;

  // 5. Sensor Idle Decay timer tracking
  if (next.fsm_state === 'S_AUTO') {
    if (next.tick_10) {
      if (next.pir_sync) {
        next.auto_idle_timer = 300; // Keep alive 30s
      } else if (next.auto_idle_timer > 0) {
        next.auto_idle_timer--;
      }
    }
  } else {
    next.auto_idle_timer = 300;
  }

  // 6. Output Drivers Mapping and Evaluation
  switch (next.fsm_state) {
    case 'S_MANUAL':
      next.alarm_led = false;
      if (cmd_valid && cmd_scene_id !== 7) {
        next.active_scene_id = cmd_scene_id;
        const lookup = lookupScene(cmd_scene_id);
        next.duty_L = [...lookup.L];
        next.duty_F = [...lookup.F];
        next.relays = [...lookup.R];
      } else if (cmd_valid) {
        next.duty_L = [cmd_duty_write, Math.floor(cmd_duty_write / 2), 0, 0];
        next.duty_F = [100, 0];
        next.relays = [true, false, true, false];
      } else if (next.manual_event_strobe) {
        // Toggles mapping
        next.duty_L = [
          next.sw_raw[0] ? 255 : 0,
          next.sw_raw[1] ? 180 : 0,
          next.sw_raw[2] ? 128 : 0,
          next.sw_raw[3] ? 64 : 0,
        ];
        next.duty_F = [
          next.sw_raw[0] ? 200 : 0,
          next.sw_raw[1] ? 120 : 0,
        ];
        next.relays = [...next.sw_raw];
      }
      break;

    case 'S_SCHED':
      next.alarm_led = false;
      next.active_scene_id = sched_scene_to_load;
      {
        const lookup = lookupScene(sched_scene_to_load);
        next.duty_L = [...lookup.L];
        next.duty_F = [...lookup.F];
        next.relays = [...lookup.R];
      }
      break;

    case 'S_AUTO':
      next.alarm_led = false;
      next.duty_L = [120, 100, 80, 0];
      next.duty_F = [150, 90];
      next.relays = [true, true, false, false];

      if (next.auto_idle_timer === 0) {
        next.duty_L = [0, 0, 0, 0];
        next.duty_F = [0, 0];
        next.relays = [false, false, false, false];
      }
      break;

    case 'S_ALARM':
      next.alarm_led = true;
      next.active_scene_id = 6; // Load Emergency Safe Scene (6)
      
      // Flash lighting channels at 10Hz tick intervals
      if (next.tick_10) {
        next.alarm_strobe_timer = (next.alarm_strobe_timer + 1) % 2;
        const flash_val = next.alarm_strobe_timer === 1 ? 255 : 0;
        next.duty_L = [flash_val, flash_val, flash_val, flash_val];
      }
      next.duty_F = [0, 0]; // Cut out fans
      next.relays = [false, false, false, false]; // Emergency cut power sockets
      break;
  }

  // 7. PWM Counter Increment Simulation
  if (next.tick_1k) {
    next.pwm_counter = (next.pwm_counter + 1) % 256;
  }

  return next;
}

// Generate an exact predefined list of waveform data samples approximating the testbench scenarios.
// This executes the logic and produces highly detailed waveform curves over time!
export function runSimulationTrace(): WaveSample[] {
  const state = createInitialSimState();
  const trace: WaveSample[] = [];
  let timeNs = 0;

  // Let's run a loop for 200 simulation ticks
  for (let cycle = 0; cycle < 500; cycle++) {
    timeNs += 10; // 10ns per cycle step

    // Define stimulus scenario times
    if (cycle === 10) {
      state.rst_btn = true; // Assert reset
    }
    if (cycle === 25) {
      state.rst_btn = false; // De-assert reset
    }

    // SCENARIO 1: Manual slide switches setting
    if (cycle === 40) {
      state.sw_raw = [true, true, false, true]; // SW0, SW1, SW3 enabled
      state.btn_raw[0] = true; // Pulse B0
    }
    if (cycle === 45) {
      state.btn_raw[0] = false;
    }

    // SCENARIO 2: Ambient turns dark, human walks into room
    if (cycle === 100) {
      state.ldr_dark_raw = true; // Night time LDR Dark active
    }
    if (cycle === 120) {
      state.pir_raw = true; // Motion detected! Transition to S_AUTO
    }
    if (cycle === 220) {
      state.pir_raw = false; // Person leaves, countdown decay begins
    }

    // SCENARIO 3: Remote serial bridge sends Overcurrent Alarm Emergency
    if (cycle === 320) {
      state.overcur_raw = true; // Overcurrent warning trips! Forces S_ALARM
    }
    if (cycle === 400) {
      state.overcur_raw = false; // Issue cleared
    }
    if (cycle === 430) {
      // Simulate serial packet CLEAR request
      // We pass the clear trigger to stepSimEngine
    }

    const command = (cycle === 435) ? { cmd: 0x05, val: 0 } : undefined; // CMD_CLEAR
    const nextState = stepSimEngine(state, command);
    Object.assign(state, nextState);

    // Sample waveforms
    const fsmNum = 
      state.fsm_state === 'S_MANUAL' ? 0 :
      state.fsm_state === 'S_SCHED' ? 1 :
      state.fsm_state === 'S_AUTO' ? 2 : 3;

    trace.push({
      timeNs,
      clk: cycle % 2 === 0,
      rst_n: state.rst_n,
      pir_raw: state.pir_raw,
      pir_sync: state.pir_sync,
      ldr_dark_raw: state.ldr_dark_raw,
      dark_sync: state.dark_sync,
      overcur_raw: state.overcur_raw,
      overcur_sync: state.overcur_sync,
      manual_evt: state.manual_event_strobe,
      fsm_state: fsmNum,
      L0_PWM: state.duty_L[0] > 0 ? (state.pwm_counter < state.duty_L[0]) : false,
      F0_PWM: state.duty_F[0] > 0 ? (state.pwm_counter < state.duty_F[0]) : false,
      R0: state.relays[0],
      R1: state.relays[1],
      ALARM_LED: state.alarm_led
    });
  }

  return trace;
}
