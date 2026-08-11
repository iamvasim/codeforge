import { WebContainer } from '@webcontainer/api';

let webContainerPromise = null;
let webContainerInstance = null;

/**
 * Singleton getter for WebContainer instance.
 * Ensures only ONE WebContainer is booted across the entire application lifecycle.
 */
export const getWebContainer = async () => {
    if (webContainerInstance) {
        return webContainerInstance;
    }

    if (!webContainerPromise) {
        webContainerPromise = WebContainer.boot()
            .then((instance) => {
                webContainerInstance = instance;
                console.log("✓ WebContainer booted successfully");
                return instance;
            })
            .catch((err) => {
                webContainerPromise = null;
                console.error("Failed to boot WebContainer:", err);
                throw err;
            });
    }

    return webContainerPromise;
};

/**
 * Converts a flat or semi-flat fileTree object into WebContainer's expected FileSystemTree format
 * e.g. { "src/App.jsx": { file: { contents: "..." } } } -> { src: { directory: { "App.jsx": { file: { contents: "..." } } } } }
 */
export const transformToWebContainerTree = (flatFileTree = {}) => {
    const root = {};

    Object.keys(flatFileTree).forEach((rawPath) => {
        // Skip gitkeep placeholders
        if (rawPath.endsWith('/.gitkeep') || rawPath === '.gitkeep') {
            const dirOnly = rawPath.replace(/\/?\.gitkeep$/, '');
            if (!dirOnly) return;
            const parts = dirOnly.split('/');
            let cur = root;
            parts.forEach((p) => {
                if (!cur[p]) cur[p] = { directory: {} };
                cur = cur[p].directory;
            });
            return;
        }

        const normalized = rawPath.replace(/^\//, '');
        const parts = normalized.split('/');
        let current = root;

        parts.forEach((part, index) => {
            const isLast = index === parts.length - 1;
            if (isLast) {
                const fileObj = flatFileTree[rawPath];
                const contents = fileObj?.file?.contents ?? (typeof fileObj === 'string' ? fileObj : '');
                current[part] = {
                    file: {
                        contents
                    }
                };
            } else {
                if (!current[part]) {
                    current[part] = {
                        directory: {}
                    };
                }
                current = current[part].directory;
            }
        });
    });

    return root;
};

/**
 * Safely mounts the entire file tree into WebContainer
 */
export const syncFileTreeToWebContainer = async (fileTree) => {
    try {
        const container = await getWebContainer();
        if (container && fileTree && Object.keys(fileTree).length > 0) {
            const transformed = transformToWebContainerTree(fileTree);
            await container.mount(transformed);
        }
    } catch (err) {
        console.warn("[WebContainer] Sync fileTree notice:", err);
    }
};