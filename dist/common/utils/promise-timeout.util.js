"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promiseTimeout = promiseTimeout;
async function promiseTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => {
            reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs)),
    ]);
}
//# sourceMappingURL=promise-timeout.util.js.map