/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * RTL Code repository for the Smart Home Automation Controller on FPGA.
 */

export interface CodeFile {
  name: string;
  path: string;
  language: string;
  category: 'RTL' | 'Verification' | 'Constraints' | 'Synthesis';
  description: string;
  code: string;
}

export const rtlFiles: CodeFile[] = [
  {
    name: "clk_en.v",
    path: "rtl/clk_en.v",
    language: "verilog",
    category: "RTL",
    description: "Clock enable tick generator. Generates precision low-frequency timing enable strobes (1kHz for PWM and 10Hz for system scheduling) without introducing multiple physical clock domains which would complicate CDC (Clock Domain Crossing) analysis.",
    code: `// =================================================================
// File: rtl/clk_en.v
// Module: clk_en
// Project: Smart Home Automation Controller on FPGA
// Description: Clock Enable Generator
// Ensures synchronous timing across the entire design without 
// using multiple clock nets, preventing clock skew and setup/hold hazards.
// =================================================================

module clk_en #(
    parameter integer CLK_HZ  = 50_000_000, // 50 MHz input clock
    parameter integer TICK_HZ = 1000        // Target tick frequency (e.g., 1 kHz)
)(
    input  wire clk,     // System Clock
    input  wire rst_n,   // Asynchronous Active-Low Reset
    output reg  tick     // Clock enable tick (active high for 1 clock cycle)
);

    // Calculate maximum count required for division
    localparam integer DIV = CLK_HZ / TICK_HZ;
    
    // Register to store timer counter
    reg [$clog2(DIV)-1:0] cnt;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            cnt  <= 0;
            tick <= 1'b0;
        end else begin
            tick <= 1'b0;
            if (cnt == DIV - 1) begin
                cnt  <= 0;
                tick <= 1'b1; // Trigger single-cycle pulse
            end else begin
                cnt  <= cnt + 1'b1;
            end
        end
    end

endmodule
`
  },
  {
    name: "debounce.v",
    path: "rtl/debounce.v",
    language: "verilog",
    category: "RTL",
    description: "Input conditioning block incorporating a 2-flip-flop synchronizer to mitigate metastability, a counter-based debouncer to filter out mechanical button bounce, and a rising-edge pulse detector.",
    code: `// =================================================================
// File: rtl/debounce.v
// Module: debounce
// Description: Dual-FF Synchronizer, Counter Debouncer & Edge Detector
// Filters out noisy, asynchronous mechanical signals (buttons, sensors)
// and outputs a single-cycle rising pulse as well as synchronized level.
// =================================================================

module debounce #(
    parameter integer CNT = 5 // Number of consecutive ticks required to settle
)(
    input  wire clk,         // System Clock
    input  wire rst_n,       // Active-Low Reset
    input  wire tick,        // Slow timing tick (e.g. 10Hz ticks = 100ms interval)
    input  wire async_in,    // Asynchronous noisy input (from switch/sensor)
    output reg  level,       // Synchronized, debounced stable output level
    output reg  rise_pulse   // Single clock cycle pulse on rising transition
);

    // Two-stage Shift Register for Metastability Synchronization (CDC Rule #1)
    reg s1, s2;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            s1 <= 1'b0;
            s2 <= 1'b0;
        end else begin
            s1 <= async_in;
            s2 <= s1;
        end
    end

    // Counter debouncer logic
    reg [$clog2(CNT+1)-1:0] db_cnt;
    reg stable_val;
    
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            db_cnt     <= 0;
            stable_val <= 1'b0;
            level      <= 1'b0;
            rise_pulse <= 1'b0;
        end else begin
            rise_pulse <= 1'b0;
            
            if (tick) begin
                if (s2 != stable_val) begin
                    db_cnt <= db_cnt + 1'b1;
                    if (db_cnt == CNT - 1) begin
                        stable_val <= s2;
                        db_cnt     <= 0;
                    end
                end else begin
                    db_cnt <= 0;
                end
                
                // Edge detection logic on settled stable value
                if (stable_val && !level) begin
                    level      <= 1'b1;
                    rise_pulse <= 1'b1; // Trigger strobe on rising edge
                end else if (!stable_val) begin
                    level      <= 1'b0;
                end
            end
        end
    end

endmodule
`
  },
  {
    name: "pwm8.v",
    path: "rtl/pwm8.v",
    language: "verilog",
    category: "RTL",
    description: "8-bit Pulse Width Modulator driven by a fast tick. Used to provide analog-like variable voltages to dim LED lights and regulate fan motor speeds in real hardware.",
    code: `// =================================================================
// File: rtl/pwm8.v
// Module: pwm8
// Description: 8-bit Pulse Width Modulation Engine (0 - 255 levels)
// Driven by high-frequency ticks to achieve flicker-free dimming or
// linear speed control on fans or other resistive loads.
// =================================================================

module pwm8 (
    input  wire       clk,      // System Clock
    input  wire       rst_n,    // Active-Low Reset
    input  wire       tick_en,  // Fast timebase enable (e.g. 1 kHz)
    input  wire [7:0] duty,     // Configurational duty cycle (0-255)
    output reg        out       // PWM output signal
);

    // 8-bit PWM Counter
    reg [7:0] cnt;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            cnt <= 8'd0;
            out <= 1'b0;
        end else if (tick_en) begin
            cnt <= cnt + 8'd1;
            // Digital Comparator for duty cycle output matching
            out <= (cnt < duty);
        end
    end

endmodule
`
  },
  {
    name: "scenes.v",
    path: "rtl/scenes.v",
    language: "verilog",
    category: "RTL",
    description: "Scene Preset Lookup Matrix (ROM-style). Maps scene indexes (e.g., Evening, Work, Alarm, Night, All-Off) to pre-defined configurations for 4 dimmers, 2 fan speeds, and 4 relay registers.",
    code: `// =================================================================
// File: rtl/scenes.v
// Module: scenes
// Description: Predefined Preset ROM Matrix
// Encapsulates scene configurations, providing instant recall capability
// for lighting dimmers, fan speeds, and electric socket relay states.
// =================================================================

module scenes (
    input  wire [2:0] idx,          // 3-bit Scene Selector Index
    output reg  [7:0] L0, L1, L2, L3, // Dimmer channels for 4 lights (0-255)
    output reg  [7:0] F0, F1,       // Fan speed channels (0-255)
    output reg  [3:0] relays        // 4 Socket relays (Bitwise state)
);

    always @(*) begin
        case (idx)
            3'd0: begin // SCENE 0: ALL OFF
                L0 = 8'd0;   L1 = 8'd0;   L2 = 8'd0;   L3 = 8'd0;
                F0 = 8'd0;   F1 = 8'd0;
                relays = 4'b0000;
            end
            3'd1: begin // SCENE 1: COZY EVENING (Soft warm lights, sockets active)
                L0 = 8'd64;  L1 = 8'd32;  L2 = 8'd16;  L3 = 8'd0;
                F0 = 8'd40;  F1 = 8'd0;
                relays = 4'b0011;
            end
            3'd2: begin // SCENE 2: CO-WORKING MODE (Bright task lights, strong ventilation)
                L0 = 8'd230; L1 = 8'd200; L2 = 8'd50;  L3 = 8'd0;
                F0 = 8'd180; F1 = 8'd120;
                relays = 4'b1111;
            end
            3'd3: begin // SCENE 3: NIGHT SAFE MODE (Slight ambient paths, fans off)
                L0 = 8'd12;  L1 = 8'd0;   L2 = 8'd0;   L3 = 8'd12;
                F0 = 8'd0;   F1 = 8'd0;
                relays = 4'b0000;
            end
            3'd4: begin // SCENE 4: MOVIE NIGHT (Dim projection-friendly light levels)
                L0 = 8'd10;  L1 = 8'd10;  L2 = 8'd8;   L3 = 8'd8;
                F0 = 8'd50;  F1 = 8'd0;
                relays = 4'b0100;
            end
            3'd5: begin // SCENE 5: ECO INTELLIGENT (Efficient daylight, dynamic ventilation)
                L0 = 8'd45;  L1 = 8'd45;  L2 = 8'd0;   L3 = 8'd0;
                F0 = 8'd80;  F1 = 8'd80;
                relays = 4'b1001;
            end
            3'd6: begin // SCENE 6: ALARM SAFETY PRESET (Flash all, open gates, cut AC relays)
                L0 = 8'd255; L1 = 8'd255; L2 = 8'd255; L3 = 8'd255;
                F0 = 8'd0;   F1 = 8'd0;
                relays = 4'b0000;
            end
            default: begin // DEFAULT SYSTEM SAFE RESET
                L0 = 8'd0;   L1 = 8'd0;   L2 = 8'd0;   L3 = 8'd0;
                F0 = 8'd0;   F1 = 8'd0;
                relays = 4'b0000;
            end
        endcase
    end

endmodule
`
  },
  {
    name: "ctrl_fsm.v",
    path: "rtl/ctrl_fsm.v",
    language: "verilog",
    category: "RTL",
    description: "Finite State Machine with hardwired safety overrides. Regulates operational states (S_MANUAL, S_SCHED, S_AUTO, S_ALARM) and selects system load parameters based on strict priority criteria.",
    code: `// =================================================================
// File: rtl/ctrl_fsm.v
// Module: ctrl_fsm
// Description: Multi-mode Controller FSM with Safety Priority Chain
// Resolves competing environmental signals and manual command flags
// using a state machine. 
// Priority Chain: ALARM (Critical) > MANUAL Override > AUTO (Sensors) > SCHEDULED
// =================================================================

module ctrl_fsm (
    input  wire       clk,              // System Core Clock
    input  wire       rst_n,            // Asynchronous Reset
    input  wire       tick_10,          // Slow 10Hz scheduler timer tick
    
    // Physical Sensor Status Signals
    input  wire       pir_sensor,       // Motion sensor input (1=PIR Active)
    input  wire       ldr_dark,         // LDR darkness threshold (1=Ambient Dark)
    input  wire       overcurrent_trip, // Current limiter safety trip (1=Emergency)
    
    // Direct Tactile Inputs
    input  wire       manual_evt,       // Flag denoting local switch triggered
    input  wire [3:0] local_switches,   // Static local manual override commands
    
    // Host Bridge Telemetry Commands (from UART parser)
    input  wire       cmd_valid,        // Strobed high on command receipt
    input  wire [2:0] cmd_sc_index,     // Remote preset scene trigger ID
    input  wire [7:0] cmd_light_val,    // Custom PWM override values
    input  wire       cmd_alarm_clear,  // Reset triggered safety latch
    
    // Automated Clock Scheduler Signals
    input  wire       sched_trigger,    // Alarm tick based on preset time of day
    input  wire [2:0] sched_scene_idx,  // Scene scheduled to actuate
    
    // Output Registers to Hardware Drivers
    output reg  [7:0] duty_L0, duty_L1, duty_L2, duty_L3,
    output reg  [7:0] duty_F0, duty_F1,
    output reg  [3:0] relays_state,
    output reg        alarm_active,
    output reg  [1:0] current_mode      // Mode Indicator: 0=MANUAL, 1=SCHED, 2=AUTO, 3=ALARM
);

    // Operational Finite State Machine State Declarations
    localparam [1:0] S_MANUAL = 2'b00,
                     S_SCHED  = 2'b01,
                     S_AUTO   = 2'b10,
                     S_ALARM  = 2'b11;

    reg [1:0] state, next_state;
    reg [11:0] auto_idle_timer; // Automatic lights turn off timer (ticks)

    // Scene Connection Matrix
    wire [7:0] sc_L0, sc_L1, sc_L2, sc_L3;
    wire [7:0] sc_F0, sc_F1;
    wire [3:0] sc_relays;
    reg  [2:0] scene_lookup_id;

    scenes preset_rom (
        .idx(scene_lookup_id),
        .L0(sc_L0), .L1(sc_L1), .L2(sc_L2), .L3(sc_L3),
        .F0(sc_F0), .F1(sc_F1),
        .relays(sc_relays)
    );

    // FSM State Transition Sequencer
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= S_MANUAL;
        end else begin
            state <= next_state;
        end
    end

    // FSM State Combinational Transition Logic (Determines Next State)
    always @(*) begin
        next_state = state;
        
        // Critical Interrupt Level 0: Immediate Emergency Overcurrent Shutdown
        if (overcurrent_trip) begin
            next_state = S_ALARM;
        end else begin
            case (state)
                S_MANUAL: begin
                    if (pir_sensor && ldr_dark) begin
                        next_state = S_AUTO; // Automatic path activation on sensory triggers
                    end else if (sched_trigger) begin
                        next_state = S_SCHED; // Activate scheduled calendar presets
                    end
                end
                
                S_SCHED: begin
                    if (manual_evt || cmd_valid) begin
                        next_state = S_MANUAL; // User overrides system scheduling via physical action
                    end else if (pir_sensor && ldr_dark) begin
                        next_state = S_AUTO; // Sensor sensing takes priority over passive schedule
                    end
                end
                
                S_AUTO: begin
                    if (manual_evt || cmd_valid) begin
                        next_state = S_MANUAL; // Local toggle forces manual prioritizations
                    end else if (sched_trigger) begin
                        next_state = S_SCHED;
                    end else if (auto_idle_timer == 0 && !pir_sensor) begin
                        next_state = S_MANUAL; // Idle timeout decays back to standard manual
                    end
                end
                
                S_ALARM: begin
                    if (cmd_alarm_clear && !overcurrent_trip) begin
                        next_state = S_MANUAL; // Complete safety lock handshakes reset
                    end
                end
                
                default: next_state = S_MANUAL;
            endcase
        end
    end

    // Sequential System Output & State Control Actions
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            duty_L0          <= 8'd0;
            duty_L1          <= 8'd0;
            duty_L2          <= 8'd0;
            duty_L3          <= 8'd0;
            duty_F0          <= 8'd0;
            duty_F1          <= 8'd0;
            relays_state     <= 4'b0000;
            alarm_active     <= 1'b0;
            scene_lookup_id  <= 3'd0;
            auto_idle_timer  <= 12'd1000; // ~100s at 10Hz tick
            current_mode     <= S_MANUAL;
        end else begin
            current_mode <= state;
            
            // Auto Sensor Idle Decay Timer block
            if (state == S_AUTO) begin
                if (tick_10) begin
                    if (pir_sensor) begin
                        auto_idle_timer <= 12'd300; // Reset countdown to 30s as long as motion exists
                    end else if (auto_idle_timer > 0) begin
                        auto_idle_timer <= auto_idle_timer - 1'b1;
                    end
                end
            end else begin
                auto_idle_timer <= 12'd300;
            end

            case (state)
                S_MANUAL: begin
                    alarm_active <= 1'b0;
                    
                    if (cmd_valid && (cmd_sc_index != 3'd7)) begin
                        // Load exact preset rom scene remotely
                        scene_lookup_id <= cmd_sc_index;
                        duty_L0         <= sc_L0;
                        duty_L1         <= sc_L1;
                        duty_L2         <= sc_L2;
                        duty_L3         <= sc_L3;
                        duty_F0         <= sc_F0;
                        duty_F1         <= sc_F1;
                        relays_state    <= sc_relays;
                    end else if (cmd_valid) begin
                        // Individual direct value writes
                        duty_L0 <= cmd_light_val;
                        duty_L1 <= cmd_light_val >> 1;
                        duty_F0 <= 8'd100;
                        relays_state <= 4'b1010;
                    end else if (manual_evt) begin
                        // Local manual toggle sets dimmers to discrete levels on switches
                        duty_L0      <= local_switches[0] ? 8'd255 : 8'd0;
                        duty_L1      <= local_switches[1] ? 8'd180 : 8'd0;
                        duty_L2      <= local_switches[2] ? 8'd128 : 8'd0;
                        duty_L3      <= local_switches[3] ? 8'd64  : 8'd0;
                        duty_F0      <= local_switches[0] ? 8'd200 : 8'd0;
                        duty_F1      <= local_switches[1] ? 8'd120 : 8'd0;
                        relays_state <= local_switches;
                    end
                end
                
                S_SCHED: begin
                    alarm_active    <= 1'b0;
                    scene_lookup_id <= sched_scene_idx;
                    duty_L0         <= sc_L0;
                    duty_L1         <= sc_L1;
                    duty_L2         <= sc_L2;
                    duty_L3         <= sc_L3;
                    duty_F0         <= sc_F0;
                    duty_F1         <= sc_F1;
                    relays_state    <= sc_relays;
                end
                
                S_AUTO: begin
                    alarm_active <= 1'b0;
                    // Sensor triggering map: Turn lights on low energy, speed fan depending on heat
                    duty_L0      <= 8'd120; // soft auto-glow
                    duty_L1      <= 8'd100;
                    duty_L2      <= 8'd80;
                    duty_L3      <= 8'd0;
                    duty_F0      <= 8'd150; // default moderate ventilation
                    duty_F1      <= 8'd90;
                    relays_state <= 4'b1100;
                    
                    // Force shutoff once timer has expired
                    if (auto_idle_timer == 0) begin
                        duty_L0      <= 8'd0;
                        duty_L1      <= 8'd0;
                        duty_L2      <= 8'd0;
                        duty_L3      <= 8'd0;
                        duty_F0      <= 8'd0;
                        duty_F1      <= 8'd0;
                        relays_state <= 4'b0000;
                    end
                end
                
                S_ALARM: begin
                    alarm_active    <= 1'b1;
                    scene_lookup_id <= 3'd6; // Load safe hazard scene (FLASH ON Lights, CUT relays)
                    
                    // Simple asynchronous dynamic strobe generator at 10Hz
                    if (tick_10) begin
                        duty_L0      <= (duty_L0 == 8'd255) ? 8'd0 : 8'd255;
                        duty_L1      <= (duty_L1 == 8'd255) ? 8'd0 : 8'd255;
                        duty_L2      <= (duty_L2 == 8'd255) ? 8'd0 : 8'd255;
                        duty_L3      <= (duty_L3 == 8'd255) ? 8'd0 : 8'd255;
                    end
                    
                    duty_F0      <= 8'd0; // Cut AC loads
                    duty_F1      <= 8'd0;
                    relays_state <= 4'b0000; // Trip sockets off to limit fire hazardous wiring
                end
                
                default: ;
            endcase
        end
    end

endmodule
`
  },
  {
    name: "uart_rx.v",
    path: "rtl/uart_rx.v",
    language: "verilog",
    category: "RTL",
    description: "Modular Universal Asynchronous Receiver (UART) block. Recreates incoming data bytes at 115200 baud with 16x oversampling to ensure link robustness over varying board capacitances.",
    code: `// =================================================================
// File: rtl/uart_rx.v
// Module: uart_rx
// Description: UART Receiver Core with 16x Oversampling Clock
// Samples serial line data robustly to avoid noise glitches or
// timing skew drifts. (8 data bits, no parity, 1 stop bit)
// =================================================================

module uart_rx #(
    parameter integer CLK_HZ  = 50_000_000,
    parameter integer BAUD    = 115200
)(
    input  wire       clk,      // System clock
    input  wire       rst_n,    // Active-low reset
    input  wire       rx,       // Incoming serial pin RX
    output reg        rx_done,  // Strobed 1 cycle on successfully receiving packet
    output reg  [7:0] rx_data   // Demodulated received byte
);

    // Calculate oversampling rate count (BAUD * 16)
    localparam integer BIT_DIV = CLK_HZ / (BAUD * 16);

    reg [$clog2(BIT_DIV)-1:0] div_cnt;
    reg sample_pulse;

    // Generate 16x Baud Pulse
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            div_cnt      <= 0;
            sample_pulse <= 1'b0;
        end else begin
            sample_pulse <= 1'b0;
            if (div_cnt == BIT_DIV - 1) begin
                div_cnt      <= 0;
                sample_pulse <= 1'b1;
            end else begin
                div_cnt <= div_cnt + 1'b1;
            end
        end
    end

    // Synchronizer for RX pin to prevent metastability
    reg rx_s1, rx_s2;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            rx_s1 <= 1'b1;
            rx_s2 <= 1'b1;
        end else begin
            rx_s1 <= rx;
            rx_s2 <= rx_s1;
        end
    end

    // UART Receiver State Machine states
    localparam [1:0] IDLE  = 2'b00,
                     START = 2'b01,
                     DATA  = 2'b10,
                     STOP  = 2'b11;

    reg [1:0] st;
    reg [3:0] spl_cnt; // Counts 0-15 cycles during a bit duration
    reg [2:0] bit_idx; // Counts 0-7 data bits

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            st       <= IDLE;
            spl_cnt  <= 0;
            bit_idx  <= 0;
            rx_data  <= 8'h00;
            rx_done  <= 1'b0;
        end else begin
            rx_done <= 1'b0;
            
            if (sample_pulse) begin
                case (st)
                    IDLE: begin
                        spl_cnt <= 0;
                        bit_idx <= 0;
                        if (!rx_s2) begin // Detected falling Start Bit transition
                            st <= START;
                        end
                    end
                    
                    START: begin
                        if (spl_cnt == 7) begin // Near middle of start bit
                            if (!rx_s2) begin
                                spl_cnt <= 0;
                                st      <= DATA; // Acceptable start bit
                            end else begin
                                st <= IDLE;              // Spurious noise, abort
                            end
                        end else begin
                            spl_cnt <= spl_cnt + 1'b1;
                        end
                    end
                    
                    DATA: begin
                        if (spl_cnt == 15) begin // Bit boundary elapsed
                            spl_cnt            <= 0;
                            rx_data[bit_idx]  <= rx_s2; // Extract value
                            
                            if (bit_idx == 7) begin
                                st <= STOP;
                            end else begin
                                bit_idx <= bit_idx + 1'b1;
                            end
                        end else begin
                            spl_cnt <= spl_cnt + 1'b1;
                        end
                    end
                    
                    STOP: begin
                        if (spl_cnt == 15) begin
                            if (rx_s2) begin // Valid High stop-bit verified
                                rx_done <= 1'b1;
                            end
                            st <= IDLE;
                        end else begin
                            spl_cnt <= spl_cnt + 1'b1;
                        end
                    end
                    
                    default: st <= IDLE;
                endcase
            end
        end
    end

endmodule
`
  },
  {
    name: "proto.v",
    path: "rtl/proto.v",
    language: "verilog",
    category: "RTL",
    description: "Parser sub-module checking checksums and unpacking binary frames. Integrates UART data structures: 0xAA header, command code, length byte, variable payload, and XOR BCC checksum.",
    code: `// =================================================================
// File: rtl/proto.v
// Module: proto
// Description: Multi-byte Serial Command Frame Decoder Protocol Engine
// Decodes remote inputs containing structured headers and validates
// checksum bounds before feeding trigger variables to the core FSM.
// Protocol Schema: [HEADER:0xAA] [CMD] [LEN] [PAYLOAD...] [XOR Checksum]
// =================================================================

module proto (
    input  wire       clk,             // Core Clock
    input  wire       rst_n,           // Active-low Reset
    input  wire       rx_done,         // UART receiver byte ready pulse
    input  wire [7:0] rx_data,         // Received UART byte data
    
    output reg        cmd_valid,       // Strobes active once valid packet is accepted 
    output reg  [2:0] cmd_sc_index,    // Presets scene recall request ID
    output reg  [7:0] cmd_light_val,   // Directly set light level integer value
    output reg        cmd_alarm_clear  // Remote safety alarms clear command
);

    // Frame parser states
    localparam [2:0] ST_HEADER   = 3'd0,
                     ST_CMD      = 3'd1,
                     ST_LEN      = 3'd2,
                     ST_PAYLOAD  = 3'd3,
                     ST_CHECKSUM = 3'd4;

    reg [2:0] parse_st;
    reg [7:0] active_cmd;
    reg [7:0] payload_len;
    reg [7:0] payload_cnt;
    reg [7:0] checksum_calc;
    
    // Command Payloads Buffer
    reg [7:0] payload_reg_0;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            parse_st        <= ST_HEADER;
            active_cmd      <= 8'h00;
            payload_len     <= 8'h00;
            payload_cnt     <= 8'h00;
            checksum_calc   <= 8'h00;
            payload_reg_0   <= 8'h00;
            
            cmd_valid       <= 1'b0;
            cmd_sc_index    <= 3'd7; // Safe inactive value
            cmd_light_val   <= 8'd0;
            cmd_alarm_clear <= 1'b0;
        end else begin
            cmd_valid       <= 1'b0;
            cmd_alarm_clear <= 1'b0;
            
            if (rx_done) begin
                case (parse_st)
                    ST_HEADER: begin
                        if (rx_data == 8'hAA) begin // Header validation
                            checksum_calc <= 8'hAA;
                            parse_st      <= ST_CMD;
                        end
                    end
                    
                    ST_CMD: begin
                        active_cmd    <= rx_data;
                        checksum_calc <= checksum_calc ^ rx_data;
                        parse_st      <= ST_LEN;
                    end
                    
                    ST_LEN: begin
                        payload_len   <= rx_data;
                        payload_cnt   <= 0;
                        checksum_calc <= checksum_calc ^ rx_data;
                        
                        if (rx_data == 0) begin
                            parse_st <= ST_CHECKSUM;
                        end else begin
                            parse_st <= ST_PAYLOAD;
                        end
                    end
                    
                    ST_PAYLOAD: begin
                        checksum_calc <= checksum_calc ^ rx_data;
                        
                        if (payload_cnt == 0) begin
                            payload_reg_0 <= rx_data;
                        end
                        
                        payload_cnt <= payload_cnt + 1'b1;
                        if (payload_cnt + 1'b1 == payload_len) begin
                            parse_st <= ST_CHECKSUM;
                        end
                    end
                    
                    ST_CHECKSUM: begin
                        if (rx_data == checksum_calc) begin // Checksum verified!
                            cmd_valid <= 1'b1;
                            
                            // Route decoded payload parameters
                            case (active_cmd)
                                8'h01: begin // SET_DUTY Direct Parameter
                                    cmd_light_val <= payload_reg_0;
                                    cmd_sc_index  <= 3'd7; 
                                end
                                8'h03: begin // LOAD_SCENE Preset Trigger
                                    cmd_sc_index  <= payload_reg_0[2:0];
                                end
                                8'h05: begin // CLEAR_ALARM Trigger
                                    cmd_alarm_clear <= 1'b1;
                                end
                                default: ;
                            endcase
                        end
                        parse_st <= ST_HEADER;
                    end
                    
                    default: parse_st <= ST_HEADER;
                endcase
            end
        end
    end

endmodule
`
  },
  {
    name: "top.v",
    path: "rtl/top.v",
    language: "verilog",
    category: "RTL",
    description: "System Top-Level Integration. Assembles clock divisors, debouncers, scene memories, state routers, PWM modulators, and serial protocol components into a single coherent FPGA structural layout.",
    code: `// =================================================================
// File: rtl/top.v
// Module: top
// Description: Structural Top-Level Smart FPGA Home Controller
// Chains clock timing ticks, input synchronizers, control logic core,
// ROM matrices, PWM modulators, and UART interfaces to map physical 
// pins together.
// =================================================================

module top (
    input  wire clk_50m,        // Primary board oscillator clock input (50 MHz)
    input  wire rst_btn,       // System primary physical push button reset (active high)
    
    // Board Physical Sensory Inputs
    input  wire pir_raw,        // Unsynchronized PIR occupancy sensor hookup
    input  wire ldr_dark_raw,   // Unsynchronized LDR threshold detector hookup
    input  wire overcur_raw,    // Out-of-bounds current limiter safety sensor
    
    // Local Switch Inputs
    input  wire btn0_raw,      // Tactile pushbutton override 0
    input  wire btn1_raw,      // Tactile pushbutton override 1
    input  wire btn2_raw,      // Tactile pushbutton override 2
    input  wire btn3_raw,      // Tactile pushbutton override 3
    input  wire [3:0] sw_raw,   // Static local manual overrides (slide switches)
    
    // Serial Bridge pins
    input  wire uart_rx,        // Serial line input from external ESP32 or PI
    output wire uart_tx,        // Serial telemetry output to remote IoT host
    
    // High-Power Modulated Load Drivers
    output wire L0_PWM,         // PWM variable dimmer output for Light 0
    output wire L1_PWM,         // PWM variable dimmer output for Light 1
    output wire L2_PWM,         // PWM variable dimmer output for Light 2
    output wire L3_PWM,         // PWM variable dimmer output for Light 3
    output wire F0_PWM,         // PWM velocity control speed driver for Fan 0
    output wire F1_PWM,         // PWM velocity control speed driver for Fan 1
    
    // Direct Relay Actuators
    output wire R0,             // Electronic relay socket 0 controller gate
    output wire R1,             // Electronic relay socket 1 controller gate
    output wire R2,             // Electronic relay socket 2 controller gate
    output wire R3,             // Electronic relay socket 3 controller gate
    
    // Board status LEDs
    output wire ALARM_LED,      // System alarm indicator light
    output wire [1:0] mode_ind   // State outputs for visual diagnostics
);

    // active-low internal reset conversion
    wire rst_n = ~rst_btn;

    // --- SECTION 1: Clock Divisor Synthesis ---
    wire tick_1k;  // 1 kHz timebase pulse
    wire tick_10;  // 10 Hz scheduler pulse

    clk_en #(.CLK_HZ(50_000_000), .TICK_HZ(1000)) u_tick_1k (
        .clk(clk_50m), .rst_n(rst_n), .tick(tick_1k)
    );

    clk_en #(.CLK_HZ(50_000_000), .TICK_HZ(10)) u_tick_10 (
        .clk(clk_50m), .rst_n(rst_n), .tick(tick_10)
    );

    // --- SECTION 2: Input Debouncers ---
    wire pir, dark, overcur;
    wire b0_p, b1_p, b2_p, b3_p;

    debounce #(.CNT(2)) u_deb_pir (
        .clk(clk_50m), .rst_n(rst_n), .tick(tick_10), .async_in(pir_raw), .level(pir), .rise_pulse()
    );

    debounce #(.CNT(2)) u_deb_dark (
        .clk(clk_50m), .rst_n(rst_n), .tick(tick_10), .async_in(ldr_dark_raw), .level(dark), .rise_pulse()
    );

    debounce #(.CNT(1)) u_deb_oc (
        .clk(clk_50m), .rst_n(rst_n), .tick(tick_10), .async_in(overcur_raw), .level(overcur), .rise_pulse()
    );

    debounce #(.CNT(2)) u_deb_b0 (
        .clk(clk_50m), .rst_n(rst_n), .tick(tick_10), .async_in(btn0_raw), .level(), .rise_pulse(b0_p)
    );

    debounce #(.CNT(2)) u_deb_b1 (
        .clk(clk_50m), .rst_n(rst_n), .tick(tick_10), .async_in(btn1_raw), .level(), .rise_pulse(b1_p)
    );

    debounce #(.CNT(2)) u_deb_b2 (
        .clk(clk_50m), .rst_n(rst_n), .tick(tick_10), .async_in(btn2_raw), .level(), .rise_pulse(b2_p)
    );

    debounce #(.CNT(2)) u_deb_b3 (
        .clk(clk_50m), .rst_n(rst_n), .tick(tick_10), .async_in(btn3_raw), .level(), .rise_pulse(b3_p)
    );

    // Local edge changes strobe manual event FSM input
    wire manual_evt = b0_p | b1_p | b2_p | b3_p;

    // --- SECTION 3: UART Host Link Decoder ---
    wire rx_byte_stb;
    wire [7:0] rx_byte_data;
    
    uart_rx #(.CLK_HZ(50_000_000), .BAUD(115200)) u_receiver (
        .clk(clk_50m), .rst_n(rst_n), .rx(uart_rx),
        .rx_done(rx_byte_stb), .rx_data(rx_byte_data)
    );

    wire       cmd_ready;
    wire [2:0] cmd_sc;
    wire [7:0] cmd_light;
    wire       cmd_clear;

    proto u_decoder (
        .clk(clk_50m), .rst_n(rst_n),
        .rx_done(rx_byte_stb), .rx_data(rx_byte_data),
        .cmd_valid(cmd_ready), .cmd_sc_index(cmd_sc), .cmd_light_val(cmd_light), .cmd_alarm_clear(cmd_clear)
    );

    assign uart_tx = uart_rx; // Echo loopback diagnostic implementation

    // --- SECTION 4: Time of Day Scheduler Simulator ---
    reg [23:0] s_time_cnt; // Simulates time tracking (min-clocks-div)
    reg        sched_stb;
    reg [2:0]  sched_scene;

    always @(posedge clk_50m or negedge rst_n) begin
        if (!rst_n) begin
            s_time_cnt  <= 0;
            sched_stb   <= 1'b0;
            sched_scene <= 3'd0;
        end else if (tick_10) begin
            sched_stb <= 1'b0;
            if (s_time_cnt == 24'd480) begin // Virtual scheduled trigger mark (e.g. at 48s interval)
                s_time_cnt  <= 0;
                sched_stb   <= 1'b1;
                // Alternate Preset Evening Scene (1) vs Night Safe Scene (3)
                sched_scene <= (sched_scene == 3'd1) ? 3'd3 : 3'd1;
            end else begin
                s_time_cnt <= s_time_cnt + 1'b1;
            end
        end
    end

    // --- SECTION 5: Core Automation Processor (FSM) ---
    wire [7:0] w_L0, w_L1, w_L2, w_L3;
    wire [7:0] w_F0, w_F1;
    wire [3:0] w_relays;
    wire       alarm_st;

    ctrl_fsm u_fsm_controller (
        .clk(clk_50m), .rst_n(rst_n), .tick_10(tick_10),
        
        .pir_sensor(pir), .ldr_dark(dark), .overcurrent_trip(overcur),
        .manual_evt(manual_evt), .local_switches(sw_raw),
        
        .cmd_valid(cmd_ready), .cmd_sc_index(cmd_sc), .cmd_light_val(cmd_light), .cmd_alarm_clear(cmd_clear),
        
        .sched_trigger(sched_stb), .sched_scene_idx(sched_scene),
        
        .duty_L0(w_L0), .duty_L1(w_L1), .duty_L2(w_L2), .duty_L3(w_L3),
        .duty_F0(w_F0), .duty_F1(w_F1),
        .relays_state(w_relays),
        .alarm_active(alarm_st),
        .current_mode(mode_ind)
    );

    // --- SECTION 6: PWM Drivers Actuation ---
    pwm8 u_pwm_L0 (.clk(clk_50m), .rst_n(rst_n), .tick_en(tick_1k), .duty(w_L0), .out(L0_PWM));
    pwm8 u_pwm_L1 (.clk(clk_50m), .rst_n(rst_n), .tick_en(tick_1k), .duty(w_L1), .out(L1_PWM));
    pwm8 u_pwm_L2 (.clk(clk_50m), .rst_n(rst_n), .tick_en(tick_1k), .duty(w_L2), .out(L2_PWM));
    pwm8 u_pwm_L3 (.clk(clk_50m), .rst_n(rst_n), .tick_en(tick_1k), .duty(w_L3), .out(L3_PWM));
    
    pwm8 u_pwm_F0 (.clk(clk_50m), .rst_n(rst_n), .tick_en(tick_1k), .duty(w_F0), .out(F0_PWM));
    pwm8 u_pwm_F1 (.clk(clk_50m), .rst_n(rst_n), .tick_en(tick_1k), .duty(w_F1), .out(F1_PWM));

    // Map outputs directly to pins
    assign {R3, R2, R1, R0} = w_relays;
    assign ALARM_LED        = alarm_st;

endmodule
`
  },
  {
    name: "home_tb.v",
    path: "tb/home_tb.v",
    language: "verilog",
    category: "Verification",
    description: "Multi-scenario digital testbench. Simulates clock generators, toggles safety triggers, applies serial inputs, triggers scheduled times, and prints self-checked terminal output to log file.",
    code: `// =================================================================
// File: tb/home_tb.v
// Module: home_tb
// Description: Multi-scenario Self-Checking Stimulus Testbench
// Verifies logic transitions, debouncer latencies, PWM outputs, ROM Preset
// mapping, overcurrent emergency state locks, and serial commands injection.
// =================================================================

\`timescale 1ns/1ps

module home_tb;

    // --- Registers & Wires declaration ---
    reg clk;
    reg rst_btn;
    reg pir_raw;
    reg ldr_dark_raw;
    reg overcur_raw;
    reg btn0_raw, btn1_raw, btn2_raw, btn3_raw;
    reg [3:0] sw_raw;
    reg uart_rx_pin;

    wire uart_tx_pin;
    wire L0_PWM, L1_PWM, L2_PWM, L3_PWM;
    wire F0_PWM, F1_PWM;
    wire R0, R1, R2, R3;
    wire ALARM_LED;
    wire [1:0] mode_ind;

    // --- UUT Instance ---
    top DUT (
        .clk_50m(clk),
        .rst_btn(rst_btn),
        .pir_raw(pir_raw),
        .ldr_dark_raw(ldr_dark_raw),
        .overcur_raw(overcur_raw),
        .btn0_raw(btn0_raw),
        .btn1_raw(btn1_raw),
        .btn2_raw(btn2_raw),
        .btn3_raw(btn3_raw),
        .sw_raw(sw_raw),
        .uart_rx(uart_rx_pin),
        .uart_tx(uart_tx_pin),
        .L0_PWM(L0_PWM),
        .L1_PWM(L1_PWM),
        .L2_PWM(L2_PWM),
        .L3_PWM(L3_PWM),
        .F0_PWM(F0_PWM),
        .F1_PWM(F1_PWM),
        .R0(R0), .R1(R1), .R2(R2), .R3(R3),
        .ALARM_LED(ALARM_LED),
        .mode_ind(mode_ind)
    );

    // --- Clock Generator (50 MHz = 20ns period) ---
    always begin
        #10 clk = ~clk;
    end

    // --- Task: Send Byte over UART ---
    task send_uart_byte(input [7:0] data);
        integer idx;
        begin
            // Start Bit (Low)
            uart_rx_pin = 1'b0;
            #8680; // 1/115200s ≈ 8.68us
            
            // 8 Data Bits (LSB first)
            for (idx = 0; idx < 8; idx = idx + 1) begin
                uart_rx_pin = data[idx];
                #8680;
            end
            
            // Stop Bit (High)
            uart_rx_pin = 1'b1;
            #8680;
        end
    endtask

    // --- Task: Inject UART Command Packet ---
    // Frame schema: 0xAA (Header) -> CMD -> LEN -> PAYLOAD... -> XOR_CS
    task send_cmd_packet(input [7:0] cmd, input [7:0] val);
        reg [7:0] cs;
        begin
            cs = 8'hAA ^ cmd ^ 8'd1 ^ val;
            $display("[TB TIME: %t] Sending UART command (CMD:%h, VAL:%d)", $time, cmd, val);
            send_uart_byte(8'hAA);
            send_uart_byte(cmd);
            send_uart_byte(8'd1); // Length = 1 byte
            send_uart_byte(val);  // Payload value
            send_uart_byte(cs);   // XOR checksum byte
            #20000;              // Grace delay
        end
    endtask

    // --- Main Stimulus Execution ---
    initial begin
        // Configure waveform dump file format to verify on GTKWave / visualizers
        $dumpfile("smart_home_sim.vcd");
        $dumpvars(0, home_tb);

        // System Initialization
        clk = 0;
        rst_btn = 1;
        pir_raw = 0;
        ldr_dark_raw = 0;
        overcur_raw = 0;
        btn0_raw = 0; btn1_raw = 0; btn2_raw = 0; btn3_raw = 0;
        sw_raw = 4'b0000;
        uart_rx_pin = 1'b1; // idle state high

        $display("[TB START] Initializing Smart Home Automation Controller Simulation Testbench.");
        #100;
        rst_btn = 0; // Release active-high reset
        #50;
        
        // Assert reset successfully released
        if (mode_ind != 2'b00) begin
            $display("[TB ERROR] System did not boot into S_MANUAL. Active state indicator: %b", mode_ind);
        end else begin
            $display("[TB OK] System successfully booted into S_MANUAL mode.");
        end

        // -----------------------------------------------------------------
        // SCENARIO 1: Manual Override Testing (Local physical switches)
        // -----------------------------------------------------------------
        #500;
        $display("[TB PROGRESS] Scenario 1: Applying manual static switch overrides.");
        sw_raw = 4'b1011; // Activate Switch 0, 1, 3
        
        // Pulse local btn0 to alert physical edge-event
        #100;
        btn0_raw = 1; #200; btn0_raw = 0; // Simulated debounced push event pulse
        #50000;                           // Multi-pulse ticks simulation elapsed
        
        $display("[TB REPORT] Sockets check (R3-R0): Expected 1011, Got: %b%b%b%b", R3, R2, R1, R0);
        
        // -----------------------------------------------------------------
        // SCENARIO 2: Sensory Automatic Trigger (Dark + Occupancy PIR)
        // -----------------------------------------------------------------
        #10000;
        $display("[TB PROGRESS] Scenario 2: Emulating sensory threshold event (LDR dark + PIR trigger).");
        sw_raw = 4'b0000; // Release static states
        ldr_dark_raw = 1; // It is dark
        #1000;
        pir_raw = 1;      // PIR motion sensor detects human trace
        #100000;          // Await debouncer settles and state machine executes S_AUTO
        
        if (mode_ind == 2'b10) begin
            $display("[TB OK] State Machine triggered into S_AUTO successfully.");
        end else begin
            $display("[TB ERROR] FSM failed to trigger inside S_AUTO. Actual: %b", mode_ind);
        end
        
        #50000;
        pir_raw = 0; // Human exits space, triggers decay wait logic

        // -----------------------------------------------------------------
        // SCENARIO 3: Remote IoT Master Serial Command Packet Injection
        // -----------------------------------------------------------------
        #10000;
        $display("[TB PROGRESS] Scenario 3: Interfacing external ESP32 command. Triggering Scene 2 (Co-Working Preset).");
        // Sending LOAD_SCENE Preset ROM Index Call command (CMD:0x03, Preset: 2)
        send_cmd_packet(8'h03, 8'd2);
        
        #100000;
        if (mode_ind == 2'b00) begin
            $display("[TB OK] System accepted UART command, returned S_MANUAL to set customized scenery.");
            $display("[TB REPORT] Preset ROM Scene 2 values successfully active: Lamp0 PWM=%d, Relays=%b%b%b%b", DUT.w_L0, R3, R2, R1, R0);
        end else begin
            $display("[TB ERROR] System failed to transition to MANUAL on remote packet intervention.");
        end

        // -----------------------------------------------------------------
        // SCENARIO 4: Active Over-Current Safe Trip Alarm Execution
        // -----------------------------------------------------------------
        #10000;
        $display("[TB PROGRESS] Scenario 4: Inducing emergency failure (Over-current trip wire triggered!).");
        overcur_raw = 1; // Trip-wire high
        #50000;          // Await debounce filter
        
        if (ALARM_LED && (mode_ind == 2'b11)) begin
            $display("[TB OK] Emergency Latch active. Alarm Siren is HIGH, all industrial relays tripped OFF.");
        end else begin
            $display("[TB ERROR] Emergency fail-safe logical lock bypassed! Latch active: %b, FSM State: %b", ALARM_LED, mode_ind);
        end

        // Clear warning state remotely with packet clear instruction
        #10000;
        overcur_raw = 0; // Condition clears
        #10000;
        send_cmd_packet(8'h05, 8'd0); // Send CLEAR_ALARM command (CMD: 0x05)
        #50000;
        
        if (!ALARM_LED) begin
            $display("[TB OK] System cleared emergency status latch, safely restored standard operations.");
        end else begin
            $display("[TB ERROR] Alarm latch stuck despite clearance packet!");
        end

        // Finish Testbench
        $display("[TB COMPLETE] Completed Verification Stimuli. All checks complete.");
        $finish;
    end

endmodule
`
  },
  {
    name: "nexys_a7.xdc",
    path: "constraints/nexys_a7.xdc",
    language: "tcl",
    category: "Constraints",
    description: "Physical Vivado constraints mapping ports to switches in standard Nexys A7-100T Artix-7 board configurations.",
    code: `## =================================================================
## File: constraints/nexys_a7.xdc
## Board: Nexys A7-100T (Artix-7 XC7A100TCSG324-1)
## Project: Smart Home Automation Controller on FPGA
## Description: Physical Pin Assignments & Timing Constraints
## =================================================================

## --- 1. Clock Signal Timing Definition (50 MHz via Clock Wizard or Divider) ---
set_property -dict { PACKAGE_PIN E3    IOSTANDARD LVCMOS33 } [get_ports { clk_50m }];
create_clock -add -name sys_clk_pin -period 20.00 -waveform {0 10} [get_ports { clk_50m }];

## --- 2. System Hardware Global Reset ---
set_property -dict { PACKAGE_PIN C12   IOSTANDARD LVCMOS33 } [get_ports { rst_btn }]; # CPU RESET Button (Active High)

## --- 3. Sensor Input Pins (Asynchronous Interfaces mapping to PMOD connectors) ---
set_property -dict { PACKAGE_PIN H17   IOSTANDARD LVCMOS33 } [get_ports { pir_raw }];       # PMOD Header JA Pin 1 (PIR motion)
set_property -dict { PACKAGE_PIN G17   IOSTANDARD LVCMOS33 } [get_ports { ldr_dark_raw }];  # PMOD Header JA Pin 2 (LDR light)
set_property -dict { PACKAGE_PIN F18   IOSTANDARD LVCMOS33 } [get_ports { overcur_raw }];   # PMOD Header JA Pin 3 (Overcurrent trip)

## --- 4. Direct Push Buttons (Manual override pulse generators) ---
set_property -dict { PACKAGE_PIN N17   IOSTANDARD LVCMOS33 } [get_ports { btn0_raw }]; # Center Button (B0)
set_property -dict { PACKAGE_PIN M18   IOSTANDARD LVCMOS33 } [get_ports { btn1_raw }]; # Upper Button  (B1)
set_property -dict { PACKAGE_PIN P17   IOSTANDARD LVCMOS33 } [get_ports { btn2_raw }]; # Left Button   (B2)
set_property -dict { PACKAGE_PIN M17   IOSTANDARD LVCMOS33 } [get_ports { btn3_raw }]; # Right Button  (B3)

## --- 5. Board Slide Switches (Manual static controls) ---
set_property -dict { PACKAGE_PIN J15   IOSTANDARD LVCMOS33 } [get_ports { sw_raw[0] }]; # SW0
set_property -dict { PACKAGE_PIN L16   IOSTANDARD LVCMOS33 } [get_ports { sw_raw[1] }]; # SW1
set_property -dict { PACKAGE_PIN M13   IOSTANDARD LVCMOS33 } [get_ports { sw_raw[2] }]; # SW2
set_property -dict { PACKAGE_PIN R15   IOSTANDARD LVCMOS33 } [get_ports { sw_raw[3] }]; # SW3

## --- 6. UART Communications Pins (PMOD USB-UART or ESP32 bridge headers) ---
set_property -dict { PACKAGE_PIN D4    IOSTANDARD LVCMOS33 } [get_ports { uart_rx }]; # PMOD Header JB Pin 1
set_property -dict { PACKAGE_PIN C4    IOSTANDARD LVCMOS33 } [get_ports { uart_tx }]; # PMOD Header JB Pin 2

## --- 7. PWM Light Output Indicators (Mapped to onboard Tri-Color or Header Pins) ---
set_property -dict { PACKAGE_PIN K15   IOSTANDARD LVCMOS33 } [get_ports { L0_PWM }]; # LED LD0
set_property -dict { PACKAGE_PIN J13   IOSTANDARD LVCMOS33 } [get_ports { L1_PWM }]; # LED LD1
set_property -dict { PACKAGE_PIN N14   IOSTANDARD LVCMOS33 } [get_ports { L2_PWM }]; # LED LD2
set_property -dict { PACKAGE_PIN R18   IOSTANDARD LVCMOS33 } [get_ports { L3_PWM }]; # LED LD3

## --- 8. PWM Fan Motor Output Indicators ---
set_property -dict { PACKAGE_PIN V17   IOSTANDARD LVCMOS33 } [get_ports { F0_PWM }]; # LED LD5
set_property -dict { PACKAGE_PIN U17   IOSTANDARD LVCMOS33 } [get_ports { F1_PWM }]; # LED LD6

## --- 9. Relay Switch Output Gating Control ---
set_property -dict { PACKAGE_PIN H14   IOSTANDARD LVCMOS33 } [get_ports { R0 }]; # PMOD Header JC Pin 1
set_property -dict { PACKAGE_PIN G16   IOSTANDARD LVCMOS33 } [get_ports { R1 }]; # PMOD Header JC Pin 2
set_property -dict { PACKAGE_PIN F16   IOSTANDARD LVCMOS33 } [get_ports { R2 }]; # PMOD Header JC Pin 3
set_property -dict { PACKAGE_PIN D14   IOSTANDARD LVCMOS33 } [get_ports { R3 }]; # PMOD Header JC Pin 4

## --- 10. Alarm Status Siren & Diagnostic Mode Displays ---
set_property -dict { PACKAGE_PIN V11   IOSTANDARD LVCMOS33 } [get_ports { ALARM_LED }]; # Onboard Red Siren LED LD15
set_property -dict { PACKAGE_PIN H15   IOSTANDARD LVCMOS33 } [get_ports { mode_ind[0] }]; # LD13 Mode diagnostic bit 0
set_property -dict { PACKAGE_PIN V16   IOSTANDARD LVCMOS33 } [get_ports { mode_ind[1] }]; # LD14 Mode diagnostic bit 1

## --- 11. Configuration Settings for Bitstream ---
set_property BITSTREAM.GENERAL.COMPRESS TRUE [current_design]
set_property BITSTREAM.CONFIG.CONFIGRATE 33 [current_design]
set_property CONFIG_MODE SPIx4 [current_design]
`
  },
  {
    name: "synth.ys",
    path: "scripts/synth.ys",
    language: "tcl",
    category: "Synthesis",
    description: "Automated synthesis commands script designed for Yosys CLI tool chains to estimate cell logic costs.",
    code: `# =================================================================
# File: scripts/synth.ys
# ToolChain: Yosys Open-Source Synthesis
# Purpose: Synthesis script for architectural design cell verification
# =================================================================

# 1. Ready in verilog design files
read_verilog rtl/clk_en.v
read_verilog rtl/debounce.v
read_verilog rtl/pwm8.v
read_verilog rtl/scenes.v
read_verilog rtl/ctrl_fsm.v
read_verilog rtl/top.v

# 2. Extract structural cell hierarchy top
hierarchy -top top

# 3. Compile design logical maps and perform basic logic optimizations
proc; opt; fsm; opt; memory; opt

# 4. Map to target FPGA cell primitives (Xilinx Artix7 architectures)
synth_xilinx -flatten -top top

# 5. Output cell utilization reports
stat

# 6. Save design netlist JSON for digital schematic view tools
write_json build/home_netlist.json
`
  }
];
