import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'markdown-to-jsx';
import hljs from 'highlight.js';

const QUICK_ACTIONS = [
    { icon: 'ri-bug-line', label: 'Fix Bugs', prompt: 'Analyze this file for runtime errors, edge cases, and bugs, and provide the corrected code.' },
    { icon: 'ri-flashlight-line', label: 'Optimize', prompt: 'Optimize this code for better runtime performance, clean logic, and memory efficiency.' },
    { icon: 'ri-question-answer-line', label: 'Explain', prompt: 'Explain how this code works step by step, highlighting key functions and logic.' },
    { icon: 'ri-chat-check-line', label: 'Add Comments', prompt: 'Add clean, descriptive comments explaining the functions and complex logic in this code.' },
    { icon: 'ri-magic-line', label: 'Refactor', prompt: 'Refactor this code to follow clean architecture and modular software engineering principles.' }
];

function SyntaxCode(props) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current && props.className?.includes('lang-')) {
            try {
                hljs.highlightElement(ref.current);
                ref.current.removeAttribute('data-highlighted');
            } catch (e) {
                // Ignore
            }
        }
    }, [props.className, props.children]);

    return <code {...props} ref={ref} />;
}

/**
 * Extracts proposed code from markdown code blocks in the AI response
 */
export const extractCodeFromResponse = (markdownText = '') => {
    const codeBlockRegex = /```(?:[a-zA-Z0-9_\-\.]+)?\n([\s\S]*?)```/g;
    const matches = [];
    let match;

    while ((match = codeBlockRegex.exec(markdownText)) !== null) {
        if (match[1] && match[1].trim()) {
            matches.push(match[1].trim());
        }
    }

    if (matches.length > 0) {
        return matches.reduce((longest, current) => current.length > longest.length ? current : longest, '');
    }

    return null;
};

const AiAssistantPanel = ({
    isOpen,
    onClose,
    currentFile,
    fileContent = '',
    fileTree = {},
    onReviewDiff,
    onDirectAccept,
    readOnly = false
}) => {
    const [instruction, setInstruction] = useState('');
    const [status, setStatus] = useState('idle'); // 'idle' | 'streaming' | 'completed' | 'error'
    const [streamedText, setStreamedText] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [proposedCode, setProposedCode] = useState(null);

    const abortControllerRef = useRef(null);
    const scrollContainerRef = useRef(null);

    // Auto-scroll to bottom of stream
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [streamedText]);

    // Handle Streaming Request
    const handleSendPrompt = async (promptText) => {
        const activePrompt = (promptText || instruction).trim();
        if (!activePrompt) return;

        setStatus('streaming');
        setStreamedText('');
        setErrorMessage('');
        setProposedCode(null);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const token = localStorage.getItem('token');
        const projectContextFiles = Object.keys(fileTree).filter(f => f !== currentFile);

        try {
            const response = await fetch('/ai/stream-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    fileName: currentFile,
                    fileContent,
                    instruction: activePrompt,
                    projectContextFiles
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Server responded with ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let accumulatedText = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith(':')) continue;

                    if (trimmed.startsWith('data:')) {
                        const dataStr = trimmed.replace(/^data:\s*/, '');
                        try {
                            const parsed = JSON.parse(dataStr);

                            const chunkText = parsed.text ?? parsed.chunk;
                            if (chunkText) {
                                accumulatedText += chunkText;
                                setStreamedText(accumulatedText);
                            }

                            if (parsed.done) {
                                setStatus('completed');
                                const extracted = extractCodeFromResponse(accumulatedText);
                                if (extracted) {
                                    setProposedCode(extracted);
                                }
                            }

                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }
                        } catch (e) {
                            if (e.message !== 'Unexpected end of JSON input') {
                                console.error("Error parsing SSE chunk:", e);
                            }
                        }
                    }
                }
            }

            setStatus('completed');
            const extracted = extractCodeFromResponse(accumulatedText);
            if (extracted) {
                setProposedCode(extracted);
            }

        } catch (err) {
            if (err.name === 'AbortError') {
                setStatus('completed');
                const extracted = extractCodeFromResponse(streamedText);
                if (extracted) {
                    setProposedCode(extracted);
                }
            } else {
                console.error("AI Streaming error:", err);
                setStatus('error');
                setErrorMessage(err.message || 'An error occurred while streaming response.');
            }
        }
    };

    const handleStopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    };

    if (!isOpen) return null;

    return (
        <aside className="w-[360px] min-w-[340px] max-w-[420px] h-full bg-[#181825] border-l border-violet-500/30 flex flex-col shrink-0 text-zinc-100 z-20 font-sans shadow-2xl">
            {/* Header */}
            <div className="h-[40px] px-4 bg-[#1e1e2e] border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-violet-500/20">
                        <i className="ri-sparkling-fill text-amber-300 text-xs"></i>
                    </div>
                    <h2 className="text-[13.5px] font-bold bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                        AI Assistant
                    </h2>
                    <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/30 font-mono">
                        Gemini 1.5
                    </span>
                </div>

                <button
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    title="Close Assistant"
                >
                    <i className="ri-close-line text-base"></i>
                </button>
            </div>

            {/* Target File Context Bar */}
            <div className="px-4 py-2 bg-[#14141a] border-b border-white/10 flex items-center justify-between text-xs text-zinc-400 shrink-0">
                <span className="flex items-center gap-1.5 truncate">
                    <i className="ri-file-code-line text-violet-400"></i>
                    <strong className="text-zinc-200 font-mono truncate font-medium">{currentFile || 'No file active'}</strong>
                </span>
                <span className="text-[11px] text-zinc-400 font-mono shrink-0">
                    {fileContent.split('\n').length} lines
                </span>
            </div>

            {/* Main Content Area */}
            <div ref={scrollContainerRef} className="flex-grow overflow-y-auto p-4 space-y-3.5 select-text">
                {/* 1. Quick Actions Chips */}
                {status === 'idle' && (
                    <div className="space-y-2 select-none">
                        <span className="text-[11px] uppercase font-mono tracking-wider text-zinc-400 block font-semibold">
                            Quick Actions
                        </span>
                        <div className="grid grid-cols-1 gap-2">
                            {QUICK_ACTIONS.map((action, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setInstruction(action.prompt);
                                        handleSendPrompt(action.prompt);
                                    }}
                                    className="w-full text-left p-2.5 rounded-xl bg-white/[0.04] hover:bg-violet-600/20 border border-white/10 hover:border-violet-500/40 text-[13px] text-zinc-200 hover:text-white transition-all flex items-center justify-between group shadow-xs"
                                >
                                    <div className="flex items-center gap-2.5 truncate">
                                        <i className={`${action.icon} text-violet-400 group-hover:text-violet-300 text-base`}></i>
                                        <span className="truncate font-medium">{action.label}</span>
                                    </div>
                                    <i className="ri-arrow-right-s-line text-zinc-500 group-hover:text-violet-400"></i>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. Streaming Output Display */}
                {streamedText && (
                    <div className="space-y-3">
                        <div className="bg-[#12131a] rounded-xl p-3.5 border border-white/10 text-[13.5px] text-zinc-100 leading-relaxed overflow-x-auto shadow-inner">
                            <Markdown
                                children={streamedText}
                                options={{
                                    overrides: {
                                        code: SyntaxCode
                                    }
                                }}
                            />
                            {status === 'streaming' && (
                                <span className="inline-block w-2 h-4 ml-1 bg-gradient-to-b from-violet-400 to-fuchsia-400 animate-pulse align-middle" />
                            )}
                        </div>

                        {/* 3. Proposed Code Action Card */}
                        {proposedCode && status === 'completed' && !readOnly && (
                            <div className="p-3.5 bg-gradient-to-br from-violet-900/30 to-fuchsia-900/20 border border-violet-500/40 rounded-xl space-y-2.5 select-none shadow-lg shadow-violet-500/10">
                                <div className="flex items-center justify-between">
                                    <span className="text-[13px] font-bold text-violet-300 flex items-center gap-1.5">
                                        <i className="ri-git-pull-request-line"></i>
                                        Code Changes Ready
                                    </span>
                                    <span className="text-[11px] text-zinc-400 font-mono">
                                        {proposedCode.split('\n').length} lines
                                    </span>
                                </div>

                                <p className="text-xs text-zinc-300 leading-relaxed">
                                    Review side-by-side diff before merging. Your manual code will not be changed without approval.
                                </p>

                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        onClick={() => onReviewDiff(currentFile, proposedCode)}
                                        className="flex-1 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-violet-500/20"
                                    >
                                        <i className="ri-git-commit-line text-xs"></i>
                                        <span>Review Diff</span>
                                    </button>

                                    <button
                                        onClick={() => onDirectAccept(currentFile, proposedCode)}
                                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-md shadow-emerald-600/20"
                                        title="Quick Accept"
                                    >
                                        ✓ Accept
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Error Banner */}
                {status === 'error' && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 space-y-1">
                        <div className="flex items-center gap-2 font-semibold">
                            <i className="ri-error-warning-line text-red-400"></i>
                            <span>Generation Error</span>
                        </div>
                        <p className="text-[11px] text-red-300/80">{errorMessage}</p>
                    </div>
                )}
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-[#1e1e2e] border-t border-white/10 shrink-0 space-y-2 select-none">
                <textarea
                    rows="2"
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (status !== 'streaming') handleSendPrompt();
                        }
                    }}
                    disabled={status === 'streaming'}
                    placeholder={`Ask AI about ${currentFile || 'code'}...`}
                    className="w-full bg-[#14141a] border border-white/10 rounded-xl px-3 py-2 text-[13.5px] text-white placeholder-zinc-500 outline-none focus:border-violet-500 resize-none transition-colors"
                />

                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400 font-mono">
                        {status === 'streaming' ? '● Generating...' : 'Press Enter to send'}
                    </span>

                    {status === 'streaming' ? (
                        <button
                            onClick={handleStopGeneration}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                            <i className="ri-stop-fill text-xs"></i>
                            <span>Stop</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => handleSendPrompt()}
                            disabled={!instruction.trim() || !currentFile}
                            className="px-4 py-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-500/25 disabled:opacity-40 transition-all flex items-center gap-1.5"
                        >
                            <i className="ri-sparkling-fill text-amber-300 text-xs"></i>
                            <span>Generate</span>
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default AiAssistantPanel;
