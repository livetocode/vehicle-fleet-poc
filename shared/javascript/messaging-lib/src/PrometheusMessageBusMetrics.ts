import { MessageBusMetrics } from 'core-lib';
import prom_client from 'prom-client';

const message_sent_counter = new prom_client.Counter({
    name: 'vehicles_message_sent_total',
    help: 'number of messages sent by the vehicle services',
    labelNames: ['subject', 'message_type'],
});

const message_received_counter = new prom_client.Counter({
    name: 'vehicles_message_received_total',
    help: 'number of messages received by the vehicle services',
    labelNames: ['subject', 'message_type', 'status'],
});

const message_received_duration_msec = new prom_client.Gauge({
    name: 'vehicles_message_received_duration',
    help: 'number of messages received by the vehicle services',
    labelNames: ['subject', 'message_type', 'status'],
});

export class PrometheusMessageBusMetrics implements MessageBusMetrics {
    publish(subject: string, messageType: string): void {
        message_sent_counter.inc({
            subject, 
            message_type: messageType,
        })

    }

    processMessage(subject: string, messageType: string, status: string, elapsedTimeInMS?: number): void {
        message_received_counter.inc({
            subject, 
            message_type: messageType,
            status,
        });
        if (elapsedTimeInMS) {
            message_received_duration_msec.set({
                subject, 
                message_type: messageType,
                status,
            }, elapsedTimeInMS);
        }
    }
}