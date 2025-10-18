# Event hub setup

You can use multiple message brokers for the hub.

## NATS

### install

Install the server:
`brew install nats-server`

Install the CLI:
`brew install nats-io/nats-tools/nats`


### Start

`nats-server -c config.txt`

To check if the server is properly running:
`nats server check connection`

### Observe

`nats traffic`

## RabbitMQ (AMQP)

### install

You can use brew or simply use Docker.

### Start

First, run the RabbitMQ server:

```shell
docker run -p 5672:5672 -p 15672:15672 -p 15678:15678 rabbitmq:4-management
```

Then run a proxy for exposing the websocket protocol to the web browser app:
```shell
docker run --rm -it -p 15670:15670 cloudamqp/websocket-tcp-relay --upstream tcp://host.docker.internal:5672
```

Note that the port 15670 used for the proxy it the one we used in the `config.yaml` file:
```yaml
  type: amqp
  enableProtoBuf: true
  protocols:
    #...
    websockets:
      server: ws://localhost:15670/ws
```

### Observe

Visit the console of RabbitMQ: http://localhost:15672/
