/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, Award, CheckCircle, ShieldCheck, HelpCircle as HelpIcon } from 'lucide-react';

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  topic: string;
}

export default function FaqAccordion() {
  const [activeId, setActiveId] = useState<number | null>(0);

  const faqData: FaqItem[] = [
    {
      id: 0,
      topic: "SYSTEM DESCRIPTION",
      question: "Can you explain your FPGA Smart Home Automation project?",
      answer: "This project represents a parameterizable home-automation controller on an FPGA designed in synthesizable Verilog. It manages a hierarchical layout: 4 PWM lights, 2 PWM fans, 4 sockets, and 3 security sensors. It segregates logic domains through pre-generated 1kHz and 10Hz clock-enable divider strobes. An FSM arbitrates operational modes based on priority: ALARM is critical override level 0, MANUAL overrides AUTO mode, SENSOR AUTO leverages PIR or light sensors, and SCHEDULE coordinates BRAM ROM presets. Direct serial control is established via an oversampled UART receiver parsing binary frame lines."
    },
    {
      id: 1,
      topic: "CLOCK BOUNDS",
      question: "Why did you use clock-enable ticks (1kHz/10Hz) instead of generating native clock nets via dividers?",
      answer: "In FPGA design, routing dividers directly as clocks (e.g., in always @(posedge divided_clk)) produces multiple clock domains, leading to clock skew, timing hazards, and Clock Domain Crossing (CDC) synchronization problems. By using clock-enables generated with a master single clock (always @(posedge clk_50m) if (tick_1k) ...), the entire system operates synchronous to a single physical global clock tree. This avoids CDC race conditions, reduces power consumption, and ensures quick, stable timing closure within Vivado."
    },
    {
      id: 2,
      topic: "METASTABILITY / CDC",
      question: "What is metastability and how does your debounce.v protect against it?",
      answer: "Metastability occurs when asynchronous input lines (buttons, external sensor switches) change state within the setup or hold-time windows of the receiving flip-flop register, causing its output to dwell or oscillate in a non-logical state. To protect against this, debounce.v utilizes a dual-stage register synchronizer (2-FF Sync). The first FF captures the asynchronous signal, and the second FF registers the settled level on the next clock edge. A counter debouncer then holds evaluation for a set period (e.g. 5 ticks) to filter out mechanical button bounce before firing logical transits."
    },
    {
      id: 3,
      topic: "FSM ARCHITECTURE",
      question: "How is the priority resolver mapped in your control FSM?",
      answer: "The control FSM (ctrl_fsm.v) utilizes a priority-based state transition look-up. Transition logic check is cascaded: First, if the 'overcurrent_trip' sensor is ever asserted, the FSM transitions directly to S_ALARM, shutting down Relays and Fans instantly. Next, if user local tactile switch toggles exist (manual_evt), the FSM locks into S_MANUAL. Only if manual events are inactive does the state machine evaluate environmental sensors (pir_sensor && ldr_dark) shifting to S_AUTO or scheduled calendar intervals (sched_trigger) shifting to S_SCHED. This strict hierarchy ensures safety loops cannot be bypassed."
    },
    {
      id: 4,
      topic: "SYNTHESIS DISCREPANCIES",
      question: "What is a simulation vs. synthesis mismatch, and how did you prevent it in ctrl_fsm.v?",
      answer: "A simulation-vs-synthesis mismatch happens when the behavioral simulator interprets a Verilog coding model differently than the compiler synthesis tool. This commonly occurs because of incomplete sensitivity lists in combinational always blocks (always @(*)), or uninitialized case maps that compile into latch networks instead of multiplexers. In this project, all combinational blocks use complete wildcards 'always @(*)', all registers are initialized asynchronously under an active-low reset tree, and ROM tables incorporate custom 'default' statements to ensure latch syntheses are explicitly avoided."
    },
    {
      id: 5,
      topic: "HARDWARE TIMING SLACK",
      question: "Explain setup and hold time. How do you analyze timing violations in Vivado?",
      answer: "Setup time is the minimum duration the data input must remain stable before the active clock edge. Hold time is the minimum duration the data input must remain stable after the active clock edge. Under-slack violations indicate signals are propagating too slowly (Setup fail) or too quickly (Hold fail). To analyze, we inspect the Post-Route Timing Report in Vivado to extract Worst Negative Slack (WNS) and Worst Hold Slack (WHS) metrics. Solutions include inserting pipelining registers to shorten long combinatorial routing paths."
    },
    {
      id: 6,
      topic: "SERIAL PROTOCOL",
      question: "Why did you implement oversampling in your UART receiver and how does frame parsing work?",
      answer: "UART is asynchronous; there is no shared clock line, meaning minor frequency discrepancies exist between transmitter and receiver. By sampling at 16x the baud rate, the receiver detects start bits reliably on falling transitions. It then counts 8 samples to read right in the middle of each payload bit to bypass cable noise. The protocol block then maps bytes into a frame register array, verifying header (0xAA), packet length, and compiling XOR hashes to protect against frame line dropouts."
    },
    {
      id: 7,
      topic: "ASYNCHRONOUS RESET HAZARDS",
      question: "Why is a synchronized asynchronous reset path critical in FPGA digital architectures?",
      answer: "Although an asynchronous reset resets register nets instantly, its de-assertion (release) is critical. If reset de-assertion occurs near the active edge of the clock (called Reset Recovery and Removal violations), some registers will capture the reset release, while others remain stuck, leading to race-conditioned boot sequences. The solution is using a 2-FF reset synchronizer which asserts reset asynchronously but releases it fully synchronous to the core clock edge."
    }
  ];

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 shadow-xl" id="interview-section">
      <div className="flex items-center gap-3 border-b border-slate-900 pb-5 mb-6">
        <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
          <HelpIcon className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-200">
            VLSI & FPGA Technical Interview Prep Hub
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            100% Industry-aligned technical questions covering metastability, clock routing setups, synthesis hazards, and physical timing slack targets.
          </p>
        </div>
      </div>

      <div className="space-y-3.5 max-w-4xl">
        {faqData.map((item) => {
          const isOpen = activeId === item.id;
          return (
            <div
              key={item.id}
              className={`rounded-xl border transition-all ${
                isOpen
                  ? 'bg-slate-900 border-indigo-500/40 shadow-md'
                  : 'bg-slate-900/40 border-slate-900 hover:border-slate-800'
              }`}
            >
              <button
                onClick={() => setActiveId(isOpen ? null : item.id)}
                className="w-full text-left p-4 flex items-start justify-between gap-4 font-sans select-none"
              >
                <div>
                  <span className="text-[9px] font-mono font-bold text-slate-500 tracking-widest block mb-1">
                    {item.topic}
                  </span>
                  <h3 className="font-semibold text-xs sm:text-sm text-slate-200 leading-snug">
                    {item.question}
                  </h3>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 mt-2.5 transition-transform ${isOpen ? 'transform rotate-180 text-indigo-400' : ''}`} />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ${
                  isOpen ? 'max-h-72 border-t border-slate-900' : 'max-h-0'
                }`}
              >
                <div className="p-4 bg-slate-950/40 font-sans text-xs text-slate-400 leading-relaxed space-y-3">
                  <p>{item.answer}</p>
                  <div className="flex items-center gap-1.5 text-3xs font-mono text-cyan-400 font-semibold bg-cyan-950/20 px-2.5 py-1 rounded-md max-w-fit">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>VERIFICATION RATING: LEVEL-FMAX GOLD SYSTEM DESIGN</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
