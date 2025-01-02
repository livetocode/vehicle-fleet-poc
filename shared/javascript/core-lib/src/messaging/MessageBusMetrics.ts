export type MessageBusMetrics = {
    publish(subject: string, messageType: string): void;
    processMessage(subject: string, messageType: string, status: string, elapsedTimeInMS?: number): void;
}
