# echo

Echo module

Listens for messages matching "echo " and echoes them back.

## Environment Variables

- `NATS_HOST` - NATS server hostname (required)
- `NATS_TOKEN` - NATS authentication token (required)
- `MODULE_CONFIG_PATH` - Path to the YAML configuration file (optional)

## Configuration

The echo module can be configured using a YAML file specified by the `MODULE_CONFIG_PATH` environment variable.

Example configuration:

```yaml
# Rate limit configuration
ratelimit:
  mode: drop
  level: user
  limit: 5
  interval: 1m
```

If no configuration file is provided, the module will use default rate limiting settings.