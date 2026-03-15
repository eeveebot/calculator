import {
  commandCounter,
  commandProcessingTime,
  commandErrorCounter,
  natsPublishCounter,
  natsSubscribeCounter,
  log,
} from '@eeveebot/libeevee';

// Function to record command execution
export function recordCalcCommand(
  platform: string,
  network: string,
  channel: string,
  result: string
): void {
  try {
    commandCounter.inc({
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
    commandProcessingTime.observe({ module: 'calculator' }, duration);
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
    commandErrorCounter.inc({
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