import socket from 'socket.io-client';

let socketInstance = null;

export const initializeSocket = (projectId) => {
    if (socketInstance) {
        socketInstance.disconnect();
        socketInstance.removeAllListeners();
    }

    socketInstance = socket(import.meta.env.VITE_API_URL || 'http://localhost:8080', {
        auth: {
            token: localStorage.getItem('token')
        },
        query: {
            projectId
        }
    });

    return socketInstance;
};

export const receiveMessage = (eventName, cb) => {
    if (!socketInstance) return;
    socketInstance.off(eventName); // remove old listener before adding new one to avoid duplicates
    socketInstance.on(eventName, cb);
};

export const removeListener = (eventName) => {
    if (socketInstance) {
        socketInstance.off(eventName);
    }
};

export const disconnectSocket = () => {
    if (socketInstance) {
        socketInstance.disconnect();
        socketInstance.removeAllListeners();
        socketInstance = null;
    }
};

export const sendMessage = (eventName, data) => {
    if (socketInstance) {
        socketInstance.emit(eventName, data);
    }
};