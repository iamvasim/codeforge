import React, { useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { getLanguageFromFileName } from './CodeEditor';

const AiDiffModal = ({
    isOpen,
    onClose,
    originalFileTree = {},
    suggestedFileTree = {},
    onAcceptChanges
}) => {
    if (!isOpen || !suggestedFileTree || Object.keys(suggestedFileTree).length === 0) {
        return null;
    }

    const fileList = Object.keys(suggestedFileTree);
    const [selectedFile, setSelectedFile] = useState(fileList[0] || '');

    const originalContent = originalFileTree[selectedFile]?.file?.contents ?? '';
    const suggestedContent = suggestedFileTree[selectedFile]?.file?.contents ?? '';
    const language = getLanguageFromFileName(selectedFile);
    const isNewFile = !originalFileTree[selectedFile];

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-[#181825] border border-white/10 rounded-2xl w-full max-w-6xl h-[88vh] flex flex-col shadow-2xl overflow-hidden text-white font-sans">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#1e1e2e]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <i className="ri-sparkling-fill text-amber-300"></i>
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                AI Suggested Code Changes (Monaco Diff Viewer)
                                <span className="bg-violet-500/20 text-violet-300 text-[10px] px-2 py-0.5 rounded-full border border-violet-500/30 font-mono">
                                    {fileList.length} file{fileList.length > 1 ? 's' : ''} affected
                                </span>
                            </h2>
                            <p className="text-xs text-zinc-400">
                                Review additions (green) and removals (red). Your existing code is protected until you click Accept.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-zinc-300 hover:text-white transition-colors border border-white/5"
                        >
                            ✕ Reject Changes
                        </button>
                        <button
                            onClick={() => {
                                onAcceptChanges(suggestedFileTree);
                                onClose();
                            }}
                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-1.5"
                        >
                            <i className="ri-check-line text-sm"></i>
                            <span>✓ Accept Changes</span>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-grow overflow-hidden">
                    {/* Multi-file sidebar if multiple files exist */}
                    {fileList.length > 1 && (
                        <div className="w-60 bg-[#16161f] border-r border-white/10 flex flex-col shrink-0">
                            <div className="p-3 border-b border-white/10 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                Changed Files
                            </div>
                            <div className="p-2 space-y-1 overflow-y-auto flex-grow">
                                {fileList.map((file) => {
                                    const isSelected = selectedFile === file;
                                    const isNew = !originalFileTree[file];

                                    return (
                                        <button
                                            key={file}
                                            onClick={() => setSelectedFile(file)}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                                                isSelected
                                                    ? 'bg-violet-600/30 text-violet-200 font-medium border border-violet-500/40'
                                                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <i className="ri-file-code-line text-sm"></i>
                                                <span className="truncate">{file}</span>
                                            </div>
                                            {isNew ? (
                                                <span className="text-[10px] text-emerald-400 font-mono font-bold shrink-0">NEW</span>
                                            ) : (
                                                <span className="text-[10px] text-amber-400 font-mono font-bold shrink-0">DIFF</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Diff Editor Pane */}
                    <div className="flex-grow flex flex-col h-full bg-[#1e1e1e] overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-[#18181f] text-xs border-b border-white/10">
                            <span className="font-mono text-zinc-200 flex items-center gap-2">
                                <i className="ri-file-text-line text-violet-400"></i>
                                {selectedFile}
                                {isNewFile && (
                                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded">New File</span>
                                )}
                            </span>
                            <div className="flex items-center gap-4 text-xs text-zinc-400 font-mono">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-red-500/60"></span>
                                    <span>Original (Read Only)</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60"></span>
                                    <span>AI Proposed</span>
                                </span>
                            </div>
                        </div>

                        <div className="flex-grow h-full w-full overflow-hidden bg-[#1e1e1e]">
                            <DiffEditor
                                height="100%"
                                language={language}
                                original={originalContent}
                                modified={suggestedContent}
                                theme="vs-dark"
                                options={{
                                    readOnly: true,
                                    renderSideBySide: true,
                                    fontSize: 13.5,
                                    minimap: { enabled: false },
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace"
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-[#1e1e2e] text-xs">
                    <span className="text-zinc-400">
                        Comparing: <strong className="text-white font-mono">{selectedFile}</strong>
                    </span>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                        >
                            Cancel & Close
                        </button>
                        <button
                            onClick={() => {
                                onAcceptChanges(suggestedFileTree);
                                onClose();
                            }}
                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-600/30 transition-colors"
                        >
                            ✓ Apply Changes to Editor
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiDiffModal;
