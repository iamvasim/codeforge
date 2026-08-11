import React, { useState, useMemo } from 'react';

// Get file type icon and color based on extension
export const getFileIcon = (fileName) => {
    if (!fileName || typeof fileName !== 'string') {
        return { icon: 'ri-file-text-line', color: 'text-zinc-400' };
    }
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'jsx':
        case 'tsx':
            return { icon: 'ri-reactjs-line', color: 'text-cyan-400' };
        case 'js':
        case 'mjs':
        case 'cjs':
            return { icon: 'ri-javascript-line', color: 'text-yellow-400' };
        case 'ts':
            return { icon: 'ri-code-box-line', color: 'text-blue-400' };
        case 'json':
            return { icon: 'ri-braces-line', color: 'text-amber-400' };
        case 'html':
        case 'htm':
            return { icon: 'ri-html5-line', color: 'text-orange-400' };
        case 'css':
        case 'scss':
        case 'less':
            return { icon: 'ri-css3-line', color: 'text-sky-400' };
        case 'md':
        case 'markdown':
            return { icon: 'ri-markdown-line', color: 'text-purple-400' };
        case 'svg':
        case 'png':
        case 'jpg':
        case 'jpeg':
            return { icon: 'ri-image-line', color: 'text-emerald-400' };
        case 'py':
            return { icon: 'ri-code-s-slash-line', color: 'text-emerald-400' };
        default:
            return { icon: 'ri-file-text-line', color: 'text-zinc-400' };
    }
};

/**
 * Builds a nested tree structure from a flat or semi-flat fileTree object
 */
const buildTreeFromFileTree = (fileTree = {}) => {
    const root = { name: 'root', path: '', isDirectory: true, children: {} };

    Object.keys(fileTree).forEach((filePath) => {
        const normalized = filePath.replace(/^\//, '');
        const parts = normalized.split('/');
        let current = root;

        parts.forEach((part, index) => {
            const isLast = index === parts.length - 1;
            const currentPath = parts.slice(0, index + 1).join('/');

            if (!current.children[part]) {
                current.children[part] = {
                    name: part,
                    path: currentPath,
                    isDirectory: !isLast,
                    children: {}
                };
            }

            current = current.children[part];
        });
    });

    return root;
};

// Tree Item Component supporting folder actions and recursive rendering
const FileTreeItem = ({
    item,
    currentFile,
    onSelectFile,
    onDeleteFile,
    onDeleteFolder,
    unsavedFiles,
    depth = 0,
    expandedFolders,
    toggleFolder,
    onStartCreateInFolder,
    creatingInFolder,
    creatingType,
    onCancelCreateInFolder,
    onSubmitCreateInFolder,
    readOnly = false
}) => {
    const [localInputName, setLocalInputName] = useState('');
    const isFolder = item.isDirectory;
    const isExpanded = expandedFolders.has(item.path);
    const isActive = currentFile === item.path;
    const isUnsaved = unsavedFiles.has(item.path);
    const isCreatingHere = creatingInFolder === item.path;

    if (isFolder) {
        const childrenKeys = Object.keys(item.children || {}).sort((a, b) => {
            const isDirA = item.children[a].isDirectory;
            const isDirB = item.children[b].isDirectory;
            if (isDirA === isDirB) return a.localeCompare(b);
            return isDirA ? -1 : 1;
        });

        const handleFolderSubmit = (e) => {
            e.preventDefault();
            const trimmed = localInputName.trim();
            if (trimmed) {
                const fullPath = item.path ? `${item.path}/${trimmed}` : trimmed;
                onSubmitCreateInFolder(fullPath, creatingType);
                setLocalInputName('');
            } else {
                onCancelCreateInFolder();
            }
        };

        return (
            <div className="select-none">
                <div
                    onClick={() => toggleFolder(item.path)}
                    style={{ paddingLeft: `${depth * 14 + 12}px` }}
                    className="group flex items-center justify-between h-[28px] pr-2 hover:bg-white/[0.06] text-zinc-300 hover:text-white cursor-pointer text-[13.5px] transition-colors"
                >
                    <div className="flex items-center gap-1.5 truncate">
                        <i className={`ri-arrow-${isExpanded ? 'down' : 'right'}-s-line text-sm text-zinc-400`}></i>
                        <i className={`ri-folder-${isExpanded ? 'open-' : ''}fill text-amber-400 text-base`}></i>
                        <span className="truncate font-medium">{item.name}</span>
                    </div>

                    {!readOnly && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStartCreateInFolder(item.path, 'file');
                                }}
                                className="p-0.5 rounded hover:text-white text-zinc-400"
                                title="New File in Folder"
                            >
                                <i className="ri-file-add-line text-sm"></i>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStartCreateInFolder(item.path, 'folder');
                                }}
                                className="p-0.5 rounded hover:text-white text-zinc-400"
                                title="New Subfolder"
                            >
                                <i className="ri-folder-add-line text-sm"></i>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteFolder(e, item.path);
                                }}
                                className="p-0.5 rounded hover:text-red-400 text-zinc-400"
                                title="Delete Folder"
                            >
                                <i className="ri-delete-bin-line text-sm"></i>
                            </button>
                        </div>
                    )}
                </div>

                {/* Inline creator inside folder */}
                {isCreatingHere && !readOnly && (
                    <form
                        onSubmit={handleFolderSubmit}
                        style={{ paddingLeft: `${(depth + 1) * 14 + 12}px` }}
                        className="pr-2 py-1 bg-white/[0.04]"
                    >
                        <div className="flex items-center gap-1.5 bg-[#141416] border border-violet-500 rounded px-2 py-0.5 h-[26px]">
                            <i className={creatingType === 'folder' ? "ri-folder-line text-amber-400 text-sm" : "ri-file-line text-zinc-400 text-sm"}></i>
                            <input
                                type="text"
                                autoFocus
                                value={localInputName}
                                onChange={(e) => setLocalInputName(e.target.value)}
                                placeholder={creatingType === 'folder' ? "folder_name" : "filename.js"}
                                className="w-full bg-transparent text-[13px] text-zinc-100 outline-none placeholder-zinc-500"
                                onBlur={() => {
                                    if (!localInputName.trim()) onCancelCreateInFolder();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') onCancelCreateInFolder();
                                }}
                            />
                        </div>
                    </form>
                )}

                {/* Render children recursively */}
                {isExpanded && childrenKeys.map((childKey) => (
                    <FileTreeItem
                        key={item.children[childKey].path}
                        item={item.children[childKey]}
                        currentFile={currentFile}
                        onSelectFile={onSelectFile}
                        onDeleteFile={onDeleteFile}
                        onDeleteFolder={onDeleteFolder}
                        unsavedFiles={unsavedFiles}
                        depth={depth + 1}
                        expandedFolders={expandedFolders}
                        toggleFolder={toggleFolder}
                        onStartCreateInFolder={onStartCreateInFolder}
                        creatingInFolder={creatingInFolder}
                        creatingType={creatingType}
                        onCancelCreateInFolder={onCancelCreateInFolder}
                        onSubmitCreateInFolder={onSubmitCreateInFolder}
                        readOnly={readOnly}
                    />
                ))}
            </div>
        );
    }

    // Single File Item
    const { icon, color } = getFileIcon(item.name);

    return (
        <div
            onClick={() => onSelectFile(item.path)}
            style={{ paddingLeft: `${depth * 14 + 18}px` }}
            className={`group flex items-center justify-between h-[28px] pr-2 cursor-pointer text-[13.5px] transition-colors relative select-none ${
                isActive
                    ? 'bg-violet-600/20 text-white font-medium border-l-2 border-violet-500'
                    : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
            }`}
        >
            <div className="flex items-center gap-2 truncate">
                <i className={`${icon} ${color} text-base shrink-0`}></i>
                <span className="truncate">{item.name}</span>
                {isUnsaved && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Unsaved changes"></span>
                )}
            </div>

            {!readOnly && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFile(e, item.path);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 text-zinc-400 transition-opacity"
                    title="Delete File"
                >
                    <i className="ri-delete-bin-line text-sm"></i>
                </button>
            )}
        </div>
    );
};

const FileExplorer = ({
    projectName = 'Project',
    fileTree = {},
    currentFile,
    onSelectFile,
    onCreateFile,
    onDeleteFile,
    onDeleteFolder,
    unsavedFiles = new Set(),
    readOnly = false
}) => {
    const [creatingInFolder, setCreatingInFolder] = useState(null);
    const [creatingType, setCreatingType] = useState('file');
    const [rootInputName, setRootInputName] = useState('');
    const [expandedFolders, setExpandedFolders] = useState(new Set(['', 'src', 'components', 'public']));

    const tree = useMemo(() => {
        return buildTreeFromFileTree(fileTree);
    }, [fileTree]);

    const toggleFolder = (folderPath) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderPath)) {
                next.delete(folderPath);
            } else {
                next.add(folderPath);
            }
            return next;
        });
    };

    const handleStartCreateInFolder = (folderPath, type = 'file') => {
        if (readOnly) return;
        setExpandedFolders((prev) => new Set(prev).add(folderPath));
        setCreatingInFolder(folderPath);
        setCreatingType(type);
    };

    const handleCancelCreate = () => {
        setCreatingInFolder(null);
        setRootInputName('');
    };

    const handleSubmitCreate = (fullPath, type) => {
        if (readOnly) return;
        if (type === 'folder') {
            onCreateFile(`${fullPath}/.gitkeep`);
        } else {
            onCreateFile(fullPath);
        }
        setCreatingInFolder(null);
        setRootInputName('');
    };

    const handleRootSubmit = (e) => {
        e.preventDefault();
        const trimmed = rootInputName.trim();
        if (trimmed) {
            handleSubmitCreate(trimmed, creatingType);
        } else {
            handleCancelCreate();
        }
    };

    const rootChildrenKeys = Object.keys(tree.children || {}).sort((a, b) => {
        const isDirA = tree.children[a].isDirectory;
        const isDirB = tree.children[b].isDirectory;
        if (isDirA === isDirB) return a.localeCompare(b);
        return isDirA ? -1 : 1;
    });

    return (
        <div className="h-full w-[260px] min-w-[240px] max-w-[300px] bg-[#16161a] border-r border-white/10 flex flex-col shrink-0 select-none text-zinc-200 overflow-hidden font-sans">
            {/* Header */}
            <div className="h-[38px] px-3.5 border-b border-white/10 flex items-center justify-between bg-[#18181f]">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 truncate">
                    <i className="ri-folder-3-line text-violet-400 text-base"></i>
                    <span className="truncate">{projectName}</span>
                    {readOnly && (
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 ml-1">
                            Read Only
                        </span>
                    )}
                </span>

                {!readOnly && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => {
                                setCreatingInFolder('');
                                setCreatingType('file');
                            }}
                            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                            title="New File"
                        >
                            <i className="ri-file-add-line text-base"></i>
                        </button>

                        <button
                            onClick={() => {
                                setCreatingInFolder('');
                                setCreatingType('folder');
                            }}
                            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                            title="New Folder"
                        >
                            <i className="ri-folder-add-line text-base"></i>
                        </button>
                    </div>
                )}
            </div>

            {/* Inline Root Creator */}
            {creatingInFolder === '' && !readOnly && (
                <form onSubmit={handleRootSubmit} className="p-2 border-b border-white/10 bg-[#1e1e24]">
                    <div className="flex items-center gap-1.5 bg-[#141416] border border-violet-500 rounded px-2 py-0.5 h-[28px]">
                        <i className={creatingType === 'folder' ? "ri-folder-line text-amber-400 text-sm" : "ri-file-line text-zinc-400 text-sm"}></i>
                        <input
                            type="text"
                            autoFocus
                            value={rootInputName}
                            onChange={(e) => setRootInputName(e.target.value)}
                            placeholder={creatingType === 'folder' ? "folder_name" : "filename.js"}
                            className="w-full bg-transparent text-[13px] text-zinc-100 outline-none placeholder-zinc-500"
                            onBlur={() => {
                                if (!rootInputName.trim()) handleCancelCreate();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') handleCancelCreate();
                            }}
                        />
                    </div>
                </form>
            )}

            {/* Tree Items List */}
            <div className="flex-grow overflow-y-auto py-1.5">
                {rootChildrenKeys.length === 0 ? (
                    <div className="p-6 text-center text-zinc-400 text-[13px]">
                        {readOnly ? 'No files in this project' : 'Empty workspace. Click + to add files.'}
                    </div>
                ) : (
                    rootChildrenKeys.map((childKey) => (
                        <FileTreeItem
                            key={tree.children[childKey].path}
                            item={tree.children[childKey]}
                            currentFile={currentFile}
                            onSelectFile={onSelectFile}
                            onDeleteFile={onDeleteFile}
                            onDeleteFolder={onDeleteFolder}
                            unsavedFiles={unsavedFiles}
                            depth={0}
                            expandedFolders={expandedFolders}
                            toggleFolder={toggleFolder}
                            onStartCreateInFolder={handleStartCreateInFolder}
                            creatingInFolder={creatingInFolder}
                            creatingType={creatingType}
                            onCancelCreateInFolder={handleCancelCreate}
                            onSubmitCreateInFolder={handleSubmitCreate}
                            readOnly={readOnly}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default FileExplorer;
