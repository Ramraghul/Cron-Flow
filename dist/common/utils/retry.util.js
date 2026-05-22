"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryOperation = retryOperation;
async function retryOperation(operation, retries, delay) {
    let currentAttempt = 0;
    while (currentAttempt <= retries) {
        try {
            return await operation();
        }
        catch (error) {
            currentAttempt++;
            if (currentAttempt > retries) {
                throw error;
            }
            console.log(`Retry attempt ${currentAttempt}`);
            await new Promise((resolve) => setTimeout(resolve, delay * currentAttempt));
        }
    }
    throw new Error('Retry failed');
}
//# sourceMappingURL=retry.util.js.map