# Core Smart FPGA Home Automation Controller

An industry-oriented, parameterizable Smart Home Controller designed in synthesizable Verilog for FPGA implementation (Nexys A7 targets). This project features synchronous low-frequency clock-enables to bypass Clock Domain Crossing (CDC) hazards, robust mechanical contact debouncers with integrated metastability protection, an 8-bit Pulse Width Modulators (PWM) load driver system, ROM preset scenario tables, and a Moore multi-mode finite state machine with hardware-level safety alarms.

---

## 🚀 Key Architectural Subsystems

1. **`clk_en.v` (Dynamic Strobe Synthesizer):**
   Divides the master board oscillator (50 MHz) to 1 kHz (for flicker-free light/fan modulation) and 10 Hz (for debouncing loops and state timers) using clock enables, avoiding skew hazards of multiple logic clocks.

2. **`debounce.v` (Metastability and Noise Protection):**
   Applies a double-stage flip-flop shift register (2-FF Sync) to absorb asynchronous sensor noise, settles mechanical chatter over consecutive tick intervals, and outputs a clean single-cycle pulse.

3. **`pwm8.v` (8-Bit Digital Dimmer):**
   Runs a wrap-counter with digital logic comparators to supply analog volt levels across 4 lighting and 2 fan outputs.

4. **`scenes.v` (Preset lookup ROM):**
   A fast combinational ROM-style LUT allowing single-command recalls of multi-load configurations (e.g. Cozy Evening, Work Studio, Night, All-off).

5. **`ctrl_fsm.v` (Multi-Mode Priority Resolver):**
   A stateful Moore machine enforcing safety priorities:
   `ALARM (Overcurrent Latching) > MANUAL Switch Overrides > SENSOR AUTO (PIR + Dark) > SCHEDULED CALENDAR`.

6. **`uart_rx.v`/`proto.v` (IoT Serial Bridge):**
   Demodulates serial packets at 115200 Baud with 16x oversampling and verifies XOR checksums. Support binary schema: `[0xAA Header] [CMD_CODE] [LEN] [PAYLOAD] [XOR CS]`.

---

## 📁 System Folder Structure

```
Smart-Home-Automation-FPGA/
│
├── rtl/                        # Synthesizable Verilog RTL Files
│   ├── clk_en.v                # Clock Dividers (1kHz/10Hz)
│   ├── debounce.v              # Asynchronous Button Debouncer
│   ├── pwm8.v                  # 8-bit Digital PWM Dimmer
│   ├── scenes.v                # ROM Scene Preset lookup
│   ├── ctrl_fsm.v              # Core Controller Finite State Machine
│   ├── uart_rx.v               # 115200 Baud UART Receiver
│   ├── proto.v                 # Command Protocol Frame Decoder
│   └── top.v                   # Core Subsystem Integration Wrapper
│
├── tb/                         # Verification Testbenches
│   └── home_tb.v               # Multi-scenario Self-Checking Testbench
│
├── constraints/                # Vivado Physical Mapping files
│   └── nexys_a7.xdc            # Board IO mappings & Clock limits
│
├── scripts/                    # Automated Build Scripts
│   └── synth.ys                # Yosys open-source Synthesis mapping
│
├── docs/                       # Project Documentation & Schematics
├── waveforms/                  # Exported VCD Waveforms (GTKWave)
├── reports/                    # Timing and Cell Utilization reports
├── images/                     # System Block Diagrams & Board Photos
└── README.md                   # Project Documentation
```

---

## 🛠️ Step-by-Step FPGA Synthesis Guide (Xilinx Vivado)

1. **Launch Vivado and Create Project:**
   - Choose `RTL Project` type.
   - Select the target part number: `XC7A100TCSG324-1` (Nexys A7-100T Artix-7).

2. **Import RTL Source Files:**
   - Choose `Add Sources` -> `Add or Create Design Sources`.
   - Select all files inside the `/rtl` directory and make sure target mapping is `Verilog`.

3. **Import Pin Constraints:**
   - Choose `Add Sources` -> `Add or Create Constraints`.
   - Add `/constraints/nexys_a7.xdc`. This establishes absolute pins and the 50 MHz clock definition constraint.

4. **Run Synthesis:**
   - Click `Run Synthesis`. Check the cell report metrics for overall Look-Up Table (LUT) count and Flip-Flop Register FDRE counts.

5. **Run Implementation:**
   - Click `Run Implementation`. This performs physical placement, nets routing, and timing optimizations.
   - Review timing outputs. Verify that **Setup Slack (WNS)** and **Hold Slack (WHS)** are positive.

6. **Generate Bitstream and Program:**
   - Click `Generate Bitstream`.
   - Open current hardware manager, connect board target via micro-USB, and load `.bit` binary netlist onto Artix-7 chip.

---

## 📝 Multi-Scenario Verification Waveform (VCD) Checklist

By simulating `tb/home_tb.v`, the waveform exports a `.vcd` file which GTKWave or ModelSim renders with the following transitions:
1. **Reset State Assertions:** `rst_n` falls active low, resetting FSM mode indicators to `2'b00` (Manual mode, all outputs zero).
2. **Tactile Switch Controls:** Switches are configured, pulling `sw_raw` high. Pressing manual B0 pulses `manual_evt`, immediately loading active relays and setting PWM registers.
3. **Sensors Auto-Pathing:** When `ldr_dark_raw` AND `pir_raw` are asserted, the FSM transitions to `S_AUTO` (State `2'b10`). Lights fade on soft ambiance duty. When PIR drops output, the FSM counts down wait frames before decay shuts loads down.
4. **Emergency Trip Interlocks:** Tripping `overcur_raw` instigates immediate lock inside `S_ALARM` (`State 2'b11`). Fan outputs are cleared to `0%` and socket relays are tripped off to protect hardware. S_ALARM engages strobe lights cycle at 10Hz.

---

## 🎓 Typical VLSI Technical Interview Q&As

- **QA 1: Why make clk-enables instead of new clock nets?**
  Using separate derived clock nets creates clock skew, timing race conditions, and complicates Clock Domain Crossing. Clock enables keep the design synchronous or mapped to a single master clock net.
- **QA 2: How do you safeguard against setup and hold violations?**
  Insert pipelined register stages to segment long combinatorial pathways, and synchronous async signals using multi-stage sync registers to mitigate metastability.

---

## 📜 Project Licensing
Licenced under Apache-2.0. Verified and synthetically compilable on Yosys and Xilinx Vivado CAD suites. Created to act as bulletproof course credit for aspiring hardware engineers!
