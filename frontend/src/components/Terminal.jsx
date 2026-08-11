import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Terminal as XTerminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { getWebContainer, syncFileTreeToWebContainer } from '../config/webContainer';
import { executePythonScript } from '../config/pythonRunner';

const Terminal = forwardRef(({
    fileTree = {},
    onServerReady,
    isExpanded = true,
    onToggleExpand,
    onClose,
    currentFile,
    readOnly = false
}, ref) => {
    const terminalContainerRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const shellProcessRef = useRef(null);
    const inputWriterRef = useRef(null);

    // Active bottom panel tab: 'TERMINAL' | 'PROBLEMS' | 'OUTPUT' | 'PORTS'
    const [activeTab, setActiveTab] = useState('TERMINAL');
    const [status, setStatus] = useState('booting'); // 'booting' | 'ready' | 'error'
    const [statusMessage, setStatusMessage] = useState('Booting WebContainer environment...');
    const [activePort, setActivePort] = useState(null);
    const [activePortUrl, setActivePortUrl] = useState(null);

    // Resizable Height state (drag border)
    const [terminalHeight, setTerminalHeight] = useState(250);
    const isDraggingRef = useRef(false);
    const startYRef = useRef(0);
    const startHeightRef = useRef(250);

    // Drag Resizer Handlers
    const handleMouseDown = (e) => {
        isDraggingRef.current = true;
        startYRef.current = e.clientY;
        startHeightRef.current = terminalHeight;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';

        const handleMouseMove = (moveEvent) => {
            if (!isDraggingRef.current) return;
            const deltaY = startYRef.current - moveEvent.clientY;
            const newHeight = Math.min(Math.max(startHeightRef.current + deltaY, 120), 650);
            setTerminalHeight(newHeight);
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            if (fitAddonRef.current) fitAddonRef.current.fit();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Expose writeCommand & runPythonFile methods to parent
    useImperativeHandle(ref, () => ({
        writeCommand: (command) => {
            setActiveTab('TERMINAL');
            if (inputWriterRef.current && status === 'ready') {
                inputWriterRef.current.write(`${command}\r`);
            } else if (xtermRef.current) {
                xtermRef.current.writeln(`\r\n\x1b[33m[Notice] Shell is initializing. Please wait a moment...\x1b[0m`);
            }
        },
        runPythonFile: async (fileName, code) => {
            setActiveTab('TERMINAL');
            if (xtermRef.current) {
                xtermRef.current.writeln(`\r\n\x1b[1;32m❯ python ${fileName}\x1b[0m`);
                try {
                    await executePythonScript(code, {
                        onStdout: (text) => xtermRef.current?.writeln(text),
                        onStderr: (text) => xtermRef.current?.writeln(`\x1b[31m${text}\x1b[0m`)
                    });
                    xtermRef.current.writeln(`\x1b[90m[Process completed with exit code 0]\x1b[0m\r\n`);
                } catch (err) {
                    // Handled in onStderr
                }
            }
        },
        clear: () => {
            if (xtermRef.current) {
                xtermRef.current.clear();
            }
        },
        restartShell: () => {
            startShell();
        }
    }));

    const startShell = useCallback(async () => {
        try {
            setStatus('booting');
            setStatusMessage('Connecting WebContainer shell...');

            const webContainer = await getWebContainer();

            if (xtermRef.current) {
                xtermRef.current.clear();
                xtermRef.current.writeln('\x1b[38;2;139;92;246m★ CodeForge WebContainer Environment\x1b[0m');
                xtermRef.current.writeln('\x1b[90mNode.js runtime with in-browser Python execution support.\x1b[0m\r\n');
            }

            // Sync current files to WebContainer
            await syncFileTreeToWebContainer(fileTree);

            // Listen for web server ports
            webContainer.on('server-ready', (port, url) => {
                setActivePort(port);
                setActivePortUrl(url);
                if (onServerReady) {
                    onServerReady(url, port);
                }
                if (xtermRef.current) {
                    xtermRef.current.writeln(`\r\n\x1b[1;32m✓ Server ready at:\x1b[0m \x1b[4;36m${url}\x1b[0m (Port ${port})\r\n`);
                }
            });

            webContainer.on('port', (port, type, url) => {
                if (type === 'open') {
                    setActivePort(port);
                    setActivePortUrl(url);
                } else if (type === 'close') {
                    setActivePort(null);
                    setActivePortUrl(null);
                }
            });

            // Spawn interactive jsh shell process
            const shellProcess = await webContainer.spawn('jsh', {
                terminal: {
                    cols: xtermRef.current?.cols || 80,
                    rows: xtermRef.current?.rows || 24,
                }
            });

            shellProcessRef.current = shellProcess;

            // Pipe shell stdout/stderr to xterm.js
            shellProcess.output.pipeTo(new WritableStream({
                write(data) {
                    xtermRef.current?.write(data);
                }
            }));

            // Prepare writer for user keyboard input
            const input = shellProcess.input.getWriter();
            inputWriterRef.current = input;

            setStatus('ready');
            setStatusMessage('WebContainer Ready');

        } catch (err) {
            console.error("Terminal shell launch error:", err);
            setStatus('error');
            setStatusMessage(err.message || 'WebContainer initialization failed');
            if (xtermRef.current) {
                xtermRef.current.writeln(`\r\n\x1b[31m[Error] Failed to boot WebContainer shell: ${err.message}\x1b[0m\r\n`);
            }
        }
    }, [fileTree, onServerReady]);

    // Initialize xterm.js instance with 14px comfortable font
    useEffect(() => {
        if (!terminalContainerRef.current) return;

        const terminal = new XTerminal({
            cursorBlink: true,
            cursorStyle: 'bar',
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
            lineHeight: 1.45,
            letterSpacing: 0,
            theme: {
                background: '#12131a',
                foreground: '#e4e4e7',
                cursor: '#d946ef',
                cursorAccent: '#12131a',
                selectionBackground: 'rgba(139, 92, 246, 0.35)',
                black: '#27272a',
                red: '#ef4444',
                green: '#10b981',
                yellow: '#f59e0b',
                blue: '#3b82f6',
                magenta: '#a855f7',
                cyan: '#06b6d4',
                white: '#f4f4f5',
                brightBlack: '#52525b',
                brightRed: '#f87171',
                brightGreen: '#34d399',
                brightYellow: '#fbbf24',
                brightBlue: '#60a5fa',
                brightMagenta: '#c084fc',
                brightCyan: '#22d3ee',
                brightWhite: '#ffffff'
            },
            convertEol: true,
            allowProposedApi: true
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(terminalContainerRef.current);
        fitAddon.fit();

        xtermRef.current = terminal;
        fitAddonRef.current = fitAddon;

        // Route keyboard input to shell process
        terminal.onData((data) => {
            if (readOnly) return;
            if (inputWriterRef.current) {
                inputWriterRef.current.write(data);
            }
        });

        // Start shell
        startShell();

        const handleResize = () => {
            if (fitAddonRef.current) {
                fitAddonRef.current.fit();
                if (shellProcessRef.current && xtermRef.current) {
                    shellProcessRef.current.resize({
                        cols: xtermRef.current.cols,
                        rows: xtermRef.current.rows
                    });
                }
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            terminal.dispose();
        };
    }, []);

    // Fit terminal whenever expansion or height changes
    useEffect(() => {
        if (fitAddonRef.current && isExpanded) {
            setTimeout(() => {
                fitAddonRef.current?.fit();
            }, 100);
        }
    }, [isExpanded, terminalHeight, activeTab]);

    return (
        <div
            style={{ height: isExpanded ? `${terminalHeight}px` : '34px' }}
            className="w-full bg-[#12131a] border-t border-white/10 flex flex-col shrink-0 select-none text-zinc-200 font-sans transition-[height] duration-150 relative z-20"
        >
            {/* Top Resize Drag Handle */}
            <div
                onMouseDown={handleMouseDown}
                className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-violet-500/50 transition-colors z-30"
                title="Drag to resize terminal panel"
            />

            {/* Terminal Tab & Controls Header */}
            <div className="flex items-center justify-between h-[34px] px-3.5 bg-[#18181f] border-b border-white/10 shrink-0 text-xs">
                {/* Left Tabs (TERMINAL, OUTPUT, PORTS) */}
                <div className="flex items-center gap-1.5">
                    {['TERMINAL', 'OUTPUT', 'PORTS'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-1 text-xs font-semibold tracking-wider uppercase transition-colors rounded-lg ${
                                activeTab === tab
                                    ? 'text-white bg-[#1e1e1e] border border-white/10'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                            }`}
                        >
                            {tab}
                            {tab === 'PORTS' && activePort && (
                                <span className="ml-1.5 w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2 text-xs text-zinc-300 font-mono">
                    <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                            status === 'ready' ? 'bg-emerald-400' : status === 'booting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
                        }`}></span>
                        <span className="text-zinc-400 text-xs hidden sm:inline">{statusMessage}</span>
                    </span>
                </div>

                {/* Right Action Icons (18px) */}
                <div className="flex items-center gap-1">
                    {/* Clear Terminal */}
                    <button
                        onClick={() => xtermRef.current?.clear()}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        title="Clear Terminal"
                    >
                        <i className="ri-eraser-line text-base"></i>
                    </button>

                    {/* Restart Shell */}
                    <button
                        onClick={startShell}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        title="Restart Shell"
                    >
                        <i className="ri-restart-line text-base"></i>
                    </button>

                    {/* Kill Process (Ctrl+C) */}
                    <button
                        onClick={() => inputWriterRef.current?.write('\x03')}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                        title="Kill Process (Ctrl+C)"
                    >
                        <i className="ri-stop-circle-line text-base"></i>
                    </button>

                    {/* Maximize / Minimize Toggle */}
                    {onToggleExpand && (
                        <button
                            onClick={onToggleExpand}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                            title={isExpanded ? "Collapse Panel" : "Expand Panel"}
                        >
                            <i className={isExpanded ? "ri-arrow-down-s-line text-base" : "ri-arrow-up-s-line text-base"}></i>
                        </button>
                    )}

                    {/* Close Panel */}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                            title="Close Terminal"
                        >
                            <i className="ri-close-line text-base"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Run Chips Bar */}
            {isExpanded && activeTab === 'TERMINAL' && (
                <div className="flex items-center gap-2 px-3.5 py-1.5 bg-[#16161a] border-b border-white/5 text-xs text-zinc-300 overflow-x-auto">
                    <span className="text-zinc-400 uppercase font-mono text-[11px] font-semibold">Quick Run:</span>
                    <button
                        onClick={() => inputWriterRef.current?.write('ls\r')}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/15 text-zinc-200 rounded-lg border border-white/5 font-mono transition-colors"
                    >
                        ls
                    </button>
                    {currentFile && (currentFile.endsWith('.js') || currentFile.endsWith('.ts')) && (
                        <button
                            onClick={() => inputWriterRef.current?.write(`node ${currentFile}\r`)}
                            className="px-2.5 py-1 bg-violet-600/20 hover:bg-violet-600/35 text-violet-300 rounded-lg border border-violet-500/30 font-mono flex items-center gap-1.5 transition-colors"
                        >
                            <i className="ri-play-fill text-sm"></i>
                            <span>node {currentFile}</span>
                        </button>
                    )}
                    {currentFile && currentFile.endsWith('.py') && (
                        <button
                            onClick={async () => {
                                const code = fileTree[currentFile]?.file?.contents || '';
                                if (xtermRef.current) {
                                    xtermRef.current.writeln(`\r\n\x1b[1;32m❯ python ${currentFile}\x1b[0m`);
                                    try {
                                        await executePythonScript(code, {
                                            onStdout: (text) => xtermRef.current?.writeln(text),
                                            onStderr: (text) => xtermRef.current?.writeln(`\x1b[31m${text}\x1b[0m`)
                                        });
                                        xtermRef.current.writeln(`\x1b[90m[Process completed with exit code 0]\x1b[0m\r\n`);
                                    } catch (e) {
                                        // Handled
                                    }
                                }
                            }}
                            className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 rounded-lg border border-emerald-500/30 font-mono flex items-center gap-1.5 transition-colors"
                        >
                            <i className="ri-play-fill text-sm"></i>
                            <span>python {currentFile}</span>
                        </button>
                    )}
                    <button
                        onClick={() => inputWriterRef.current?.write('npm start\r')}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/15 text-zinc-200 rounded-lg border border-white/5 font-mono transition-colors"
                    >
                        npm start
                    </button>
                    <button
                        onClick={() => inputWriterRef.current?.write('pwd\r')}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/15 text-zinc-200 rounded-lg border border-white/5 font-mono transition-colors"
                    >
                        pwd
                    </button>
                    <button
                        onClick={() => inputWriterRef.current?.write('clear\r')}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/15 text-zinc-200 rounded-lg border border-white/5 font-mono transition-colors"
                    >
                        clear
                    </button>
                </div>
            )}

            {/* TAB CONTENTS */}
            {isExpanded && (
                <div className="flex-grow w-full h-full relative overflow-hidden bg-[#12131a]">
                    {/* 1. Interactive xterm.js Terminal View */}
                    <div
                        ref={terminalContainerRef}
                        className={`w-full h-full p-3 bg-[#12131a] overflow-hidden ${
                            activeTab === 'TERMINAL' ? 'block' : 'hidden'
                        }`}
                    />

                    {/* 2. Output View */}
                    {activeTab === 'OUTPUT' && (
                        <div className="p-5 text-[13px] text-zinc-300 space-y-2 font-mono">
                            <p className="text-violet-400 font-semibold">[CodeForge System Telemetry]</p>
                            <p>WebContainer Engine: Active (Node.js WASM)</p>
                            <p>Active File: {currentFile || 'None'}</p>
                            <p>Python Engine: Pyodide WASM Ready</p>
                        </div>
                    )}

                    {/* 3. Ports View */}
                    {activeTab === 'PORTS' && (
                        <div className="p-5 text-[13px] text-zinc-300 space-y-3">
                            {activePort ? (
                                <div className="p-4 bg-[#181825] border border-white/10 rounded-xl flex items-center justify-between shadow-lg">
                                    <div>
                                        <span className="font-mono text-emerald-400 font-bold text-sm">Port {activePort}</span>
                                        <p className="text-xs text-zinc-400 mt-1 truncate">{activePortUrl}</p>
                                    </div>
                                    <a
                                        href={activePortUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-lg text-xs text-white font-semibold shadow-md shadow-violet-500/25 transition-all"
                                    >
                                        Open Preview
                                    </a>
                                </div>
                            ) : (
                                <p className="text-zinc-500">No active ports forwarded currently.</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export default Terminal;
