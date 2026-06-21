/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Compass, Info, Play, RefreshCw, Layers } from 'lucide-react';
import { runSimulationTrace, WaveSample } from '../simulator/fpgaSimEngine';

export default function WaveformViewer() {
  const [trace] = useState<WaveSample[]>(() => runSimulationTrace());
  const [zoom, setZoom] = useState(1); // 1 = regular, 0.5 = zoom out, 2 = zoom in
  const [cursorIdx, setCursorIdx] = useState(120); // active hovered cursor index
  const [highlightedScenario, setHighlightedScenario] = useState<number | null>(null);

  // Scenarios checkpoints to help student navigate and understand
  const scenarios = [
    {
      id: 0,
      title: "System Reset & Boot",
      desc: "Simulates board boot-up. Active-high reset btn is held and released, loading initial manual registers (S_MANUAL, all outputs low).",
      range: [0, 40],
      marker: 15
    },
    {
      id: 1,
      title: "Physical Overrides",
      desc: "Static switches are toggled (SW0,SW1,SW3 on, SW2 off) and B0 button is pulsed. Edge-detect triggers manual loading override values.",
      range: [40, 100],
      marker: 45
    },
    {
      id: 2,
      title: "Sensor Auto Trigger",
      desc: "Occupancy PIR detected in ambient darkness. FSM shifts to S_AUTO, turning on dynamic low-energy lighting maps instantly.",
      range: [100, 310],
      marker: 150
    },
    {
      id: 3,
      title: "Overcurrent Trip & Alarm",
      desc: "Emergency trip wire high! Critical logic priority trips and locks state inside S_ALARM, disabling sockets and flashing lights.",
      range: [310, 500],
      marker: 350
    }
  ];

  const handleScenarioClick = (sc: typeof scenarios[0]) => {
    setCursorIdx(Math.floor(sc.marker));
    setHighlightedScenario(sc.id);
  };

  // Canvas bounds sizing
  const widthPerStep = 6 * zoom;
  const traceLength = trace.length;
  const containerWidth = traceLength * widthPerStep;
  const rowHeight = 32;

  // Active hover sample
  const cursorSample = trace[cursorIdx] || trace[0];

  function getFsmText(num: number) {
    if (num === 0) return 'MANUAL (2\'b00)';
    if (num === 1) return 'SCHED (2\'b01)';
    if (num === 2) return 'AUTO (2\'b10)';
    return 'ALARM (2\'b11)';
  }

  // Helper to generate SVG polyline points for normal logic signal
  const renderDigitalWav = (signalName: keyof WaveSample) => {
    let pts = "";
    for (let i = 0; i < traceLength; i++) {
      const val = trace[i][signalName] ? 1 : 0;
      const x1 = i * widthPerStep;
      const x2 = (i + 1) * widthPerStep;
      const y = (val === 1) ? 4 : rowHeight - 6;

      if (i === 0) {
        pts += `${x1},${y} `;
      } else {
        // Create standard square digital transition line
        const prevVal = trace[i-1][signalName] ? 1 : 0;
        if (prevVal !== val) {
          const prevY = (prevVal === 1) ? 4 : rowHeight - 6;
          pts += `${x1},${prevY} ${x1},${y} `;
        }
      }
      pts += `${x2},${y} `;
    }
    return pts;
  };

  // Helper to draw FSM State vector block boundaries
  const renderStateArray = () => {
    const blocks: React.ReactNode[] = [];
    let startIdx = 0;
    let currentState = trace[0].fsm_state;

    for (let i = 1; i < traceLength; i++) {
      if (trace[i].fsm_state !== currentState || i === traceLength - 1) {
        const x1 = startIdx * widthPerStep;
        const x2 = i * widthPerStep;
        const label = 
          currentState === 0 ? 'S_MANUAL' :
          currentState === 1 ? 'S_SCHED' :
          currentState === 2 ? 'S_AUTO' : 'S_ALARM';

        const colorMap = 
          currentState === 0 ? 'bg-slate-700 text-slate-200 border-slate-600' :
          currentState === 1 ? 'bg-teal-950 text-teal-300 border-teal-800' :
          currentState === 2 ? 'bg-amber-950/80 text-amber-300 border-amber-800' :
          'bg-rose-950/80 text-rose-300 border-rose-800';

        blocks.push(
          <g key={startIdx} className="group/vector">
            <rect
              x={x1}
              y={2}
              width={x2 - x1}
              height={rowHeight - 4}
              className={`fill-slate-900 stroke-slate-700/80 hover:fill-slate-800 transition-colors`}
              strokeWidth={1}
            />
            {x2 - x1 > 40 && (
              <text
                x={x1 + (x2 - x1) / 2}
                y={rowHeight / 2 + 4}
                className="font-mono text-3xs font-bold fill-sky-400 text-anchor-middle"
                style={{ textAnchor: 'middle' }}
              >
                {label}
              </text>
            )}
          </g>
        );

        startIdx = i;
        currentState = trace[i].fsm_state;
      }
    }
    return blocks;
  };

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 shadow-xl" id="waveform-section">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-900 pb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            GTKWave Emulation: Verilog Simulation Waveforms
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Visual verification of debouncers settling times, core Moore FSM register logic, and precision high-frequency PWM pulses.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-all flex items-center gap-1 font-mono"
            disabled={zoom <= 0.5}
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-slate-500 font-semibold select-none px-2 text-2xs">
            Zoom {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-all flex items-center gap-1 font-mono"
            disabled={zoom >= 3}
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Guide Scenario buttons for student */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        {scenarios.map((sc) => (
          <button
            key={sc.id}
            onClick={() => handleScenarioClick(sc)}
            className={`text-left p-3 rounded-xl border transition-all h-full flex flex-col justify-between ${
              highlightedScenario === sc.id
                ? 'bg-emerald-500/10 border-emerald-500/40 shadow-emerald-950/20 shadow-md'
                : 'bg-slate-900/40 border-slate-900/60 hover:bg-slate-900'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-3xs px-2 py-0.5 rounded font-mono font-bold ${
                  sc.id === 0 ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                  sc.id === 1 ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                  sc.id === 2 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  SCENARIO {sc.id}
                </span>
                <span className="font-mono text-3xs text-slate-500">{sc.marker * 10}ns</span>
              </div>
              <h4 className="font-medium text-xs text-slate-300 mb-1.5">{sc.title}</h4>
              <p className="text-3xs text-slate-500 leading-relaxed font-sans">{sc.desc}</p>
            </div>
            <div className="mt-3 flex items-center text-3xs text-slate-400 font-mono gap-1 group-hover:text-emerald-400">
              <Play className="w-3 h-3 text-emerald-400 fill-emerald-500/15" />
              <span>Jump to timeline</span>
            </div>
          </button>
        ))}
      </div>

      {/* Waveforms Plotter Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Signals Directory Panel (Left Rail) */}
        <div className="bg-slate-900/80 border border-slate-900 rounded-xl p-3 select-none flex flex-col justify-between">
          <div>
            <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5 px-1 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              Registered Signals
            </div>
            <div className="space-y-1 font-mono text-2xs">
              {[
                { name: 'clk_50m', type: 'clk', desc: 'Board Clock Network' },
                { name: 'rst_n', type: 'rst', desc: 'Synchronized Reset' },
                { name: 'pir_raw', type: 'in', desc: 'Asynchronous Occupancy' },
                { name: 'pir_sync', type: 'synced', desc: 'Debounced Status PIR' },
                { name: 'ldr_dark_raw', type: 'in', desc: 'Amb. Light Sensor LDR' },
                { name: 'dark_sync', type: 'synced', desc: 'Sensed Ambient Light' },
                { name: 'overcur_raw', type: 'in', desc: 'Power Overlimit' },
                { name: 'current_mode[1:0]', type: 'vector', desc: 'FSM Core Registers' },
                { name: 'L0_PWM_Dimmer', type: 'pwm', desc: 'Primary Dimmer Line' },
                { name: 'F0_PWM_Fan', type: 'pwm', desc: 'Primary Fan Line' },
                { name: 'R0 (Relay_0)', type: 'relay', desc: 'Power Socket 0' },
                { name: 'ALARM_LED_Siren', type: 'out', desc: 'Critical Strobe Light' }
              ].map((sig, idx) => (
                <div
                  key={idx}
                  className="p-1 px-2 rounded hover:bg-slate-850 flex items-center justify-between border border-transparent hover:border-slate-800 transition-all text-slate-400"
                >
                  <span className="text-slate-300 font-semibold truncate max-w-[124px]" title={sig.desc}>
                    {sig.name}
                  </span>
                  <span className={`text-[9px] px-1 py-0.2 rounded shrink-0 uppercase font-bold tracking-tight ${
                    sig.type === 'clk' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                    sig.type === 'vector' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                    sig.type === 'pwm' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                    sig.type === 'synced' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {sig.type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-3.5 mt-4 text-3xs font-mono text-slate-500 space-y-1 bg-slate-950/45 p-2 rounded-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span>Timeline:</span>
              <span className="text-emerald-400 font-bold">{cursorSample.timeNs} ns</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Core FSM State:</span>
              <span className="text-indigo-400 font-medium">{getFsmText(cursorSample.fsm_state)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>L0 PWM State:</span>
              <span className={`font-bold ${cursorSample.L0_PWM ? 'text-emerald-500' : 'text-slate-600'}`}>
                {cursorSample.L0_PWM ? 'HIGH_1' : 'LOW_0'}
              </span>
            </div>
          </div>
        </div>

        {/* Waves SVG Plot Container (Right Canvas) */}
        <div className="lg:col-span-3 bg-slate-900/40 border border-slate-900 rounded-xl relative overflow-hidden flex flex-col h-[400px]">
          {/* Time axis marks */}
          <div className="bg-slate-950 border-b border-slate-900 h-8 flex overflow-x-auto overflow-y-hidden select-none relative scrollbar-thin">
            <div style={{ width: containerWidth }} className="h-full relative shrink-0">
              {Array.from({ length: Math.ceil(traceLength / 10) }).map((_, stepIdx) => {
                const idx = stepIdx * 10;
                const x = idx * widthPerStep;
                return (
                  <div
                    key={stepIdx}
                    className="absolute top-0 bottom-0 border-l border-slate-800 flex flex-col justify-between pl-1 text-[9px] font-mono text-slate-600"
                    style={{ left: x }}
                  >
                    <span>{idx * 10} ns</span>
                    <span className="h-2 w-px bg-slate-700" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Canvas Wave Streams scroll area */}
          <div className="flex-1 overflow-auto scrollbar-thin select-none relative bg-slate-950/20">
            {/* SVG drawing grids */}
            <div className="relative shrink-0" style={{ width: containerWidth, height: rowHeight * 12 }}>
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {/* Horizontal lane separators and bounds */}
                {Array.from({ length: 12 }).map((_, rIdx) => (
                  <line
                    key={rIdx}
                    x1={0}
                    y1={(rIdx + 1) * rowHeight}
                    x2={containerWidth}
                    y2={(rIdx + 1) * rowHeight}
                    className="stroke-slate-900"
                    strokeWidth={1}
                  />
                ))}

                {/* Vertical time marker grids inside canvas */}
                {Array.from({ length: Math.ceil(traceLength / 10) }).map((_, stepIdx) => {
                  const x = stepIdx * 10 * widthPerStep;
                  return (
                    <line
                      key={stepIdx}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={rowHeight * 12}
                      className="stroke-slate-900/40"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                  );
                })}

                {/* --- Logic Graph Lines --- */}

                {/* 1. clk */}
                <g transform={`translate(0, ${rowHeight * 0})`}>
                  <polyline points={renderDigitalWav('clk')} fill="none" className="stroke-amber-500/75" strokeWidth={1.5} />
                </g>

                {/* 2. rst_n */}
                <g transform={`translate(0, ${rowHeight * 1})`}>
                  <polyline points={renderDigitalWav('rst_n')} fill="none" className="stroke-teal-400" strokeWidth={1.5} />
                </g>

                {/* 3. pir_raw */}
                <g transform={`translate(0, ${rowHeight * 2})`}>
                  <polyline points={renderDigitalWav('pir_raw')} fill="none" className="stroke-slate-500" strokeWidth={1.5} />
                </g>

                {/* 4. pir_sync */}
                <g transform={`translate(0, ${rowHeight * 3})`}>
                  <polyline points={renderDigitalWav('pir_sync')} fill="none" className="stroke-emerald-400" strokeWidth={1.5} />
                </g>

                {/* 5. ldr_dark_raw */}
                <g transform={`translate(0, ${rowHeight * 4})`}>
                  <polyline points={renderDigitalWav('ldr_dark_raw')} fill="none" className="stroke-slate-500" strokeWidth={1.5} />
                </g>

                {/* 6. dark_sync */}
                <g transform={`translate(0, ${rowHeight * 5})`}>
                  <polyline points={renderDigitalWav('dark_sync')} fill="none" className="stroke-emerald-400" strokeWidth={1.5} />
                </g>

                {/* 7. overcur_raw */}
                <g transform={`translate(0, ${rowHeight * 6})`}>
                  <polyline points={renderDigitalWav('overcur_raw')} fill="none" className="stroke-rose-500" strokeWidth={1.5} />
                </g>

                {/* 8. FSM mode_state array block boundary */}
                <g transform={`translate(0, ${rowHeight * 7})`}>
                  {renderStateArray()}
                </g>

                {/* 9. L0_PWM dimmer */}
                <g transform={`translate(0, ${rowHeight * 8})`}>
                  <polyline points={renderDigitalWav('L0_PWM')} fill="none" className="stroke-purple-400" strokeWidth={1.5} />
                </g>

                {/* 10. F0_PWM fan speed */}
                <g transform={`translate(0, ${rowHeight * 9})`}>
                  <polyline points={renderDigitalWav('F0_PWM')} fill="none" className="stroke-blue-400" strokeWidth={1.5} />
                </g>

                {/* 11. Relay_0 */}
                <g transform={`translate(0, ${rowHeight * 10})`}>
                  <polyline points={renderDigitalWav('R0')} fill="none" className="stroke-sky-400" strokeWidth={1.5} />
                </g>

                {/* 12. ALARM_LED SIREN */}
                <g transform={`translate(0, ${rowHeight * 11})`}>
                  <polyline points={renderDigitalWav('ALARM_LED')} fill="none" className="stroke-rose-500" strokeWidth={1.5} />
                </g>

                {/* Live Mouse Cursor Marker Tracking rule */}
                {cursorIdx !== null && (
                  <g>
                    <line
                      x1={cursorIdx * widthPerStep}
                      y1={0}
                      x2={cursorIdx * widthPerStep}
                      y2={rowHeight * 12}
                      className="stroke-cyan-400/90"
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={cursorIdx * widthPerStep}
                      cy={rowHeight * 12 - 5}
                      r={3}
                      className="fill-cyan-400 shadow-lg"
                    />
                  </g>
                )}
              </svg>

              {/* Click intercepts overlay catcher */}
              <div
                className="absolute inset-0 cursor-crosshair"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
                  const idx = Math.min(traceLength - 1, Math.max(0, Math.floor(x / widthPerStep)));
                  setCursorIdx(idx);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Synchronizer and CDC analysis footnote */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mt-5 flex items-start gap-3 text-xs select-none">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5 leading-relaxed font-sans">
          <h4 className="font-semibold text-slate-300">Verification Note: Clock Domain Crossings (CDC) & Metastability Protection</h4>
          <p className="text-slate-400 text-3xs">
            Review the synchronization waves above: When raw sensor inputs like <strong className="text-amber-500 font-mono">pir_raw</strong> or <strong className="text-amber-500 font-mono">ldr_dark_raw</strong> shift asynchronously, they are held by the 2-stage synchronizer register flip-flops inside <strong className="text-cyan-400 font-mono">debounce.v</strong> before falling into synched signals (<strong className="text-emerald-400 font-mono">pir_sync</strong>, <strong className="text-emerald-400 font-mono">dark_sync</strong>). This holds the signal bound until mechanical chatter is decayed, preventing metastabilities or timing hazards inside the main sequential FSM controller module!
          </p>
        </div>
      </div>
    </div>
  );
}
