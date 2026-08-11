import React, { useState, useEffect, useMemo, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { getFileIcon } from './FileExplorer';

// Map file extensions to Monaco language identifiers
export const getLanguageFromFileName = (fileName) => {
    if (!fileName || typeof fileName !== 'string') return 'plaintext';
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'js':
        case 'mjs':
        case 'cjs':
            return 'javascript';
        case 'jsx':
            return 'javascript';
        case 'ts':
            return 'typescript';
        case 'tsx':
            return 'typescript';
        case 'json':
            return 'json';
        case 'html':
        case 'htm':
            return 'html';
        case 'css':
        case 'scss':
        case 'less':
            return 'css';
        case 'py':
            return 'python';
        case 'md':
        case 'markdown':
            return 'markdown';
        default:
            return 'plaintext';
    }
};

const CodeEditor = ({
    fileTree = {},
    currentFile,
    setCurrentFile,
    openFiles = [],
    setOpenFiles,
    onSaveFile,
    saveStatus = 'saved', // 'saved' | 'saving' | 'unsaved' | 'error'
    onFileContentChange,
    unsavedFiles = new Set(),
    onAskAi,
    onRunProject,
    onToggleTerminal,
    isTerminalOpen = false,
    isRunning = false,
    readOnly = false,
    userRole = 'owner'
}) => {
    // Editor settings state with comfortable defaults
    const [theme, setTheme] = useState('vs-dark');
    const [fontSize, setFontSize] = useState(14.5);
    const [tabSize, setTabSize] = useState(2);
    const [wordWrap, setWordWrap] = useState('on');
    const [minimap, setMinimap] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Cursor position & metadata in status bar
    const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });
    const [confirmCloseFile, setConfirmCloseFile] = useState(null);

    const editorRef = useRef(null);

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;

        // Track cursor position
        editor.onDidChangeCursorPosition((e) => {
            setCursorPos({
                line: e.position.lineNumber,
                column: e.position.column
            });
        });

        // Add custom Ctrl/Cmd + S keybinding inside Monaco
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            if (currentFile && onSaveFile && !readOnly) {
                onSaveFile(currentFile);
            }
        });
    };

    // Global keyboard listener for Ctrl/Cmd + S
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (currentFile && onSaveFile && !readOnly) {
                    onSaveFile(currentFile);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentFile, onSaveFile, readOnly]);

    // Current active file content and language
    const currentFileContent = useMemo(() => {
        if (!currentFile || !fileTree[currentFile]) return '';
        return fileTree[currentFile].file?.contents || '';
    }, [currentFile, fileTree]);

    const language = useMemo(() => {
        return getLanguageFromFileName(currentFile);
    }, [currentFile]);

    // Close Tab Handler
    const handleCloseTab = (fileToClose, force = false) => {
        if (!force && unsavedFiles.has(fileToClose)) {
            setConfirmCloseFile(fileToClose);
            return;
        }

        const nextOpen = openFiles.filter((f) => f !== fileToClose);
        setOpenFiles(nextOpen);

        if (currentFile === fileToClose) {
            const nextActive = nextOpen.length > 0 ? nextOpen[nextOpen.length - 1] : null;
            setCurrentFile(nextActive);
        }

        setConfirmCloseFile(null);
    };

    const handleTabCloseClick = (e, file) => {
        e.stopPropagation();
        handleCloseTab(file);
    };

    // Path segments for breadcrumbs
    const pathSegments = useMemo(() => {
        if (!currentFile || typeof currentFile !== 'string') return [];
        return currentFile.replace(/^\//, '').split('/');
    }, [currentFile]);

    return (
        <div className="flex flex-col h-full w-full bg-[#1e1e1e] text-zinc-100 select-none overflow-hidden font-sans">
            {/* 1. VS Code Style Tabs Header & Action Bar */}
            <div className="flex items-center justify-between bg-[#16161a] border-b border-white/10 h-[38px] px-1.5 overflow-hidden shrink-0">
                {/* Tabs Container */}
                <div className="flex items-center overflow-x-auto h-full scrollbar-none">
                    {openFiles.length === 0 ? (
                        <span className="text-[13px] text-zinc-400 px-4 italic">No files open</span>
                    ) : (
                        openFiles.filter(Boolean).map((file) => {
                            const fileName = (typeof file === 'string') ? file.split('/').pop() : '';
                            const { icon, color } = getFileIcon(fileName);
                            const isActive = currentFile === file;
                            const isUnsaved = unsavedFiles.has(file);

                            return (
                                <div
                                    key={file}
                                    onClick={() => setCurrentFile(file)}
                                    className={`group relative flex items-center gap-2 h-full px-3.5 text-[13.5px] cursor-pointer border-r border-white/10 transition-colors ${
                                        isActive
                                            ? 'bg-[#1e1e1e] text-white font-medium border-t-2 border-t-violet-500'
                                            : 'bg-[#16161a] text-zinc-400 hover:bg-[#1a1a20] hover:text-zinc-200'
                                    }`}
                                >
                                    <i className={`${icon} ${color} text-base shrink-0`}></i>
                                    <span className="truncate max-w-[140px]">{fileName}</span>

                                    {/* Unsaved indicator or close tab button */}
                                    {isUnsaved ? (
                                        <span
                                            onClick={(e) => handleTabCloseClick(e, file)}
                                            className="w-2.5 h-2.5 rounded-full bg-amber-400 group-hover:hidden ml-1 shrink-0 shadow-sm shadow-amber-400/50"
                                            title="Unsaved changes (click to close)"
                                        ></span>
                                    ) : null}

                                    {/* Close Tab Button */}
                                    <button
                                        onClick={(e) => handleTabCloseClick(e, file)}
                                        className={`p-0.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors ml-0.5 ${
                                            isUnsaved ? 'hidden group-hover:inline-block' : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                        title="Close Tab"
                                    >
                                        <i className="ri-close-line text-sm"></i>
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Top Action Buttons (Save, Run, Ask AI, Settings) */}
                <div className="flex items-center gap-2 pl-2 shrink-0">
                    {/* Read-Only Badge for Viewers */}
                    {readOnly && (
                        <span className="bg-purple-500/20 text-purple-300 text-xs px-2.5 py-1 rounded border border-purple-500/30 font-medium flex items-center gap-1">
                            <i className="ri-eye-line text-sm"></i>
                            <span>Read Only</span>
                        </span>
                    )}

                    {/* Save Button */}
                    <button
                        onClick={() => currentFile && onSaveFile(currentFile)}
                        disabled={readOnly || !currentFile || (!unsavedFiles.has(currentFile) && saveStatus === 'saved')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            unsavedFiles.has(currentFile) && !readOnly
                                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm shadow-amber-600/30'
                                : 'bg-white/10 hover:bg-white/15 text-zinc-200 border border-white/10'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                        title={readOnly ? "Viewers have read-only access" : "Save File (Ctrl/Cmd + S)"}
                    >
                        <i className="ri-save-3-line text-sm"></i>
                        <span>Save</span>
                    </button>

                    {/* Ask AI Button with Gradient */}
                    {onAskAi && (
                        <button
                            onClick={() => onAskAi(currentFile, currentFileContent)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-md shadow-violet-500/25 transition-all"
                            title="Ask AI to modify or explain code"
                        >
                            <i className="ri-sparkling-fill text-sm text-amber-300"></i>
                            <span>Ask AI</span>
                        </button>
                    )}

                    {/* Run Project Button */}
                    {onRunProject && (
                        <button
                            disabled={readOnly || isRunning}
                            onClick={onRunProject}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isRunning
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                    : readOnly
                                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30'
                            }`}
                            title={readOnly ? "Viewers cannot execute code" : "Run File / Project in WebContainer"}
                        >
                            <i className={isRunning ? 'ri-loader-4-line animate-spin text-sm' : 'ri-play-fill text-sm'}></i>
                            <span>{isRunning ? 'Running' : 'Run'}</span>
                        </button>
                    )}

                    {/* Terminal Toggle Button */}
                    {onToggleTerminal && (
                        <button
                            onClick={onToggleTerminal}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                                isTerminalOpen
                                    ? 'bg-white/15 text-white border border-white/10'
                                    : 'hover:bg-white/10 text-zinc-300 hover:text-white'
                            }`}
                            title="Toggle Interactive Terminal"
                        >
                            <i className="ri-terminal-box-line text-sm"></i>
                            <span>Terminal</span>
                        </button>
                    )}

                    {/* Editor Settings Trigger */}
                    <div className="relative">
                        <button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                            title="Editor Settings"
                        >
                            <i className="ri-settings-3-line text-base"></i>
                        </button>

                        {/* Settings Dropdown Popover */}
                        {isSettingsOpen && (
                            <div className="absolute right-0 mt-2 w-64 glass-modal rounded-xl shadow-2xl p-4 z-50 text-xs space-y-3.5 text-zinc-200">
                                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                                    <span className="font-semibold text-white text-[13px]">Editor Settings</span>
                                    <button
                                        onClick={() => setIsSettingsOpen(false)}
                                        className="text-zinc-400 hover:text-white"
                                    >
                                        <i className="ri-close-line text-base"></i>
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-zinc-300 mb-1 font-medium">Theme</label>
                                    <select
                                        value={theme}
                                        onChange={(e) => setTheme(e.target.value)}
                                        className="w-full bg-[#141416] border border-white/10 rounded-lg px-2.5 py-1.5 text-zinc-100 outline-none focus:border-violet-500"
                                    >
                                        <option value="vs-dark">Dark (VS Dark)</option>
                                        <option value="light">Light</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-zinc-300 mb-1 font-medium">Font Size: {fontSize}px</label>
                                    <input
                                        type="range"
                                        min="12"
                                        max="22"
                                        step="0.5"
                                        value={fontSize}
                                        onChange={(e) => setFontSize(Number(e.target.value))}
                                        className="w-full accent-violet-500 cursor-pointer"
                                    />
                                </div>

                                <div>
                                    <label className="block text-zinc-300 mb-1 font-medium">Tab Size: {tabSize} spaces</label>
                                    <select
                                        value={tabSize}
                                        onChange={(e) => setTabSize(Number(e.target.value))}
                                        className="w-full bg-[#141416] border border-white/10 rounded-lg px-2.5 py-1.5 text-zinc-100 outline-none focus:border-violet-500"
                                    >
                                        <option value={2}>2 Spaces</option>
                                        <option value={4}>4 Spaces</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-300 font-medium">Word Wrap</span>
                                    <input
                                        type="checkbox"
                                        checked={wordWrap === 'on'}
                                        onChange={(e) => setWordWrap(e.target.checked ? 'on' : 'off')}
                                        className="accent-violet-500 cursor-pointer w-4 h-4"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-300 font-medium">Minimap</span>
                                    <input
                                        type="checkbox"
                                        checked={minimap}
                                        onChange={(e) => setMinimap(e.target.checked)}
                                        className="accent-violet-500 cursor-pointer w-4 h-4"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Breadcrumbs Bar */}
            {currentFile && (
                <div className="flex items-center gap-1.5 px-4 h-[28px] bg-[#18181f] border-b border-white/5 text-[12.5px] text-zinc-400 shrink-0 font-sans">
                    <i className="ri-folder-open-line text-zinc-400 text-sm"></i>
                    {pathSegments.map((segment, index) => (
                        <React.Fragment key={index}>
                            {index > 0 && <i className="ri-arrow-right-s-line text-zinc-500 text-xs"></i>}
                            <span className={index === pathSegments.length - 1 ? 'text-zinc-200 font-medium' : 'text-zinc-400'}>
                                {segment}
                            </span>
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* 3. Main Monaco Editor Container */}
            <div className="flex-grow w-full h-full relative overflow-hidden bg-[#1e1e1e]">
                {currentFile ? (
                    <Editor
                        height="100%"
                        language={language}
                        value={currentFileContent}
                        theme={theme}
                        onChange={(value) => {
                            if (!readOnly && onFileContentChange) {
                                onFileContentChange(currentFile, value || '');
                            }
                        }}
                        onMount={handleEditorDidMount}
                        options={{
                            readOnly: readOnly,
                            fontSize: fontSize,
                            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
                            tabSize: tabSize,
                            wordWrap: wordWrap,
                            minimap: { enabled: minimap },
                            scrollBeyondLastLine: false,
                            smoothScrolling: true,
                            cursorBlinking: 'smooth',
                            cursorSmoothCaretAnimation: 'on',
                            lineNumbers: 'on',
                            renderLineHighlight: 'all',
                            automaticLayout: true,
                            lineHeight: 1.5,
                            padding: { top: 10, bottom: 10 }
                        }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 text-3xl shadow-lg">
                            <i className="ri-code-s-slash-line"></i>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-zinc-200">No File Open</p>
                            <p className="text-xs text-zinc-400 mt-1">Select a file from the explorer or create a new one to start coding</p>
                        </div>
                    </div>
                )}
            </div>

            {/* 4. VS Code Style Bottom Status Bar */}
            <div className="flex items-center justify-between h-[24px] px-3.5 bg-[#18181f] border-t border-white/10 text-[12px] text-zinc-300 font-mono select-none shrink-0 z-10">
                {/* Left Metadata */}
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 hover:text-white cursor-default">
                        <i className="ri-cursor-line text-xs text-violet-400"></i>
                        <span>Ln {cursorPos.line}, Col {cursorPos.column}</span>
                    </span>

                    <span className="text-zinc-500">•</span>

                    <span className="text-zinc-300">UTF-8</span>

                    <span className="text-zinc-500">•</span>

                    <span className="text-zinc-300">Spaces: {tabSize}</span>
                </div>

                {/* Right Language & Save Status */}
                <div className="flex items-center gap-3">
                    <span className="text-zinc-200 capitalize font-medium">{language}</span>

                    <span className="text-zinc-500">•</span>

                    {/* Role indicator */}
                    <span className={`capitalize font-semibold text-[11px] px-1.5 py-0.2 rounded ${
                        userRole === 'owner' ? 'text-amber-400 bg-amber-400/10' : userRole === 'editor' ? 'text-cyan-400 bg-cyan-400/10' : 'text-purple-400 bg-purple-400/10'
                    }`}>
                        {userRole}
                    </span>

                    <span className="text-zinc-500">•</span>

                    {/* Save State Badge */}
                    {readOnly ? (
                        <span className="text-purple-400 flex items-center gap-1">
                            <i className="ri-lock-line text-xs"></i>
                            <span>Read-Only</span>
                        </span>
                    ) : saveStatus === 'saving' ? (
                        <span className="text-amber-400 flex items-center gap-1">
                            <i className="ri-loader-4-line animate-spin text-xs"></i>
                            <span>Saving...</span>
                        </span>
                    ) : unsavedFiles.has(currentFile) ? (
                        <span className="text-amber-400 flex items-center gap-1 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                            <span>Unsaved</span>
                        </span>
                    ) : (
                        <span className="text-emerald-400 flex items-center gap-1">
                            <i className="ri-check-line text-xs"></i>
                            <span>Saved</span>
                        </span>
                    )}
                </div>
            </div>

            {/* Unsaved Changes Close Confirmation Modal */}
            {confirmCloseFile && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="glass-modal p-5 rounded-2xl w-96 max-w-full shadow-2xl space-y-3.5 text-zinc-200">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                                <i className="ri-error-warning-line text-lg"></i>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white">Unsaved Changes</h3>
                                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                                    Do you want to save changes you made to <strong className="text-white">"{confirmCloseFile}"</strong> before closing?
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => handleCloseTab(confirmCloseFile, true)}
                                className="flex-1 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs text-zinc-300 transition-colors"
                            >
                                Don't Save
                            </button>
                            <button
                                onClick={() => setConfirmCloseFile(null)}
                                className="flex-1 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs text-zinc-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (onSaveFile) await onSaveFile(confirmCloseFile);
                                    handleCloseTab(confirmCloseFile, true);
                                }}
                                className="flex-1 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-xs font-semibold text-white transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CodeEditor;
