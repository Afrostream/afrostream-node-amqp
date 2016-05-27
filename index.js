'use strict';

var amqp = require('amqplib');
var EventEmitter = require('events');
var util = require('util');
var domain = require('domain');

/**
 * @param options
 * {
 *   autoReconnect: boolean     (default true)
 *   displayErrors: boolean     (default true)
 *   endPoint: string           Mandatory
 * }
 * @constructor
 */
var AMQP = function (options) {
  this.autoReconnect = !(options.autoReconnect === false);
  this.displayErrors = !(options.displayErrors === false);
  if (!this.displayErrors) {
    console.log('[WARNING]: [AMQP]: displayErrors is off, amqp will be silent');
  }
  this.silent = options.silent;
  this.endPoint = options.endPoint;
  this.conn = null;
  this.reopenId = null;
  this.channel = null;
};

// AMQP will be an event emitter
util.inherits(AMQP, EventEmitter);

/**
 * this function will open a connection & create a channel.
 * it will try to re-open & re-create a channel on every errors.
 *
 * @returns {*}
 *
 */
AMQP.prototype.open = function () {
  var that = this;

  var onError = function (err) {
    if (that.displayErrors) {
      console.error('[ERROR]: [AMQP]: ', err);
    }
    that.channel = null;
    that.conn = null;
    that.emit('connection.closed');
    that.reopen();
  };

  // catchall
  var dom = domain.create();
  dom.on('error', onError);

  //
  return amqp.connect(this.endPoint)
    .then(
    function (conn) {
      if (!that.silent) {
        console.log('[INFO]: [AMQP]: connected to AMQP ' + that.endPoint);
      }
      that.conn = conn;
      that.conn.on('error', onError);
      that.emit('connection.opened');
      return that.conn.createChannel();
    }
  )
    .then(
    function (channel) {
      if (!that.silent) {
        console.log('[INFO]: [AMQP]: channel opened');
      }
      that.channel = channel;
      that.channel.on('error', onError);
      that.channel.on('close', onError);
      that.emit('channel.opened');
      return channel;
    }
  )
    .then(
    function (channel) {
      return channel;
    },
    onError
  );
};

AMQP.prototype.reopen = function () {
  var that = this;

  if (!this.autoReconnect) {
    console.log('[WARNING]: [AMQP]: reconnection aborded (autoreconnect is off)');
    return this;
  }
  if (this.reopenId) {
    console.log('[WARNING]: [AMQP]:  already reopening connection');
  } else {
    console.log('[WARNING]: [AMQP]:  try to reopen connection in 500ms');
    this.reopenId = setTimeout(function () {
      that.reopenId = null;
      that.open();
    }, 500);
  }
  return this;
};

AMQP.prototype.drain = function (options) {
  if (!options ||
      !options.exchangeName || !options.queueName) {
    throw new Error('missing exchange/queue name');
  }

  var that = this;
  var exchangeName = options.exchangeName;
  var queueName = options.queueName;

  // CHANNEL OPEN => DRAIN
  this.on('channel.opened', function () {
    that.channel.assertExchange(exchangeName, 'fanout', { durable: true });
    that.channel.assertQueue(queueName, { durable: true });
    that.channel.bindQueue(queueName, exchangeName);
    that.channel.consume(queueName, function (message) {
      if (!that.silent) {
        console.log('[INFO]: [AMQP]: message = ' + String(message.content));
      }
      that.channel.ack(message);
      try {
        const unserialized = JSON.parse(String(message.content));
        that.emit('message', unserialized);
      } catch (e) {
        console.log('[ERROR]: [AMQP]: cannot parse message ' + String(message.content));
      }
    });
    if (!that.silent) {
      console.log('[INFO]: [AMQP]: channel.opened, consuming '+ queueName);
    }
  });
  this.open();
};

module.exports = AMQP;