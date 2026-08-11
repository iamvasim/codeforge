import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { UserContext } from '../context/user.context';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from '../config/axios';
import { initializeSocket, receiveMessage, sendMessage, removeListener, disconnectSocket } from '../config/socket';
import Markdown from 'markdown-to-jsx';
import hljs from 'highlight.js';
import { getWebContainer, syncFileTreeToWebContainer } from '../config/webContainer';
import CodeEditor from '../components/CodeEditor';
import FileExplorer from '../components/FileExplorer';
import Terminal from '../components/Terminal';
import AiDiffModal from '../components/AiDiffModal';
import AiAssistantPanel from '../components/AiAssistantPanel';

function SyntaxHighlightedCode(props) {
    const ref = useRef(null);
    const [copied, setCopied] = useState(false);

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

    const handleCopy = (e) => {
        e.stopPropagation();
        const codeText = ref.current?.innerText || '';
        navigator.clipboard.writeText(codeText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const langMatch = props.className?.match(/lang-(\w+)/);
    const lang = langMatch ? langMatch[1] : '';

    if (lang) {
        return (
            <div className="relative my-2.5 rounded-xl border border-white/10 bg-[#12131a] overflow-hidden shadow-md">
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#181822] border-b border-white/10 text-xs font-mono text-zinc-300">
                    <span className="text-violet-400 font-semibold">{lang}</span>
                    <button
                        onClick={handleCopy}
                        className="hover:text-white transition-colors flex items-center gap-1 text-xs"
                    >
                        <i className={copied ? "ri-check-line text-emerald-400" : "ri-file-copy-line"}></i>
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                </div>
                <div className="p-3 text-[13.5px] font-mono overflow-x-auto">
                    <code {...props} ref={ref} />
                </div>
            </div>
        );
    }

    return <code {...props} ref={ref} className="bg-white/10 text-violet-300 px-1.5 py-0.5 rounded text-xs font-mono" />;
}

const Project = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const projectInitial = location.state?.project || null;
    const [isChatOpen, setIsChatOpen] = useState(true);
    const [chatWidth, setChatWidth] = useState(() => {
        try {
            const saved = localStorage.getItem('codeforge-chat-width') || localStorage.getItem('nexchat-chat-width');
            if (saved) {
                const parsed = parseInt(saved, 10);
                if (!isNaN(parsed) && parsed >= 280 && parsed <= 480) {
                    return parsed;
                }
            }
        } catch (e) {}
        return 320;
    });
    const [isDraggingChat, setIsDraggingChat] = useState(false);
    const [showChatWidthMenu, setShowChatWidthMenu] = useState(false);
    const chatWidthRef = useRef(chatWidth);
    chatWidthRef.current = chatWidth;

    const [unreadCount, setUnreadCount] = useState(0);
    const [incomingToast, setIncomingToast] = useState(null);

    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeletingProject, setIsDeletingProject] = useState(false);

    const [selectedUserId, setSelectedUserId] = useState(new Set());
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [inviteRole, setInviteRole] = useState('editor'); // 'editor' | 'viewer'
    const [userRole, setUserRole] = useState(location.state?.userRole || 'owner'); // 'owner' | 'editor' | 'viewer'
    const [project, setProject] = useState(projectInitial || {});
    const [message, setMessage] = useState('');
    const { user } = useContext(UserContext);
    const messageBox = useRef(null);

    // Toggle Chat safely with automatic layout resize dispatch
    const toggleChat = () => {
        setIsChatOpen(prev => {
            const next = !prev;
            if (next) setUnreadCount(0);
            setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
            setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
            return next;
        });
    };

    // Chat Resize Drag Handlers
    const handleChatResizeMouseDown = (e) => {
        e.preventDefault();
        setIsDraggingChat(true);
        const startX = e.clientX;
        const startWidth = chatWidthRef.current;

        const onMouseMove = (moveEvent) => {
            const delta = moveEvent.clientX - startX;
            const newWidth = Math.min(480, Math.max(280, startWidth + delta));
            setChatWidth(newWidth);
        };

        const onMouseUp = () => {
            setIsDraggingChat(false);
            try {
                localStorage.setItem('codeforge-chat-width', chatWidthRef.current.toString());
            } catch (err) {}
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const handleChatResizeDoubleClick = () => {
        setChatWidth(320);
        try {
            localStorage.setItem('codeforge-chat-width', '320');
        } catch (err) {}
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    };

    const handleSetPresetWidth = (width) => {
        setChatWidth(width);
        try {
            localStorage.setItem('codeforge-chat-width', width.toString());
        } catch (err) {}
        setShowChatWidthMenu(false);
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    };

    // Chat states
    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);

    // File tree and editor states
    const [fileTree, setFileTree] = useState(projectInitial?.fileTree || {});
    const [currentFile, setCurrentFile] = useState(null);
    const [openFiles, setOpenFiles] = useState([]);
    const [unsavedFiles, setUnsavedFiles] = useState(new Set());
    const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved' | 'error'

    // Interactive Terminal states
    const [isTerminalOpen, setIsTerminalOpen] = useState(true);
    const [isTerminalExpanded, setIsTerminalExpanded] = useState(true);
    const terminalRef = useRef(null);

    // Cursor-style Streaming AI Assistant & Diff states
    const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
    const [isAiDiffOpen, setIsAiDiffOpen] = useState(false);
    const [suggestedAiFileTree, setSuggestedAiFileTree] = useState(null);

    // Live Browser Preview iframe state
    const [iframeUrl, setIframeUrl] = useState(null);

    const isViewer = userRole === 'viewer';
    const isOwner = userRole === 'owner';

    // Normalized member list combining owner, members array, and legacy users array
    const normalizedMembers = useMemo(() => {
        const list = [];
        const seen = new Set();

        // 1. Owner
        if (project.owner) {
            const ownerObj = typeof project.owner === 'object' ? project.owner : { _id: project.owner, email: 'Project Owner' };
            const ownerId = ownerObj._id?.toString() || ownerObj.toString();
            list.push({
                _id: ownerId,
                email: ownerObj.email || 'Project Owner',
                role: 'owner'
            });
            seen.add(ownerId);
        }

        // 2. Members Array
        if (Array.isArray(project.members) && project.members.length > 0) {
            project.members.forEach(m => {
                const uObj = typeof m.user === 'object' ? m.user : { _id: m.user, email: 'Collaborator' };
                const uId = uObj?._id?.toString() || uObj?.toString();
                if (uId && !seen.has(uId)) {
                    list.push({
                        _id: uId,
                        email: uObj?.email || 'Member',
                        role: m.role || 'editor'
                    });
                    seen.add(uId);
                }
            });
        }

        // 3. Fallback: Users Array (for legacy projects)
        if (Array.isArray(project.users) && project.users.length > 0) {
            project.users.forEach((u, idx) => {
                const uObj = typeof u === 'object' ? u : { _id: u, email: 'Collaborator' };
                const uId = uObj?._id?.toString() || uObj?.toString();
                if (uId && !seen.has(uId)) {
                    list.push({
                        _id: uId,
                        email: uObj?.email || 'Collaborator',
                        role: list.length === 0 && idx === 0 ? 'owner' : 'editor'
                    });
                    seen.add(uId);
                }
            });
        }

        return list;
    }, [project]);

    const existingMemberIds = useMemo(() => {
        return new Set(normalizedMembers.map(m => m._id));
    }, [normalizedMembers]);

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            if (!u.email) return false;
            if (u._id === user?._id) return false;
            return u.email.toLowerCase().includes(userSearchQuery.toLowerCase().trim());
        });
    }, [users, userSearchQuery, user]);

    const scrollToBottom = () => {
        if (messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight;
        }
    };

    const formatTimestamp = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    useEffect(() => {
        const fileKeys = Object.keys(fileTree);
        if (fileKeys.length > 0 && !currentFile) {
            const initialFile = fileKeys[0];
            setCurrentFile(initialFile);
            setOpenFiles([initialFile]);
        }
    }, [fileTree]);

    const handleUserClick = (id) => {
        if (existingMemberIds.has(id)) return;

        setSelectedUserId(prevSelectedUserId => {
            const newSelectedUserId = new Set(prevSelectedUserId);
            if (newSelectedUserId.has(id)) {
                newSelectedUserId.delete(id);
            } else {
                newSelectedUserId.add(id);
            }
            return newSelectedUserId;
        });
    };

    const addCollaborators = () => {
        const projectId = project?._id || location.state?.project?._id;
        if (!projectId) return;

        axios.put("/projects/add-user", {
            projectId,
            users: Array.from(selectedUserId),
            role: inviteRole
        }).then(res => {
            if (res.data?.project) {
                setProject(res.data.project);
            }
            setIsModalOpen(false);
            setSelectedUserId(new Set());
            setUserSearchQuery('');
        }).catch(err => {
            console.error("Error adding collaborators:", err);
            alert(err.response?.data?.message || "Failed to add collaborators");
        });
    };

    const handleChangeMemberRole = (targetUserId, newRole) => {
        const projectId = project?._id || location.state?.project?._id;
        if (!projectId) return;

        axios.put("/projects/update-member-role", {
            projectId,
            targetUserId,
            newRole
        }).then(res => {
            if (res.data?.project) {
                setProject(res.data.project);
            }
        }).catch(err => {
            console.error("Error updating member role:", err);
            alert(err.response?.data?.message || "Failed to update role");
        });
    };

    const handleRemoveMember = (targetUserId) => {
        const projectId = project?._id || location.state?.project?._id;
        if (!projectId) return;

        if (!window.confirm("Are you sure you want to remove this member from the project?")) return;

        axios.delete("/projects/remove-member", {
            data: { projectId, targetUserId }
        }).then(res => {
            if (res.data?.project) {
                setProject(res.data.project);
            }
        }).catch(err => {
            console.error("Error removing member:", err);
            alert(err.response?.data?.message || "Failed to remove member");
        });
    };

    const handleDeleteProject = () => {
        const projectId = project?._id || location.state?.project?._id;
        if (!projectId) return;

        setIsDeletingProject(true);
        axios.delete(`/projects/${projectId}`)
            .then(() => {
                setIsDeletingProject(false);
                setIsDeleteModalOpen(false);
                navigate('/');
            })
            .catch(err => {
                setIsDeletingProject(false);
                console.error("Delete project error:", err);
                alert(err.response?.data?.message || "Failed to delete project");
            });
    };

    const send = () => {
        if (isViewer) {
            alert("Viewers have read-only permissions and cannot send chat messages.");
            return;
        }

        if (!message.trim()) return;

        sendMessage('project-message', {
            message: message.trim(),
            sender: user
        });
        setMessage("");
    };

    // Safely unescapes literal escaped characters (\n, \t, \", \\)
    function unescapeString(str) {
        if (typeof str !== 'string') return '';
        // If string contains literal escaped newlines "\n" instead of actual newlines
        if (str.includes('\\n') || str.includes('\\t') || str.includes('\\"')) {
            return str
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\r/g, '\r')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\');
        }
        return str;
    }

    // Parses and formats raw/JSON AI responses into clean Markdown and extracts any fileTree
    function sanitizeAiResponse(raw) {
        if (!raw) return { markdownContent: '', effectiveFileTree: null };

        let obj = null;

        if (typeof raw === 'object' && raw !== null) {
            obj = raw;
        } else if (typeof raw === 'string') {
            const trimmed = raw.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                try {
                    obj = JSON.parse(trimmed);
                } catch (e) {
                    try {
                        const cleaned = trimmed.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
                        obj = JSON.parse(cleaned);
                    } catch (e2) {
                        obj = null;
                    }
                }
            }
        }

        let markdownContent = '';
        let effectiveFileTree = obj?.fileTree || null;

        if (obj && typeof obj === 'object') {
            if (obj.text && typeof obj.text === 'string') {
                markdownContent = unescapeString(obj.text);
            } else {
                const parts = [];
                if (obj.explanation) {
                    parts.push(typeof obj.explanation === 'string' ? unescapeString(obj.explanation) : JSON.stringify(obj.explanation));
                }
                if (obj.code) {
                    let codeStr = unescapeString(String(obj.code)).trim();

                    // Detect leading language specifier if not wrapped in markdown code fence (e.g. "javascript\nfunction...")
                    let detectedLang = 'javascript';
                    const langPrefixMatch = codeStr.match(/^([a-zA-Z0-9_\-]+)\s*\n([\s\S]*)$/);
                    if (langPrefixMatch && !codeStr.startsWith('```')) {
                        const candidateLang = langPrefixMatch[1].toLowerCase();
                        if (['javascript', 'js', 'typescript', 'ts', 'python', 'py', 'html', 'css', 'json', 'sql', 'bash', 'sh'].includes(candidateLang)) {
                            detectedLang = candidateLang;
                            codeStr = langPrefixMatch[2].trim();
                        }
                    }

                    if (codeStr.startsWith('```')) {
                        parts.push(codeStr);
                    } else {
                        parts.push(`\`\`\`${detectedLang}\n${codeStr}\n\`\`\``);
                    }
                }
                if (obj.buildCommand?.mainItem) {
                    parts.push(`\`\`\`bash\n${unescapeString(obj.buildCommand.mainItem).trim()}\n\`\`\``);
                }
                if (obj.message && !obj.explanation) {
                    parts.push(typeof obj.message === 'string' ? unescapeString(obj.message) : JSON.stringify(obj.message));
                }
                markdownContent = parts.join('\n\n') || JSON.stringify(obj, null, 2);
            }

            // Construct fileTree if code is present but fileTree is empty
            if ((!effectiveFileTree || Object.keys(effectiveFileTree).length === 0) && obj.code) {
                let cleanCode = unescapeString(String(obj.code)).trim();
                cleanCode = cleanCode.replace(/^```[a-zA-Z0-9_\-]*\n/, '').replace(/\n```$/, '');
                const langPrefixMatch = cleanCode.match(/^([a-zA-Z0-9_\-]+)\s*\n([\s\S]*)$/);
                if (langPrefixMatch && ['javascript', 'js', 'typescript', 'ts', 'python', 'py', 'html', 'css', 'json'].includes(langPrefixMatch[1].toLowerCase())) {
                    cleanCode = langPrefixMatch[2].trim();
                }

                const targetFileName = currentFile || 'solution.js';
                effectiveFileTree = {
                    [targetFileName]: {
                        file: {
                            contents: cleanCode
                        }
                    }
                };
            }
        } else {
            markdownContent = typeof raw === 'string' ? unescapeString(raw) : String(raw);
        }

        return { markdownContent, effectiveFileTree };
    }

    function WriteAiMessage(rawMessage) {
        const { markdownContent, effectiveFileTree } = sanitizeAiResponse(rawMessage);
        const hasAiFileTree = Boolean(effectiveFileTree && Object.keys(effectiveFileTree).length > 0);

        return (
            <div className='bg-[#12131a] text-zinc-100 rounded-2xl border border-white/10 p-3.5 text-[13.5px] space-y-2.5 leading-relaxed shadow-md'>
                <Markdown
                    children={markdownContent}
                    options={{
                        overrides: {
                            code: SyntaxHighlightedCode,
                        },
                    }}
                />

                {hasAiFileTree && !isViewer && (
                    <div className="pt-2.5 border-t border-white/10 flex items-center justify-between">
                        <span className="text-xs text-violet-300 font-medium">
                            Generated {Object.keys(effectiveFileTree).length} code file(s)
                        </span>
                        <button
                            onClick={() => {
                                setSuggestedAiFileTree(effectiveFileTree);
                                setIsAiDiffOpen(true);
                            }}
                            className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-md shadow-violet-500/20"
                        >
                            <i className="ri-git-pull-request-line"></i>
                            <span>Review & Merge</span>
                        </button>
                    </div>
                )}
            </div>
        );
    }

    const loadOlderMessages = async () => {
        if (!hasMore || !nextCursor || isLoadingOlder) return;

        const container = messageBox.current;
        if (!container) return;

        const previousScrollHeight = container.scrollHeight;
        const previousScrollTop = container.scrollTop;

        try {
            setIsLoadingOlder(true);
            const currentProjectId = location.state?.project?._id || project?._id;
            const res = await axios.get(`/projects/${currentProjectId}/messages?before=${encodeURIComponent(nextCursor)}&limit=30`);

            if (res.data?.success && res.data.messages?.length > 0) {
                const olderMessages = res.data.messages;

                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m._id));
                    const filteredOlder = olderMessages.filter(m => !existingIds.has(m._id));
                    return [...filteredOlder, ...prev];
                });

                setHasMore(res.data.hasMore || false);
                setNextCursor(res.data.nextCursor || null);

                requestAnimationFrame(() => {
                    if (container) {
                        container.scrollTop = container.scrollHeight - previousScrollHeight + previousScrollTop;
                    }
                });
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error("Failed to load older messages:", err);
        } finally {
            setIsLoadingOlder(false);
        }
    };

    const handleScroll = () => {
        if (messageBox.current && messageBox.current.scrollTop <= 10 && hasMore && !isLoadingOlder) {
            loadOlderMessages();
        }
    };

    useEffect(() => {
        const currentProjectId = location.state?.project?._id;

        if (!currentProjectId) {
            navigate('/');
            return;
        }

        initializeSocket(currentProjectId);

        getWebContainer().catch(err => {
            console.warn("WebContainer initialization notice:", err.message);
        });

        setIsLoadingHistory(true);
        axios.get(`/projects/${currentProjectId}/messages?limit=30`)
            .then(res => {
                if (res.data?.success) {
                    setMessages(res.data.messages || []);
                    setHasMore(res.data.hasMore || false);
                    setNextCursor(res.data.nextCursor || null);
                    setTimeout(scrollToBottom, 100);
                }
            })
            .catch(err => {
                console.error("Failed to fetch message history:", err);
            })
            .finally(() => {
                setIsLoadingHistory(false);
            });

        receiveMessage('project-message', data => {
            const messageContent = data.content || data.message;
            const isFromOtherUser = data.sender?._id && user?._id && data.sender._id.toString() !== user._id.toString();
            const isAi = data.sender?._id === 'ai';

            if (isFromOtherUser || isAi) {
                const { markdownContent } = isAi ? sanitizeAiResponse(messageContent) : { markdownContent: typeof messageContent === 'string' ? messageContent : '' };
                const cleanSnippet = (markdownContent || '').replace(/```[\s\S]*?```/g, '[Code snippet]').trim();
                setIncomingToast({
                    sender: data.sender?.email || (isAi ? 'AI Assistant' : 'Collaborator'),
                    text: cleanSnippet ? (cleanSnippet.length > 70 ? cleanSnippet.slice(0, 70) + '...' : cleanSnippet) : 'Shared code files',
                    isAi
                });

                setTimeout(() => setIncomingToast(null), 4000);

                if (!isChatOpen) {
                    setUnreadCount(prev => prev + 1);
                }
            }

            if (isAi && !isViewer) {
                const { effectiveFileTree } = sanitizeAiResponse(messageContent);
                if (effectiveFileTree && Object.keys(effectiveFileTree).length > 0) {
                    setSuggestedAiFileTree(effectiveFileTree);
                    setIsAiDiffOpen(true);
                }
            }

            setMessages(prevMessages => {
                if (data._id && prevMessages.some(m => m._id === data._id)) {
                    return prevMessages;
                }
                return [...prevMessages, data];
            });

            setTimeout(scrollToBottom, 50);
        });

        axios.get(`/projects/get-project/${currentProjectId}`).then(res => {
            if (res.data?.project) {
                setProject(res.data.project);
                if (res.data.userRole) {
                    setUserRole(res.data.userRole);
                }
                if (res.data.project.fileTree && Object.keys(res.data.project.fileTree).length > 0) {
                    setFileTree(res.data.project.fileTree);
                }
            }
        }).catch(err => {
            console.error("Failed to load project:", err);
            if (err.response?.status === 403) {
                alert("Access Denied: You are not a member of this project.");
                navigate('/');
            }
        });

        axios.get('/users/all').then(res => {
            setUsers(res.data.users || []);
        }).catch(err => {
            console.error("Failed to load users:", err);
        });

        return () => {
            removeListener('project-message');
            disconnectSocket();
        };
    }, [isChatOpen]);

    const handleFileContentChange = (fileName, newContent) => {
        if (isViewer) return;

        setFileTree(prev => ({
            ...prev,
            [fileName]: {
                file: {
                    contents: newContent
                }
            }
        }));

        setUnsavedFiles(prev => new Set(prev).add(fileName));
        setSaveStatus('unsaved');
    };

    const handleSaveFile = async (fileName) => {
        if (isViewer) {
            alert("Viewers cannot save or modify files.");
            return;
        }

        const projectId = project?._id || location.state?.project?._id;
        if (!projectId) return;

        try {
            setSaveStatus('saving');
            const res = await axios.put('/projects/update-file-tree', {
                projectId,
                fileTree
            });

            if (res.data?.project) {
                setProject(res.data.project);
            }

            await syncFileTreeToWebContainer(fileTree);

            setUnsavedFiles(prev => {
                const next = new Set(prev);
                if (fileName) {
                    next.delete(fileName);
                } else {
                    next.clear();
                }
                return next;
            });

            setSaveStatus('saved');
        } catch (err) {
            console.error("Failed to save file tree:", err);
            setSaveStatus('error');
            alert(err.response?.data?.message || "Failed to save file");
        }
    };

    const handleCreateNewFile = (newFileString) => {
        if (isViewer) {
            alert("Viewers cannot create new files.");
            return;
        }

        const trimmed = newFileString.trim();
        if (!trimmed) return;

        if (fileTree[trimmed]) {
            alert(`File "${trimmed}" already exists.`);
            return;
        }

        const updatedTree = {
            ...fileTree,
            [trimmed]: {
                file: {
                    contents: ''
                }
            }
        };

        setFileTree(updatedTree);
        setOpenFiles(prev => Array.from(new Set([...prev, trimmed])));
        setCurrentFile(trimmed);
        setUnsavedFiles(prev => new Set(prev).add(trimmed));

        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: updatedTree
        }).then(async () => {
            await syncFileTreeToWebContainer(updatedTree);
        }).catch(err => console.error("Error creating file:", err));
    };

    const handleDeleteFile = (e, fileToDelete) => {
        e.stopPropagation();
        if (isViewer) {
            alert("Viewers cannot delete files.");
            return;
        }

        if (!window.confirm(`Are you sure you want to delete "${fileToDelete}"?`)) {
            return;
        }

        const updatedTree = { ...fileTree };
        delete updatedTree[fileToDelete];

        const updatedOpen = openFiles.filter(f => f !== fileToDelete);
        setFileTree(updatedTree);
        setOpenFiles(updatedOpen);

        if (currentFile === fileToDelete) {
            setCurrentFile(updatedOpen[0] || null);
        }

        setUnsavedFiles(prev => {
            const next = new Set(prev);
            next.delete(fileToDelete);
            return next;
        });

        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: updatedTree
        }).then(async () => {
            await syncFileTreeToWebContainer(updatedTree);
        }).catch(err => console.error("Error deleting file:", err));
    };

    const handleDeleteFolder = (e, folderPath) => {
        e.stopPropagation();
        if (isViewer) {
            alert("Viewers cannot delete folders.");
            return;
        }

        if (!window.confirm(`Are you sure you want to delete folder "${folderPath}" and all files inside it?`)) {
            return;
        }

        const prefix = `${folderPath}/`;
        const updatedTree = { ...fileTree };

        Object.keys(updatedTree).forEach(filePath => {
            if (filePath === folderPath || filePath.startsWith(prefix)) {
                delete updatedTree[filePath];
            }
        });

        const updatedOpen = openFiles.filter(f => f !== folderPath && !f.startsWith(prefix));
        setFileTree(updatedTree);
        setOpenFiles(updatedOpen);

        if (currentFile === folderPath || currentFile?.startsWith(prefix)) {
            setCurrentFile(updatedOpen[0] || null);
        }

        setUnsavedFiles(prev => {
            const next = new Set(prev);
            Object.keys(fileTree).forEach(filePath => {
                if (filePath === folderPath || filePath.startsWith(prefix)) {
                    next.delete(filePath);
                }
            });
            return next;
        });

        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: updatedTree
        }).then(async () => {
            await syncFileTreeToWebContainer(updatedTree);
        }).catch(err => console.error("Error deleting folder:", err));
    };

    const handleReviewSingleFileDiff = (fileName, proposedCode) => {
        if (isViewer) {
            alert("Viewers cannot modify files using AI.");
            return;
        }

        setSuggestedAiFileTree({
            [fileName]: {
                file: {
                    contents: proposedCode
                }
            }
        });
        setIsAiDiffOpen(true);
    };

    const handleDirectAccept = (fileName, proposedCode) => {
        if (isViewer) return;

        const updatedTree = {
            ...fileTree,
            [fileName]: {
                file: {
                    contents: proposedCode
                }
            }
        };

        setFileTree(updatedTree);
        setUnsavedFiles(prev => new Set(prev).add(fileName));
        setSaveStatus('unsaved');
    };

    const handleAcceptAiChanges = async (suggestedTree) => {
        if (isViewer) return;

        const mergedTree = {
            ...fileTree,
            ...suggestedTree
        };

        setFileTree(mergedTree);

        const modifiedFileKeys = Object.keys(suggestedTree);
        setOpenFiles(prev => Array.from(new Set([...prev, ...modifiedFileKeys])));
        if (modifiedFileKeys.length > 0) {
            setCurrentFile(modifiedFileKeys[0]);
        }

        setUnsavedFiles(prev => {
            const next = new Set(prev);
            modifiedFileKeys.forEach(k => next.add(k));
            return next;
        });

        setSaveStatus('unsaved');
        await syncFileTreeToWebContainer(mergedTree);
    };

    const handleRunProject = async () => {
        if (isViewer) {
            alert("Viewers have read-only access and cannot execute terminal processes.");
            return;
        }

        setIsTerminalOpen(true);
        setIsTerminalExpanded(true);

        if (currentFile && unsavedFiles.has(currentFile)) {
            await handleSaveFile(currentFile);
        }

        if (terminalRef.current) {
            if (currentFile && currentFile.endsWith('.py')) {
                const pythonCode = fileTree[currentFile]?.file?.contents || '';
                await terminalRef.current.runPythonFile(currentFile, pythonCode);
            } else if (currentFile && (currentFile.endsWith('.js') || currentFile.endsWith('.mjs') || currentFile.endsWith('.cjs') || currentFile.endsWith('.ts'))) {
                terminalRef.current.writeCommand(`node ${currentFile}`);
            } else if (fileTree['package.json']) {
                terminalRef.current.writeCommand('npm start');
            } else if (fileTree['index.js']) {
                terminalRef.current.writeCommand('node index.js');
            } else if (fileTree['app.js']) {
                terminalRef.current.writeCommand('node app.js');
            } else if (fileTree['server.js']) {
                terminalRef.current.writeCommand('node server.js');
            } else if (fileTree['main.js']) {
                terminalRef.current.writeCommand('node main.js');
            } else {
                terminalRef.current.writeCommand('ls');
            }
        }
    };

    return (
        <main className='h-screen w-screen flex bg-[#080810] overflow-hidden font-sans text-zinc-100 select-none'>
            {/* 1. VS Code Left Activity Bar (54px) */}
            <aside className="w-[54px] bg-[#181818] border-r border-white/10 flex flex-col items-center py-3 justify-between shrink-0 z-30">
                <div className="flex flex-col items-center gap-3 w-full">
                    {/* Chat Sidebar Toggle Icon */}
                    <button
                        onClick={toggleChat}
                        className={`relative p-2.5 rounded-xl text-xs transition-all ${
                            isChatOpen
                                ? 'text-white bg-violet-600/25 border border-violet-500/40 shadow-sm shadow-violet-500/20'
                                : 'text-zinc-400 hover:text-white hover:bg-white/10'
                        }`}
                        title={isChatOpen ? "Hide Chat" : "Open Chat"}
                    >
                        <i className="ri-chat-3-line text-xl"></i>
                        {unreadCount > 0 && !isChatOpen && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-sm">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {/* AI Assistant Sidebar Toggle Icon */}
                    <button
                        onClick={() => setIsAiAssistantOpen(prev => !prev)}
                        className={`p-2.5 rounded-xl text-xs transition-all ${
                            isAiAssistantOpen
                                ? 'text-violet-300 bg-violet-600/25 border border-violet-500/40 shadow-sm shadow-violet-500/20'
                                : 'text-zinc-400 hover:text-white hover:bg-white/10'
                        }`}
                        title={isAiAssistantOpen ? "Close AI Assistant" : "Open AI Assistant"}
                    >
                        <i className="ri-sparkling-fill text-xl text-amber-300"></i>
                    </button>

                    {/* Invite Collaborators */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="p-2.5 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="Invite Collaborators"
                    >
                        <i className="ri-user-add-line text-xl"></i>
                    </button>

                    {/* Collaborator & Role Drawer */}
                    <button
                        onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
                        className={`p-2.5 rounded-xl text-xs transition-all ${
                            isSidePanelOpen ? 'text-white bg-violet-600/25 border border-violet-500/40' : 'text-zinc-400 hover:text-white hover:bg-white/10'
                        }`}
                        title="Project Members & Roles"
                    >
                        <i className="ri-group-line text-xl"></i>
                    </button>
                </div>

                <div className="flex flex-col items-center gap-3">
                    {/* User Role Badge in Activity Bar Footer */}
                    <div
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase font-bold tracking-wider ${
                            isOwner
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : userRole === 'editor'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        }`}
                        title={`Role: ${userRole}`}
                    >
                        {userRole === 'owner' ? 'OWN' : userRole === 'editor' ? 'EDT' : 'VIEW'}
                    </div>

                    <button
                        onClick={() => navigate('/')}
                        className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="Dashboard"
                    >
                        <i className="ri-home-4-line text-xl"></i>
                    </button>
                </div>
            </aside>

            {/* 2. Resizable Left Chat Panel (Preserved in DOM to retain state & scroll) */}
            <section
                style={{
                    width: isChatOpen ? `${chatWidth}px` : '0px',
                    minWidth: isChatOpen ? '280px' : '0px',
                    maxWidth: isChatOpen ? '480px' : '0px',
                    display: isChatOpen ? 'flex' : 'none'
                }}
                className={`relative flex-col h-screen bg-[#181822] border-r border-white/10 shrink-0 font-sans z-10 ${
                    isDraggingChat ? 'select-none' : ''
                }`}
            >
                <header className='h-[38px] flex justify-between items-center px-4 bg-[#1e1e2c] border-b border-white/10 text-zinc-200 z-10 shrink-0'>
                    <div className="flex items-center gap-2">
                        <i className="ri-message-3-line text-violet-400 text-base"></i>
                        <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Chat</h2>
                        <span className="text-[11px] font-mono text-zinc-500">{chatWidth}px</span>
                        {isViewer && (
                            <span className="bg-purple-500/20 text-purple-300 text-[10px] px-2 py-0.5 rounded-full border border-purple-500/30">
                                Read Only
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1 relative">
                        {/* Preset Width Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowChatWidthMenu(prev => !prev)}
                                className="p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                                title="Chat Width Options"
                            >
                                <i className="ri-more-2-fill text-base"></i>
                            </button>

                            {showChatWidthMenu && (
                                <div className="absolute right-0 top-8 w-36 glass-modal rounded-xl border border-white/10 py-1.5 shadow-xl z-50 text-xs text-zinc-200 space-y-1">
                                    <button
                                        onClick={() => handleSetPresetWidth(280)}
                                        className={`w-full px-3 py-1 text-left flex items-center justify-between hover:bg-white/10 transition-colors ${chatWidth === 280 ? 'text-violet-400 font-semibold' : ''}`}
                                    >
                                        <span>Compact</span>
                                        <span className="font-mono text-[10px] text-zinc-500">280px</span>
                                    </button>
                                    <button
                                        onClick={() => handleSetPresetWidth(320)}
                                        className={`w-full px-3 py-1 text-left flex items-center justify-between hover:bg-white/10 transition-colors ${chatWidth === 320 ? 'text-violet-400 font-semibold' : ''}`}
                                    >
                                        <span>Default</span>
                                        <span className="font-mono text-[10px] text-zinc-500">320px</span>
                                    </button>
                                    <button
                                        onClick={() => handleSetPresetWidth(400)}
                                        className={`w-full px-3 py-1 text-left flex items-center justify-between hover:bg-white/10 transition-colors ${chatWidth === 400 ? 'text-violet-400 font-semibold' : ''}`}
                                    >
                                        <span>Wide</span>
                                        <span className="font-mono text-[10px] text-zinc-500">400px</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                            title="Invite Members"
                        >
                            <i className="ri-user-add-line text-base"></i>
                        </button>
                        <button
                            onClick={toggleChat}
                            className="p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                            title="Hide Chat"
                        >
                            <i className="ri-layout-left-line text-base"></i>
                        </button>
                    </div>
                </header>

                <div className="conversation-area flex-grow flex flex-col h-full relative overflow-hidden bg-[#181822]">
                    <div
                        ref={messageBox}
                        onScroll={handleScroll}
                        className="message-box p-3.5 flex-grow flex flex-col gap-3 overflow-y-auto pb-16">

                        {isLoadingOlder && (
                            <div className="flex justify-center items-center py-2 text-xs text-zinc-400 gap-2">
                                <div className="w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                                <span>Loading older messages...</span>
                            </div>
                        )}

                        {isLoadingHistory ? (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-xs gap-2">
                                <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                                <span>Loading messages...</span>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="text-center text-zinc-400 text-xs my-auto p-4">
                                {isViewer ? 'Read-only chat access.' : 'No messages yet. Send a message or ask @ai to generate code.'}
                            </div>
                        ) : (
                            messages.map((msg, index) => {
                                const isUser = msg.sender?._id && user?._id && msg.sender._id.toString() === user._id.toString();
                                const isAi = msg.sender?._id === 'ai';
                                const messageContent = msg.content || msg.message;
                                const senderEmail = msg.sender?.email || (isAi ? 'AI Assistant' : 'User');
                                const senderInitial = senderEmail[0].toUpperCase();

                                return (
                                    <div
                                        key={msg._id || index}
                                        className="group flex flex-col space-y-1.5 p-2 rounded-xl hover:bg-white/[0.04] transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 truncate">
                                                <div className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 shadow-xs ${
                                                    isAi ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white' : isUser ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-200'
                                                }`}>
                                                    {isAi ? '✦' : senderInitial}
                                                </div>
                                                <span className={`text-[13px] font-semibold truncate ${
                                                    isAi ? 'text-violet-300' : isUser ? 'text-white' : 'text-zinc-200'
                                                }`}>
                                                    {senderEmail}
                                                </span>
                                            </div>

                                            {msg.createdAt && (
                                                <span className="text-[11px] text-zinc-500 font-mono shrink-0">
                                                    {formatTimestamp(msg.createdAt)}
                                                </span>
                                            )}
                                        </div>

                                        <div className='text-sm text-zinc-200 leading-relaxed pl-8'>
                                            {isAi ? WriteAiMessage(messageContent) : <p className="whitespace-pre-wrap">{messageContent}</p>}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Chat Input Bar (Disabled for Viewers) */}
                    <div className="inputField w-full flex absolute bottom-0 bg-[#1e1e2c] border-t border-white/10 p-2.5 gap-2">
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') send();
                            }}
                            disabled={isViewer}
                            className='flex-grow bg-[#14141a] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500 disabled:opacity-50 transition-colors'
                            type="text"
                            placeholder={isViewer ? "Viewers have read-only chat access..." : "Message or type @ai..."}
                        />
                        <button
                            onClick={send}
                            disabled={isViewer || !message.trim()}
                            className='px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-40 rounded-xl text-white font-medium transition-all flex items-center justify-center text-sm shadow-md shadow-violet-500/20'
                        >
                            <i className="ri-send-plane-fill"></i>
                        </button>
                    </div>
                </div>

                {/* RBAC Collaborators & Roles Drawer */}
                <div className={`sidePanel w-full h-full flex flex-col bg-[#181825] text-zinc-200 absolute transition-transform duration-200 ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} top-0 z-20 shadow-2xl`}>
                    <header className='h-[38px] flex justify-between items-center px-4 bg-[#1e1e2e] border-b border-white/10'>
                        <div>
                            <h2 className='font-bold text-xs uppercase tracking-wider text-white'>Members ({normalizedMembers.length})</h2>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="p-1 px-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                                title="Invite Collaborators"
                            >
                                <i className="ri-user-add-line text-xs"></i>
                                <span>Invite</span>
                            </button>
                            <button onClick={() => setIsSidePanelOpen(false)} className='p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white'>
                                <i className="ri-close-fill text-base"></i>
                            </button>
                        </div>
                    </header>

                    <div className="users flex flex-col gap-2 p-3.5 overflow-y-auto flex-grow">
                        {normalizedMembers.length === 0 ? (
                            <div className="text-center py-8 space-y-2">
                                <p className="text-xs text-zinc-400">No members listed yet.</p>
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl text-xs font-bold text-white transition-all shadow-md shadow-violet-500/20 inline-flex items-center gap-1"
                                >
                                    <i className="ri-user-add-line text-xs"></i>
                                    <span>Invite First Member</span>
                                </button>
                            </div>
                        ) : (
                            normalizedMembers.map((member, idx) => {
                                const isMemberOwner = member.role === 'owner';
                                const isMemberViewer = member.role === 'viewer';

                                return (
                                    <div
                                        key={member._id || idx}
                                        className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-2 shadow-xs"
                                    >
                                        <div className='flex items-center gap-2.5 truncate'>
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 shadow-xs ${
                                                isMemberOwner
                                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                    : 'bg-zinc-700 text-zinc-200'
                                            }`}>
                                                {member.email ? member.email[0].toUpperCase() : 'U'}
                                            </div>
                                            <div className="truncate">
                                                <span className='text-[13px] font-medium text-white truncate block'>{member.email}</span>
                                                <span className={`text-[11px] font-mono font-semibold ${
                                                    isMemberOwner ? 'text-amber-400' : isMemberViewer ? 'text-purple-400' : 'text-cyan-400'
                                                }`}>
                                                    {isMemberOwner ? '👑 Owner' : isMemberViewer ? '👁 Viewer' : '✏️ Editor'}
                                                </span>
                                            </div>
                                        </div>

                                        {isOwner && !isMemberOwner && (
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <select
                                                    value={member.role}
                                                    onChange={(e) => handleChangeMemberRole(member._id, e.target.value)}
                                                    className="bg-[#14141a] border border-white/10 text-xs rounded-lg px-2 py-1 text-zinc-200 outline-none cursor-pointer focus:border-violet-500"
                                                >
                                                    <option value="editor">Editor</option>
                                                    <option value="viewer">Viewer</option>
                                                </select>
                                                <button
                                                    onClick={() => handleRemoveMember(member._id)}
                                                    className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
                                                    title="Remove Member"
                                                >
                                                    <i className="ri-delete-bin-line"></i>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}

                        {/* Danger Zone (Owner Only) */}
                        {isOwner && (
                            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2.5">
                                <div className="flex items-center gap-1.5 text-red-400">
                                    <i className="ri-error-warning-line text-base"></i>
                                    <span className="text-xs font-bold uppercase tracking-wider">Danger Zone</span>
                                </div>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                    Permanently delete this project, files, and chat messages.
                                </p>
                                <button
                                    onClick={() => setIsDeleteModalOpen(true)}
                                    className="w-full py-2 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold text-white transition-colors shadow-md shadow-red-600/25"
                                >
                                    Delete Project
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Bottom Drawer Action Bar */}
                    <div className="p-3 bg-[#1e1e2e] border-t border-white/10 shrink-0">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="w-full py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/25 flex items-center justify-center gap-1.5"
                        >
                            <i className="ri-user-add-line text-sm"></i>
                            <span>+ Add Collaborators</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Draggable Resize Handle between Chat and File Explorer */}
            {isChatOpen && (
                <div
                    onMouseDown={handleChatResizeMouseDown}
                    onDoubleClick={handleChatResizeDoubleClick}
                    className={`w-2 -ml-1 cursor-col-resize z-20 hover:bg-violet-500/50 active:bg-violet-500 transition-colors shrink-0 flex items-center justify-center group ${
                        isDraggingChat ? 'bg-violet-500 shadow-sm shadow-violet-500/50' : 'bg-transparent'
                    }`}
                    title="Drag to resize Chat | Double-click to reset (320px)"
                >
                    <div className={`w-[2px] h-8 rounded-full bg-white/20 group-hover:bg-violet-300 transition-colors ${
                        isDraggingChat ? 'bg-white h-12' : ''
                    }`} />
                </div>
            )}

            {/* 3. Main Workspace: File Explorer + Monaco Editor + AI Assistant + Terminal */}
            <section className="right bg-[#1e1e1e] flex-1 min-w-0 h-full flex overflow-hidden relative">
                <FileExplorer
                    projectName={project.name ? project.name.toUpperCase() : 'PROJECT'}
                    fileTree={fileTree}
                    currentFile={currentFile}
                    onSelectFile={(filePath) => {
                        setCurrentFile(filePath);
                        setOpenFiles(prev => Array.from(new Set([...prev, filePath])));
                    }}
                    onCreateFile={handleCreateNewFile}
                    onDeleteFile={handleDeleteFile}
                    onDeleteFolder={handleDeleteFolder}
                    unsavedFiles={unsavedFiles}
                    readOnly={isViewer}
                />

                <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
                    <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
                        <CodeEditor
                            fileTree={fileTree}
                            currentFile={currentFile}
                            setCurrentFile={setCurrentFile}
                            openFiles={openFiles}
                            setOpenFiles={setOpenFiles}
                            onSaveFile={handleSaveFile}
                            saveStatus={saveStatus}
                            onFileContentChange={handleFileContentChange}
                            unsavedFiles={unsavedFiles}
                            onAskAi={() => setIsAiAssistantOpen(prev => !prev)}
                            onRunProject={handleRunProject}
                            onToggleTerminal={() => {
                                setIsTerminalOpen(prev => !prev);
                                if (!isTerminalOpen) setIsTerminalExpanded(true);
                            }}
                            isTerminalOpen={isTerminalOpen}
                            readOnly={isViewer}
                            userRole={userRole}
                        />
                    </div>

                    {/* Integrated Interactive Terminal */}
                    {isTerminalOpen && (
                        <Terminal
                            ref={terminalRef}
                            fileTree={fileTree}
                            currentFile={currentFile}
                            onServerReady={(url) => setIframeUrl(url)}
                            isExpanded={isTerminalExpanded}
                            onToggleExpand={() => setIsTerminalExpanded(prev => !prev)}
                            onClose={() => setIsTerminalOpen(false)}
                            readOnly={isViewer}
                        />
                    )}
                </div>

                {/* 4. Cursor-style Streaming AI Assistant Sidebar */}
                {isAiAssistantOpen && (
                    <AiAssistantPanel
                        isOpen={isAiAssistantOpen}
                        onClose={() => setIsAiAssistantOpen(false)}
                        currentFile={currentFile}
                        fileContent={fileTree[currentFile]?.file?.contents || ''}
                        fileTree={fileTree}
                        onReviewDiff={handleReviewSingleFileDiff}
                        onDirectAccept={handleDirectAccept}
                        readOnly={isViewer}
                    />
                )}

                {/* 5. Live Browser Preview Window */}
                {iframeUrl && (
                    <div className="flex w-[400px] min-w-[340px] flex-col h-full border-l border-white/10 bg-[#141416]">
                        <div className="address-bar p-2.5 bg-[#181822] border-b border-white/10 flex items-center gap-2">
                            <input
                                type="text"
                                onChange={(e) => setIframeUrl(e.target.value)}
                                value={iframeUrl}
                                className="w-full text-xs p-1.5 px-3 bg-[#14141a] border border-white/10 rounded-lg text-zinc-200 outline-none font-mono"
                            />
                            <button onClick={() => setIframeUrl(null)} className="text-zinc-400 hover:text-white text-sm p-1">
                                <i className="ri-close-line"></i>
                            </button>
                        </div>
                        <iframe src={iframeUrl} className="w-full flex-grow bg-white" title="Web Preview"></iframe>
                    </div>
                )}
            </section>

            {/* Floating Incoming Message Toast Banner */}
            {incomingToast && (
                <div
                    onClick={() => {
                        setIsChatOpen(true);
                        setUnreadCount(0);
                        setIncomingToast(null);
                    }}
                    className="fixed bottom-6 right-6 glass-modal rounded-2xl p-4 max-w-sm cursor-pointer z-50 flex items-start gap-3 transition-all hover:border-violet-500/50 shadow-2xl glow-violet"
                >
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-md">
                        {incomingToast.isAi ? '✦' : incomingToast.sender[0].toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-bold text-white truncate">
                                {incomingToast.sender}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">now</span>
                        </div>
                        <p className="text-xs text-zinc-300 truncate mt-0.5">{incomingToast.text}</p>
                    </div>
                </div>
            )}

            {/* Monaco Side-by-Side Diff Code Review Modal */}
            <AiDiffModal
                isOpen={isAiDiffOpen}
                onClose={() => setIsAiDiffOpen(false)}
                originalFileTree={fileTree}
                suggestedFileTree={suggestedAiFileTree}
                onAcceptChanges={handleAcceptAiChanges}
            />

            {/* Add Collaborators Modal with Real Users and Search Filter */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="glass-modal p-6 rounded-2xl w-[420px] max-w-full shadow-2xl relative text-zinc-100 space-y-4 font-sans">
                        <header className='flex justify-between items-center'>
                            <div>
                                <h2 className='text-sm font-bold text-white'>Invite Collaborators</h2>
                                <p className="text-xs text-zinc-400">Select registered users to join your project</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className='text-zinc-400 hover:text-white'>
                                <i className="ri-close-fill text-lg"></i>
                            </button>
                        </header>

                        {/* Search Filter Input */}
                        <div className="relative">
                            <i className="ri-search-line absolute left-3 top-2.5 text-zinc-400 text-sm"></i>
                            <input
                                type="text"
                                value={userSearchQuery}
                                onChange={(e) => setUserSearchQuery(e.target.value)}
                                placeholder="Search by email..."
                                className="w-full bg-[#14141a] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-violet-500"
                            />
                        </div>

                        {/* Role Assignment Picker */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-mono uppercase text-zinc-400 block font-semibold">
                                Assign Role:
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setInviteRole('editor')}
                                    className={`p-2 rounded-xl text-xs border text-left flex items-center justify-between transition-colors ${
                                        inviteRole === 'editor'
                                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-semibold'
                                            : 'bg-[#14141a] border-white/10 text-zinc-400 hover:bg-white/5'
                                    }`}
                                >
                                    <span>Editor (Read/Write)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInviteRole('viewer')}
                                    className={`p-2 rounded-xl text-xs border text-left flex items-center justify-between transition-colors ${
                                        inviteRole === 'viewer'
                                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 font-semibold'
                                            : 'bg-[#14141a] border-white/10 text-zinc-400 hover:bg-white/5'
                                    }`}
                                >
                                    <span>Viewer (Read-Only)</span>
                                </button>
                            </div>
                        </div>

                        {/* Registered Real Users List */}
                        <div className="users-list flex flex-col gap-2 max-h-56 overflow-y-auto">
                            {filteredUsers.length === 0 ? (
                                <p className="text-xs text-zinc-400 text-center py-6">No matching registered users found.</p>
                            ) : (
                                filteredUsers.map(u => {
                                    const isAlreadyMember = existingMemberIds.has(u._id);
                                    const isSelected = selectedUserId.has(u._id);

                                    return (
                                        <div
                                            key={u._id}
                                            className={`p-2.5 rounded-xl flex items-center gap-3 transition-colors ${
                                                isAlreadyMember
                                                    ? 'bg-white/[0.02] border border-white/5 opacity-50 cursor-not-allowed'
                                                    : isSelected
                                                    ? 'bg-violet-600/20 border border-violet-500/50 cursor-pointer shadow-sm'
                                                    : 'bg-[#14141a] border border-white/10 hover:bg-white/5 cursor-pointer'
                                            }`}
                                            onClick={() => !isAlreadyMember && handleUserClick(u._id)}
                                        >
                                            <div className='w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center text-xs font-bold text-white shrink-0'>
                                                {u.email ? u.email[0].toUpperCase() : 'U'}
                                            </div>
                                            <div className="truncate flex-grow">
                                                <span className='text-[13px] font-normal text-white truncate block'>{u.email}</span>
                                                {isAlreadyMember && (
                                                    <span className="text-[10px] text-zinc-400">Already in project</span>
                                                )}
                                            </div>

                                            {!isAlreadyMember && isSelected && (
                                                <i className="ri-checkbox-circle-fill text-violet-400 ml-auto text-base"></i>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className='flex-1 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs text-zinc-300 transition-colors'
                            >
                                Cancel
                            </button>
                            <button
                                onClick={addCollaborators}
                                disabled={selectedUserId.size === 0}
                                className='flex-1 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/25'
                            >
                                Invite ({selectedUserId.size})
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Project Confirmation Modal (Owner Only) */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="glass-modal border-red-500/40 p-6 rounded-2xl w-[400px] max-w-full shadow-2xl text-zinc-100 space-y-4 font-sans">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                                <i className="ri-delete-bin-2-line text-lg"></i>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Delete Project Permanently</h3>
                                <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                                    Are you sure you want to delete <strong className="text-white">"{project.name}"</strong>? All code files, history, and chat messages will be permanently removed.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={isDeletingProject}
                                className="flex-1 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs text-zinc-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteProject}
                                disabled={isDeletingProject}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-red-600/30 flex items-center justify-center gap-1.5"
                            >
                                {isDeletingProject ? 'Deleting...' : 'Delete Project'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default Project;