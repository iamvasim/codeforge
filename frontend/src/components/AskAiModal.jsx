import React, { useState } from 'react';

const QUICK_PROMPTS = [
    { label: 'Explain this file', action: 'Explain what this code does in detail and point out key components.' },
    { label: 'Find bugs & fix', action: 'Analyze this code for bugs, edge cases, and runtime errors, and provide the corrected version.' },
    { label: 'Optimize performance', action: 'Optimize this code for better runtime performance and memory efficiency.' },
    { label: 'Add clear comments', action: 'Add clean, helpful JSDoc/inline comments explaining complex logic in this code.' },
    { label: 'Refactor to clean code', action: 'Refactor this code following best modular software engineering principles.' }
];

const AskAiModal = ({
    isOpen,
    onClose,
    fileName,
    fileContent = '',
    onSendAiPrompt
}) => {
    const [customPrompt, setCustomPrompt] = useState('');

    if (!isOpen) return null;

    const handleActionClick = (actionText) => {
        const fullPrompt = `@ai For file "${fileName}":\n${actionText}\n\nCode:\n\`\`\`\n${fileContent}\n\`\`\``;
        onSendAiPrompt(fullPrompt);
        onClose();
    };

    const handleCustomSubmit = (e) => {
        e.preventDefault();
        if (!customPrompt.trim()) return;

        const fullPrompt = `@ai For file "${fileName}":\n${customPrompt.trim()}\n\nCode:\n\`\`\`\n${fileContent}\n\`\`\``;
        onSendAiPrompt(fullPrompt);
        setCustomPrompt('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#252526] border border-[#3e3e42] rounded-2xl w-full max-w-lg shadow-2xl p-6 text-white space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-violet-500/30">
                            <i className="ri-sparkling-fill text-amber-300 text-sm"></i>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">Ask AI Assistant</h3>
                            <p className="text-xs text-white/40">Target File: <strong className="text-violet-300">{fileName || 'No file'}</strong></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/10">
                        <i className="ri-close-line text-lg"></i>
                    </button>
                </div>

                {/* Quick Action Chips */}
                <div>
                    <label className="block text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2.5">
                        Quick Actions
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {QUICK_PROMPTS.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleActionClick(item.action)}
                                className="text-left p-2.5 rounded-xl bg-white/5 hover:bg-violet-600/20 border border-white/5 hover:border-violet-500/40 text-xs text-white/80 hover:text-white transition-all flex items-center justify-between group"
                            >
                                <span>{item.label}</span>
                                <i className="ri-arrow-right-s-line text-white/30 group-hover:text-violet-400"></i>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom Instruction Input */}
                <form onSubmit={handleCustomSubmit} className="space-y-3 pt-2 border-t border-white/10">
                    <label className="block text-[11px] uppercase tracking-wider text-white/40 font-semibold">
                        Custom Instruction
                    </label>
                    <textarea
                        rows="3"
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="e.g. Add an input validation function for user emails..."
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/25 outline-none focus:border-violet-500 resize-none transition-colors"
                    />
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-[#333333] hover:bg-[#444444] rounded-xl text-xs text-white/60 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!customPrompt.trim()}
                            className="px-5 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-violet-500/20 disabled:opacity-40 transition-all"
                        >
                            Send to AI
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AskAiModal;
