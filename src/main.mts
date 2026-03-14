'use strict';

// Calculator module
// Evaluates mathematical expressions using mathjs

import fs from 'node:fs';
import yaml from 'js-yaml';
import { NatsClient, log } from '@eeveebot/libeevee';
import { evaluate } from 'mathjs';

// Record module startup time for uptime tracking
const moduleStartTime = Date.now();

const calcCommandUUID = 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e';
const calcCommandDisplayName = 'calc';

// Rate limit configuration interface
interface RateLimitConfig {
  mode: 'enqueue' | 'drop';
  level: 'channel' | 'user' | 'global';
  limit: number;
  interval: string; // e.g., "30s", "1m", "5m"
}

// Calculator module configuration interface
interface CalculatorConfig {
  ratelimit?: RateLimitConfig;
}

const natsClients: InstanceType<typeof NatsClient>[] = [];
const natsSubscriptions: Array<Promise<string | boolean>> = [];

/**
 * Load calculator configuration from YAML file
 * @returns CalculatorConfig parsed from YAML file
 */
function loadCalculatorConfig(): CalculatorConfig {
  // Get the config file path from environment variable
  const configPath = process.env.MODULE_CONFIG_PATH;
  if (!configPath) {
    log.warn('MODULE_CONFIG_PATH not set, using default rate limit config', {
      producer: 'calculator',
    });
    return {};
  }

  try {
    // Read the YAML file
    const configFile = fs.readFileSync(configPath, 'utf8');

    // Parse the YAML content
    const config = yaml.load(configFile) as CalculatorConfig;

    log.info('Loaded calculator configuration', {
      producer: 'calculator',
      configPath,
    });

    return config;
  } catch (error) {
    log.error('Failed to load calculator configuration, using defaults', {
      producer: 'calculator',
      configPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

//
// Do whatever teardown is necessary before calling common handler
process.on('SIGINT', () => {
  natsClients.forEach((natsClient) => {
    void natsClient.drain();
  });
});

process.on('SIGTERM', () => {
  natsClients.forEach((natsClient) => {
    void natsClient.drain();
  });
});

//
// Setup NATS connection

// Get host and token
const natsHost = process.env.NATS_HOST || false;
if (!natsHost) {
  const msg = 'environment variable NATS_HOST is not set.';
  throw new Error(msg);
}

const natsToken = process.env.NATS_TOKEN || false;
if (!natsToken) {
  const msg = 'environment variable NATS_TOKEN is not set.';
  throw new Error(msg);
}

const nats = new NatsClient({
  natsHost: natsHost as string,
  natsToken: natsToken as string,
});
natsClients.push(nats);
await nats.connect();

// Load configuration at startup
const calculatorConfig = loadCalculatorConfig();

// Function to register the calc command with the router
async function registerCalcCommand(): Promise<void> {
  // Default rate limit configuration
  const defaultRateLimit = {
    mode: 'drop',
    level: 'user',
    limit: 5,
    interval: '1m',
  };

  // Use configured rate limit or default
  const rateLimitConfig = calculatorConfig.ratelimit || defaultRateLimit;

  const commandRegistration = {
    type: 'command.register',
    commandUUID: calcCommandUUID,
    commandDisplayName: calcCommandDisplayName,
    platform: '.*', // Match all platforms
    network: '.*', // Match all networks
    instance: '.*', // Match all instances
    channel: '.*', // Match all channels
    user: '.*', // Match all users
    regex: '(calc|c) ', // Match calc or c - trailing whitespace intentional
    platformPrefixAllowed: true,
    ratelimit: rateLimitConfig,
  };

  try {
    await nats.publish('command.register', JSON.stringify(commandRegistration));
    log.info('Registered calc command with router', {
      producer: 'calculator',
      ratelimit: rateLimitConfig,
    });
  } catch (error) {
    log.error('Failed to register calc command', {
      producer: 'calculator',
      error: error,
    });
  }
}

// Register commands at startup
await registerCalcCommand();

// Subscribe to command execution messages
const calcCommandSub = nats.subscribe(
  `command.execute.${calcCommandUUID}`,
  (subject, message) => {
    try {
      const data = JSON.parse(message.string());
      log.info('Received command.execute for calc', {
        producer: 'calculator',
        platform: data.platform,
        instance: data.instance,
        channel: data.channel,
        user: data.user,
        originalText: data.originalText,
      });

      // Process the calculation
      const expression = data.text.trim();

      // Check for factorial operations which are disabled
      if (expression.includes('!') || expression.includes('factorial')) {
        const response = {
          channel: data.channel,
          network: data.network,
          instance: data.instance,
          platform: data.platform,
          text: 'Error: Factorials disabled',
          trace: data.trace,
          type: 'message.outgoing',
        };

        const outgoingTopic = `chat.message.outgoing.${data.platform}.${data.instance}.${data.channel}`;
        void nats.publish(outgoingTopic, JSON.stringify(response));
        return;
      }

      try {
        // Evaluate the mathematical expression
        const result = evaluate(expression);

        // Send result back on chat.message.outgoing.$PLATFORM.$INSTANCE.$CHANNEL
        const response = {
          channel: data.channel,
          network: data.network,
          instance: data.instance,
          platform: data.platform,
          text: result.toString(),
          trace: data.trace,
          type: 'message.outgoing',
        };

        const outgoingTopic = `chat.message.outgoing.${data.platform}.${data.instance}.${data.channel}`;
        void nats.publish(outgoingTopic, JSON.stringify(response));
      } catch (evalError) {
        // Handle evaluation errors
        const response = {
          channel: data.channel,
          network: data.network,
          instance: data.instance,
          platform: data.platform,
          text: `Error: ${(evalError as Error).message}`,
          trace: data.trace,
          type: 'message.outgoing',
        };

        const outgoingTopic = `chat.message.outgoing.${data.platform}.${data.instance}.${data.channel}`;
        void nats.publish(outgoingTopic, JSON.stringify(response));
      }
    } catch (error) {
      log.error('Failed to parse message', {
        producer: 'calculator',
        message: message.string(),
        error: error,
      });
    }
  }
);
natsSubscriptions.push(calcCommandSub);

// Subscribe to control messages for re-registering commands
const controlSubRegisterCommandCalc = nats.subscribe(
  `control.registerCommands.${calcCommandDisplayName}`,
  () => {
    log.info(
      `Received control.registerCommands.${calcCommandDisplayName} control message`,
      {
        producer: 'calculator',
      }
    );
    void registerCalcCommand();
  }
);
natsSubscriptions.push(controlSubRegisterCommandCalc);

const controlSubRegisterCommandAll = nats.subscribe(
  'control.registerCommands',
  () => {
    log.info('Received control.registerCommands control message', {
      producer: 'calculator',
    });
    void registerCalcCommand();
  }
);
natsSubscriptions.push(controlSubRegisterCommandAll);

// Subscribe to stats.uptime messages and respond with module uptime
const statsUptimeSub = nats.subscribe('stats.uptime', (subject, message) => {
  try {
    const data = JSON.parse(message.string());
    log.info('Received stats.uptime request', {
      producer: 'calculator',
      replyChannel: data.replyChannel,
    });

    // Calculate uptime in milliseconds
    const uptime = Date.now() - moduleStartTime;

    // Send uptime back via the ephemeral reply channel
    const uptimeResponse = {
      module: 'calculator',
      uptime: uptime,
      uptimeFormatted: `${Math.floor(uptime / 86400000)}d ${Math.floor((uptime % 86400000) / 3600000)}h ${Math.floor((uptime % 3600000) / 60000)}m ${Math.floor((uptime % 60000) / 1000)}s`,
    };

    if (data.replyChannel) {
      void nats.publish(data.replyChannel, JSON.stringify(uptimeResponse));
    }
  } catch (error) {
    log.error('Failed to process stats.uptime request', {
      producer: 'calculator',
      error: error,
    });
  }
});
natsSubscriptions.push(statsUptimeSub);

// Help information for calculator commands
const calculatorHelp = [
  {
    command: 'calc',
    descr: 'Evaluate a math expression with mathJS',
    params: [
      {
        param: 'expression',
        required: true,
        descr: 'Expression to evaluate',
      },
    ],
  },
  {
    command: 'c',
    descr: 'Alias to calc command',
    params: [
      {
        param: 'expression',
        required: true,
        descr: 'Expression to evaluate',
      },
    ],
  },
];

// Function to publish help information
async function publishHelp(): Promise<void> {
  const helpUpdate = {
    from: 'calculator',
    help: calculatorHelp,
  };

  try {
    await nats.publish('_help.update', JSON.stringify(helpUpdate));
    log.info('Published calculator help information', {
      producer: 'calculator',
    });
  } catch (error) {
    log.error('Failed to publish calculator help information', {
      producer: 'calculator',
      error: error,
    });
  }
}

// Publish help information at startup
await publishHelp();

// Subscribe to help update requests
const helpUpdateRequestSub = nats.subscribe('_help.updateRequest', () => {
  log.info('Received _help.updateRequest message', {
    producer: 'calculator',
  });
  void publishHelp();
});
natsSubscriptions.push(helpUpdateRequestSub);
