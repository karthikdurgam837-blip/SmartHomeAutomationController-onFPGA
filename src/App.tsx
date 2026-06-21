/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Cpu, Terminal, Layers, ShieldCheck, Award, BookOpen, Compass, Settings, FileText, ArrowRight, HelpCircle, Activity } from 'lucide-react';
import FpgaBoard from './components/FpgaBoard';
import WaveformViewer from './components/WaveformViewer';
import CodeExplorer from './components/CodeExplorer';
import ReportBuilder from './components/ReportBuilder';
import FaqAccordion from './components/FaqAccordion';

export default function App() {
  const [activeTab, setActiveTab] = useState<'board' | 'waveform' | 'code' | 'report' | 'interview'>('board');

  // Interactive Tech Stack Comparison Matrix
  const techOptions = [
    {
      id: 'A',
      title: "Option A: Basic (Entry-level Simulation)",
      difficulty: "Beginner",
      hardware: "NOT Required",
      tools: "ModelSim or EDA Playground",
      output: "Pure functional testbench, waveform logs, static status feedback.",
      desc: "Perfect for students new to hardware description languages. Focuses strictly on logic gates and basic clock ticking."
    },
    {
      id: 'B',
      title: "Option B: Visual (Board IO Mapping)",
      difficulty: "Intermediate",
      hardware: "Optional / Highly Recommended",
      tools: "Xilinx Vivado CAD Suite",
      output: "Fully mapped digital pins to Nexys A7 switches (sensors) and status LEDs (appliances).",
      desc: "Fuses software simulation with physical hardware design. Demystifies pin constraint mappings (.XDC) and synthesizer routing clocks."
    },
    {
      id: 'C',
      title: "Option C: Advanced (Full SoC Automation)",
      difficulty: "Advanced (Industry Ready)",
      hardware: "Optional",
      tools: "Vivado + Yosys + GTKWave + UART USB Bridge",
      output: "FSM with strict dynamic priority paths, auto-decay timing, serial checksum validation.",
      desc: "Implements of real-world silicon layouts incorporating metastability guards and serial link decoders. Highly rated for portfolios!"
    }
  ];

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Upper Main PCB Header Grid */}
      <header className="bg-slate-900 border-b border-slate-900 px-6 py-5 sticky top-0 z-50 shadow-md backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          {/* Logo & Headline */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/30 text-cyan-400 font-bold flex items-center justify-center shadow-lg shadow-cyan-950/20">
              <Cpu className="w-7 h-7 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white font-sans">
                  Smart Home Automation on FPGA
                </h1>
                <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-bold font-mono px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                  SYNTH COMPLIANT
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Industry-Oriented Verilog Digital Design Workstation & Behavioral Emulator
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-6 font-mono text-2xs text-slate-400 select-none bg-slate-950/40 p-2.5 px-4 rounded-xl border border-slate-800/80">
            <div>
              <span className="text-slate-500 font-bold uppercase tracking-widest">CORE RATIO:</span>{' '}
              <span className="text-cyan-400 font-semibold">50.000 MHz</span>
            </div>
            <div className="h-4 w-px bg-slate-800 hidden sm:block" />
            <div>
              <span className="text-slate-500 font-bold uppercase tracking-widest">BUS LINK:</span>{' '}
              <span className="text-cyan-400 font-semibold">115200 BAUD</span>
            </div>
            <div className="h-4 w-px bg-slate-800 hidden sm:block" />
            <div>
              <span className="text-slate-500 font-bold uppercase tracking-widest">FSM:</span>{' '}
              <span className="text-emerald-400 font-semibold">PRIORITY RESOLVED</span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 space-y-10">
        
        {/* SECTION 1: Digital Concept Explanations Banner */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-full bg-[radial-gradient(circle_at_right,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent pointer-events-none" />
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-4">
              <span className="text-3xs font-mono font-bold font-semibold uppercase tracking-widest text-cyan-400">
                COURSE MANUAL CONTEXT
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                Why use synthesizable hardware for custom home automation?
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Standard microcontrollers execute program lines sequentially, creating vulnerable software cycle delays that can lag during safety alarms or hazard trips. An <strong>FPGA (Field Programmable Gate Array)</strong> executes millions of logical structures in **true micro-level hardware parallelism**, verifying sensor thresholds, debouncer counters, clock timings, and safety cutaways near instantly.
              </p>

              {/* Workflow Flowcard requested by prompts */}
              <div className="border border-slate-850 p-4 bg-slate-950/40 rounded-xl mt-4 select-none">
                <span className="text-[10px] font-mono text-slate-500 font-bold block mb-3 uppercase tracking-wide">
                  SYSTEM CORE DATA PIPELINE WORKFLOW:
                </span>
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px] text-slate-400">
                  <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-slate-200">Sensors / Switches Inputs</span>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-cyan-300">Synchronizer & Debouncer</span>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-indigo-300">Moore Priority FSM</span>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="bg-indigo-950/40 border border-indigo-900/50 px-2 py-1 rounded text-indigo-400">8-bit PWM Generator</span>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-emerald-300">Appliance Load Activations</span>
                </div>
              </div>
            </div>

            {/* Business value & Industry relevance panel */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3.5 h-full">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Industry and Business Relevance
              </h3>
              <p className="text-3xs text-slate-400 leading-normal leading-relaxed">
                Deterministic real-time control, low-latency interlocks, and low-power hardware structures are fundamental inside high-performance building management systems, avionics environments, power grids, and industrial PLC (Programmable Logic Controller) designs.
              </p>
              <div className="border-t border-slate-850 pt-3 space-y-2">
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-slate-400 font-medium">Fmax Limit Target:</span>
                  <span className="text-cyan-400 font-mono font-bold">125 MHz</span>
                </div>
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-slate-400 font-medium">Metastability Protection:</span>
                  <span className="text-emerald-400 font-mono font-bold">Dual-Stage 2-FF Sync</span>
                </div>
                <div className="flex items-center justify-between text-2xs w-full">
                  <span className="text-slate-400 font-medium">Primary Architecture:</span>
                  <span className="text-indigo-400 font-mono font-bold uppercase">Single-Clock Synchronous</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* SECTION 2: Course Tech Stack Options Comparison Selector */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 mb-5 select-none">
            <div>
              <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-widest font-semibold">
                CURRICULAR PATHWAYS
              </span>
              <h3 className="font-bold text-base text-white mt-1">
                Curriculum Implementation Options Comparisons
              </h3>
            </div>
            <span className="text-3xs uppercase font-mono px-3 py-1 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-900/50">
              Instructor Recommendation: Pathway B & C
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
            {techOptions.map((opt) => (
              <div key={opt.id} className="bg-slate-950 border border-slate-900 rounded-xl p-4.5 flex flex-col justify-between h-full hover:border-slate-850 transition-all shadow">
                <div>
                  <div className="flex justify-between items-center mb-2 select-none">
                    <span className="font-mono text-3xs font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 uppercase">
                      PATHWAY {opt.id}
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${
                      opt.difficulty === 'Beginner' ? 'text-cyan-400' :
                      opt.difficulty === 'Intermediate' ? 'text-emerald-400' : 'text-purple-400'
                    }`}>
                      {opt.difficulty}
                    </span>
                  </div>
                  <h4 className="font-semibold text-xs text-slate-100 mb-2">{opt.title}</h4>
                  <p className="text-3xs text-slate-400 leading-relaxed mb-4">{opt.desc}</p>
                </div>

                <div className="border-t border-slate-900 pt-3.5 space-y-2 text-3xs select-none">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 uppercase font-semibold text-[8px]">CAD Tools:</span>
                    <span className="text-slate-300 font-mono font-semibold">{opt.tools}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 uppercase font-semibold text-[8px]">Inputs / Outputs:</span>
                    <span className="text-slate-300 font-mono font-semibold">{opt.output}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 uppercase font-semibold text-[8px]">HW Need:</span>
                    <span className="text-amber-500 font-mono font-bold">{opt.hardware}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: Workspace Interactive Navigation Tabs Toolbar */}
        <div className="space-y-6">
          
          {/* Tab buttons bar */}
          <div className="bg-slate-900 border border-slate-900 p-2 rounded-2xl flex flex-wrap gap-1.5 select-none shadow">
            {[
              { id: 'board', label: 'Tactile FPGA Board Simulation', icon: Cpu, color: 'text-cyan-400', glow: 'shadow-cyan-950/25 border-cyan-500/40 text-cyan-300 bg-cyan-950/20' },
              { id: 'waveform', label: 'GTKWave Logic Analyzer', icon: Activity, color: 'text-emerald-400', glow: 'shadow-emerald-950/25 border-emerald-500/40 text-emerald-300 bg-emerald-950/20' },
              { id: 'code', label: 'RTL Source Code Workspace', icon: Terminal, color: 'text-amber-400', glow: 'shadow-amber-950/25 border-amber-500/40 text-amber-300 bg-amber-950/20' },
              { id: 'report', label: 'Lab Verification Report', icon: FileText, color: 'text-indigo-400', glow: 'shadow-indigo-950/25 border-indigo-500/40 text-indigo-300 bg-indigo-950/20' },
              { id: 'interview', label: 'VLSI Technical Interview prep', icon: Award, color: 'text-pink-400', glow: 'shadow-pink-950/25 border-pink-500/40 text-pink-300 bg-pink-950/20' }
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                    isActive
                      ? `shadow ${tab.glow}`
                      : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-950/40'
                  }`}
                >
                  <IconComp className={`w-4 h-4 ${tab.color}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab Viewport Portal */}
          <div className="p-0.5">
            {activeTab === 'board' && <FpgaBoard />}
            {activeTab === 'waveform' && <WaveformViewer />}
            {activeTab === 'code' && <CodeExplorer />}
            {activeTab === 'report' && <ReportBuilder />}
            {activeTab === 'interview' && <FaqAccordion />}
          </div>

        </div>

      </main>

      {/* Corporate specs-grade footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 mt-16 px-6 font-mono text-[9px] text-slate-500 select-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <span>SMARTHOMEAUTOMATIONCONTROLLER ON FPGA Project Draft. For Academic and GitHub accreditation.</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-cyan-500 font-bold">
            <span>RTL: VERILOG 2001</span>
            <span>TIMING STATUS: CLOSED (+4.2ns slack)</span>
            <span>STANDARD: NEXYS_A7_PINOUT_YOSYS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
