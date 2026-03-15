import {
  Counter,
  Histogram,
  log,
  natsPublishCounter,
  natsSubscribeCounter,
} from '@eeveebot/libeevee';

// Calculator module specific metrics
export const calcCommandCounter = new Counter({
  name: 'calc_commands_total',
  help: 'Total number of calc commands processed',
  labelNames: ['module', 'platform', 'network', 'channel', 'result'],
});

export const calcProcessingTime = new Histogram({
  name: 'calc_processing_seconds',
  help: 'Time spent processing calc commands',
  labelNames: ['module'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
});

export const calcErrorCounter = new Counter({
  name: 'calc_errors_total',
  help: 'Total number of calc errors encountered',
  labelNames: ['module', 'type'],
});

// Function to record command execution
export function recordCalcCommand(
  platform: string,
  network: string,
  channel: string,
  result: string
): void {
  try {
    calcCommandCounter.inc({
      module: 'calculator',
      platform,
      network,
      channel,
      result,
    });
  } catch (error) {
    log.error('Failed to record calc command metric', {
      producer: 'calculator-metrics',
      error,
    });
  }
}

// Function to record processing time
export function recordProcessingTime(duration: number): void {
  try {
    calcProcessingTime.observe({ module: 'calculator' }, duration);
  } catch (error) {
    log.error('Failed to record calc processing time metric', {
      producer: 'calculator-metrics',
      error,
    });
  }
}

// Function to record errors
export function recordCalcError(errorType: string): void {
  try {
    calcErrorCounter.inc({
      module: 'calculator',
      type: errorType,
    });
  } catch (error) {
    log.error('Failed to record calc error metric', {
      producer: 'calculator-metrics',
      error,
    });
  }
}

// Function to record NATS publish operations
export function recordNatsPublish(subject: string, messageType: string): void {
  try {
    natsPublishCounter.inc({
      module: 'calculator',
      type: messageType,
    });
  } catch (error) {
    log.error('Failed to record NATS publish metric', {
      producer: 'calculator-metrics',
      error,
    });
  }
}

// Function to record NATS subscribe operations
export function recordNatsSubscribe(subject: string): void {
  try {
    natsSubscribeCounter.inc({
      module: 'calculator',
      subject: subject,
    });
  } catch (error) {
    log.error('Failed to record NATS subscribe metric', {
      producer: 'calculator-metrics',
      error,
    });
  }
}
