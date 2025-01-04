export type MessageBusMetrics = {
    publish(subject: string, messageType: string): void;
    processMessage(subject: string, messageType: string, status: string, elapsedTimeInMS?: number): void;
}

export function normalizeSubject(subject: string) {
    if (subject.startsWith('inbox.')) {
        const idx = subject.lastIndexOf('.');
        return subject.slice(0, idx);
    }
    return subject;
}
