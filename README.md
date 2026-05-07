# calculator

> IRC math expression evaluator powered by mathjs.

## Overview

The calculator module provides in-chat mathematical expression evaluation for the eevee platform. When a user issues a `!calc` or `!c` command, the module parses and evaluates the expression using [mathjs](https://mathjs.org/) and returns the result directly in the channel.

It integrates with the eevee ecosystem via NATS: the router forwards matching command messages, calculator evaluates the expression, and sends the result back through the chat connector. Like all eevee modules, it exposes Prometheus-compatible metrics, health checks, and help registration.

Factorial operations (`!` and `factorial()`) are explicitly disabled to prevent abuse (e.g., computing astronomically large numbers that could degrade performance).

## Features

- **Mathematical expression evaluation** — arbitrary expressions via mathjs (arithmetic, trigonometry, logarithms, constants, and more)
- **Two command aliases** — `!calc` and `!c` for quick access
- **Rate limiting** — configurable per-command rate limits to prevent spam
- **Error reporting** — parse and evaluation errors surfaced inline in chat
- **Factorial protection** — `!` and `factorial` blocked to prevent resource abuse
- **Prometheus metrics** — command counts, processing time, error rates by platform/network/channel
- **Help registration** — automatic `!help calc` documentation
- **Stats endpoints** — uptime and module stats via NATS

## Install

This module is part of the eevee ecosystem and is not published independently.

```bash
# From the eevee project root
cd calculator
npm install
```

## Configuration

Configuration is loaded via `loadModuleConfig` from `@eeveebot/libeevee`. The following options are supported:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ratelimit` | `RateLimitConfig` | `defaultRateLimit` | Rate limiting for the `calc` command (inherits the eevee default if unset) |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HTTP_API_PORT` | `9003` | Port for the metrics/health HTTP server |
| `NATS_URL` | _(libeevee default)_ | NATS server URL |

## Usage / Commands

### `!calc <expression>`

Evaluates a mathematical expression and returns the result.

### `!c <expression>`

Alias for `!calc`.

### Examples

```
<user> !calc 2 + 2
<eevee> 4

<user> !calc sqrt(144)
<eevee> 12

<user> !c sin(pi / 2)
<eevee> 1

<user> !calc 1.5 * 10^6
<eevee> 1500000

<user> !calc log(100, 10)
<eevee> 2

<user> !calc 5!
<eevee> Error: Factorials disabled

<user> !calc factorial(5)
<eevee> Error: Factorials disabled

<user> !calc undefined_function(x)
<eevee> Error: Undefined symbol undefined_function
```

### Supported Operations

Since calculator delegates to mathjs, it supports the full [mathjs expression syntax](https://mathjs.org/docs/expressions/syntax.html), including:

- **Arithmetic:** `+`, `-`, `*`, `/`, `^`, `%`, `mod`
- **Trigonometry:** `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, etc.
- **Logarithms:** `log(x)`, `log(x, base)`, `log10`, `log2`
- **Roots & powers:** `sqrt`, `cbrt`, `nthRoot`, `pow`
- **Constants:** `pi`, `e`, `phi`, `Infinity`, `NaN`
- **Rounding:** `round`, `ceil`, `floor`, `fix`
- **Combinatorics:** `combinations`, `permutations` (factorial is disabled)
- **Units:** `5.4 kg to lb`, `2 inch to cm`

## Architecture

```
IRC/Discord ──▶ Connector ──▶ Router ──▶ NATS ──▶ Calculator
                     ▲                              │
                     └──────── NATS ◄───────────────┘
```

1. **Router** matches incoming messages against the `^(calc|c)\s+` regex and publishes a `command.execute.<uuid>` NATS message.
2. **Calculator** subscribes to that subject, parses the JSON payload, and extracts the expression from `data.text`.
3. The expression is evaluated via `mathjs.evaluate()`. Factorial operations are blocked before evaluation.
4. The result (or error message) is sent back to the originating channel via `sendChatMessage`.
5. Metrics are recorded for every invocation: success, eval error, or parse error, along with processing duration.

### Key Components

| Component | Purpose |
|-----------|---------|
| `registerCommand` | Registers the `calc`/`c` command with the router via NATS |
| `evaluate` (mathjs) | Core expression evaluation engine |
| `sendChatMessage` | Returns results to the chat connector |
| `registerHelp` | Publishes help entries for `!help calc` |
| `registerStatsHandlers` | Handles `stats.uptime` and `stats.emit.request` |
| `createModuleMetrics` | Prometheus-compatible metrics collection |

## Development

```bash
cd calculator
npm install
npm run build   # lint + compile TypeScript
npm run dev     # build + run locally
npm test        # lint only (eslint)
```

### Requirements

- Node.js ≥ 24.0.0
- Access to a running NATS server (for full integration testing)

## Contributing

Contributions are welcome! Please see the [eevee contributing guide](https://github.com/eeveebot/eevee) for details.

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — see [LICENSE](./LICENSE) for the full text.
