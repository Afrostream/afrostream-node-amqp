# Description

AMQP client  
high level functionnality over amqplib :  
 - auto reconnect  
 - easy drain  

# Usage

## Low level

```js
// creating mq
var AMQP = require('afrostream-node-amqp');
var mq = new AMQP('amqp://localhost');

// CHANNEL OPEN => DRAIN
mq.on('channel.opened', function () {
    mq.channel.assertExchange("exchange", 'fanout', { durable: true });
    mq.channel.assertQueue("queue", { durable: true });
    mq.channel.bindQueue("queue", "exchange");
    mq.channel.consume("queue", function (message) {
      console.log('[INFO]: [MQ]: message = ' + String(message.content));
      mq.channel.ack(message);
      //
      // Do what you want here
      //
    });
    console.log('[INFO]: [MQ]: channel.opened, consuming '+ "queue");
});

mq.open();
```

## High level

```js
var AMQP = require('afrostream-node-amqp');
var mq = new AMQP('amqp://localhost');
mq.drain({exchangeName: "exchange", queueName: "queue"});
mq.on('message', function (message) {
  console.log('[INFO]: [MQ]: message received !');
  //
  // Do what you want here
  //
});
```