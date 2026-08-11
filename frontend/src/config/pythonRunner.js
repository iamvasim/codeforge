let pyodideInstance = null;
let pyodideLoadingPromise = null;

/**
 * Loads Pyodide (CPython WebAssembly runtime) dynamically into the browser
 */
export const loadPythonRuntime = async () => {
    if (pyodideInstance) {
        return pyodideInstance;
    }

    if (pyodideLoadingPromise) {
        return pyodideLoadingPromise;
    }

    pyodideLoadingPromise = new Promise((resolve, reject) => {
        if (window.loadPyodide) {
            window.loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"
            }).then(py => {
                pyodideInstance = py;
                resolve(py);
            }).catch(reject);
            return;
        }

        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
        script.async = true;
        script.onload = async () => {
            try {
                const py = await window.loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"
                });
                pyodideInstance = py;
                resolve(py);
            } catch (err) {
                reject(err);
            }
        };
        script.onerror = (err) => {
            pyodideLoadingPromise = null;
            reject(new Error("Failed to load Python WebAssembly runtime script."));
        };
        document.head.appendChild(script);
    });

    return pyodideLoadingPromise;
};

/**
 * Executes Python code using Pyodide in the browser and captures stdout/stderr
 */
export const executePythonScript = async (code = '', { onStdout, onStderr } = {}) => {
    const py = await loadPythonRuntime();

    py.setStdout({
        batched: (text) => {
            if (onStdout) onStdout(text);
        }
    });

    py.setStderr({
        batched: (text) => {
            if (onStderr) onStderr(text);
        }
    });

    try {
        return await py.runPythonAsync(code);
    } catch (err) {
        if (onStderr) {
            onStderr(err.message || String(err));
        }
        throw err;
    }
};
