/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileCode, Copy, Check, Info, Download, Cpu, ShieldCheck, HelpCircle } from 'lucide-react';
import { rtlFiles, CodeFile } from '../data/rtlCode';

export default function CodeExplorer() {
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'RTL' | 'Verification' | 'Constraints' | 'Synthesis'>('ALL');
  const [activeFile, setActiveFile] = useState<CodeFile>(rtlFiles[0]);
  const [copied, setCopied] = useState(false);

  const filteredFiles = rtlFiles.filter(
    file => selectedCategory === 'ALL' || file.category === selectedCategory
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([activeFile.code], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = activeFile.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="code-explorer-section">
      {/* Sidebar: File Tree */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[650px] shadow-lg">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-cyan-400" />
            Workspace Files
          </h3>
          <div className="flex flex-wrap gap-1">
            {['ALL', 'RTL', 'Verification', 'Constraints', 'Synthesis'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat as any)}
                className={`px-2 py-1 text-2xs rounded-md border font-mono transition-all ${
                  (selectedCategory === cat)
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Tree List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
          {filteredFiles.map((file) => {
            const isActive = activeFile.path === file.path;
            return (
              <button
                key={file.path}
                onClick={() => {
                  setActiveFile(file);
                  setCopied(false);
                }}
                className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 group ${
                  isActive
                    ? 'bg-slate-800/80 border-cyan-500/45 text-cyan-300'
                    : 'bg-slate-950/40 border-slate-900/50 text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
                }`}
              >
                <FileCode className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'}`} />
                <div className="truncate">
                  <div className="font-semibold text-slate-200 truncate">{file.name}</div>
                  <div className="text-3xs text-slate-500 font-sans truncate">{file.path}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 text-3xs text-slate-500 flex items-center justify-between">
          <span>Files Count: {rtlFiles.length}</span>
          <span className="text-cyan-400 font-mono">Synthesizable Verilog-2001</span>
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="lg:col-span-3 bg-slate-950 border border-slate-900 rounded-xl flex flex-col h-[650px] shadow-2xl relative overflow-hidden">
        {/* Panel Header */}
        <div className="bg-slate-900/80 border-b border-slate-900 px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="h-4 w-px bg-slate-800" />
            <span className="font-mono text-xs text-slate-300 font-semibold flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-3xs text-cyan-400 font-bold uppercase">
                {activeFile.category}
              </span>
              {activeFile.path}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-2xs font-mono"
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 rounded bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-2xs font-mono"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* File Description bar */}
        <div className="bg-slate-900/40 border-b border-slate-900 px-4 py-3 flex items-start gap-2.5 text-xs text-slate-400 select-none">
          <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
          <div className="leading-relaxed font-sans">{activeFile.description}</div>
        </div>

        {/* Editor Code Body */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-200 leading-6 bg-slate-950 antialiased select-text">
          <pre className="relative h-full">
            <code>
              {activeFile.code.split('\n').map((line, idx) => (
                <div key={idx} className="flex hover:bg-slate-900/40 px-2 rounded -mx-2 transition-colors">
                  <span className="w-10 text-slate-600 text-right select-none pr-4 shrink-0 font-light border-r border-slate-900 margin-r-4">
                    {idx + 1}
                  </span>
                  <span className="pl-4 whitespace-pre text-slate-300 text-xs tracking-normal">
                    {highlightVerilogLine(line)}
                  </span>
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}

// Simple client side syntactic highlighter for high-fidelity FPGA coding view
function highlightVerilogLine(line: string) {
  if (line.trim().startsWith('//') || line.trim().startsWith('##')) {
    return <span className="text-green-500/90 italic font-normal">{line}</span>;
  }

  // Common keywords matching Verilog/SystemVerilog
  const keywords = /\b(module|endmodule|parameter|localparam|input|output|wire|reg|integer|always|posedge|negedge|begin|end|if|else|case|endcase|default|assign|wire|reg|localparam|timescale)\b/g;
  const numbers = /\b(\d+'[bhd]\w+|\b\d+\b)\b/g;
  const systemTasks = /(\$\w+)/g;

  // Split and render highlights (using basic replacement)
  // To keep React rendering safe without dangerouslySetInnerHTML, we can just style keywords nicely or return inline colored blocks
  // For lightweight highlights, let's treat comments nicely (which we already did).
  // Inside Verilog code block we will paint keywords blue/cyan!
  if (line.includes('//')) {
    const parts = line.split('//');
    return (
      <>
        {applyKeywordsHighlights(parts[0])}
        <span className="text-emerald-500/90 italic font-normal">//{parts.slice(1).join('//')}</span>
      </>
    );
  }

  return applyKeywordsHighlights(line);
}

function applyKeywordsHighlights(text: string) {
  const parts = text.split(/(\s+|,|\(|\)|;|:|=|\+|-|<|>|!|&|\||\^|\*)/);
  const keywordSet = new Set([
    'module', 'endmodule', 'parameter', 'localparam', 'input', 'output', 'wire', 'reg', 'integer',
    'always', 'posedge', 'negedge', 'begin', 'end', 'if', 'else', 'case', 'endcase', 'default',
    'assign', 'set_property', 'create_clock', 'hierarcy', 'synth_xilinx', 'stat', 'write_json'
  ]);

  return parts.map((part, index) => {
    if (keywordSet.has(part.trim())) {
      return <span key={index} className="text-amber-400 font-semibold">{part}</span>;
    }
    if (part.trim().startsWith('$')) {
      return <span key={index} className="text-teal-400 font-bold">{part}</span>;
    }
    if (/^\d+'[bhd]\w+$/.test(part.trim()) || /^\d+$/.test(part.trim())) {
      return <span key={index} className="text-pink-400 font-semibold">{part}</span>;
    }
    if (['PACKAGE_PIN', 'IOSTANDARD', 'create_clock', 'sys_clk_pin', 'LVCMOS33'].includes(part.trim())) {
      return <span key={index} className="text-cyan-400 font-medium">{part}</span>;
    }
    return <span key={index} className="text-slate-200">{part}</span>;
  });
}
