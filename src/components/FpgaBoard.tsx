/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, AlertTriangle, Lightbulb, Wind, Power, Server, Terminal, Radio } from 'lucide-react';
import { createInitialSimState, stepSimEngine, lookupScene, SimState } from '../simulator/fpgaSimEngine';

export default function FpgaBoard() {
  const [state, setState] = useState<SimState>(() => createInitialSimState());
  const [uartLogs, setUartLogs] = useState<string[]>([]);
  const [uartCommand, setUartCommand] = useState<string>('scene2'); // dropdown preset
  
  // Keep track of ticks for animation frames
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto Tick Loop to animate PWM and clock states in real-time
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setState(prev => stepSimEngine(prev));
    }, 40); // 25Hz evaluation rate

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Sync inputs toggling handlers
  const handleToggleSwitch = (idx: number) => {
    setState(prev => {
      const nextSw = [...prev.sw_raw];
      nextSw[idx] = !nextSw[idx];
      return { ...prev, sw_raw: nextSw };
    });
  };

  const handlePushButtonDown = (idx: number) => {
    setState(prev => {
      const nextBtn = [...prev.btn_raw];
      nextBtn[idx] = true;
      return { ...prev, btn_raw: nextBtn };
    });
  };

  const handlePushButtonUp = (idx: number) => {
    setState(prev => {
      const nextBtn = [...prev.btn_raw];
      nextBtn[idx] = false;
      return { ...prev, btn_raw: nextBtn };
    });
  };

  const handleResetDown = () => {
    setState(prev => ({ ...prev, rst_btn: true }));
    setUartLogs(prev => [...prev, ...earlyLog("CPU Asynchronous Reset Asserted (Active-High)")]);
  };

  const handleResetUp = () => {
    setState(prev => ({ ...prev, rst_btn: false }));
    setUartLogs(prev => [...prev, ...earlyLog("CPU Reset Released. Resumed core processing.")]);
  };

  const handleSensorToggle = (type: 'pir' | 'ldr' | 'oc') => {
    setState(prev => {
      if (type === 'pir') return { ...prev, pir_raw: !prev.pir_raw };
      if (type === 'ldr') return { ...prev, ldr_dark_raw: !prev.ldr_dark_raw };
      return { ...prev, overcur_raw: !prev.overcur_raw };
    });
  };

  const earlyLog = (msg: string) => {
    return [`[${new Date().toLocaleTimeString()}] ${msg}`];
  };

  // Dispatch binary command frame to emulated UART port
  const handleSendUart = () => {
    let cmd = 0x01;
    let val = 0x00;
    let hexString = "";

    if (uartCommand === 'scene0') {
      cmd = 0x03; val = 0; hexString = "AA 03 01 00 A8"; // Preset Index 0
    } else if (uartCommand === 'scene1') {
      cmd = 0x03; val = 1; hexString = "AA 03 01 01 A9"; // Preset Index 1
    } else if (uartCommand === 'scene2') {
      cmd = 0x03; val = 2; hexString = "AA 03 01 02 AA"; // Preset Index 2 (Co-Working)
    } else if (uartCommand === 'scene3') {
      cmd = 0x03; val = 3; hexString = "AA 03 01 03 AB"; // Preset Index 3
    } else if (uartCommand === 'scene4') {
      cmd = 0x03; val = 4; hexString = "AA 03 01 04 AC"; // Preset Index 4
    } else if (uartCommand === 'lightFull') {
      cmd = 0x01; val = 255; hexString = "AA 01 01 FF 55"; // LightFull
    } else if (uartCommand === 'lightDim') {
      cmd = 0x01; val = 60; hexString = "AA 01 01 3C CA"; // LightDim
    } else if (uartCommand === 'clearAlarm') {
      cmd = 0x05; val = 0; hexString = "AA 05 01 00 AE"; // Clear alarm
    }

    // Inject parsed command directly into simulated logic register on next cycle
    setState(prev => stepSimEngine(prev, { cmd, val }));
    
    // Log binary telemetry frame stream
    setUartLogs(prev => {
      const logs = [...prev];
      logs.push(`[TX ──► RX] Sending Binary Frame: ${hexString}`);
      if (cmd === 0x03) {
        logs.push(`[FPGA RCV] Decoded instruction: LOAD_SCENE Preset Index #${val}`);
      } else if (cmd === 0x01) {
        logs.push(`[FPGA RCV] Decoded instruction: SET_DUTY PWM_0 to integer ${val}`);
      } else {
        logs.push(`[FPGA RCV] Decoded instruction: CLEAR_ALARM_LATCH Request`);
      }
      return logs.slice(-7); // Keep last 7 logs
    });
  };

  // Convert FSM state to virtual Seven Segment display output
  const getSevenSegmentDisplay = () => {
    switch (state.fsm_state) {
      case 'S_MANUAL': return 'MANU';
      case 'S_SCHED':  return 'SCHd';
      case 'S_AUTO':   return 'Auto';
      case 'S_ALARM':  return 'ALrM';
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" id="virtual-board-section">
      {/* LEFT PANEL: Virtual Smart Home Accessories (Dimmable lights, fans, relays) */}
      <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200 text-sm tracking-wider uppercase flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              Controlled Smart Appliances
            </h3>
            <span className={`text-2xs font-mono font-semibold px-2 py-0.5 rounded-full ${
              state.fsm_state === 'S_ALARM' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-slate-950 text-slate-400'
            }`}>
              State: {state.fsm_state}
            </span>
          </div>

          <p className="text-3xs text-slate-400 leading-normal mb-5">
            Real-time display showing lights and fans driven by high-frequency FPGA PWM generators, alongside dry contact power relay sockets.
          </p>

          {/* Connected Accessories Layout Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* L0..L3 Lights array */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-3.5 flex flex-col justify-between h-[155px]">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-3xs font-mono font-bold text-slate-400">PWM LIGHTS</span>
                <span className="text-3xs font-mono text-purple-400">8-bit Dim</span>
              </div>
              
              <div className="grid grid-cols-4 gap-1.5 flex-1 items-center">
                {state.duty_L.map((duty, idx) => {
                  const glowIntensity = duty / 255;
                  return (
                    <div key={idx} className="flex flex-col items-center">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300 relative"
                        style={{
                          backgroundColor: `rgba(234, 179, 8, ${0.05 + glowIntensity * 0.4})`,
                          borderColor: duty > 0 ? `rgba(234, 179, 8, ${0.4 + glowIntensity * 0.6})` : 'rgba(51, 65, 85, 0.4)',
                          boxShadow: duty > 0 ? `0 0 ${glowIntensity * 16}px rgba(234, 179, 8, ${0.2 + glowIntensity * 0.5})` : 'none'
                        }}
                      >
                        <Lightbulb className={`w-5 h-5 transition-colors ${duty > 0 ? 'text-yellow-400' : 'text-slate-700'}`} />
                        {duty > 0 && (
                          <span className="absolute top-0 right-0 bg-yellow-500 text-[6px] font-bold text-black px-0.5 rounded">
                            {duty}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-mono mt-1.5 text-slate-500 font-semibold">L{idx}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ventilation Fan Controllers (F0..F1) */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-3.5 flex flex-col justify-between h-[155px]">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-3xs font-mono font-bold text-slate-400">PWM VENTILATORS</span>
                <span className="text-3xs font-mono text-blue-400">Velocity</span>
              </div>

              <div className="grid grid-cols-2 gap-2 flex-1 items-center justify-center">
                {state.duty_F.map((duty, idx) => {
                  const isSpinning = duty > 0;
                  const spinDuration = isSpinning ? Math.max(0.3, 3 - (duty / 100)) : 0;
                  return (
                    <div key={idx} className="flex flex-col items-center">
                      <div
                        className="w-12 h-12 rounded-full border border-slate-800 flex items-center justify-center relative bg-slate-900/60"
                        style={{
                          borderColor: isSpinning ? 'rgba(59, 130, 246, 0.5)' : 'rgba(51, 65, 85, 0.3)',
                          boxShadow: isSpinning ? '0 0 10px rgba(59, 130, 246, 0.15)' : 'none'
                        }}
                      >
                        <Wind
                          className={`w-6 h-6 transition-colors ${isSpinning ? 'text-blue-400 animate-spin' : 'text-slate-700'}`}
                          style={{
                            animationDuration: isSpinning ? `${spinDuration}s` : '0s'
                          }}
                        />
                        {isSpinning && (
                          <span className="absolute -top-1 -right-1 bg-blue-500 text-[6px] font-bold text-white px-0.5 rounded">
                            {Math.round((duty/255)*100)}%
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-mono mt-1.5 text-slate-500 font-semibold">FAN {idx}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dry Relays Power sockets */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-3.5 flex flex-col justify-between h-[155px]">
              <div className="flex justify-between items-center mb-1">
                <span className="text-3xs font-mono font-bold text-slate-400">RELAY SOCKET INTERLOCK</span>
                <span className="text-3xs font-mono text-sky-400 font-bold px-1 rounded bg-sky-950/40">Gated</span>
              </div>

              <div className="grid grid-cols-4 gap-1 flex-1 items-center">
                {state.relays.map((relay, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded border flex items-center justify-center transition-all ${
                      relay 
                        ? 'bg-sky-500/10 border-sky-500/50 text-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                        : 'bg-slate-900 border-slate-800 text-slate-700'
                    }`}>
                      <Power className="w-4 h-4" />
                    </div>
                    <span className="text-[8px] font-mono mt-1 text-slate-500">R{idx}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger Fire Safety / Hazard Siren */}
            <div className={`border rounded-xl p-3.5 flex flex-col justify-between h-[155px] transition-all duration-300 ${
              state.alarm_led 
                ? 'bg-red-950/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
                : 'bg-slate-950 border-slate-900'
            }`}>
              <div className="flex justify-between items-center">
                <span className="text-3xs font-mono font-bold text-slate-400">SAFETY ALARM LED</span>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  state.alarm_led ? 'bg-red-500 text-black animate-pulse' : 'bg-slate-900 text-slate-600'
                }`}>
                  {state.alarm_led ? 'TRIPPED' : 'SECURE'}
                </span>
              </div>

              <div className="flex-1 flex flex-col justify-center items-center">
                <div className={`w-14 h-14 rounded-full border flex items-center justify-center relative ${
                  state.alarm_led
                    ? 'bg-red-500/20 border-red-500 animate-pulse text-red-500'
                    : 'bg-slate-900 border-slate-800 text-slate-700'
                }`}>
                  <AlertTriangle className="w-7 h-7" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sensory Inputs Controls Dashboard (Simulates PMOD switches/sensors) */}
        <div className="mt-5 border-t border-slate-800/80 pt-4">
          <h4 className="text-2xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-indigo-400" />
            Simulate External Sensors (PMOD JA)
          </h4>
          <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
            {/* PIR Occupancy Trigger */}
            <button
              onClick={() => handleSensorToggle('pir')}
              className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                state.pir_raw
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300 shadow-md'
                  : 'bg-slate-950/50 border-slate-900 text-slate-500 hover:text-slate-300 hover:bg-slate-950'
              }`}
            >
              <span className="text-[10px] font-bold">PIR Occupancy</span>
              <span className="text-[9px] font-mono mt-0.5">{state.pir_raw ? '● MOTION DET' : '○ EMPTY'}</span>
            </button>

            {/* LDR Lux Sensor */}
            <button
              onClick={() => handleSensorToggle('ldr')}
              className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                state.ldr_dark_raw
                  ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 shadow-md'
                  : 'bg-slate-950/50 border-slate-900 text-slate-500 hover:text-slate-300 hover:bg-slate-950'
              }`}
            >
              <span className="text-[10px] font-bold">LDR (Darkness)</span>
              <span className="text-[9px] font-mono mt-0.5">{state.ldr_dark_raw ? '● NIGHT DARK' : '○ DAYLIGHT'}</span>
            </button>

            {/* Overcurrent Emergency Trip */}
            <button
              onClick={() => handleSensorToggle('oc')}
              className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                state.overcur_raw
                  ? 'bg-red-500/15 border-red-500/50 text-red-400 shadow-md'
                  : 'bg-slate-950/50 border-slate-900 text-slate-500 hover:text-slate-300 hover:bg-slate-950'
              }`}
            >
              <span className="text-[10px] font-bold">Overcurrent Trip</span>
              <span className="text-[9px] font-mono mt-0.5">{state.overcur_raw ? '⚠️ EXCES LOAD' : '○ NORMAL'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* CENTER PANEL: Digital FPGA Development Hardware UI (Nexys A7 emulation) */}
      <div className="xl:col-span-7 bg-slate-950 border border-slate-900 rounded-2xl p-6 relative flex flex-col justify-between shadow-2xl overflow-hidden">
        {/* Decorative corner hex grids matching physical PCB layouts */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 to-transparent pointer-events-none" />
        
        <div>
          {/* PCB Brand Header */}
          <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-6 select-none font-mono">
            <div className="flex items-center gap-2">
              <div className="w-5.5 h-5.5 rounded-full bg-cyan-500 flex items-center justify-center font-bold text-black text-2xs shadow-[0_0_8px_rgba(6,182,212,0.4)]">⏃</div>
              <div>
                <h4 className="text-2xs text-slate-200 font-bold tracking-widest uppercase">NEXYS A7-100T</h4>
                <p className="text-[8px] text-slate-500">DIGILENT® DESIGN ENVIRONMENT / ARTIX-7 FPGA</p>
              </div>
            </div>
            <div className="text-[9px] text-slate-500 text-right">
              <div>HOST CLK: 50.000 MHz</div>
              <div>PINOUTS: COMPLIANT</div>
            </div>
          </div>

          {/* Graphical Representation of PCB Central Chip */}
          <div className="grid grid-cols-12 gap-6 items-center mb-6">
            {/* 7-Segment Modes Display */}
            <div className="col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between h-[120px] shadow-inner select-none">
              <span className="text-3xs font-mono text-slate-500 font-semibold uppercase tracking-wider">7-Segment Display</span>
              <div className="flex items-center justify-center gap-1.5 flex-1 select-none">
                {getSevenSegmentDisplay().split('').map((char, index) => (
                  <div
                    key={index}
                    className="w-8 h-12 bg-black border border-slate-900 rounded flex items-center justify-center font-mono text-xl font-bold shadow-neon-glow"
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      color: state.fsm_state === 'S_ALARM' ? '#ef4444' : '#06b6d4',
                      textShadow: state.fsm_state === 'S_ALARM' ? '0 0 8px rgba(239, 68, 68, 0.6)' : '0 0 10px rgba(6, 182, 212, 0.6)'
                    }}
                  >
                    {char.toUpperCase()}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono mt-1">
                <span>MODE INDICATOR</span>
                <span className="text-cyan-400">DEC: {state.fsm_state === 'S_ALARM' ? '3' : state.fsm_state === 'S_AUTO' ? '2' : '0'}</span>
              </div>
            </div>

            {/* ARTIX-7 Main FPGA Silicon Block */}
            <div className="col-span-7 h-[120px] bg-slate-900 border-2 border-slate-800 rounded-xl flex flex-col items-center justify-center p-3 text-center relative select-none">
              <span className="absolute top-1 left-2 text-[8px] font-mono text-slate-600">MAIN IC</span>
              <div className="w-16 h-16 bg-slate-950 border border-indigo-500/20 rounded flex items-center justify-center flex-col shadow-lg-indigo mb-1 relative">
                <span className="text-indigo-400 font-bold text-3xs tracking-widest font-mono">XILINX®</span>
                <span className="text-slate-400 text-[8px] font-mono select-none mt-0.5">ARTIX-7</span>
                <div className="absolute top-0 bottom-0 left-0 right-0 border border-cyan-400/10 rounded animate-pulse" />
              </div>
              <span className="text-[10px] font-semibold text-slate-300 font-mono">XC7A100T-CSG324</span>
              <span className="text-[8px] font-mono text-slate-500">SYSTEM GATE COMPLEX CELL INTEGRATION</span>
            </div>
          </div>

          {/* Slides Switches Area (GPIOSW[3:0]) */}
          <div className="bg-slate-900/60 border border-slate-950 p-4.5 rounded-xl mb-5">
            <div className="flex items-center justify-between mb-3 text-3xs font-mono text-slate-500 select-none">
              <span>BOARD SLIDE SWITCHES [3:0] (sw_raw)</span>
              <span>STATE SETTING</span>
            </div>
            
            <div className="grid grid-cols-4 gap-4">
              {state.sw_raw.map((swActive, idx) => (
                <div
                  key={idx}
                  onClick={() => handleToggleSwitch(idx)}
                  className="bg-slate-950 border border-slate-900 rounded-lg p-2.5 flex flex-col items-center cursor-pointer hover:bg-slate-900 transition-all text-center select-none"
                >
                  <span className="text-[9px] font-mono text-slate-400 font-bold mb-2">sw_raw[{idx}]</span>
                  <div className={`w-6 h-11 bg-slate-900 rounded-md border border-slate-800 p-1 flex flex-col justify-between items-center transition-colors relative ${
                    swActive ? 'bg-indigo-950/20 border-indigo-500/40' : ''
                  }`}>
                    <div className={`w-3.5 h-4.5 rounded transition-all shadow ${
                      swActive ? 'bg-indigo-400 transform translate-y-4' : 'bg-slate-700'
                    }`} />
                  </div>
                  <span className={`text-[8px] font-mono mt-2 font-bold ${swActive ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {swActive ? 'HIGH_1' : 'LOW_0'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Mechanical Pushbuttons and Rest Btn */}
          <div className="grid grid-cols-12 gap-4">
            {/* CPU Asynchronous reset push button (Active High) */}
            <div className="col-span-4 bg-slate-900/60 border border-slate-950 p-4.5 rounded-xl flex flex-col items-center justify-between">
              <span className="text-[8px] font-mono font-bold text-red-400 select-none uppercase tracking-widest text-center">Global Resets</span>
              <button
                onMouseDown={handleResetDown}
                onMouseUp={handleResetUp}
                onMouseLeave={handleResetUp}
                className={`w-14 h-14 rounded-full border-4 flex flex-col items-center justify-center transition-all select-none mt-2 shadow ${
                  state.rst_btn 
                    ? 'bg-red-500/20 border-red-500 text-red-500 scale-95 shadow-[0_0_12px_rgba(239,68,68,0.3)]' 
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-red-500/30 hover:text-slate-300'
                }`}
              >
                <RotateCcw className="w-5 h-5 shrink-0" />
                <span className="text-[8px] font-bold font-mono mt-0.5 text-center">RST_BTN</span>
              </button>
              <span className="text-[8px] font-mono text-slate-500 text-center select-none mt-2">Active-High</span>
            </div>

            {/* Local Override Buttons Array (B0..B3) */}
            <div className="col-span-8 bg-slate-900/60 border border-slate-900/50 p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[8px] font-mono text-slate-500 select-none uppercase tracking-widest">TACTILE DIRECT BUTTONS (btn_raw[3:0])</span>
              
              <div className="grid grid-cols-4 gap-2.5 mt-3 select-none">
                {state.btn_raw.map((btnActive, idx) => (
                  <button
                    key={idx}
                    onMouseDown={() => handlePushButtonDown(idx)}
                    onMouseUp={() => handlePushButtonUp(idx)}
                    onMouseLeave={() => handlePushButtonUp(idx)}
                    className={`p-2 py-3 rounded-lg border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                      btnActive
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 scale-95 shadow-md'
                        : 'bg-slate-950 border-slate-900 text-slate-400 hover:border-slate-800'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full border border-slate-700 bg-slate-900/40 relative flex items-center justify-center shadow-inner">
                      <div className={`w-2.5 h-2.5 rounded-full transition-colors ${btnActive ? 'bg-cyan-400 animate-ping' : 'bg-slate-800'}`} />
                    </div>
                    <span className="text-[9px] font-mono font-bold mt-2">btn{idx}</span>
                  </button>
                ))}
              </div>
              <span className="text-[8px] font-mono text-slate-500 mt-2 select-none">Pressing registers rising-edge manual pulse trigger.</span>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Emulated UART Host command sender console (ESP32) */}
        <div className="bg-slate-900 border border-slate-950 p-4.5 rounded-xl mt-5 h-56 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xs font-mono text-slate-500 font-bold uppercase flex items-center gap-1.5 select-none">
              <Terminal className="w-4 h-4 text-emerald-400" />
              ESP32 IoT UART Controller Terminal
            </span>
            <div className="flex items-center gap-1.5 font-sans">
              <select
                value={uartCommand}
                onChange={(e) => setUartCommand(e.target.value)}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded px-2 py-0.5 text-3xs font-mono outline-none"
              >
                <option value="scene2">CMD:0x03 SCENE 2 (Co-working)</option>
                <option value="scene1">CMD:0x03 SCENE 1 (Evening Cozy)</option>
                <option value="scene3">CMD:0x03 SCENE 3 (Night Safe)</option>
                <option value="scene4">CMD:0x03 SCENE 4 (Movie Night)</option>
                <option value="scene0">CMD:0x03 SCENE 0 (ALL OFF)</option>
                <option value="lightFull">CMD:0x01 WRITE PWM_0 [255]</option>
                <option value="lightDim">CMD:0x01 WRITE PWM_0 [60]</option>
                <option value="clearAlarm">CMD:0x05 CLEAR EMERGENCY LATCH</option>
              </select>
              <button
                onClick={handleSendUart}
                className="bg-cyan-500 hover:bg-cyan-400 text-black px-2.5 py-0.5 text-3xs font-semibold rounded flex items-center gap-1 transition-all"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Transmit command packet</span>
              </button>
            </div>
          </div>

          {/* Retro logging viewport */}
          <div className="bg-black/95 rounded-lg p-2.5 flex-1 overflow-y-auto font-mono text-[9px] text-emerald-500 border border-slate-950 leading-relaxed max-h-[120px] select-text">
            {uartLogs.length === 0 ? (
              <div className="text-slate-600 italic select-none">No serial frame transmissions recorded. Press "Transmit command packet" above to send binary frame arrays over UART Rx lines.</div>
            ) : (
              uartLogs.map((log, idx) => (
                <div key={idx} className={log.includes('TX ──► RX') ? 'text-indigo-400' : 'text-emerald-500'}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
